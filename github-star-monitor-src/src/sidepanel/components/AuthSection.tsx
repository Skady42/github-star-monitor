import type { StatusData } from '../hooks/useStatus';

interface AuthSectionProps {
  status: StatusData;
  onAuthClick: () => void;
  connecting: boolean;
}

export default function AuthSection({ status, onAuthClick, connecting }: AuthSectionProps) {
  if (status.hasToken && status.user) {
    return (
      <section className="auth-section">
        <div className="auth-connected">
          <span>{status.user}</span>
        </div>
      </section>
    );
  }

  if (!status.hasCredentials) {
    return null;
  }

  return (
    <section className="auth-section">
      <button className="auth-btn" disabled={connecting} onClick={onAuthClick}>
        {connecting ? 'CONNECTING...' : 'CONNECT GITHUB'}
      </button>
    </section>
  );
}
