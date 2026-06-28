import { t } from '../../lib/i18n';
import { sendMessage } from '../hooks/useStatus';

interface FooterProps {
  visible: boolean;
  onDisconnect: () => void;
}

export default function Footer({ visible, onDisconnect }: FooterProps) {
  if (!visible) return null;

  const handleDisconnect = async () => {
    await sendMessage({ action: 'logout' });
    onDisconnect();
  };

  return (
    <footer className="footer">
      <button className="logout-btn" onClick={handleDisconnect}>
        {t('disconnect')}
      </button>
    </footer>
  );
}
