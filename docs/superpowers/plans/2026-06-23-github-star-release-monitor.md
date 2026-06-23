# GitHub Star Release Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Edge extension that monitors starred GitHub repos for new releases, checks hourly, and pushes system notifications. Uses Side Panel for UI.

**Architecture:** Manifest V3 ES Module Service Worker with chrome.alarms for scheduling, chrome.storage.local for persistence, chrome.identity for GitHub OAuth, chrome.sidePanel for UI, and chrome.notifications for alerts.

**Tech Stack:** Manifest V3 (ES Module SW), vanilla JS (ES2020+), no npm/build dependencies, pure Chrome Extension APIs.

## Global Constraints

- No npm dependencies — all vanilla JS
- Manifest V3 only, ES Module mode (`"type": "module"` in background config)
- Service Worker uses `import` syntax, utils use `export` syntax
- Side Panel UI (chrome.sidePanel API), NOT popup
- All API calls must have timeout handling (5s connectivity, 10s data)
- Color scheme: light mode, GitHub-inspired
- No fixed width on UI — side panel fills available space

---

### Task 1: 项目骨架 & manifest.json

**Files:**
- Create: `github-star-monitor/manifest.json`

**Interfaces:**
- Produces: manifest with all permissions, ES Module SW, side panel config

- [ ] **Step 1: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "GitHub Star Release Monitor",
  "version": "1.0.0",
  "description": "监控 GitHub Star 仓库的新 Release，整点推送通知",
  "permissions": ["storage", "alarms", "notifications", "identity", "sidePanel"],
  "host_permissions": ["https://api.github.com/*", "https://github.com/*"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "action": {
    "default_title": "GitHub Star Monitor",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/manifest.json
git commit -m "chore: scaffold extension with manifest.json (ES Module + Side Panel)"
```

---

### Task 2: Storage 封装

**Files:**
- Create: `github-star-monitor/utils/storage.js`

**Interfaces:**
- Produces (all `export`):
  - `getToken()` → Promise<string|null>
  - `setToken(token)` → Promise<void>
  - `getUser()` → Promise<string|null>
  - `setUser(username)` → Promise<void>
  - `getLastCheckTime()` → Promise<string|null>
  - `setLastCheckTime(isoString)` → Promise<void>
  - `getKnownReleases()` → Promise<Object> — { "owner/repo": "tag" }
  - `getPendingUpdates()` → Promise<Array>
  - `mergeNewReleases(allStarredRepos, newReleases)` → Promise<Array>
  - `getLastCheckStatus()` → Promise<string|null>
  - `setLastCheckStatus(status)` → Promise<void>
  - `clearUpdates()` → Promise<void>

- [ ] **Step 1: Write storage.js**

```js
// utils/storage.js

const STORAGE_KEYS = {
  TOKEN: 'github_token',
  USER: 'github_user',
  LAST_CHECK_TIME: 'last_check_time',
  KNOWN_RELEASES: 'known_releases',
  PENDING_UPDATES: 'pending_updates',
  LAST_CHECK_STATUS: 'last_check_status'
};

export async function getToken() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TOKEN);
  return result[STORAGE_KEYS.TOKEN] || null;
}

export async function setToken(token) {
  await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: token });
}

export async function getUser() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER);
  return result[STORAGE_KEYS.USER] || null;
}

export async function setUser(username) {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER]: username });
}

export async function getLastCheckTime() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECK_TIME);
  return result[STORAGE_KEYS.LAST_CHECK_TIME] || null;
}

export async function setLastCheckTime(isoString) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CHECK_TIME]: isoString });
}

export async function getKnownReleases() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.KNOWN_RELEASES);
  return result[STORAGE_KEYS.KNOWN_RELEASES] || {};
}

export async function getPendingUpdates() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_UPDATES);
  return result[STORAGE_KEYS.PENDING_UPDATES] || [];
}

export async function mergeNewReleases(allStarredRepos, newReleases) {
  const known = await getKnownReleases();
  const existing = await getPendingUpdates();
  const genuinelyNew = [];

  for (const rel of newReleases) {
    const prev = known[rel.repo];
    if (!prev || prev !== rel.tag) {
      known[rel.repo] = rel.tag;
      genuinelyNew.push({ ...rel, detected_at: new Date().toISOString() });
    }
  }

  const starredSet = new Set(allStarredRepos.map(r => r.full_name));
  for (const key of Object.keys(known)) {
    if (!starredSet.has(key)) delete known[key];
  }

  const merged = [...genuinelyNew, ...existing];
  await chrome.storage.local.set({
    [STORAGE_KEYS.KNOWN_RELEASES]: known,
    [STORAGE_KEYS.PENDING_UPDATES]: merged
  });

  return genuinelyNew;
}

export async function clearUpdates() {
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_UPDATES]: [] });
}

export async function getLastCheckStatus() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECK_STATUS);
  return result[STORAGE_KEYS.LAST_CHECK_STATUS] || null;
}

export async function setLastCheckStatus(status) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CHECK_STATUS]: status });
}
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/utils/storage.js
git commit -m "feat: add storage utility for chrome.storage.local"
```

---

### Task 3: GitHub API 封装

**Files:**
- Create: `github-star-monitor/utils/github-api.js`

**Interfaces:**
- Produces (all `export`):
  - `checkConnectivity()` → Promise<boolean>
  - `getStarredRepos(token)` → Promise<Array>
  - `getLatestRelease(token, owner, repo)` → Promise<Object|null>

- [ ] **Step 1: Write github-api.js**

```js
// utils/github-api.js

const GITHUB_API = 'https://api.github.com';
const CONNECTIVITY_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 10000;

async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkConnectivity() {
  try {
    const response = await fetchWithTimeout(
      GITHUB_API,
      { headers: {} },
      CONNECTIVITY_TIMEOUT
    );
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
}

export async function getStarredRepos(token) {
  const repos = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchWithTimeout(
      `${GITHUB_API}/user/starred?per_page=${perPage}&page=${page}&sort=updated`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch starred repos: ${response.status}`);
    }

    const data = await response.json();
    repos.push(...data.map(r => ({
      full_name: r.full_name,
      owner: r.owner.login,
      name: r.name,
      html_url: r.html_url
    })));

    hasMore = data.length === perPage;
    page++;
  }

  return repos;
}

export async function getLatestRelease(token, owner, repo) {
  const response = await fetchWithTimeout(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=3`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch releases for ${owner}/${repo}: ${response.status}`);
  }

  const releases = await response.json();
  if (releases.length === 0) return null;

  const latest = releases[0];
  return {
    repo: `${owner}/${repo}`,
    tag: latest.tag_name,
    name: latest.name || latest.tag_name,
    url: latest.html_url,
    published_at: latest.published_at
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/utils/github-api.js
git commit -m "feat: add GitHub API utilities with timeout handling"
```

---

### Task 4: 通知模块

**Files:**
- Create: `github-star-monitor/utils/notifications.js`

**Interfaces:**
- Produces: `notifyUpdates(updates)` → void

- [ ] **Step 1: Write notifications.js**

```js
// utils/notifications.js

export function notifyUpdates(updates) {
  if (!updates || updates.length === 0) return;

  if (updates.length === 1) {
    const u = updates[0];
    chrome.notifications.create(`release-${u.repo.replace('/', '-')}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${u.repo} 发布新 Release`,
      message: `${u.name || u.tag}`,
      priority: 2
    });
  } else {
    const repoList = updates.map(u => `${u.repo} -> ${u.tag}`).join('\n');
    chrome.notifications.create(`release-summary-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${updates.length} 个仓库有新 Release`,
      message: repoList.slice(0, 200),
      priority: 2
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/utils/notifications.js
git commit -m "feat: add notification utility"
```

---

### Task 5: Service Worker (后台核心逻辑)

**Files:**
- Create: `github-star-monitor/background.js`

**Interfaces:**
- Consumes: all functions from storage.js, github-api.js, notifications.js (via `import`)
- Produces: Alarm scheduling, OAuth flow, release check logic, message handler, side panel opener
- `chrome.alarms` with name `"check-releases"`
- `chrome.runtime.onMessage` handles: `"startOAuth"`, `"checkNow"`, `"getStatus"`, `"logout"`
- `chrome.action.onClicked` opens side panel

- [ ] **Step 1: Write background.js (complete file)**

```js
// background.js — ES Module mode

import {
  getToken, setToken, getUser, setUser,
  getLastCheckTime, setLastCheckTime,
  getKnownReleases, getPendingUpdates, mergeNewReleases,
  getLastCheckStatus, setLastCheckStatus
} from './utils/storage.js';

import {
  checkConnectivity, getStarredRepos, getLatestRelease
} from './utils/github-api.js';

import { notifyUpdates } from './utils/notifications.js';

const ALARM_NAME = 'check-releases';
const ONE_HOUR_MS = 60 * 60 * 1000;

const GITHUB_OAUTH = {
  clientId: 'YOUR_GITHUB_CLIENT_ID',
  redirectUri: chrome.identity.getRedirectURL('oauth2'),
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token'
};

function setupAlarm() {
  chrome.alarms.clear(ALARM_NAME, () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const delayMinutes = (nextHour - now) / 60000;

    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: 60,
      delayInMinutes: delayMinutes
    });
    console.log(`[Monitor] Alarm set for ${nextHour.toISOString()} (in ${Math.round(delayMinutes)}min)`);
  });
}

async function performCheck() {
  console.log('[Monitor] Starting release check...');

  const token = await getToken();
  if (!token) {
    await setLastCheckStatus('no_token');
    console.log('[Monitor] No token, skipping check');
    return;
  }

  const connected = await checkConnectivity();
  if (!connected) {
    await setLastCheckStatus('network_error');
    console.log('[Monitor] GitHub unreachable, skipping check');
    return;
  }

  try {
    const repos = await getStarredRepos(token);
    console.log(`[Monitor] Found ${repos.length} starred repos`);

    const newReleases = [];
    for (const repo of repos) {
      try {
        const release = await getLatestRelease(token, repo.owner, repo.name);
        if (release) {
          newReleases.push(release);
        }
      } catch (err) {
        console.warn(`[Monitor] Failed for ${repo.full_name}:`, err.message);
      }
    }

    const genuinelyNew = await mergeNewReleases(
      repos.map(r => r.full_name),
      newReleases
    );

    if (genuinelyNew.length > 0) {
      console.log(`[Monitor] Found ${genuinelyNew.length} new release(s)`);
      notifyUpdates(genuinelyNew);
    } else {
      console.log('[Monitor] No new releases');
    }

    await setLastCheckTime(new Date().toISOString());
    await setLastCheckStatus('success');
  } catch (err) {
    console.error('[Monitor] Check failed:', err);
    await setLastCheckStatus('error');
  }
}

async function startOAuth() {
  const authUrl = new URL(GITHUB_OAUTH.authUrl);
  authUrl.searchParams.set('client_id', GITHUB_OAUTH.clientId);
  authUrl.searchParams.set('redirect_uri', GITHUB_OAUTH.redirectUri);
  authUrl.searchParams.set('scope', 'read:user');
  authUrl.searchParams.set('state', Math.random().toString(36).substring(2));

  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('No authorization code received');
    }

    const tokenResponse = await fetch(GITHUB_OAUTH.tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH.clientId,
        client_secret: 'YOUR_GITHUB_CLIENT_SECRET',
        code: code,
        redirect_uri: GITHUB_OAUTH.redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.access_token) {
      await setToken(tokenData.access_token);

      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      const userData = await userResponse.json();
      await setUser(userData.login);

      await performCheck();
      return { success: true, user: userData.login };
    }
    throw new Error('Failed to get access token');
  } catch (err) {
    console.error('[Monitor] OAuth failed:', err);
    return { success: false, error: err.message };
  }
}

// Click action icon -> open side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel globally
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Alarm: hourly check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    performCheck();
  }
});

// Message handler: sidepanel -> SW
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'startOAuth':
        const result = await startOAuth();
        sendResponse(result);
        break;

      case 'checkNow':
        await performCheck();
        const updates = await getPendingUpdates();
        const status = await getLastCheckStatus();
        const time = await getLastCheckTime();
        sendResponse({ updates, status, lastCheckTime: time });
        break;

      case 'getStatus':
        const s = await getLastCheckStatus();
        const t = await getLastCheckTime();
        const u = await getPendingUpdates();
        const user = await getUser();
        const token = await getToken();
        sendResponse({ status: s, lastCheckTime: t, updates: u, user, hasToken: !!token });
        break;

      case 'logout':
        await chrome.storage.local.clear();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});

// Install/Update: register alarm + startup check
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Monitor] Extension installed/updated:', details.reason);
  setupAlarm();

  const lastCheckTime = await getLastCheckTime();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > ONE_HOUR_MS) {
    await performCheck();
  }
});

// Browser startup: catch-up check
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Monitor] Browser started');
  setupAlarm();

  const lastCheckTime = await getLastCheckTime();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > ONE_HOUR_MS) {
    await performCheck();
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/background.js
git commit -m "feat: add ES module service worker with alarms, OAuth, side panel, and release checks"
```

---

### Task 6: Side Panel UI

**Files:**
- Create: `github-star-monitor/sidepanel/sidepanel.html`
- Create: `github-star-monitor/sidepanel/sidepanel.css`
- Create: `github-star-monitor/sidepanel/sidepanel.js`

**Interfaces:**
- Consumes: `chrome.runtime.sendMessage` to communicate with background.js
- Produces: Full side panel UI (no fixed width, fills available space)

- [ ] **Step 1: Write sidepanel.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div id="app">
    <header class="header">
      <h1 class="title">GitHub Star Monitor</h1>
      <span class="status-dot" id="statusDot"></span>
    </header>

    <section class="auth-section" id="authSection">
      <div class="auth-connected" id="authConnected" style="display:none">
        <span class="connected-icon">&#9679;</span>
        <span id="authUser">已连接</span>
      </div>
      <button class="auth-btn" id="authBtn" style="display:none">
        连接 GitHub 账号
      </button>
    </section>

    <section class="actions">
      <button class="check-btn" id="checkBtn">
        &#x21bb; 手动检查更新
      </button>
      <div class="check-status" id="checkStatus">
        <span id="checkTime">上次检查: --</span>
        <span id="checkResult"></span>
      </div>
    </section>

    <section class="updates-section">
      <h2 class="section-title">最新 Release 更新</h2>
      <div class="update-list" id="updateList">
        <div class="empty-state" id="emptyState">
          &#x1f7e2; 暂无更新
        </div>
        <div class="error-state" id="errorState" style="display:none">
          &#x26a0; 网络连接失败，请检查代理后重试
        </div>
        <div class="error-state" id="noTokenState" style="display:none">
          &#x1f511; 请先连接 GitHub 账号
        </div>
      </div>
    </section>

    <footer class="footer">
      <button class="logout-btn" id="logoutBtn" style="display:none">退出登录</button>
    </footer>
  </div>
  <script src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write sidepanel.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #24292f;
  background: #f6f8fa;
  min-height: 100vh;
}

#app {
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2328;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d0d7de;
}

.status-dot.connected {
  background: #1a7f37;
}

.auth-section {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

.auth-connected {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #1a7f37;
  font-weight: 500;
}

.connected-icon {
  font-size: 18px;
  line-height: 1;
}

.auth-btn {
  width: 100%;
  padding: 8px 16px;
  background: #2da44e;
  color: #fff;
  border: 1px solid #2c974b;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.auth-btn:hover {
  background: #2c974b;
}

.actions {
  margin-bottom: 16px;
}

.check-btn {
  width: 100%;
  padding: 10px 16px;
  background: #f6f8fa;
  color: #24292f;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.check-btn:hover {
  background: #eaeef2;
}

.check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.check-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: #656d76;
}

.check-result-success { color: #1a7f37; }
.check-result-error { color: #cf222e; }
.check-result-warning { color: #9a6700; }

.updates-section {
  flex: 1;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2328;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #d0d7de;
}

.update-list {
  flex: 1;
  overflow-y: auto;
}

.update-item {
  display: block;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  margin-bottom: 6px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.update-item:hover {
  background: #ddf4ff;
  border-color: #54aeff;
}

.update-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #0969da;
  margin-bottom: 2px;
}

.update-item-repo {
  font-size: 12px;
  color: #656d76;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.update-item-time {
  font-size: 11px;
  color: #656d76;
  margin-top: 4px;
}

.empty-state, .error-state {
  padding: 24px;
  text-align: center;
  color: #656d76;
  font-size: 13px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

.error-state {
  color: #cf222e;
  background: #fff1f0;
  border-color: #ffc1ba;
}

.footer {
  padding-top: 12px;
  border-top: 1px solid #d0d7de;
  text-align: right;
}

.logout-btn {
  padding: 4px 12px;
  background: none;
  color: #656d76;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.logout-btn:hover {
  color: #cf222e;
  border-color: #cf222e;
}

.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Write sidepanel.js**

```js
// sidepanel/sidepanel.js

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  await loadStatus();
  setupEventListeners();
}

async function loadStatus() {
  const status = await sendMessage({ action: 'getStatus' });

  const statusDot = document.getElementById('statusDot');
  const authConnected = document.getElementById('authConnected');
  const authBtn = document.getElementById('authBtn');
  const authUser = document.getElementById('authUser');
  const checkBtn = document.getElementById('checkBtn');
  const checkTime = document.getElementById('checkTime');
  const checkResult = document.getElementById('checkResult');
  const logoutBtn = document.getElementById('logoutBtn');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const noTokenState = document.getElementById('noTokenState');

  if (status.hasToken && status.user) {
    statusDot.classList.add('connected');
    authConnected.style.display = 'flex';
    authUser.textContent = '已连接: ' + status.user;
    authBtn.style.display = 'none';
    checkBtn.disabled = false;
    logoutBtn.style.display = 'inline-block';
  } else {
    statusDot.classList.remove('connected');
    authConnected.style.display = 'none';
    authBtn.style.display = 'block';
    checkBtn.disabled = true;
    logoutBtn.style.display = 'none';
  }

  if (status.lastCheckTime) {
    const time = new Date(status.lastCheckTime);
    checkTime.textContent = `上次检查: ${getRelativeTime(time)}`;
  }

  if (status.status === 'success') {
    checkResult.textContent = '成功';
    checkResult.className = 'check-result-success';
  } else if (status.status === 'network_error') {
    checkResult.textContent = '网络不通';
    checkResult.className = 'check-result-error';
  } else if (status.status === 'error') {
    checkResult.textContent = '检查失败';
    checkResult.className = 'check-result-error';
  }

  if (!status.hasToken) {
    noTokenState.style.display = 'block';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
  } else if (status.status === 'network_error') {
    errorState.style.display = 'block';
    emptyState.style.display = 'none';
    noTokenState.style.display = 'none';
  } else if (status.updates && status.updates.length > 0) {
    renderUpdateList(status.updates);
  } else {
    emptyState.style.display = 'block';
    errorState.style.display = 'none';
    noTokenState.style.display = 'none';
  }
}

function renderUpdateList(updates) {
  const updateList = document.getElementById('updateList');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const noTokenState = document.getElementById('noTokenState');

  [emptyState, errorState, noTokenState].forEach(el => el.style.display = 'none');
  updateList.querySelectorAll('.update-item').forEach(el => el.remove());

  updates
    .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
    .forEach(update => {
      const a = document.createElement('a');
      a.className = 'update-item';
      a.href = update.url;
      a.target = '_blank';
      a.innerHTML = `
        <div class="update-item-title">${escapeHtml(update.name || update.tag)}</div>
        <div class="update-item-repo">${escapeHtml(update.repo)}</div>
        <div class="update-item-time">${getRelativeTime(new Date(update.published_at))}</div>
      `;
      updateList.appendChild(a);
    });
}

function setupEventListeners() {
  document.getElementById('authBtn').addEventListener('click', async () => {
    const btn = document.getElementById('authBtn');
    btn.textContent = '正在连接...';
    btn.disabled = true;

    const result = await sendMessage({ action: 'startOAuth' });
    if (result.success) {
      await loadStatus();
    } else {
      btn.textContent = '连接失败，重试';
      btn.disabled = false;
    }
  });

  document.getElementById('checkBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spin">&#x21bb;</span> 检查中...';
    btn.disabled = true;

    const result = await sendMessage({ action: 'checkNow' });
    btn.innerHTML = originalText;
    btn.disabled = false;

    if (result.updates && result.updates.length > 0) {
      renderUpdateList(result.updates);
    }
    await loadStatus();
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sendMessage({ action: 'logout' });
    await loadStatus();
  });
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 4: Commit**

```bash
git add github-star-monitor/sidepanel/
git commit -m "feat: add side panel UI with status display and update list"
```

---

### Task 7: 图标生成

**Files:**
- Create: `github-star-monitor/icons/icon16.png`
- Create: `github-star-monitor/icons/icon48.png`
- Create: `github-star-monitor/icons/icon128.png`

- [ ] **Step 1: Generate icon files**

Use ImageGen to create a GitHub star-themed icon, then save as 16x16, 48x48, 128x128 PNGs.

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/icons/
git commit -m "feat: add extension icons"
```

---

### Task 8: 部署 & 安装说明

**Files:**
- Create: `github-star-monitor/README.md`

- [ ] **Step 1: Write README.md**

```markdown
# GitHub Star Release Monitor

Chrome/Edge 扩展，监控 GitHub Star 仓库的新 Release，整点自动检查并推送系统通知。

## 安装步骤

### 1. 创建 GitHub OAuth App

1. 打开 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息:
   - Application name: GitHub Star Monitor
   - Homepage URL: (任意)
   - Authorization callback URL: 从扩展的 background.js 控制台获取 redirectUri
4. 创建后获取 Client ID 和 Client Secret

### 2. 配置扩展

打开 `background.js`，替换以下值:
- `YOUR_GITHUB_CLIENT_ID` -> 你的 Client ID
- `YOUR_GITHUB_CLIENT_SECRET` -> 你的 Client Secret

### 3. 加载扩展

Chrome/Edge:
1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 开启 "开发者模式"
3. 点击 "加载已解压的扩展程序"
4. 选择 `github-star-monitor/` 目录

### 4. 首次使用

1. 点击工具栏扩展图标，打开侧边栏
2. 点击 "连接 GitHub 账号" 进行 OAuth 授权
3. 授权后自动检查一次，之后每小时整点自动检查

## 功能

- 每小时整点检查 Star 仓库的新 Release
- 浏览器启动时如距上次检查超 1 小时则立即补检
- 系统通知推送汇总更新
- 侧边栏展示更新列表，点击跳转仓库
- 手动检查按钮
- 网络超时自动跳过，不误报
```

- [ ] **Step 2: Commit**

```bash
git add github-star-monitor/README.md
git commit -m "docs: add setup instructions"
```

---

## Completion Checklist

- [ ] `manifest.json` — MV3, ES Module, sidePanel permission
- [ ] `background.js` — ES Module SW with import, alarms, OAuth, side panel, check logic
- [ ] `utils/storage.js` — chrome.storage.local wrapper (export)
- [ ] `utils/github-api.js` — fetch with timeout, starred repos, releases (export)
- [ ] `utils/notifications.js` — notification creation (export)
- [ ] `sidepanel/sidepanel.html` — layout structure
- [ ] `sidepanel/sidepanel.css` — responsive styles, no fixed width
- [ ] `sidepanel/sidepanel.js` — interactivity, messaging
- [ ] `icons/` — 16/48/128 PNG icons
- [ ] `README.md` — OAuth setup guide
