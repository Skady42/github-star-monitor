import { useState, useCallback } from 'react';
import type { RepoSettings, RepoSetting } from '../../lib/types';
import { sendMessage } from './useStatus';

export function useRepoSettings(initial: RepoSettings = {}) {
  const [settings, setSettings] = useState<RepoSettings>(initial);

  const setReleaseType = useCallback(async (repo: string, releaseType: RepoSetting['releaseType']) => {
    setSettings(prev => ({
      ...prev,
      [repo]: { ...prev[repo], releaseType },
    }));
    await sendMessage({ action: 'setRepoReleaseType', repo, releaseType });
  }, []);

  const toggleDisabled = useCallback(async (repo: string, disabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      [repo]: { ...prev[repo], disabled },
    }));
    await sendMessage({ action: 'setRepoDisabled', repo, disabled });
  }, []);

  return { settings, setSettings, setReleaseType, toggleDisabled };
}
