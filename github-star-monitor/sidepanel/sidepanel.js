import { t, setLang, getLang } from '../utils/i18n.js';
import { getLanguage, setLanguage } from '../utils/storage.js';
import { getLogs, clearLogs, exportLogs } from '../utils/logger.js';

let currentLang = 'zh';

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  currentLang = await getLanguage();
  setLang(currentLang);
  document.getElementById('langSelect').value = currentLang;
  applyLanguage();

  try {
    const uri = chrome.identity.getRedirectURL('oauth2');
    document.getElementById('redirectUri').textContent = uri || '...';
  } catch (e) {
    document.getElementById('redirectUri').textContent = '...';
  }

  const manifest = chrome.runtime.getManifest();
  document.getElementById('versionDisplay').textContent = manifest.version;

  await loadStatus();
  setupEventListeners();
  updateLogStats();
  loadRepoSettings();
}

function applyLanguage() {
  const titleEl = document.querySelector('.console-title');
  titleEl.textContent = '';
  const slash = document.createElement('span');
  slash.textContent = '//';
  titleEl.appendChild(slash);
  titleEl.appendChild(document.createTextNode(' ' + t('title')));

  document.getElementById('settingsBtn').title = t('settings');
  document.getElementById('backBtn').textContent = t('back');
  document.querySelector('.settings-title').textContent = t('settings');
  document.querySelectorAll('.settings-label')[0].textContent = t('scanInterval');
  document.querySelectorAll('.settings-suffix')[0].textContent = t('min');
  document.querySelector('.settings-hint').textContent = t('range');
  document.getElementById('settingsSaveBtn').textContent = t('save');
  document.querySelectorAll('.settings-label')[1].textContent = t('lang');
  document.getElementById('checkBtn').textContent = t('scan');
  document.querySelector('.search-input').placeholder = t('filter');

  const sort = document.getElementById('sortSelect');
  sort.options[0].textContent = t('sortNewest');
  sort.options[1].textContent = t('sortOldest');
  sort.options[2].textContent = t('sortAZ');
  sort.options[3].textContent = t('sortZA');
  sort.options[4].textContent = t('sortStarsDesc');
  sort.options[5].textContent = t('sortStarsAsc');

  document.getElementById('emptyState').textContent = '\u25CB ' + t('noUpdates');
  document.getElementById('errorState').textContent = '\u26A0 ' + t('networkUnreach');
  document.getElementById('noTokenState').textContent = '\u26A0 ' + t('noToken');
  document.getElementById('logoutBtn').textContent = t('disconnect');

  const hint = document.querySelector('.config-hint');
  hint.textContent = '';
  hint.appendChild(document.createTextNode(t('configTitle')));
  const ol = document.createElement('ol');
  const steps = [t('stepCreate'), t('stepCallback'), t('stepFill')];
  steps.forEach((step, i) => {
    const li = document.createElement('li');
    if (i === 0) {
      const a = document.createElement('a');
      a.href = 'https://github.com/settings/developers';
      a.target = '_blank';
      a.textContent = step;
      li.appendChild(a);
    } else {
      li.textContent = step;
    }
    ol.appendChild(li);
  });
  hint.appendChild(ol);

  document.querySelector('.redirect-label').textContent = t('redirectLabel');
  document.getElementById('copyRedirectBtn').textContent = t('copy');
  document.querySelectorAll('.config-label')[0].textContent = t('clientId');
  document.querySelectorAll('.config-label')[1].textContent = t('clientSecret');
  document.getElementById('configSaveBtn').textContent = t('saveCreds');

  document.getElementById('logManagementLabel').textContent = t('logManagement');
  document.getElementById('exportLogBtn').textContent = t('exportLog');
  document.getElementById('clearLogBtn').textContent = t('clearLog');
  document.getElementById('logCountDisplay').textContent = t('logCount') + ': ' + (document.getElementById('logCountDisplay').textContent.split(': ')[1] || '0');
}

async function loadStatus() {
  const status = await sendMessage({ action: 'getStatus' });

  // 如果状态是旧的 network_error（上次检查超过 1 分钟），自动触发一次重试
  if (status.status === 'network_error' && status.lastCheckTime) {
    const age = Date.now() - new Date(status.lastCheckTime).getTime();
    if (age > 60000) {
      const result = await sendMessage({ action: 'checkNow' });
      if (result.status !== 'network_error') {
        status.status = result.status;
        status.updates = result.updates;
        status.lastCheckTime = result.lastCheckTime;
      }
    }
  }

  if (status.redirectUri) {
    document.getElementById('redirectUri').textContent = status.redirectUri;
  }

  const statusDot = document.getElementById('statusDot');
  const authConnected = document.getElementById('authConnected');
  const authConfig = document.getElementById('authConfig');
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
    statusDot.classList.add('online');
    authConnected.style.display = 'flex';
    authUser.textContent = t('connected') + ': ' + status.user;
    authConfig.style.display = 'none';
    authBtn.style.display = 'none';
    checkBtn.disabled = false;
    logoutBtn.style.display = 'inline-block';
  } else if (status.hasCredentials) {
    statusDot.classList.remove('online');
    authConnected.style.display = 'none';
    authConfig.style.display = 'none';
    authBtn.style.display = 'block';
    authBtn.textContent = t('connect');
    checkBtn.disabled = true;
    logoutBtn.style.display = 'none';
  } else {
    statusDot.classList.remove('online');
    authConnected.style.display = 'none';
    authConfig.style.display = 'block';
    authBtn.style.display = 'none';
    checkBtn.disabled = true;
    logoutBtn.style.display = 'none';
  }

  if (status.lastCheckTime) {
    const time = new Date(status.lastCheckTime);
    checkTime.textContent = t('lastScan') + ': ' + getRelativeTime(time);
  }

  if (status.status === 'success') {
    checkResult.textContent = t('success');
    checkResult.className = 'check-result-success';
  } else if (status.status === 'network_error') {
    checkResult.textContent = t('networkErr');
    checkResult.className = 'check-result-error';
  } else if (status.status === 'error') {
    checkResult.textContent = t('checkFail');
    checkResult.className = 'check-result-error';
  }

  if (status.checkInterval) {
    document.getElementById('intervalInput').value = status.checkInterval;
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

let currentUpdates = [];
let repoSettings = {};

async function loadRepoSettings() {
  const result = await sendMessage({ action: 'getRepoSettings' });
  repoSettings = result.settings || {};
}

function renderUpdateList(updates) {
  currentUpdates = updates;
  applyFilters();
}

function applyFilters() {
  const updateList = document.getElementById('updateList');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const noTokenState = document.getElementById('noTokenState');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const sortMode = document.getElementById('sortSelect').value;

  [emptyState, errorState, noTokenState].forEach(el => el.style.display = 'none');
  updateList.querySelectorAll('.update-item').forEach(el => el.remove());

  let filtered = currentUpdates.filter(u =>
    u.repo.toLowerCase().includes(searchTerm)
  );

  switch (sortMode) {
    case 'newest':
      filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
      break;
    case 'az':
      filtered.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));
      break;
    case 'za':
      filtered.sort((a, b) => b.repo.toLowerCase().localeCompare(a.repo.toLowerCase()));
      break;
    case 'stars-desc':
      filtered.sort((a, b) => (b.stars || 0) - (a.stars || 0));
      break;
    case 'stars-asc':
      filtered.sort((a, b) => (a.stars || 0) - (b.stars || 0));
      break;
  }

  filtered.forEach(update => {
    const a = document.createElement('a');
    a.className = 'update-item' + (update.read ? ' read' : '');
    a.href = update.url;
    a.target = '_blank';

    const repoDiv = document.createElement('div');
    repoDiv.className = 'update-item-repo';
    repoDiv.textContent = update.repo;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'update-item-meta';

    const tagSpan = document.createElement('span');
    tagSpan.className = 'update-item-tag';
    tagSpan.textContent = update.tag;

    const dateSpan = document.createElement('span');
    dateSpan.className = 'update-item-date';
    dateSpan.textContent = formatDate(new Date(update.published_at));

    metaDiv.appendChild(tagSpan);
    metaDiv.appendChild(dateSpan);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'update-item-menu';
    menuBtn.textContent = '\u22EE';
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showRepoMenu(update.repo, menuBtn);
    });

    a.appendChild(repoDiv);
    a.appendChild(metaDiv);
    a.appendChild(menuBtn);
    if (!update.read) {
      a.addEventListener('click', async (e) => {
        if (!update.read) {
          update.read = true;
          a.classList.add('read');
          await sendMessage({ action: 'markAsRead', repo: update.repo });
        }
      });
    }
    updateList.appendChild(a);
  });

  if (filtered.length === 0 && currentUpdates.length > 0) {
    emptyState.textContent = '\u25CB ' + t('noUpdatesFiltered');
    emptyState.style.display = 'block';
  } else if (filtered.length === 0 && currentUpdates.length === 0) {
    emptyState.textContent = '\u25CB ' + t('noUpdates');
    emptyState.style.display = 'block';
  }
}

async function updateLogStats() {
  const logs = await getLogs();
  const count = logs ? logs.length : 0;
  document.getElementById('logCountDisplay').textContent = t('logCount') + ': ' + count;
}

let _searchDebounce = null;
function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(applyFilters, 150);
  });
  document.getElementById('sortSelect').addEventListener('change', applyFilters);

  document.getElementById('markAllReadBtn').addEventListener('click', async () => {
    await sendMessage({ action: 'markAllAsRead' });
    currentUpdates = currentUpdates.map(u => ({ ...u, read: true }));
    applyFilters();
  });

  document.getElementById('langSelect').addEventListener('change', async () => {
    currentLang = document.getElementById('langSelect').value;
    setLang(currentLang);
    await setLanguage(currentLang);
    applyLanguage();
    await loadStatus();
  });

  document.getElementById('copyRedirectBtn').addEventListener('click', async () => {
    const uri = document.getElementById('redirectUri').textContent;
    try {
      await navigator.clipboard.writeText(uri);
      const btn = document.getElementById('copyRedirectBtn');
      btn.textContent = t('copied');
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = t('copy');
        btn.classList.remove('copied');
      }, 2000);
    } catch {
      document.getElementById('redirectUri').select();
    }
  });

  document.getElementById('configSaveBtn').addEventListener('click', async () => {
    const clientId = document.getElementById('clientIdInput').value.trim();
    const clientSecret = document.getElementById('clientSecretInput').value.trim();
    const statusEl = document.getElementById('configStatus');

    if (!clientId || !clientSecret) {
      statusEl.textContent = t('fillAll');
      statusEl.className = 'config-status error';
      return;
    }

    const result = await sendMessage({
      action: 'saveCredentials',
      clientId,
      clientSecret
    });

    if (result.success) {
      statusEl.textContent = t('credsSaved');
      statusEl.className = 'config-status';
      await loadStatus();
    } else {
      statusEl.textContent = 'FAILED: ' + (result.error || '');
      statusEl.className = 'config-status error';
    }
  });

  document.getElementById('authBtn').addEventListener('click', async () => {
    const btn = document.getElementById('authBtn');
    btn.textContent = t('connecting');
    btn.disabled = true;

    const result = await sendMessage({ action: 'startOAuth' });
    if (result.success) {
      await loadStatus();
    } else {
      btn.textContent = t('retry');
      btn.disabled = false;
    }
  });

  document.getElementById('checkBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkBtn');
    const originalText = btn.textContent;
    btn.textContent = t('scanning');
    btn.disabled = true;

    const checkTimeEl = document.getElementById('checkTime');
    checkTimeEl.textContent = t('scanning');

    const result = await sendMessage({ action: 'checkNow' });
    btn.textContent = originalText;
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

  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('settingsView').style.display = 'block';
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('settingsView').style.display = 'none';
    document.getElementById('mainView').style.display = 'block';
  });

  document.getElementById('settingsSaveBtn').addEventListener('click', async () => {
    const input = document.getElementById('intervalInput');
    const minutes = parseInt(input.value);
    const statusEl = document.getElementById('settingsStatus');

    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      statusEl.textContent = 'INVALID RANGE';
      statusEl.className = 'settings-status error';
      return;
    }

    input.value = Math.max(1, Math.min(1440, minutes));
    const result = await sendMessage({ action: 'saveSettings', interval: minutes });

    if (result.success) {
      statusEl.textContent = t('saved');
      statusEl.className = 'settings-status';
    } else {
      statusEl.textContent = 'FAILED';
      statusEl.className = 'settings-status error';
    }
  });

  // Log management
  document.getElementById('exportLogBtn').addEventListener('click', async () => {
    const logs = await getLogs();
    if (!logs || logs.length === 0) {
      const status = document.getElementById('logStatus');
      status.textContent = t('noLogs');
      status.className = 'log-status error';
      return;
    }

    const text = await exportLogs();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `star-monitor-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    const status = document.getElementById('logStatus');
    status.textContent = t('logExported');
    status.className = 'log-status';
  });

  document.getElementById('clearLogBtn').addEventListener('click', async () => {
    await clearLogs();
    document.getElementById('logCountDisplay').textContent = t('logCount') + ': 0';
    const status = document.getElementById('logStatus');
    status.textContent = t('logCount') + ': 0';
    status.className = 'log-status';
  });
}

function showRepoMenu(repo, anchorEl) {
  closeRepoMenu();

  const currentType = repoSettings[repo]?.releaseType || 'stable';

  const menu = document.createElement('div');
  menu.className = 'repo-menu';
  menu.id = 'repoMenu';

  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const title = document.createElement('div');
  title.className = 'repo-menu-title';
  title.textContent = repo;
  menu.appendChild(title);

  const isMuted = repoSettings[repo]?.muted || false;

  const options = [
    { type: 'stable', label: t('releaseStable') },
    { type: 'pre-release', label: t('releasePreRelease') }
  ];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'repo-menu-option' + (currentType === opt.type ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      repoSettings[repo] = { ...repoSettings[repo], releaseType: opt.type };
      await sendMessage({ action: 'setRepoReleaseType', repo, releaseType: opt.type });
      closeRepoMenu();
      await performCheckAndReload();
    });
    menu.appendChild(btn);
  });

  const muteBtn = document.createElement('button');
  muteBtn.className = 'repo-menu-option' + (isMuted ? ' active' : '');
  muteBtn.textContent = isMuted ? t('unmute') : t('mute');
  muteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    repoSettings[repo] = { ...repoSettings[repo], muted: !isMuted };
    await sendMessage({ action: 'setRepoMuted', repo, muted: !isMuted });
    closeRepoMenu();
    await performCheckAndReload();
  });
  menu.appendChild(muteBtn);

  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = (rect.left - 100) + 'px';
  menu.style.zIndex = '1000';

  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('mousedown', closeRepoMenu, { once: true });
  }, 0);
}

function closeRepoMenu() {
  const existing = document.getElementById('repoMenu');
  if (existing) existing.remove();
}

async function performCheckAndReload() {
  await sendMessage({ action: 'checkNow' });
  await loadRepoSettings();
  await loadStatus();
}

function sendMessage(message, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: 'Timeout: service worker may be sleeping' });
    }, timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
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

  if (minutes < 1) return t('justNow');
  if (minutes < 60) return minutes + t('minsAgo');
  if (hours < 24) return hours + t('hrsAgo');
  if (days < 30) return days + t('daysAgo');
  return date.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US');
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
