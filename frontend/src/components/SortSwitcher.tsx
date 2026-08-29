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
    <select
      aria-label="Sortierung"
      value={value}
      onChange={(e) => onChange(e.target.value as SortMode)}
      className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-sm text-white"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-gray-700 text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
