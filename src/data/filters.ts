import type { FilterPresetId, PhotoAsset, PhotoStats } from '../types';

export interface FilterPreset {
  id: FilterPresetId;
  name: string;
  description: string;
  css: string;
  swatch: string;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: [number, number, number];
  tintAmount: number;
  fade: number;
  target: {
    luminance: number;
    saturation: number;
    temperature: number;
  };
}

export const FILTER_PRESETS: readonly FilterPreset[] = [
  {
    id: 'papel',
    name: 'Papel',
    description: 'Neutro, quente e editorial.',
    css: 'brightness(1.02) contrast(0.96) saturate(0.92) sepia(0.06)',
    swatch: '#F7F5EF',
    brightness: 0.015,
    contrast: 0.96,
    saturation: 0.92,
    temperature: 0.12,
    tint: [247, 245, 239],
    tintAmount: 0.05,
    fade: 0.08,
    target: { luminance: 0.64, saturation: 0.28, temperature: 0.14 },
  },
  {
    id: 'fresco',
    name: 'Fresco',
    description: 'Limpo, claro e levemente frio.',
    css: 'brightness(1.04) contrast(1.03) saturate(1.02) hue-rotate(-3deg)',
    swatch: '#C9EEDB',
    brightness: 0.025,
    contrast: 1.03,
    saturation: 1.02,
    temperature: -0.18,
    tint: [201, 238, 219],
    tintAmount: 0.06,
    fade: 0.04,
    target: { luminance: 0.66, saturation: 0.3, temperature: -0.18 },
  },
  {
    id: 'criativo',
    name: 'Criativo',
    description: 'Contraste alto com um toque lilás.',
    css: 'brightness(1.01) contrast(1.08) saturate(1.14) hue-rotate(-2deg)',
    swatch: '#6C4CF5',
    brightness: 0.01,
    contrast: 1.08,
    saturation: 1.14,
    temperature: -0.04,
    tint: [108, 76, 245],
    tintAmount: 0.07,
    fade: 0.05,
    target: { luminance: 0.58, saturation: 0.4, temperature: -0.04 },
  },
  {
    id: 'humano',
    name: 'Humano',
    description: 'Quente, solar e acolhedor.',
    css: 'brightness(1.03) contrast(1) saturate(1.06) sepia(0.08)',
    swatch: '#FF8068',
    brightness: 0.02,
    contrast: 1,
    saturation: 1.06,
    temperature: 0.26,
    tint: [255, 128, 104],
    tintAmount: 0.06,
    fade: 0.05,
    target: { luminance: 0.62, saturation: 0.36, temperature: 0.26 },
  },
  {
    id: 'tinta',
    name: 'Tinta',
    description: 'Preto e branco com presença.',
    css: 'grayscale(1) contrast(1.16)',
    swatch: '#201932',
    brightness: 0,
    contrast: 1.16,
    saturation: 0,
    temperature: 0,
    tint: [32, 25, 50],
    tintAmount: 0,
    fade: 0.02,
    target: { luminance: 0.56, saturation: 0.02, temperature: 0 },
  },
];

export const FILTER_PRESET_MAP = Object.fromEntries(
  FILTER_PRESETS.map((preset) => [preset.id, preset]),
) as Record<FilterPresetId, FilterPreset>;

export function isFilterPresetId(value: unknown): value is FilterPresetId {
  return typeof value === 'string' && value in FILTER_PRESET_MAP;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(
  a: { luminance: number; saturation: number; temperature: number },
  b: { luminance: number; saturation: number; temperature: number },
): number {
  return Math.hypot(
    a.luminance - b.luminance,
    (a.saturation - b.saturation) * 1.4,
    (a.temperature - b.temperature) * 1.2,
  );
}

function styledStats(stats: PhotoStats, preset: FilterPreset) {
  return {
    luminance: clamp(
      stats.luminance +
        preset.brightness +
        (preset.contrast - 1) * (stats.luminance - 0.5) * 0.6,
      0,
      1,
    ),
    saturation: clamp(stats.saturation * preset.saturation, 0, 1),
    temperature: clamp(stats.temperature + preset.temperature, -1, 1),
  };
}

/**
 * Escolhe o preset que deixa o conjunto de fotos mais coerente.
 * A conta combina a dispersão entre as fotos com a distância até o alvo
 * de cada preset — assim uma foto sozinha ainda recebe um filtro autoral.
 */
export function pickPreset(photos: PhotoAsset[]): FilterPresetId {
  if (photos.length === 0) return 'papel';

  let bestId: FilterPresetId = 'papel';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const preset of FILTER_PRESETS) {
    const styled = photos.map((photo) => styledStats(photo.stats, preset));
    const mean = styled.reduce(
      (acc, item) => ({
        luminance: acc.luminance + item.luminance / styled.length,
        saturation: acc.saturation + item.saturation / styled.length,
        temperature: acc.temperature + item.temperature / styled.length,
      }),
      { luminance: 0, saturation: 0, temperature: 0 },
    );

    const spread =
      styled.reduce((total, item) => total + distance(item, mean), 0) /
      styled.length;
    const brand = distance(mean, preset.target);
    const score = spread * 0.75 + brand * 0.25;

    if (score < bestScore) {
      bestScore = score;
      bestId = preset.id;
    }
  }

  return bestId;
}
