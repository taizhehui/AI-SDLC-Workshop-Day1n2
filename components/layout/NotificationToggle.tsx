'use client';

interface NotificationToggleProps {
  granted: boolean;
  supported: boolean;
  onRequest: () => void;
}

/** Browser notification opt-in (PRP 04). Two states: not-yet-granted, and granted. */
export function NotificationToggle({ granted, supported, onRequest }: NotificationToggleProps) {
  if (!supported) {
    return (
      <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        Notifications unsupported
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={granted}
      data-testid="notification-toggle"
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        granted
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-orange-500 text-white hover:bg-orange-600'
      }`}
    >
      {granted ? '🔔 Notifications On' : '🔔 Enable Notifications'}
    </button>
  );
}
