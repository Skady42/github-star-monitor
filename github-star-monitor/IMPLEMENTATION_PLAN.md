# GitHub Star Monitor — Implementation Plan

## Overview

9 changes across 7 files, organized by priority. Each change is self-contained and backward-compatible.

---

## Execution Order

```
Phase 1 (independent, no cross-dependencies):
  #6 (storage key unified) ──────┐
  #1 (message listener catch) ───┤── all independent
  #3 (search filter empty state) ┤
  #9 (notification auto-close) ──┘

Phase 2 (depends on #6):
  #2 (logger batch write) ── requires #6 for STORAGE_KEYS.LOGS import
  #4 (unified i18n export) ── independent structurally, but do after #3 to avoid merge conflicts in sidepanel.js
  #5 (notifications use i18n) ── depends on #4

Phase 3 (independent feature work):
  #7 (read/unread markers)
  #8 (multi-account support) ── separate effort, HIGH complexity
```

---

## Change #1: Message Listener Catch (First Priority)

**File**: `background.js` (lines 232-284)

**Problem**: The async IIFE inside `onMessage` has no `.catch()`. If any `await` throws before `sendResponse()` is called, the promise rejects silently, `sendResponse` is never called, and the sidepanel's `sendMessage()` hangs forever waiting.

**Current code** (lines 232-284):
```js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      // ... cases that call sendResponse()
    }
  })();
  return true;
});
```

**Fix**:
```js
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

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })().catch((err) => {
    logError('message_handler_error', `onMessage handler failed: ${err.message}`, { action: message.action, error: err.message });
    try { sendResponse({ error: err.message }); } catch {}
  });
  return true;
});
```

**What changed**: Added `.catch()` chain to the async IIFE. The inner `try { sendResponse() } catch {}` guards against the case where `sendResponse` was already called before the error.

**New functions/exports**: None.

**Storage schema changes**: None.

**Risk**: LOW. Purely defensive addition. The `.catch()` only fires if something already threw, which currently causes a silent hang.

---

## Change #2: Logger Batch Write (First Priority)

**File**: `utils/logger.js`

**Problem**: Every `log()` call does `getStoredLogs()` → push → `setStoredLogs()`. During `performCheck()` with ~30 log calls, this triggers 30 full `chrome.storage.local.get()` + `chrome.storage.local.set()` cycles.

**Fix**: Buffer logs in an in-memory array. Flush to storage on demand or via a timer.

**Current code** (lines 1, 27-34, 47-63):
```js
const LOG_STORAGE_KEY = 'app_logs';
// ...
async function getStoredLogs() { ... }
async function setStoredLogs(logs) { ... }
async function log(level, event, message, data) {
  // ... create entry ...
  const logs = await getStoredLogs();
  logs.push(entry);
  const pruned = await pruneLogs(logs);
  await setStoredLogs(pruned);
  // ... console output ...
}
```

**New code**:
```js
import { STORAGE_KEYS } from './storage.js';

const MAX_LOG_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_LOG_COUNT = 200;

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let _buffer = [];
let _flushTimer = null;
let _initialized = false;
let _persistedLogs = [];

function generateId() {
  return Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function formatTimestamp(isoString) {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

async function ensureLoaded() {
  if (_initialized) return;
  const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
  _persistedLogs = result[STORAGE_KEYS.LOGS] || [];
  _initialized = true;
}

async function flushBuffer() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  if (_buffer.length === 0) return;

  await ensureLoaded();
  _persistedLogs.push(..._buffer);
  _buffer = [];
  _persistedLogs = pruneLogsSync(_persistedLogs);
  await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: _persistedLogs });
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { flushBuffer(); }, 500);
}

function pruneLogsSync(logs) {
  const now = Date.now();
  let pruned = logs.filter(log => (now - new Date(log.timestamp).getTime()) < MAX_LOG_AGE_MS);
  if (pruned.length > MAX_LOG_COUNT) {
    pruned = pruned.slice(pruned.length - MAX_LOG_COUNT);
  }
  return pruned;
}

async function log(level, event, message, data) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    event,
    message
  };
  if (data !== undefined) {
    entry.data = data;
  }

  _buffer.push(entry);
  scheduleFlush();

  const prefix = `[${entry.level}] ${event}`;
  switch (level) {
    case 'DEBUG':  console.debug(prefix, message, data || ''); break;
    case 'INFO':   console.info(prefix, message, data || ''); break;
    case 'WARN':   console.warn(prefix, message, data || ''); break;
    case 'ERROR':  console.error(prefix, message, data || ''); break;
  }
}

async function forceFlush() {
  await flushBuffer();
}

function debug(event, message, data) { return log('DEBUG', event, message, data); }
function info(event, message, data) { return log('INFO', event, message, data); }
function warn(event, message, data) { return log('WARN', event, message, data); }
function error(event, message, data) { return log('ERROR', event, message, data); }

async function getLogs() {
  await flushBuffer();
  return _persistedLogs;
}

async function clearLogs() {
  _buffer = [];
  _persistedLogs = [];
  await chrome.storage.local.remove(STORAGE_KEYS.LOGS);
}

async function exportLogs() {
  await flushBuffer();
  if (!_persistedLogs || _persistedLogs.length === 0) return '';

  const lines = _persistedLogs.map(entry => {
    const formattedTime = formatTimestamp(entry.timestamp);
    let line = `[${formattedTime}] [${entry.level}] ${entry.event} - ${entry.message}`;
    if (entry.data) {
      const dataStr = typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data);
      line += ` (${dataStr})`;
    }
    return line;
  });

  return lines.join('\n');
}

export { log, debug, info, warn, error, getLogs, clearLogs, exportLogs, forceFlush };
```

**Key design decisions**:
- `_buffer` holds entries in memory, `scheduleFlush()` sets a 500ms debounce timer.
- `getLogs()` and `exportLogs()` call `flushBuffer()` first to ensure all data is persisted before reading.
- `clearLogs()` resets both buffer and persisted logs.
- `forceFlush()` exported for explicit flush (used by `performCheck` completion).
- `pruneLogsSync()` avoids async overhead — pruning is pure array manipulation.
- Uses `STORAGE_KEYS.LOGS` from storage.js (fixes #6 at the same time).

**Integration point in `background.js`**: Import `forceFlush` and call it at the end of `performCheck()`:

```js
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError, forceFlush } from './utils/logger.js';
```

At the end of `performCheck()`, before the `finally` block:
```js
await forceFlush();
```

This ensures all logs from the check cycle are persisted before the service worker may go idle.

**New functions/exports**: `forceFlush()`.

**Storage schema changes**: None. Same `app_logs` key, same array structure. Just changes *when* writes happen.

**Risk**: MEDIUM-LOW. If the SW is killed mid-check before `forceFlush()`, the in-memory buffer is lost. This is acceptable — those are transient check logs, not critical data. The trade-off is 30x fewer storage writes.

---

## Change #3: Search Filter Empty Result (First Priority)

**File**: `sidepanel/sidepanel.js` (function `applyFilters()`, lines 176-226)

**Problem**: Line 184 hides `emptyState` unconditionally, but after filtering if `filtered.length === 0`, no empty state is shown. The user sees a blank list with no feedback.

**Fix**: After the `filtered.forEach` loop (after line 225), add:

```js
  filtered.forEach(update => {
    // ... existing DOM creation ...
  });

  if (filtered.length === 0) {
    const emptyState = document.getElementById('emptyState');
    emptyState.innerHTML = '&#x25CB; ' + t('noUpdates');
    emptyState.style.display = 'block';
  }
```

**Note**: `emptyState` is already declared at line 178 and hidden at line 184. We just need to show it again with the correct i18n text when there are no filtered results.

**New functions/exports**: None.

**Storage schema changes**: None.

**Risk**: LOW. Pure UI fix. Only affects display when search filter produces no matches.

---

## Change #4: Unified i18n Export (Second Priority)

**File**: `utils/i18n.js`

**Problem**: `i18n.js` only exports the raw `translations` object. `sidepanel.js` defines its own `t(key)` at line 7-9 that references a module-level `currentLang`. `notifications.js` has hardcoded Chinese. There's no shared translation function.

**Fix**: Add a `t(key, lang)` function export to `i18n.js`:

```js
export const translations = {
  zh: { /* ... existing ... */ },
  en: { /* ... existing ... */ }
};

export function t(key, lang = 'zh') {
  return translations[lang]?.[key] || translations.en[key] || key;
}
```

**Then update `sidepanel.js`** (lines 1-9):

```js
import { t as tFn } from '../utils/i18n.js';
import { getLanguage, setLanguage } from '../utils/storage.js';
import { getLogs, clearLogs, exportLogs } from '../utils/logger.js';

let currentLang = 'zh';

export function t(key) {
  return tFn(key, currentLang);
}
```

This keeps the sidepanel's `t(key)` signature (no lang parameter needed at call sites) while delegating to the shared `t(key, lang)`.

**New functions/exports**: `t(key, lang)` from `i18n.js`.

**Storage schema changes**: None.

**Risk**: LOW. The sidepanel's existing `t(key)` wrapper is preserved so all call sites inside sidepanel.js remain unchanged. The only consumer outside sidepanel is notifications.js (Change #5).

---

## Change #5: Notifications Use i18n (Second Priority)

**File**: `utils/notifications.js`

**Problem**: Lines 9, 19, 37-39 have hardcoded Chinese strings:
- `"${u.repo} 发布新 Release"` (line 9)
- `"${updates.length} 个仓库有新 Release"` (line 23)
- `"找到 ${newReleaseCount} 个新 Release"` (line 37)
- `"扫描完成，无新 Release"` (line 38)
- `"检查了 ${reposCount} 个仓库，耗时 ${Math.round(elapsedMs / 1000)} 秒"` (line 39)

**Fix**: Import `t` from i18n.js and `getLanguage` from storage.js. Since this runs in the service worker, we need to add translation keys for notification strings.

**Step 1: Add i18n keys to `utils/i18n.js`**:

In the `zh` object, add:
```js
notifyReleaseSingle: '{repo} 发布新 Release',
notifyReleaseMulti: '{count} 个仓库有新 Release',
notifyFoundReleases: '找到 {count} 个新 Release',
notifyNoReleases: '扫描完成，无新 Release',
notifyScanDetail: '检查了 {repos} 个仓库，耗时 {seconds} 秒',
```

In the `en` object, add:
```js
notifyReleaseSingle: '{repo} has a new Release',
notifyReleaseMulti: '{count} repos have new Releases',
notifyFoundReleases: 'Found {count} new Releases',
notifyNoReleases: 'Scan complete, no new releases',
notifyScanDetail: 'Checked {repos} repos in {seconds}s',
```

**Step 2: Update `utils/notifications.js`**:

```js
import { t } from './i18n.js';
import { getLanguage } from './storage.js';

let _lang = 'zh';
getLanguage().then(lang => { _lang = lang; });

export function notifyUpdates(updates) {
  if (!updates || updates.length === 0) return;

  if (updates.length === 1) {
    const u = updates[0];
    chrome.notifications.create(`release-${u.repo.replace('/', '-')}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: t('notifyReleaseSingle', _lang).replace('{repo}', u.repo),
      message: `${u.name || u.tag}`,
      priority: 2,
      requireInteraction: false
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
      }
    });
    // Auto-close after 5 seconds (Change #9 incorporated here)
    setTimeout(() => {
      chrome.notifications.clear(`release-${u.repo.replace('/', '-')}-${Date.now()}`);
    }, 5000);
  } else {
    const repoList = updates.map(u => `${u.repo} -> ${u.tag}`).join('\n');
    const notifId = `release-summary-${Date.now()}`;
    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: t('notifyReleaseMulti', _lang).replace('{count}', updates.length),
      message: repoList.slice(0, 200),
      priority: 2,
      requireInteraction: false
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
      }
    });
    // Auto-close after 5 seconds (Change #9 incorporated here)
    setTimeout(() => {
      chrome.notifications.clear(notifId);
    }, 5000);
  }
}

export function notifyScanComplete(reposCount, newReleaseCount, elapsedMs) {
  const title = newReleaseCount > 0
    ? t('notifyFoundReleases', _lang).replace('{count}', newReleaseCount)
    : t('notifyNoReleases', _lang);
  const message = t('notifyScanDetail', _lang)
    .replace('{repos}', reposCount)
    .replace('{seconds}', Math.round(elapsedMs / 1000));

  chrome.notifications.create(`scan-complete-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 1,
    requireInteraction: false
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.warn('[Monitor] Scan-notification error:', chrome.runtime.lastError.message);
    }
  });
}
```

**Note on Change #9 (auto-close)**: The `requireInteraction: true` is changed to `false` and `setTimeout` + `chrome.notifications.clear()` added. This is combined here since the file is the same. See Change #9 below for details.

**Risk**: MEDIUM-LOW. The `getLanguage()` call at module load time may race if the SW hasn't initialized storage yet. Mitigation: defaults to `'zh'`, which matches current behavior. The language is read once at import; if it changes, the SW would need to be restarted (or a `chrome.storage.onChanged` listener added — but that's out of scope for a minimal fix).

---

## Change #6: Storage Key Unified (Second Priority)

**File**: `utils/logger.js` (line 1) and `utils/storage.js` (line 13)

**Problem**: `storage.js` defines `STORAGE_KEYS.LOGS = 'app_logs'` but `logger.js` defines its own `const LOG_STORAGE_KEY = 'app_logs'` at line 1. Same string, two sources of truth.

**Fix**: Already addressed in Change #2 above. The new `logger.js` imports `STORAGE_KEYS` from storage.js and uses `STORAGE_KEYS.LOGS` everywhere.

**Specific lines**:
- `logger.js:1` — remove `const LOG_STORAGE_KEY = 'app_logs';`
- `logger.js:1` — add `import { STORAGE_KEYS } from './storage.js';`
- All references to `LOG_STORAGE_KEY` become `STORAGE_KEYS.LOGS`

**Storage schema changes**: None. Same underlying key `'app_logs'`.

**Risk**: LOW. Mechanical replacement. The string value doesn't change.

---

## Change #7: Read/Unread Markers (Third Priority)

**Files**: `utils/storage.js`, `sidepanel/sidepanel.js`, `sidepanel/sidepanel.css`

**Design decision**: Add a `'read': boolean` field to each pending_update object rather than maintaining a separate `read_releases` Set. This is simpler because:
1. The read status travels with the update item
2. No separate data structure to keep in sync
3. `mergeNewReleases` doesn't need to know about read status — new items default to `read: false`

### storage.js changes

Add a new function:

```js
export async function markUpdateAsRead(repo) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_UPDATES);
  const updates = result[STORAGE_KEYS.PENDING_UPDATES] || [];
  const updated = updates.map(u => u.repo === repo ? { ...u, read: true } : u);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_UPDATES]: updated });
}
```

In `mergeNewReleases`, ensure new items don't have `read` set (they default to `undefined` which is falsy, so this is already correct — no change needed).

### sidepanel.js changes

In `renderUpdateList` / `applyFilters`, update the item creation:

```js
filtered.forEach(update => {
  const a = document.createElement('a');
  a.className = 'update-item' + (update.read ? ' read' : '');
  a.href = update.url;
  a.target = '_blank';
  a.innerHTML = `
    <div class="update-item-repo">${escapeHtml(update.repo)}</div>
    <div class="update-item-meta">
      <span class="update-item-tag">${escapeHtml(update.tag)}</span>
      <span class="update-item-date">${formatDate(new Date(update.published_at))}</span>
    </div>
  `;
  a.addEventListener('click', () => {
    if (!update.read) {
      sendMessage({ action: 'markAsRead', repo: update.repo });
      update.read = true;
      a.classList.add('read');
    }
  });
  updateList.appendChild(a);
});
```

In `background.js`, add a new message handler:

```js
case 'markAsRead':
  await markUpdateAsRead(message.repo);
  sendResponse({ success: true });
  break;
```

Import `markUpdateAsRead` from storage.js in background.js.

### sidepanel.css additions

```css
.update-item.read {
  opacity: 0.45;
  border-color: #1c1917;
}

.update-item.read:hover {
  opacity: 0.7;
  border-color: #27272a;
  background: #111827;
}

.update-item.read .update-item-repo {
  color: #71717a;
}

.update-item.read .update-item-tag {
  color: #52525b;
  border-color: #27272a;
  background: #09090b;
}
```

**New functions/exports**: `markUpdateAsRead(repo)` from storage.js.

**Storage schema changes**: Each object in `pending_updates` array gains an optional `read: boolean` field. Old items without this field are treated as unread (falsy check). Backward compatible.

**Risk**: LOW. Additive field, no migration needed.

---

## Change #8: Multi GitHub Account Support (Third Priority)

**Files**: `utils/storage.js`, `background.js`, `sidepanel/sidepanel.js`, `sidepanel/sidepanel.html`, `sidepanel/sidepanel.css`

**Complexity**: HIGH. This is a significant feature with storage schema changes, UI additions, and OAuth flow modifications.

### Design

**Storage schema**:
```js
// New structure
{
  accounts: [
    {
      id: 'acc_1719312345678_abc',     // generated unique ID
      user: 'username',
      token: 'ghp_xxx',
      clientId: 'Ov23li...',
      clientSecret: 'secret...',
      isActive: true,                    // only one account is active at a time
      addedAt: '2024-06-25T00:00:00Z'
    }
  ],
  // Legacy keys (github_token, github_user, etc.) preserved for backward compat
  // On first load, if legacy keys exist but no accounts[], migrate them
}
```

**Migration strategy**:
- On `onInstalled` with `reason === 'update'`, check if `accounts` key exists.
- If not, read legacy `github_token`, `github_user`, `oauth_client_id`, `oauth_client_secret` and create a single account entry.
- After migration, legacy keys remain but are unused. All reads go through `accounts[]`.

### storage.js additions

```js
const ACCOUNTS_KEY = 'accounts';

export async function getAccounts() {
  const result = await chrome.storage.local.get(ACCOUNTS_KEY);
  return result[ACCOUNTS_KEY] || [];
}

export async function getActiveAccount() {
  const accounts = await getAccounts();
  return accounts.find(a => a.isActive) || null;
}

export async function addAccount(token, user, clientId, clientSecret) {
  const accounts = await getAccounts();
  // Deactivate all existing
  accounts.forEach(a => a.isActive = false);
  accounts.push({
    id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    user,
    token,
    clientId,
    clientSecret,
    isActive: true,
    addedAt: new Date().toISOString()
  });
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
  return accounts;
}

export async function switchAccount(accountId) {
  const accounts = await getAccounts();
  accounts.forEach(a => a.isActive = (a.id === accountId));
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
}

export async function removeAccount(accountId) {
  const accounts = await getAccounts();
  const filtered = accounts.filter(a => a.id !== accountId);
  // If we removed the active one, activate the first remaining
  if (filtered.length > 0 && !filtered.some(a => a.isActive)) {
    filtered[0].isActive = true;
  }
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: filtered });
  return filtered;
}
```

### background.js changes

Replace single-account `getToken()`/`setToken()`/etc. with account-based reads. The simplest approach: modify `getToken()`, `getUser()`, `setToken()`, `setUser()` in storage.js to proxy through `getActiveAccount()`:

```js
// In storage.js — override existing functions for backward compat
export async function getToken() {
  const account = await getActiveAccount();
  if (account) return account.token;
  // Fallback to legacy
  const result = await chrome.storage.local.get(STORAGE_KEYS.TOKEN);
  return result[STORAGE_KEYS.TOKEN] || null;
}

export async function getUser() {
  const account = await getActiveAccount();
  if (account) return account.user;
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER);
  return result[STORAGE_KEYS.USER] || null;
}
```

Add new message actions:
- `switchAccount` — calls `switchAccount(id)`
- `removeAccount` — calls `removeAccount(id)`
- `addAccount` — triggers OAuth flow, adds to accounts array
- `getAccounts` — returns all accounts

### sidepanel.js / sidepanel.html changes

Add account switcher UI:
- Dropdown showing all accounts with active indicator
- "Add Account" button (triggers OAuth)
- "Remove" button per account (with confirmation)
- Switching accounts triggers `loadStatus()` refresh

### Risk: HIGH
- Storage migration must be bulletproof — data loss is unacceptable
- Token security: multiple tokens stored in `chrome.storage.local`
- OAuth flow needs to handle account ID association
- Edge case: what if all accounts are removed?
- Edge case: what if active account's token is revoked?

**Recommendation**: Implement this as a separate branch/PR. Do not combine with the other 8 changes.

---

## Change #9: Notification Auto-Close 5s (First Priority)

**File**: `utils/notifications.js`

**Problem**: `notifyUpdates` uses `requireInteraction: true`, meaning notifications persist until manually dismissed. This clutters the notification area.

**Fix**: Already incorporated into Change #5 above. Summary:

1. Change `requireInteraction: true` to `requireInteraction: false` in both `notifyUpdates` branches (lines 12, 26).
2. Add `setTimeout(() => { chrome.notifications.clear(notificationId); }, 5000)` in the callback of each `chrome.notifications.create`.

**Note**: The `notificationId` variable needs to be captured correctly. In the current callback pattern, the ID is passed as a parameter. For the summary notification, we can also store it in a variable before calling `create`:

```js
const notifId = `release-summary-${Date.now()}`;
chrome.notifications.create(notifId, { ... }, (id) => {
  // ...
});
setTimeout(() => {
  chrome.notifications.clear(notifId);
}, 5000);
```

**Risk**: LOW. The `clear()` call is a no-op if the notification was already dismissed or doesn't exist.

---

## Summary of All Files Modified

| File | Changes |
|------|---------|
| `background.js` | #1: Add `.catch()` to onMessage async IIFE. #2: Import `forceFlush`, call at end of `performCheck`. #7: Add `markAsRead` message handler. #8: Add account management message handlers (if doing multi-account). |
| `utils/storage.js` | #6: Already has `STORAGE_KEYS.LOGS` (no change). #7: Add `markUpdateAsRead()`. #8: Add account functions (if doing multi-account). |
| `utils/logger.js` | #2: Buffer-based logging with `forceFlush()`. #6: Import `STORAGE_KEYS` from storage.js. |
| `utils/i18n.js` | #4: Add `t(key, lang)` export. #5: Add notification i18n keys (8 new keys). |
| `utils/notifications.js` | #5: Import `t` and `getLanguage`, use i18n strings. #9: Change `requireInteraction`, add auto-close. |
| `sidepanel/sidepanel.js` | #3: Show emptyState when filtered results = 0. #4: Import `t` from i18n.js, keep local `t(key)` wrapper. #7: Add click handler for read marking, add `read` class. |
| `sidepanel/sidepanel.css` | #7: Add `.update-item.read` styles. |

---

## Execution Sequence

```
Step 1: Change #6 (storage key unified) — 1 line in logger.js
Step 2: Change #1 (message listener catch) — 3 lines in background.js
Step 3: Change #3 (search filter empty state) — 5 lines in sidepanel.js
Step 4: Change #9 (notification auto-close) — 6 lines in notifications.js
Step 5: Change #2 (logger batch write) — rewrite logger.js, add 2 lines in background.js
Step 6: Change #4 (unified i18n export) — 3 lines in i18n.js, 2 lines in sidepanel.js
Step 7: Change #5 (notifications use i18n) — rewrite notifications.js, add 10 keys in i18n.js
Step 8: Change #7 (read/unread markers) — storage.js + sidepanel.js + sidepanel.css + background.js
Step 9: Change #8 (multi-account) — separate effort, high complexity
```

Steps 1-4 can be done in any order. Steps 5-7 must follow the numbered sequence. Step 8 is independent. Step 9 is a standalone project.
