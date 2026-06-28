export interface StarredRepo {
  full_name: string;
  owner: string;
  name: string;
  html_url: string;
  stargazers_count: number;
}

export interface ReleaseUpdate {
  repo: string;
  tag: string;
  name: string;
  url: string;
  published_at: string;
  prerelease: boolean;
}

export interface ReleaseWithRead extends ReleaseUpdate {
  detected_at: string;
  read: boolean;
}

export interface LatestReleaseResult {
  etag: string | null;
  release: ReleaseUpdate | null;
}

export interface KnownReleases {
  [repo: string]: string;
}

export interface ReleaseEtags {
  [repo: string]: string;
}

export interface RepoSetting {
  releaseType: 'stable' | 'pre-release';
  disabled?: boolean;
}

export interface RepoSettings {
  [repo: string]: RepoSetting;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  data?: unknown;
}

export interface AppLogs {
  logs: LogEntry[];
}

export interface MessageAction {
  action: string;
  [key: string]: unknown;
}

export interface StatusResponse {
  status: string;
  message?: string;
}

export interface TranslationKeys {
  title: string;
  settings: string;
  back: string;
  scanInterval: string;
  min: string;
  range: string;
  save: string;
  saved: string;
  lang: string;
  connect: string;
  connecting: string;
  retry: string;
  connected: string;
  scan: string;
  scanning: string;
  lastScan: string;
  success: string;
  networkErr: string;
  checkFail: string;
  noUpdates: string;
  noToken: string;
  networkUnreach: string;
  disconnect: string;
  filter: string;
  sortNewest: string;
  sortOldest: string;
  sortAZ: string;
  sortZA: string;
  sortStarsDesc: string;
  sortStarsAsc: string;
  configTitle: string;
  stepCreate: string;
  stepCallback: string;
  stepFill: string;
  redirectLabel: string;
  copy: string;
  copied: string;
  clientId: string;
  clientSecret: string;
  saveCreds: string;
  credsSaved: string;
  fillAll: string;
  minsAgo: string;
  hrsAgo: string;
  daysAgo: string;
  justNow: string;
  logManagement: string;
  logCount: string;
  exportLog: string;
  clearLog: string;
  noLogs: string;
  logExported: string;
  releaseNew: string;
  releaseMulti: string;
  foundNew: string;
  releaseCount: string;
  scanComplete: string;
  releaseStable: string;
  releasePreRelease: string;
  disableCheck: string;
  enableCheck: string;
  markAllRead: string;
  checked: string;
  repos: string;
  took: string;
  seconds: string;
  noUpdatesFiltered: string;
}

export type TranslationKey = keyof TranslationKeys;

export type SupportedLanguage = 'zh' | 'en';
