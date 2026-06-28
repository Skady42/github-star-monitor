import { useState } from 'react';
import { t } from '../../lib/i18n';
import { sendMessage } from '../hooks/useStatus';
import type { ReleaseWithRead } from '../../lib/types';

interface ActionsSectionProps {
  disabled: boolean;
  lastCheckTime: string | null;
  getRelativeTime: (date: Date) => string;
  onScanResult: (updates: ReleaseWithRead[]) => void;
}

export default function ActionsSection({ disabled, lastCheckTime, getRelativeTime, onScanResult }: ActionsSectionProps) {
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusClass, setStatusClass] = useState('');

  const handleScan = async () => {
    setScanning(true);
    const result = await sendMessage({ action: 'checkNow' });
    setScanning(false);

    if (result.updates && (result.updates as ReleaseWithRead[]).length > 0) {
      onScanResult(result.updates as ReleaseWithRead[]);
    }

    if (result.status === 'success') {
      setStatusText(t('success'));
      setStatusClass('check-result-success');
    } else if (result.status === 'network_error') {
      setStatusText(t('networkErr'));
      setStatusClass('check-result-error');
    } else if (result.status === 'error') {
      setStatusText(t('checkFail'));
      setStatusClass('check-result-error');
    }
  };

  const displayTime = lastCheckTime
    ? t('lastScan') + ': ' + getRelativeTime(new Date(lastCheckTime))
    : t('lastScan') + ': --';

  return (
    <section className="actions">
      <button className="check-btn" disabled={disabled || scanning} onClick={handleScan}>
        {scanning ? t('scanning') : t('scan')}
      </button>
      <div className="check-status">
        <span>{displayTime}</span>
        {statusText && <span className={statusClass}>{statusText}</span>}
      </div>
    </section>
  );
}
