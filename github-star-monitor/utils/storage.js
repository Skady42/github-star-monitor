export const STORAGE_KEYS = {
  TOKEN: 'github_token',
  USER: 'github_user',
  LAST_CHECK_TIME: 'last_check_time',
  KNOWN_RELEASES: 'known_releases',
  PENDING_UPDATES: 'pending_updates',
  LAST_CHECK_STATUS: 'last_check_status',
  OAUTH_CLIENT_ID: 'oauth_client_id',
  OAUTH_CLIENT_SECRET: 'oauth_client_secret',
  CHECK_INTERVAL: 'check_interval',
  LANG: 'language',
  RELEASE_ETAGS: 'release_etags',
  LOGS: 'app_logs'
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

export async function mergeNewReleases(allStarredRepoNames, newReleases) {
  const known = await getKnownReleases();
  const genuinelyNew = [];

  const starredSet = new Set(allStarredRepoNames);

  for (const rel of newReleases) {
    // 只处理当前仍被标星的仓库
    if (!starredSet.has(rel.repo)) continue;

    const prev = known[rel.repo];
    if (!prev || prev !== rel.tag) {
      known[rel.repo] = rel.tag;
      genuinelyNew.push({ ...rel, detected_at: new Date().toISOString(), read: false });
    }
  }

  // 清理已取消标星的仓库
  for (const key of Object.keys(known)) {
    if (!starredSet.has(key)) delete known[key];
  }

  if (genuinelyNew.length > 0) {
    // 合并旧 pending + 新 release，按 repo 去重：同仓库只保留 genuinelyNew（最新发现）
    const existing = await getPendingUpdates();
    const newRepos = new Set(genuinelyNew.map(r => r.repo));
    const merged = [...genuinelyNew];
    for (const entry of existing) {
      if (!newRepos.has(entry.repo) && starredSet.has(entry.repo)) {
        merged.push(entry);
      }
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.KNOWN_RELEASES]: known,
      [STORAGE_KEYS.PENDING_UPDATES]: merged
    });
  } else {
    // 没有新 Release，只更新 known（取消标星的清理）和 pending（取消标星的清理）
    const existing = await getPendingUpdates();
    const filtered = existing.filter(entry => starredSet.has(entry.repo));
    await chrome.storage.local.set({
      [STORAGE_KEYS.KNOWN_RELEASES]: known,
      [STORAGE_KEYS.PENDING_UPDATES]: filtered
    });
  }

  return genuinelyNew;
}

export async function getLastCheckStatus() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECK_STATUS);
  return result[STORAGE_KEYS.LAST_CHECK_STATUS] || null;
}

export async function setLastCheckStatus(status) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CHECK_STATUS]: status });
}

export async function getOAuthClientId() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.OAUTH_CLIENT_ID);
  return result[STORAGE_KEYS.OAUTH_CLIENT_ID] || null;
}

export async function setOAuthClientId(id) {
  await chrome.storage.local.set({ [STORAGE_KEYS.OAUTH_CLIENT_ID]: id });
}

export async function getOAuthClientSecret() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.OAUTH_CLIENT_SECRET);
  return result[STORAGE_KEYS.OAUTH_CLIENT_SECRET] || null;
}

export async function setOAuthClientSecret(secret) {
  await chrome.storage.local.set({ [STORAGE_KEYS.OAUTH_CLIENT_SECRET]: secret });
}

export async function getCheckInterval() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHECK_INTERVAL);
  return result[STORAGE_KEYS.CHECK_INTERVAL] || 60; // default 60 minutes
}

export async function setCheckInterval(minutes) {
  await chrome.storage.local.set({ [STORAGE_KEYS.CHECK_INTERVAL]: minutes });
}

export async function getLanguage() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LANG);
  return result[STORAGE_KEYS.LANG] || 'zh';
}

export async function setLanguage(lang) {
  await chrome.storage.local.set({ [STORAGE_KEYS.LANG]: lang });
}

export async function getReleaseEtags() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RELEASE_ETAGS);
  return result[STORAGE_KEYS.RELEASE_ETAGS] || {};
}

export async function setReleaseEtags(etags) {
  await chrome.storage.local.set({ [STORAGE_KEYS.RELEASE_ETAGS]: etags });
}

export async function markAsRead(repo) {
  const updates = await getPendingUpdates();
  const updated = updates.map(u => u.repo === repo ? { ...u, read: true } : u);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_UPDATES]: updated });
}
