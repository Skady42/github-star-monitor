import { useState, useEffect, useCallback } from 'react';
import type { ReleaseWithRead, RepoSettings } from '../../lib/types';
import { t, getLang } from '../../lib/i18n';

export interface StatusData {
  hasToken: boolean;
  hasCredentials: boolean;
  user: string;
  status: string;
  lastCheckTime: string | null;
  checkInterval: number;
  updates: ReleaseWithRead[];
  redirectUri: string;
}

export function sendMessage(message: Record<string, unknown>, timeoutMs = 30000): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: 'Timeout: service worker may be sleeping' });
    }, timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response as Record<string, unknown>);
      }
    });
  });
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  const lang = getLang();
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return minutes + t('minsAgo');
  if (hours < 24) return hours + t('hrsAgo');
  if (days < 30) return days + t('daysAgo');
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
}

export function useStatus() {
  const [status, setStatus] = useState<StatusData>({
    hasToken: false,
    hasCredentials: false,
    user: '',
    status: '',
    lastCheckTime: null,
    checkInterval: 60,
    updates: [],
    redirectUri: '',
  });
  const [loading, setLoading] = useState(true);
  const [repoSettings, setRepoSettings] = useState<RepoSettings>({});

  const loadStatus = useCallback(async () => {
    const result = await sendMessage({ action: 'getStatus' });

    if ((result.status === 'network_error') && result.lastCheckTime) {
      const age = Date.now() - new Date(result.lastCheckTime as string).getTime();
      if (age > 60000) {
        const retryResult = await sendMessage({ action: 'checkNow' });
        if (retryResult.status !== 'network_error') {
          result.status = retryResult.status;
          result.updates = retryResult.updates;
          result.lastCheckTime = retryResult.lastCheckTime;
        }
      }
    }

    setStatus({
      hasToken: !!result.hasToken,
      hasCredentials: !!result.hasCredentials,
      user: (result.user as string) || '',
      status: (result.status as string) || '',
      lastCheckTime: (result.lastCheckTime as string) || null,
      checkInterval: (result.checkInterval as number) || 60,
      updates: (result.updates as ReleaseWithRead[]) || [],
      redirectUri: (result.redirectUri as string) || '',
    });
    setLoading(false);
  }, []);

  const loadRepoSettings = useCallback(async () => {
    const result = await sendMessage({ action: 'getRepoSettings' });
    setRepoSettings((result.settings as RepoSettings) || {});
  }, []);

  const refresh = useCallback(async () => {
    await sendMessage({ action: 'checkNow' });
    await loadRepoSettings();
    await loadStatus();
  }, [loadRepoSettings, loadStatus]);

  useEffect(() => {
    loadStatus();
    loadRepoSettings();
  }, [loadStatus, loadRepoSettings]);

  return {
    status,
    loading,
    repoSettings,
    setRepoSettings,
    loadStatus,
    loadRepoSettings,
    refresh,
    getRelativeTime,
  };
}
