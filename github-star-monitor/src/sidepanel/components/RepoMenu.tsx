import { useEffect, useRef } from 'react';
import { t } from '../../lib/i18n';
import { sendMessage } from '../hooks/useStatus';
import { useRepoSettings } from '../hooks/useRepoSettings';

interface RepoMenuProps {
  repo: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSettingsChange: () => void;
}

export default function RepoMenu({ repo, anchorEl, onClose, onSettingsChange }: RepoMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { settings } = useRepoSettings();

  useEffect(() => {
    if (!anchorEl || !menuRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    menuRef.current.style.position = 'fixed';
    menuRef.current.style.top = (rect.bottom + 4) + 'px';
    menuRef.current.style.left = (rect.left - 100) + 'px';
  }, [anchorEl]);

  const handleSelect = async (type: 'stable' | 'pre-release') => {
    await sendMessage({ action: 'setRepoReleaseType', repo, releaseType: type });
    onSettingsChange();
    onClose();
  };

  const handleDisableToggle = async (disabled: boolean) => {
    await sendMessage({ action: 'setRepoDisabled', repo, disabled });
    onSettingsChange();
    onClose();
  };

  const isDisabled = settings[repo]?.disabled || false;

  return (
    <div className="repo-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <div className="repo-menu-title">{repo}</div>
      <button
        className={`repo-menu-option`}
        onClick={() => handleSelect('stable')}
      >
        {t('releaseStable')}
      </button>
      <button
        className={`repo-menu-option`}
        onClick={() => handleSelect('pre-release')}
      >
        {t('releasePreRelease')}
      </button>
      <button
        className={`repo-menu-option ${isDisabled ? 'active' : ''}`}
        onClick={() => handleDisableToggle(!isDisabled)}
      >
        {isDisabled ? t('enableCheck') : t('disableCheck')}
      </button>
    </div>
  );
}
