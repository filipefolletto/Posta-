import type { Brief, ImageFontId } from '../types';

export interface ImageFontPreset {
  id: ImageFontId;
  name: string;
  description: string;
  family: string;
  headlineWeight: number;
  sublineWeight: number;
  sublineStyle: 'normal' | 'italic';
  headlineScale: number;
  sublineScale: number;
}

export const IMAGE_FONTS: readonly ImageFontPreset[] = [
  {
    id: 'manrope',
    name: 'Manrope',
    description: 'Sans moderna e amigável, boa para o dia a dia.',
    family: 'Manrope, "Segoe UI", system-ui, sans-serif',
    headlineWeight: 800,
    sublineWeight: 500,
    sublineStyle: 'normal',
    headlineScale: 1,
    sublineScale: 1,
  },
  {
    id: 'lora',
    name: 'Lora',
    description: 'Serifada editorial, com mais autoridade e calma.',
    family: 'Lora, Georgia, "Times New Roman", serif',
    headlineWeight: 700,
    sublineWeight: 500,
    sublineStyle: 'italic',
    headlineScale: 0.98,
    sublineScale: 1.04,
  },
  {
    id: 'inter',
    name: 'Inter',
    description: 'Sans limpa e objetiva, pensada para leitura rápida.',
    family: 'Inter, "Segoe UI", system-ui, sans-serif',
    headlineWeight: 700,
    sublineWeight: 500,
    sublineStyle: 'normal',
    headlineScale: 0.96,
    sublineScale: 1,
  },
  {
    id: 'playfair',
    name: 'Playfair',
    description: 'Serifada elegante, ideal para ideias inspiradoras.',
    family: '"Playfair Display", Georgia, "Times New Roman", serif',
    headlineWeight: 700,
    sublineWeight: 500,
    sublineStyle: 'italic',
    headlineScale: 1.02,
    sublineScale: 1.06,
  },
  {
    id: 'space',
    name: 'Space Grotesk',
    description: 'Geométrica com energia de feed, vídeo e criatividade.',
    family: '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
    headlineWeight: 700,
    sublineWeight: 500,
    sublineStyle: 'normal',
    headlineScale: 1,
    sublineScale: 1,
  },
];

export const IMAGE_FONT_MAP: Record<ImageFontId, ImageFontPreset> = Object.fromEntries(
  IMAGE_FONTS.map((font) => [font.id, font]),
) as Record<ImageFontId, ImageFontPreset>;

export function isImageFontId(value: unknown): value is ImageFontId {
  return typeof value === 'string' && value in IMAGE_FONT_MAP;
}

/**
 * A fonte acompanha o tipo de post: plataforma + tom principal.
 * O usuário ainda pode trocar manualmente no PhotoStudio.
 */
export function recommendedFontFor(brief: Brief): ImageFontId {
  const tone = brief.tones[0] ?? 'autentico';

  if (brief.platform === 'linkedin') {
    return tone === 'bem-humorado' ? 'space' : 'lora';
  }

  if (brief.platform === 'tiktok') {
    return tone === 'educativo' ? 'inter' : 'space';
  }

  switch (tone) {
    case 'inspirador':
      return 'playfair';
    case 'bem-humorado':
      return 'space';
    case 'educativo':
      return 'inter';
    default:
      return 'manrope';
  }
}
