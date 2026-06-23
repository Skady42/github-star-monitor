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
