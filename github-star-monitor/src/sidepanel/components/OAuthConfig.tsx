import { useState } from 'react';
import { t } from '../../lib/i18n';
import { sendMessage } from '../hooks/useStatus';

interface OAuthConfigProps {
  onSaved: () => void;
}

export default function OAuthConfig({ onSaved }: OAuthConfigProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [statusText, setStatusText] = useState('');
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redirectUri] = useState('FETCHING...');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setStatusText(t('fillAll'));
      setIsError(true);
      return;
    }

    const result = await sendMessage({
      action: 'saveCredentials',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });

    if (result.success) {
      setStatusText(t('credsSaved'));
      setIsError(false);
      onSaved();
    } else {
      setStatusText('FAILED: ' + ((result.error as string) || ''));
      setIsError(true);
    }
  };

  return (
    <section className="auth-section">
      <div className="config-hint">
        {t('configTitle')}
        <ol>
          <li>
            <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
              {t('stepCreate')}
            </a>
          </li>
          <li>{t('stepCallback')}</li>
          <li>{t('stepFill')}</li>
        </ol>
      </div>
      <div className="redirect-box">
        <div className="redirect-label">{t('redirectLabel')}</div>
        <code className="redirect-value">{redirectUri}</code>
        <button className={`redirect-copy${copied ? ' copied' : ''}`} onClick={handleCopy}>
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
      <label className="config-label">{t('clientId')}</label>
      <input
        className="config-input"
        type="text"
        placeholder="Ov23li..."
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      />
      <label className="config-label">{t('clientSecret')}</label>
      <input
        className="config-input"
        type="password"
        placeholder="••••••••"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
      />
      <div className="config-actions">
        <button className="config-save-btn" onClick={handleSave}>
          {t('saveCreds')}
        </button>
      </div>
      {statusText && (
        <div className={`config-status${isError ? ' error' : ''}`}>{statusText}</div>
      )}
    </section>
  );
}
