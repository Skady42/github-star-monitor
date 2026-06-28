import type { ReleaseUpdate, KnownReleases, RepoSettings, RepoSetting, ReleaseWithRead } from './types';

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
  LOGS: 'app_logs',
  REPO_SETTINGS: 'repo_settings'
} as const;

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TOKEN);
  return result[STORAGE_KEYS.TOKEN] || null;
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: token });
}

export async function getUser(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER);
  return result[STORAGE_KEYS.USER] || null;
}

export async function setUser(username: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER]: username });
}

export async function getLastCheckTime(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECK_TIME);
  return result[STORAGE_KEYS.LAST_CHECK_TIME] || null;
}

export async function setLastCheckTime(isoString: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CHECK_TIME]: isoString });
}

export async function getKnownReleases(): Promise<KnownReleases> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.KNOWN_RELEASES);
  return result[STORAGE_KEYS.KNOWN_RELEASES] || {};
}

export async function getPendingUpdates(): Promise<ReleaseWithRead[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_UPDATES);
  return result[STORAGE_KEYS.PENDING_UPDATES] || [];
}

export async function mergeNewReleases(
  allStarredRepoNames: string[],
  newReleases: ReleaseUpdate[]
): Promise<ReleaseWithRead[]> {
  const known = await getKnownReleases();
  const genuinelyNew: ReleaseWithRead[] = [];

  const starredSet = new Set(allStarredRepoNames);

  for (const rel of newReleases) {
    if (!starredSet.has(rel.repo)) continue;

    const prev = known[rel.repo];
    if (!prev || prev !== rel.tag) {
      known[rel.repo] = rel.tag;
      genuinelyNew.push({ ...rel, detected_at: new Date().toISOString(), read: false });
    }
  }

  for (const key of Object.keys(known)) {
    if (!starredSet.has(key)) delete known[key];
  }

  if (genuinelyNew.length > 0) {
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
    const existing = await getPendingUpdates();
    const filtered = existing.filter(entry => starredSet.has(entry.repo));
    await chrome.storage.local.set({
      [STORAGE_KEYS.KNOWN_RELEASES]: known,
      [STORAGE_KEYS.PENDING_UPDATES]: filtered
    });
  }

  return genuinelyNew;
}

export async function getLastCheckStatus(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_CHECK_STATUS);
  return result[STORAGE_KEYS.LAST_CHECK_STATUS] || null;
}

export async function setLastCheckStatus(status: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_CHECK_STATUS]: status });
}

export async function getOAuthClientId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.OAUTH_CLIENT_ID);
  return result[STORAGE_KEYS.OAUTH_CLIENT_ID] || null;
}

export async function setOAuthClientId(id: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.OAUTH_CLIENT_ID]: id });
}

export async function getOAuthClientSecret(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.OAUTH_CLIENT_SECRET);
  return result[STORAGE_KEYS.OAUTH_CLIENT_SECRET] || null;
}

export async function setOAuthClientSecret(secret: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.OAUTH_CLIENT_SECRET]: secret });
}

export async function getCheckInterval(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHECK_INTERVAL);
  return result[STORAGE_KEYS.CHECK_INTERVAL] || 60;
}

export async function setCheckInterval(minutes: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CHECK_INTERVAL]: minutes });
}

export async function getLanguage(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LANG);
  return result[STORAGE_KEYS.LANG] || 'zh';
}

export async function setLanguage(lang: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LANG]: lang });
}

export async function getReleaseEtags(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RELEASE_ETAGS);
  return result[STORAGE_KEYS.RELEASE_ETAGS] || {};
}

export async function setReleaseEtags(etags: Record<string, string>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.RELEASE_ETAGS]: etags });
}

export async function markAsRead(repo: string): Promise<void> {
  const updates = await getPendingUpdates();
  const updated = updates.map(u => u.repo === repo ? { ...u, read: true } : u);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_UPDATES]: updated });
}

export async function markAllAsRead(): Promise<void> {
  const updates = await getPendingUpdates();
  const updated = updates.map(u => ({ ...u, read: true }));
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_UPDATES]: updated });
}

export async function getRepoSettings(): Promise<RepoSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.REPO_SETTINGS);
  return result[STORAGE_KEYS.REPO_SETTINGS] || {};
}

export async function getRepoReleaseType(repo: string): Promise<'stable' | 'pre-release'> {
  const settings = await getRepoSettings();
  return settings[repo]?.releaseType || 'stable';
}

export async function setRepoReleaseType(repo: string, releaseType: 'stable' | 'pre-release'): Promise<void> {
  const settings = await getRepoSettings();
  settings[repo] = { ...settings[repo], releaseType } as RepoSetting;
  await chrome.storage.local.set({ [STORAGE_KEYS.REPO_SETTINGS]: settings });
}

export async function setRepoDisabled(repo: string, disabled: boolean): Promise<void> {
  const settings = await getRepoSettings();
  settings[repo] = { ...settings[repo], disabled } as RepoSetting;
  await chrome.storage.local.set({ [STORAGE_KEYS.REPO_SETTINGS]: settings });
}
