import React from 'react';
import { Search, Bell, Shield } from 'lucide-react';
import { User } from '../../types';
import { useToast } from '../../context/ToastContext';

interface TopbarProps {
  currentUser: User;
  onOpenCommand: () => void;
  onOpenLogin?: () => void;
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ currentUser, onOpenCommand, onOpenLogin }) => {
  const { toast } = useToast();
  return (
    <header
      style={{
        height: '48px',
        backgroundColor: 'var(--color-dark-charcoal)',
        borderBottom: '1px solid var(--color-border-gray)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onOpenCommand}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            backgroundColor: 'var(--color-charcoal)',
            border: '1px solid var(--color-border-gray)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-light-gray)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <Search size={13} />
          <span>Search or jump to...</span>
          <kbd
            style={{
              padding: '1px 5px',
              backgroundColor: 'var(--color-dark-gray)',
              border: '1px solid var(--color-border-gray)',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-off-white)',
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            backgroundColor: 'var(--color-charcoal)',
            border: '1px solid var(--color-border-gray)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--color-light-gray)',
          }}
        >
          <Shield size={12} color="#81C784" />
          <span>RBAC: {currentUser.role}</span>
        </div>

        {onOpenLogin && (
          <button
            className="btn btn-outline btn-sm"
            onClick={onOpenLogin}
            style={{ fontSize: '11px', padding: '3px 8px' }}
          >
            Authenticate
          </button>
        )}

        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-light-gray)',
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
          }}
          onClick={() =>
            toast.info(
              'All institutional systems operational. Real-time PostgreSQL event stream active.',
              'Notification Center'
            )
          }
        >
          <Bell size={16} />
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '6px',
              height: '6px',
              backgroundColor: 'var(--color-warning)',
              borderRadius: '50%',
            }}
          />
        </button>
      </div>
    </header>
  );
};
