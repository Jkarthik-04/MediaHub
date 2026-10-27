import type { LibraryEntry } from '../services/mediahub-api';

type Props = {
  entry: LibraryEntry;
  value: string;
  currentUnitId: string;
  saving: boolean;
  onValueChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onSave: () => void;
};

export function ProgressControl({
  entry,
  value,
  currentUnitId,
  saving,
  onValueChange,
  onUnitChange,
  onSave,
}: Props) {
  const progressMode = entry.mediaItem.mediaType.progressMode;
  const unitLabel =
    progressMode === 'PERCENTAGE'
      ? 'percent'
      : progressMode === 'EPISODE'
        ? 'episodes'
        : progressMode === 'PAGE'
          ? 'pages'
          : progressMode === 'CHAPTER'
            ? 'chapters'
            : progressMode === 'VOLUME'
              ? 'volumes'
              : 'units';
  const maximum = progressMode === 'PERCENTAGE' ? 100 : (entry.mediaItem.totalUnits ?? undefined);

  return (
    <div className="progress-control">
      <label htmlFor={`progress-${entry.id}`}>Progress ({unitLabel})</label>
      <input
        id={`progress-${entry.id}`}
        aria-label={`New progress for ${entry.mediaItem.title}`}
        type="number"
        min={0}
        max={maximum}
        step="any"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {entry.mediaItem.units.length > 0 && (
        <>
          <label htmlFor={`current-unit-${entry.id}`}>Current episode or unit</label>
          <select
            id={`current-unit-${entry.id}`}
            value={currentUnitId}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            <option value="">No specific unit</option>
            {entry.mediaItem.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.seasonNumber !== null ? `Season ${unit.seasonNumber} · ` : ''}
                {unit.title || `${unit.unitKind} ${unit.sequenceNumber ?? ''}`}
              </option>
            ))}
          </select>
        </>
      )}
      <button className="tab" disabled={saving} onClick={onSave} type="button">
        {saving ? 'Saving…' : 'Save progress'}
      </button>
    </div>
  );
}
