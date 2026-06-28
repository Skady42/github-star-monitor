import { useState, useCallback } from 'react';
import { useStatus } from './hooks/useStatus';
import type { ReleaseWithRead } from '../lib/types';
import Header from './components/Header';
import AuthSection from './components/AuthSection';
import OAuthConfig from './components/OAuthConfig';
import ActionsSection from './components/ActionsSection';
import UpdatesSection from './components/UpdatesSection';
import Footer from './components/Footer';
import SettingsView from './components/SettingsView';
import { sendMessage } from './hooks/useStatus';

function App() {
  const { status, loading, loadStatus, refresh, getRelativeTime } = useStatus();
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [connecting, setConnecting] = useState(false);
  const [currentUpdates, setCurrentUpdates] = useState<ReleaseWithRead[]>([]);

  const handleSettingsClick = useCallback(() => setView('settings'), []);
  const handleBackClick = useCallback(() => setView('main'), []);

  const handleAuthClick = useCallback(async () => {
    setConnecting(true);
    const result = await sendMessage({ action: 'startOAuth' });
    setConnecting(false);
    if (result.success) {
      await loadStatus();
    }
  }, [loadStatus]);

  const handleCredentialsSaved = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  const handleScanResult = useCallback((updates: ReleaseWithRead[]) => {
    setCurrentUpdates(updates);
  }, []);

  const handleRead = useCallback((repo: string) => {
    setCurrentUpdates((prev) =>
      prev.map((u) => (u.repo === repo ? { ...u, read: true } : u))
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setCurrentUpdates((prev) => prev.map((u) => ({ ...u, read: true })));
  }, []);

  const handleDisconnect = useCallback(async () => {
    await loadStatus();
    setCurrentUpdates([]);
  }, [loadStatus]);

  const handleLanguageChange = useCallback(async () => {
    await loadStatus();
  }, [loadStatus]);

  const handleSettingsChange = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const updates = currentUpdates.length > 0 ? currentUpdates : status.updates;

  if (loading) return null;

  return (
    <div className="app">
      {view === 'main' ? (
        <div className="main-view">
          <Header onSettingsClick={handleSettingsClick} isOnline={status.hasToken} />

          {!status.hasToken && !status.hasCredentials && (
            <OAuthConfig onSaved={handleCredentialsSaved} />
          )}

          {status.hasToken && status.user && (
            <AuthSection
              status={status}
              onAuthClick={handleAuthClick}
              connecting={connecting}
            />
          )}

          {status.hasCredentials && !status.hasToken && (
            <AuthSection
              status={status}
              onAuthClick={handleAuthClick}
              connecting={connecting}
            />
          )}

          <ActionsSection
            disabled={!status.hasToken}
            lastCheckTime={status.lastCheckTime}
            getRelativeTime={getRelativeTime}
            onScanResult={handleScanResult}
          />

          <UpdatesSection
            updates={updates}
            hasToken={status.hasToken}
            status={status.status}
            repoSettings={{}}
            onRead={handleRead}
            onMarkAllRead={handleMarkAllRead}
            onSettingsChange={handleSettingsChange}
          />

          <Footer visible={status.hasToken} onDisconnect={handleDisconnect} />
        </div>
      ) : (
        <SettingsView
          onBack={handleBackClick}
          checkInterval={status.checkInterval}
          onLanguageChange={handleLanguageChange}
        />
      )}
    </div>
  );
}

export default App;
