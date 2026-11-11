import type { ToastMessage } from '../types';
import { Icon } from './Icon';

const TOAST_ICON = {
  success: 'check',
  error: 'alert',
  info: 'info',
} as const;

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          <span className="toast-icon">
            <Icon name={TOAST_ICON[toast.kind]} size={16} />
          </span>
          <span className="toast-text">{toast.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={onDismiss}
            aria-label="Fechar aviso"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
