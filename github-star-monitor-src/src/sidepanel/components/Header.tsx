import { t } from '../../lib/i18n';

interface HeaderProps {
  onSettingsClick: () => void;
  isOnline: boolean;
}

export default function Header({ onSettingsClick, isOnline }: HeaderProps) {
  return (
    <header className="console-header">
      <h1 className="console-title">
        <span>//</span> {t('title')}
      </h1>
      <div className="header-controls">
        <button className="settings-btn" title={t('settings')} onClick={onSettingsClick}>
          &#x2699;
        </button>
        <span className={`status-lamp${isOnline ? ' online' : ''}`} />
      </div>
    </header>
  );
}
