import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/ui/primitives';
import { BankCard } from '../../../components/BankCard';
import { DisconnectModal } from '../../../components/DisconnectModal';
import ConnectButton from './ConnectButton';

export interface BankAccount {
  id: string;
  name: string;
  mask: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';
  balance?: number;
  transactions?: number;
}

export interface BankConnectionViewModel {
  id: string;
  name: string;
  short: string;
  status: 'connected' | 'needs_reauth' | 'error';
  lastSync?: string | null;
  accounts: BankAccount[];
}

interface ConnectionsListProps {
  banks: BankConnectionViewModel[];
  onConnect: () => void;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onReconnect?: (id: string) => Promise<void>;
  onAccountSelect?: (accountId: string) => void;
}

const ConnectionsList = ({
  banks,
  onConnect,
  onSync,
  onDisconnect,
  onReconnect,
  onAccountSelect,
}: ConnectionsListProps) => {
  const [disconnectBank, setDisconnectBank] = useState<BankConnectionViewModel | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const closeDisconnectModal = () => {
    if (disconnectLoading) return;
    setDisconnectError(null);
    setDisconnectBank(null);
  };

  const confirmDisconnect = async () => {
    if (!disconnectBank) return;

    setDisconnectLoading(true);
    setDisconnectError(null);
    try {
      await onDisconnect(disconnectBank.id);
      setDisconnectBank(null);
    } catch (error) {
      setDisconnectError(
        error instanceof Error ? error.message : 'Failed to disconnect this connection'
      );
    } finally {
      setDisconnectLoading(false);
    }
  };

  if (!banks.length) {
    return (
      <EmptyState
        icon={Link2}
        title="No accounts connected yet"
        description="Add your first institution to unlock live balances and automated transaction sync."
        action={<ConnectButton onClick={onConnect} />}
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        {banks.map((bank) => (
          <BankCard
            key={bank.id}
            bank={bank}
            onSync={onSync}
            onDisconnectClick={(nextBank) => {
              setDisconnectError(null);
              setDisconnectBank(nextBank);
            }}
            onReconnect={onReconnect}
            onAccountSelect={onAccountSelect}
          />
        ))}
      </div>

      {disconnectBank && (
        <DisconnectModal
          isOpen
          bank={disconnectBank}
          onConfirm={confirmDisconnect}
          onCancel={closeDisconnectModal}
          loading={disconnectLoading}
          error={disconnectError}
        />
      )}
    </>
  );
};

export default ConnectionsList;
