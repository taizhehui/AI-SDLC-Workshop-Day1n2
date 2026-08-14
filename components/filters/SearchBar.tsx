'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Search input over todo titles and subtask titles (PRP 08). */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      >
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search todos and subtasks..."
        aria-label="Search todos and subtasks"
        data-testid="search-input"
        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      {value && (
        // Clearing bypasses the 300ms debounce — the list must snap back immediately.
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          data-testid="clear-search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ✕
        </button>
      )}
    </div>
  );
}
