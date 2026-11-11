import { MAX_TONES, TONES } from '../data/tones';
import type { ToneId } from '../types';

interface TonePickerProps {
  value: ToneId[];
  onChange: (tones: ToneId[]) => void;
}

export function TonePicker({ value, onChange }: TonePickerProps) {
  function toggle(id: ToneId) {
    if (value.includes(id)) {
      onChange(value.filter((tone) => tone !== id));
      return;
    }

    if (value.length >= MAX_TONES) {
      // Mantém o tom mais recente e abre espaço para o novo.
      onChange([value[value.length - 1], id]);
      return;
    }

    onChange([...value, id]);
  }

  return (
    <div className="tone-row" role="group" aria-label="Tom de voz">
      {TONES.map((tone) => {
        const active = value.includes(tone.id);

        return (
          <button
            key={tone.id}
            type="button"
            className={`tone-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => toggle(tone.id)}
            title={tone.hint}
          >
            <span className="tone-dot" aria-hidden="true" />
            {tone.name}
          </button>
        );
      })}
    </div>
  );
}
