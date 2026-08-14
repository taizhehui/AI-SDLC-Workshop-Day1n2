'use client';

export type BannerTone = 'success' | 'error' | 'info';

const TONE_STYLES: Record<BannerTone, string> = {
  success:
    'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
  error:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
};

interface BannerProps {
  tone: BannerTone;
  children: React.ReactNode;
  onDismiss?: () => void;
  testId?: string;
}

/** Inline status message for save/import/error feedback. */
export function Banner({ tone, children, onDismiss, testId }: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-2 text-sm ${TONE_STYLES[tone]}`}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
