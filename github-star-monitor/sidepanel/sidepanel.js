document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // 显示 redirect URI
  try {
    const uri = chrome.identity.getRedirectURL('oauth2');
    document.getElementById('redirectUri').textContent = uri || '获取失败，请查看扩展ID';
  } catch (e) {
    document.getElementById('redirectUri').textContent = '获取失败，请查看扩展ID';
  }

  await loadStatus();
  setupEventListeners();
}

async function loadStatus() {
  const status = await sendMessage({ action: 'getStatus' });

  // 用 SW 返回的 redirectUri 覆盖（确保准确）
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
    // 已连接 GitHub
    statusDot.classList.add('connected');
    authConnected.style.display = 'flex';
    authUser.textContent = '已连接: ' + status.user;
    authConfig.style.display = 'none';
    authBtn.style.display = 'none';
    checkBtn.disabled = false;
    logoutBtn.style.display = 'inline-block';
  } else if (status.hasCredentials) {
    // 有凭证但未授权
    statusDot.classList.remove('connected');
    authConnected.style.display = 'none';
    authConfig.style.display = 'none';
    authBtn.style.display = 'block';
    checkBtn.disabled = true;
    logoutBtn.style.display = 'none';
  } else {
    // 未配置凭证
    statusDot.classList.remove('connected');
    authConnected.style.display = 'none';
    authConfig.style.display = 'block';
    authBtn.style.display = 'none';
    checkBtn.disabled = true;
    logoutBtn.style.display = 'none';
  }

  if (status.lastCheckTime) {
    const time = new Date(status.lastCheckTime);
    checkTime.textContent = '上次检查: ' + getRelativeTime(time);
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

let currentUpdates = [];

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
      filtered.sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.detected_at) - new Date(b.detected_at));
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
    a.className = 'update-item';
    a.href = update.url;
    a.target = '_blank';
    a.innerHTML = `
      <div class="update-item-repo">${escapeHtml(update.repo)}</div>
      <div class="update-item-meta">
        <span class="update-item-tag">${escapeHtml(update.tag)}</span>
        <span class="update-item-date">${formatDate(new Date(update.published_at))}</span>
      </div>
    `;
    updateList.appendChild(a);
  });
}

function setupEventListeners() {
  // 搜索和排序
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('sortSelect').addEventListener('change', applyFilters);

  // 保存凭证
  document.getElementById('configSaveBtn').addEventListener('click', async () => {
    const clientId = document.getElementById('clientIdInput').value.trim();
    const clientSecret = document.getElementById('clientSecretInput').value.trim();
    const statusEl = document.getElementById('configStatus');

    if (!clientId || !clientSecret) {
      statusEl.textContent = '请填写 Client ID 和 Client Secret';
      statusEl.className = 'config-status error';
      return;
    }

    const result = await sendMessage({
      action: 'saveCredentials',
      clientId,
      clientSecret
    });

    if (result.success) {
      statusEl.textContent = '凭证已保存！';
      statusEl.className = 'config-status';
      await loadStatus();
    } else {
      statusEl.textContent = '保存失败: ' + (result.error || '未知错误');
      statusEl.className = 'config-status error';
    }
  });

  // OAuth 连接
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
  if (minutes < 60) return minutes + '分钟前';
  if (hours < 24) return hours + '小时前';
  if (days < 30) return days + '天前';
  return date.toLocaleDateString('zh-CN');
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
