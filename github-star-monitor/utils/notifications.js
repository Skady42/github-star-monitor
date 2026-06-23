export function notifyUpdates(updates) {
  if (!updates || updates.length === 0) return;

  if (updates.length === 1) {
    const u = updates[0];
    chrome.notifications.create(`release-${u.repo.replace('/', '-')}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${u.repo} 发布新 Release`,
      message: `${u.name || u.tag}`,
      priority: 2,
      requireInteraction: true
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
      }
    });
  } else {
    const repoList = updates.map(u => `${u.repo} -> ${u.tag}`).join('\n');
    chrome.notifications.create(`release-summary-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${updates.length} 个仓库有新 Release`,
      message: repoList.slice(0, 200),
      priority: 2,
      requireInteraction: true
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
      }
    });
  }
}

export function notifyScanComplete(reposCount, newReleaseCount, elapsedMs) {
  const title = newReleaseCount > 0
    ? `找到 ${newReleaseCount} 个新 Release`
    : '扫描完成，无新 Release';
  const message = `检查了 ${reposCount} 个仓库，耗时 ${Math.round(elapsedMs / 1000)} 秒`;

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
