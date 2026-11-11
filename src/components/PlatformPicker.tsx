import { PLATFORMS } from '../data/platforms';
import type { PlatformId } from '../types';
import { Icon } from './Icon';

interface PlatformPickerProps {
  value: PlatformId;
  onChange: (value: PlatformId) => void;
}

export function PlatformPicker({ value, onChange }: PlatformPickerProps) {
  return (
    <div className="platform-grid" role="radiogroup" aria-label="Onde será publicado?">
      {PLATFORMS.map((platform) => {
        const active = value === platform.id;

        return (
          <button
            key={platform.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`platform-card${active ? ' is-active' : ''}`}
            onClick={() => onChange(platform.id)}
          >
            <span className={`platform-icon platform-icon--${platform.id}`}>
              <Icon name={platform.id} size={20} />
            </span>
            <span className="platform-copy">
              <strong>{platform.name}</strong>
              <small>{platform.hint}</small>
            </span>
            <span className="platform-check" aria-hidden="true">
              <Icon name="check" size={13} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
