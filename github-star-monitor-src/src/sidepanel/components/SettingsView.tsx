import { useState, useEffect } from 'react';
import { t, setLang } from '../../lib/i18n';
import { setLanguage } from '../../lib/storage';
import { sendMessage } from '../hooks/useStatus';
import { useLogs } from '../hooks/useLogs';

interface SettingsViewProps {
  onBack: () => void;
  checkInterval: number;
  onLanguageChange: () => void;
}

export default function SettingsView({ onBack, checkInterval, onLanguageChange }: SettingsViewProps) {
  const [interval, setInterval] = useState(checkInterval);
  const [settingsStatus, setSettingsStatus] = useState({ text: '', isError: false });
  const { logCount, logStatus, updateLogCount, handleExport, handleClear } = useLogs();
  const [version, setVersion] = useState('...');

  useEffect(() => {
    updateLogCount();
    try {
      const manifest = chrome.runtime.getManifest();
      setVersion(manifest.version);
    } catch {
      setVersion('...');
    }
  }, [updateLogCount]);

  useEffect(() => {
    setInterval(checkInterval);
  }, [checkInterval]);

  const handleSave = async () => {
    const minutes = parseInt(String(interval));
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      setSettingsStatus({ text: 'INVALID RANGE', isError: true });
      return;
    }

    const clamped = Math.max(1, Math.min(1440, minutes));
    setInterval(clamped);
    const result = await sendMessage({ action: 'saveSettings', interval: clamped });

    if (result.success) {
      setSettingsStatus({ text: t('saved'), isError: false });
    } else {
      setSettingsStatus({ text: 'FAILED', isError: true });
    }
  };

  const handleLangChange = async (lang: string) => {
    setLang(lang as any);
    await setLanguage(lang);
    onLanguageChange();
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          {t('back')}
        </button>
        <h2 className="settings-title">{t('settings')}</h2>
      </div>
      <div className="settings-body">
        <label className="settings-label">{t('scanInterval')}</label>
        <div className="settings-row">
          <input
            className="settings-input"
            type="number"
            min={1}
            max={1440}
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 0)}
          />
          <span className="settings-suffix">{t('min')}</span>
        </div>
        <p className="settings-hint">{t('range')}</p>
        <button className="settings-save-btn" onClick={handleSave}>
          {t('save')}
        </button>
        {settingsStatus.text && (
          <div className={`settings-status${settingsStatus.isError ? ' error' : ''}`}>
            {settingsStatus.text}
          </div>
        )}

        <div className="settings-divider" />

        <label className="settings-label">{t('lang')}</label>
        <div className="settings-row">
          <select className="lang-select" onChange={(e) => handleLangChange(e.target.value)}>
            <option value="en">ENGLISH</option>
            <option value="zh">中文</option>
          </select>
        </div>

        <div className="settings-divider" />

        <label className="settings-label">{t('logManagement')}</label>
        <div className="log-stats">
          <span>{t('logCount')}: {logCount}</span>
        </div>
        <div className="log-actions">
          <button className="log-btn" onClick={handleExport}>
            {t('exportLog')}
          </button>
          <button className="log-btn" onClick={handleClear}>
            {t('clearLog')}
          </button>
        </div>
        {logStatus.text && (
          <div className={`log-status${logStatus.isError ? ' error' : ''}`}>
            {logStatus.text}
          </div>
        )}

        <div className="settings-divider" />

        <a
          className="repo-link"
          href="https://github.com/Skady42/github-star-monitor"
          target="_blank"
          rel="noreferrer"
        >
          GITHUB REPO &#x2197;
        </a>

        <div className="settings-divider" />

        <div className="version-text">VERSION <span>{version}</span></div>
      </div>
    </div>
  );
}
