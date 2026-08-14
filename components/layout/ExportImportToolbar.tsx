'use client';

import { useRef, useState } from 'react';
import { Banner, type BannerTone } from '@/components/ui/Banner';

const LARGE_FILE_BYTES = 10 * 1024 * 1024;

interface ExportImportToolbarProps {
  onImported: () => void;
}

/** Export (JSON/CSV) and import (JSON only) controls (PRP 09). */
export function ExportImportToolbar({ onImported }: ExportImportToolbarProps) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ tone: BannerTone; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const download = (format: 'json' | 'csv') => {
    // Not a navigation: the endpoint replies with `Content-Disposition: attachment`, so the
    // browser starts a download and the current page stays put. `useRouter().push()` would
    // try to render the response as a route instead.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/todos/export?format=${format}`;
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(
      file.size > LARGE_FILE_BYTES
        ? { tone: 'info', text: 'Large file — this may take a while…' }
        : null,
    );

    try {
      const text = await file.text();
      // Parsed client-side first so a plainly invalid file never reaches the network.
      const body: unknown = JSON.parse(text);

      const response = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string; imported?: number };
      if (!response.ok) throw new Error(data.error ?? 'Failed to import todos');

      setMessage({
        tone: 'success',
        text: `Successfully imported ${data.imported ?? 0} todos`,
      });
      onImported();
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof SyntaxError
            ? 'Invalid JSON format'
            : ((error as Error).message ?? 'Failed to import todos'),
      });
    } finally {
      setImporting(false);
      // Reset so re-selecting the same file fires `change` again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => download('json')}
        data-testid="export-json-button"
        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={() => download('csv')}
        data-testid="export-csv-button"
        className="rounded-lg bg-green-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-900"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        title="Import creates new todos and does not merge with existing ones"
        data-testid="import-button"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {importing ? 'Importing…' : 'Import'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="import-file-input"
        onChange={handleFile}
      />

      {message && (
        <Banner tone={message.tone} testId="import-message" onDismiss={() => setMessage(null)}>
          {message.text}
        </Banner>
      )}
    </div>
  );
}
