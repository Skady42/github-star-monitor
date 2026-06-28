import { useState, useRef, useEffect } from 'react';
import { sendMessage } from '../hooks/useStatus';
import type { ReleaseWithRead } from '../../lib/types';
import RepoMenu from './RepoMenu';

interface UpdateItemProps {
  update: ReleaseWithRead;
  onRead: (repo: string) => void;
  onSettingsChange: () => void;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function UpdateItem({ update, onRead, onSettingsChange }: UpdateItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  const handleClick = async () => {
    if (!update.read) {
      onRead(update.repo);
      await sendMessage({ action: 'markAsRead', repo: update.repo });
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  useEffect(() => {
    if (menuOpen) {
      const handle = () => setMenuOpen(false);
      document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }
  }, [menuOpen]);

  return (
    <>
      <a
        className={`update-item${update.read ? ' read' : ''}`}
        href={update.url}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
      >
        <div className="update-item-repo">{update.repo}</div>
        <div className="update-item-meta">
          <span className="update-item-tag">{update.tag}</span>
          <span className="update-item-date">{formatDate(new Date(update.published_at))}</span>
        </div>
        <button className="update-item-menu" ref={menuAnchorRef} onClick={handleMenuClick}>
          &#x22EE;
        </button>
      </a>
      {menuOpen && (
        <RepoMenu
          repo={update.repo}
          anchorEl={menuAnchorRef.current}
          onClose={() => setMenuOpen(false)}
          onSettingsChange={onSettingsChange}
        />
      )}
    </>
  );
}
