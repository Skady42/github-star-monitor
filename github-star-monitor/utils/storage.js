const STORAGE_KEYS = {
  TOKEN: 'github_token',
  USER: 'github_user',
  LAST_CHECK_TIME: 'last_check_time',
  KNOWN_RELEASES: 'known_releases',
  PENDING_UPDATES: 'pending_updates',
  LAST_CHECK_STATUS: 'last_check_status',
  OAUTH_CLIENT_ID: 'oauth_client_id',
  OAUTH_CLIENT_SECRET: 'oauth_client_secret',
  CHECK_INTERVAL: 'check_interval'
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
  // Deduplicate: keep only the latest entry per repo (by published_at)
  const deduped = [];
  const seen = new Set();
  for (const entry of merged) {
    if (seen.has(entry.repo)) continue;
    seen.add(entry.repo);
    deduped.push(entry);
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.KNOWN_RELEASES]: known,
    [STORAGE_KEYS.PENDING_UPDATES]: deduped
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
