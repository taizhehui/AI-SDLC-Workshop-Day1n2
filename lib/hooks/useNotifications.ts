'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api-client';
import { formatDueDate, getSingaporeNow, toSingaporeTimestamp } from '../timezone';
import type { Todo } from '../db/types';

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

interface CheckResponse {
  success: boolean;
  data: Todo[];
}

/**
 * Browser notification permission plus the reminder polling loop (PRP 04).
 *
 * Timing is entirely server-side: this hook only asks "what is due?" every 30 seconds and
 * shows whatever comes back. Deduplication is enforced by the server stamping
 * `last_notification_sent`, not by client state, so refreshes and restarts cannot re-fire a
 * reminder.
 *
 * Known limitation: with no service worker, reminders only fire while a tab is open.
 */
export function useNotifications(enabled = true) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;
    setSupported(isSupported);
    if (isSupported) setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch (error) {
      console.error('Notification permission request failed:', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !supported || permission !== 'granted') return;

    let cancelled = false;

    const poll = async () => {
      // Re-check on every tick: permission can be revoked mid-session, and calling
      // `new Notification()` without it throws in some browsers.
      if (Notification.permission !== 'granted') {
        setPermission(Notification.permission);
        return;
      }

      try {
        const { data } = await apiClient.get<CheckResponse>('/api/notifications/check');
        if (cancelled) return;

        for (const todo of data) {
          new Notification(todo.title, {
            body: todo.due_date ? `Due ${formatDueDate(todo.due_date)}` : 'Reminder',
            // Same tag => the OS coalesces repeats instead of stacking them, which softens
            // the multi-tab race where two tabs poll before either PUT lands.
            tag: `todo-${todo.id}`,
          });

          await apiClient.put(`/api/todos/${todo.id}`, {
            last_notification_sent: toSingaporeTimestamp(getSingaporeNow()),
          });
        }
      } catch (error) {
        console.error('Reminder poll failed:', error);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, supported, permission]);

  return { permission, supported, requestPermission, granted: permission === 'granted' };
}
