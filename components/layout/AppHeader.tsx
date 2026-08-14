'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface AppHeaderProps {
  /** Which page is active, so the header can link to the other one. */
  current: 'list' | 'calendar';
  children?: React.ReactNode;
}

/** Top navigation shared by `/` and `/calendar`, including the logout control (PRP 11). */
export function AppHeader({ current, children }: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Navigate regardless: the cookie is almost certainly gone, and staying on a protected
      // page after a logout attempt is the worse failure mode.
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {current === 'calendar' ? 'Calendar' : 'Todos'}
        </h1>

        {current === 'calendar' ? (
          <Link
            href="/"
            data-testid="nav-list"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            List
          </Link>
        ) : (
          <Link
            href="/calendar"
            data-testid="nav-calendar"
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Calendar
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button
          type="button"
          onClick={handleLogout}
          data-testid="logout-button"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
