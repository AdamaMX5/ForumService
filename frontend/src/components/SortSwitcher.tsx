import type { SortMode } from '../api/types';

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'beste', label: 'Beste' },
  { value: 'neu', label: 'Neueste' },
  { value: 'likes', label: 'Meistgelikt' },
];

export function SortSwitcher({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  return (
    <div className="inline-flex rounded border border-gray-300 text-sm dark:border-gray-600" role="group" aria-label="Sortierung">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1 first:rounded-l last:rounded-r ${
            value === opt.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
