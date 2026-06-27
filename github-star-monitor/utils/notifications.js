import { t, setLang } from './i18n.js';
import { getLanguage } from './storage.js';

let _langLoaded = false;

async function ensureLang() {
  if (!_langLoaded) {
    const lang = await getLanguage();
    setLang(lang);
    _langLoaded = true;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.language) {
    setLang(changes.language.newValue);
  }
});

export async function notifyUpdates(updates) {
  await ensureLang();
  if (!updates || updates.length === 0) return;

  if (updates.length === 1) {
    const u = updates[0];
    chrome.notifications.create(`release-${u.repo.replace('/', '-')}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${u.repo} ${t('releaseNew')}`,
      message: `${u.name || u.tag}`,
      priority: 2,
      requireInteraction: false
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
        return;
      }
      setTimeout(() => chrome.notifications.clear(notificationId), 5000);
    });
  } else {
    const repoList = updates.map(u => `${u.repo} -> ${u.tag}`).join('\n');
    chrome.notifications.create(`release-summary-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${updates.length} ${t('releaseMulti')}`,
      message: repoList.slice(0, 200),
      priority: 2,
      requireInteraction: false
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Monitor] Notification error:', chrome.runtime.lastError.message);
        return;
      }
      setTimeout(() => chrome.notifications.clear(notificationId), 5000);
    });
  }
}

export async function notifyScanComplete(reposCount, newReleaseCount, elapsedMs) {
  await ensureLang();
  const title = newReleaseCount > 0
    ? `${t('foundNew')} ${newReleaseCount} ${t('releaseCount')}`
    : t('scanComplete');
  const message = `${t('checked')} ${reposCount} ${t('repos')} ${t('took')} ${Math.round(elapsedMs / 1000)} ${t('seconds')}`;

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
      return;
    }
    setTimeout(() => chrome.notifications.clear(notificationId), 5000);
  });
}
