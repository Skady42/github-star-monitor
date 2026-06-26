import {
  getToken, setToken, getUser, setUser,
  getLastCheckTime, setLastCheckTime,
  getKnownReleases, getPendingUpdates, mergeNewReleases, markAsRead,
  getLastCheckStatus, setLastCheckStatus,
  getOAuthClientId, setOAuthClientId,
  getOAuthClientSecret, setOAuthClientSecret,
  getCheckInterval, setCheckInterval,
  getReleaseEtags, setReleaseEtags,
  getLanguage
} from './utils/storage.js';

import {
  checkConnectivity, getStarredRepos, getLatestRelease
} from './utils/github-api.js';

import { notifyUpdates, notifyScanComplete } from './utils/notifications.js';

import { debug as logDebug, info as logInfo, warn as logWarn, error as logError, flushLogs } from './utils/logger.js';

import { setLang } from './utils/i18n.js';

const ALARM_NAME = 'check-releases';
const CONCURRENCY = 3;

// 内存锁：防止 performCheck 并发执行（两个检查同时写 storage 会互相覆盖）
let _isChecking = false;

const GITHUB_OAUTH = {
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token'
};

async function batchWithConcurrency(items, limit, handler) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(handler));
    results.push(...batchResults);
  }
  return results;
}

function setupAlarm() {
  getCheckInterval().then(interval => {
    const periodMinutes = Math.max(1, Math.min(1440, interval));
    chrome.alarms.clear(ALARM_NAME, () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const delayMinutes = Math.max(1, (nextHour - now) / 60000);

      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: periodMinutes,
        delayInMinutes: delayMinutes
      });
      logInfo('alarm_set', `Alarm set for ${nextHour.toISOString()} (interval: ${periodMinutes}min)`);
    });
  });
}

async function performCheck() {
  if (_isChecking) {
    logWarn('check_skip_concurrent', '有检查正在运行，跳过本次');
    return;
  }
  _isChecking = true;

  try {
    logInfo('check_start', '开始检查更新');

    const token = await getToken();
    if (!token) {
      await setLastCheckStatus('no_token');
      logWarn('check_skip_no_token', '无 Token，跳过检查');
      return;
    }

    const connected = await checkConnectivity();
    if (!connected) {
      await setLastCheckStatus('network_error');
      logWarn('check_skip_network', 'GitHub 不可达，跳过检查');
      return;
    }

    try {
      const scanStart = performance.now();
      const repos = await getStarredRepos(token);
      logInfo('check_repos_found', `找到 ${repos.length} 个标星仓库`, { repoCount: repos.length });

      const etags = await getReleaseEtags();

      const repoResults = await batchWithConcurrency(repos, CONCURRENCY, async (repo) => {
        try {
          const result = await getLatestRelease(token, repo.owner, repo.name, etags[repo.full_name]);
          if (result.release) {
            result.release.stars = repo.stargazers_count || 0;
          }
          return { full_name: repo.full_name, ...result };
        } catch (err) {
          logWarn('check_repo_failed', `检查仓库失败: ${repo.full_name}`, { repo: repo.full_name, error: err.message });
          return { full_name: repo.full_name, etag: etags[repo.full_name], release: null };
        }
      });

      const newReleases = repoResults.filter(r => r.release).map(r => r.release);

      // ⚠️ 必须先 mergeNewReleases 再 setReleaseEtags！
      // 如果 ETag 先更新但 known 还没写，SW 被杀后新 Release 会被 304 永久跳过
      const genuinelyNew = await mergeNewReleases(
        repos.map(r => r.full_name),
        newReleases
      );

      const newEtags = {};
      for (const r of repoResults) {
        if (r.etag) newEtags[r.full_name] = r.etag;
      }
      await setReleaseEtags(newEtags);

      const elapsed = performance.now() - scanStart;

      if (genuinelyNew.length > 0) {
        logInfo('check_new_releases', `发现 ${genuinelyNew.length} 个新 Release`, { count: genuinelyNew.length });
        notifyUpdates(genuinelyNew);
      } else {
        logInfo('check_no_new', '没有新更新');
      }

      // 总是发送扫描完成通知（即使无新 Release）
      notifyScanComplete(repos.length, genuinelyNew.length, elapsed);

      await setLastCheckTime(new Date().toISOString());
      await setLastCheckStatus('success');
    } catch (err) {
      logError('check_failed', '检查失败', { error: err.message });
      await setLastCheckStatus('error');
    } finally {
    _isChecking = false;
    await flushLogs();
  }
}

async function startOAuth() {
  const clientId = await getOAuthClientId();
  const clientSecret = await getOAuthClientSecret();

  if (!clientId || !clientSecret) {
    return { success: false, error: '请先配置 GitHub OAuth 凭证' };
  }

  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const authUrl = new URL(GITHUB_OAUTH.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user');

  const stateArr = new Uint8Array(16);
  crypto.getRandomValues(stateArr);
  const state = Array.from(stateArr, b => b.toString(16).padStart(2, '0')).join('');
  await chrome.storage.local.set({ oauth_state: state });
  authUrl.searchParams.set('state', state);

  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    const url = new URL(redirectUrl);
    const returnedState = url.searchParams.get('state');
    const savedState = await chrome.storage.local.get('oauth_state');
    if (returnedState !== savedState.oauth_state) {
      throw new Error('OAuth state mismatch');
    }
    await chrome.storage.local.remove('oauth_state');

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
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
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

      logInfo('oauth_success', 'OAuth 授权成功', { user: userData.login });

      await performCheck();
      return { success: true, user: userData.login };
    }
    throw new Error('Failed to get access token');
  } catch (err) {
    logError('oauth_failed', 'OAuth 失败', { error: err.message });
    return { success: false, error: err.message };
  }
}

// Click action icon -> open side panel (setPanelBehavior handles this)
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const lastCheckTime = await getLastCheckTime();
    const interval = await getCheckInterval();
    const intervalMs = interval * 60 * 1000;
    if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > intervalMs) {
      // 额外防御：如果距上次检查不到 30 秒，跳过（防止浏览器启动时的双触发）
      if (lastCheckTime && (Date.now() - new Date(lastCheckTime).getTime()) < 30000) {
        logWarn('check_skip_alarm_recent', '上次检查不到 30 秒，跳过 alarm 触发');
        return;
      }
      await performCheck();
    } else {
      logWarn('check_skip_alarm', `上次检查在间隔内，跳过 (${Math.round((Date.now() - new Date(lastCheckTime).getTime()) / 1000)}s ago)`);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'saveCredentials':
        await setOAuthClientId(message.clientId);
        await setOAuthClientSecret(message.clientSecret);
        logInfo('creds_saved', 'OAuth 凭证已保存');
        sendResponse({ success: true });
        break;

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
        const hasCreds = !!(await getOAuthClientId() && await getOAuthClientSecret());
        const redirUri = chrome.identity.getRedirectURL('oauth2');
        const checkInterval = await getCheckInterval();
        sendResponse({ status: s, lastCheckTime: t, updates: u, user, hasToken: !!token, hasCredentials: hasCreds, redirectUri: redirUri, checkInterval });
        break;

      case 'logout':
        await chrome.storage.local.clear();
        logInfo('logout', '用户已登出');
        sendResponse({ success: true });
        break;

      case 'saveSettings':
        const minutes = parseInt(message.interval) || 60;
        await setCheckInterval(Math.max(1, Math.min(1440, minutes)));
        setupAlarm();
        sendResponse({ success: true });
        break;

      case 'markAsRead':
        await markAsRead(message.repo);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })().catch(err => {
    try { sendResponse({ error: err.message }); } catch {}
  });
  return true;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  logInfo('extension_installed', `扩展安装/更新: ${details.reason}`);
  const lang = await getLanguage();
  setLang(lang);
  setupAlarm();

  if (details.reason === 'update') {
    // 清理 pending_updates 中被旧版本 ETag bug 污染的重复条目
    const updates = await getPendingUpdates();
    if (updates.length > 0) {
      const latestPerRepo = new Map();
      for (const u of updates) {
        const prev = latestPerRepo.get(u.repo);
        if (!prev || new Date(u.published_at) > new Date(prev.published_at)) {
          latestPerRepo.set(u.repo, u);
        }
      }
      await chrome.storage.local.set({
        pending_updates: Array.from(latestPerRepo.values())
      });
      logInfo('cleanup_pending', `清理 ${updates.length} 条 pending_updates，去重后保留 ${latestPerRepo.size} 条`);
    }
  }

  if (details.reason === 'install') {
    // 首次安装跳过检查，避免所有标星仓库全部变成"新 Release"轰炸用户
    const now = new Date().toISOString();
    await setLastCheckTime(now);
    logInfo('install_skip_check', '首次安装跳过检查，避免全部仓库标记为新 Release');
    return;
  }

  const lastCheckTime = await getLastCheckTime();
  const interval = await getCheckInterval();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > interval * 60 * 1000) {
    await performCheck();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logInfo('browser_startup', '浏览器启动');
  const lang = await getLanguage();
  setLang(lang);
  setupAlarm();

  const lastCheckTime = await getLastCheckTime();
  const interval = await getCheckInterval();
  if (!lastCheckTime || (Date.now() - new Date(lastCheckTime).getTime()) > interval * 60 * 1000) {
    // 安装时已设置 lastCheckTime，如果距上次检查不到 60 秒，跳过启动检查
    if (lastCheckTime && (Date.now() - new Date(lastCheckTime).getTime()) < 60000) {
      logWarn('check_skip_startup_recent', '距上次检查不到 60 秒，跳过启动检查');
      return;
    }
    await performCheck();
  }
});
