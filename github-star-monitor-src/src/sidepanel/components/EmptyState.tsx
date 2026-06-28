import { t } from '../../lib/i18n';

interface EmptyStateProps {
  type: 'empty' | 'error' | 'noToken' | 'noResults';
}

export default function EmptyState({ type }: EmptyStateProps) {
  if (type === 'error') {
    return <div className="error-state">⚠ {t('networkUnreach')}</div>;
  }
  if (type === 'noToken') {
    return <div className="error-state">⚠ {t('noToken')}</div>;
  }
  if (type === 'noResults') {
    return <div className="empty-state">○ {t('noUpdatesFiltered')}</div>;
  }
  return <div className="empty-state">○ {t('noUpdates')}</div>;
}
