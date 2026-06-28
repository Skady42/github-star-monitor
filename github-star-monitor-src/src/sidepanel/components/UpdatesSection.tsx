import { useState, useMemo, useCallback } from 'react';
import type { ReleaseWithRead, RepoSettings } from '../../lib/types';
import Toolbar from './Toolbar';
import UpdateItem from './UpdateItem';
import EmptyState from './EmptyState';

interface UpdatesSectionProps {
  updates: ReleaseWithRead[];
  hasToken: boolean;
  status: string;
  repoSettings: RepoSettings;
  onRead: (repo: string) => void;
  onMarkAllRead: () => void;
  onSettingsChange: () => void;
}

export default function UpdatesSection({
  updates,
  hasToken,
  status,
  onRead,
  onMarkAllRead,
  onSettingsChange,
}: UpdatesSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('newest');

  const filtered = useMemo(() => {
    let result = updates.filter((u) =>
      u.repo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
        break;
      case 'az':
        result.sort((a, b) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));
        break;
      case 'za':
        result.sort((a, b) => b.repo.toLowerCase().localeCompare(a.repo.toLowerCase()));
        break;
      case 'stars-desc':
        result.sort((a, b) => ((b as any).stars || 0) - ((a as any).stars || 0));
        break;
      case 'stars-asc':
        result.sort((a, b) => ((a as any).stars || 0) - ((b as any).stars || 0));
        break;
    }

    return result;
  }, [updates, searchTerm, sortMode]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleSort = useCallback((mode: string) => {
    setSortMode(mode);
  }, []);

  const getEmptyType = (): 'empty' | 'error' | 'noToken' | 'noResults' => {
    if (!hasToken) return 'noToken';
    if (status === 'network_error') return 'error';
    if (filtered.length === 0 && updates.length > 0) return 'noResults';
    return 'empty';
  };

  return (
    <section className="updates-section">
      <Toolbar
        searchPlaceholder=""
        onSearch={handleSearch}
        onSort={handleSort}
        onMarkAllRead={onMarkAllRead}
      />
      <div className="update-list">
        {filtered.length === 0 ? (
          <EmptyState type={getEmptyType()} />
        ) : (
          filtered.map((update) => (
            <UpdateItem
              key={update.repo}
              update={update}
              onRead={onRead}
              onSettingsChange={onSettingsChange}
            />
          ))
        )}
      </div>
    </section>
  );
}
