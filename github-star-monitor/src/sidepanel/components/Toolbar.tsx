import { t } from '../../lib/i18n';
import { sendMessage } from '../hooks/useStatus';

interface ToolbarProps {
  searchPlaceholder: string;
  onSearch: (term: string) => void;
  onSort: (mode: string) => void;
  onMarkAllRead: () => void;
}

export default function Toolbar({ onSearch, onSort, onMarkAllRead }: ToolbarProps) {
  const handleMarkAllRead = async () => {
    await sendMessage({ action: 'markAllAsRead' });
    onMarkAllRead();
  };

  return (
    <div className="list-toolbar">
      <input
        className="search-input"
        type="text"
        placeholder={t('filter')}
        onChange={(e) => onSearch(e.target.value)}
      />
      <select className="sort-select" onChange={(e) => onSort(e.target.value)}>
        <option value="newest">{t('sortNewest')}</option>
        <option value="oldest">{t('sortOldest')}</option>
        <option value="az">{t('sortAZ')}</option>
        <option value="za">{t('sortZA')}</option>
        <option value="stars-desc">{t('sortStarsDesc')}</option>
        <option value="stars-asc">{t('sortStarsAsc')}</option>
      </select>
      <button className="toolbar-btn" title={t('markAllRead')} onClick={handleMarkAllRead}>
        &#x2713;
      </button>
    </div>
  );
}
