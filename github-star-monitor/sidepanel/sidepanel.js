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
