import { useState, useCallback } from 'react';
import { getLogs, clearLogs, exportLogs } from '../../lib/logger';
import { t } from '../../lib/i18n';

export function useLogs() {
  const [logCount, setLogCount] = useState(0);
  const [logStatus, setLogStatus] = useState({ text: '', isError: false });

  const updateLogCount = useCallback(async () => {
    const logs = await getLogs();
    setLogCount(logs ? logs.length : 0);
  }, []);

  const handleExport = useCallback(async () => {
    const logs = await getLogs();
    if (!logs || logs.length === 0) {
      setLogStatus({ text: t('noLogs'), isError: true });
      return;
    }

    const text = await exportLogs();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `star-monitor-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    setLogStatus({ text: t('logExported'), isError: false });
  }, []);

  const handleClear = useCallback(async () => {
    await clearLogs();
    setLogCount(0);
    setLogStatus({ text: t('logCount') + ': 0', isError: false });
  }, []);

  return { logCount, logStatus, updateLogCount, handleExport, handleClear };
}
