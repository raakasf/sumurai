import { useEffect } from 'react';

interface ProviderMismatchCheckProps {
  showMismatch: boolean;
  onShowMismatch: (show: boolean) => void;
  onConfirm: () => void;
}

export const ProviderMismatchCheck = ({
  showMismatch,
  onShowMismatch,
}: ProviderMismatchCheckProps) => {
  useEffect(() => {
    if (showMismatch) {
      onShowMismatch(false);
    }
  }, [onShowMismatch, showMismatch]);

  return null;
};
