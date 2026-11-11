import type { Platform, PlatformId } from '../types';

export const PLATFORMS: Platform[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@seu.perfil',
    hint: 'Storytelling, reels e carrossel',
    characterLimit: 2200,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    handle: '@seu.perfil',
    hint: 'Hook rápido e vídeo curto',
    characterLimit: 2200,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    handle: 'seu perfil',
    hint: 'Insight, autoridade e conversa',
    characterLimit: 3000,
  },
];

export const PLATFORM_MAP: Record<PlatformId, Platform> = {
  instagram: PLATFORMS[0],
  tiktok: PLATFORMS[1],
  linkedin: PLATFORMS[2],
};

export function isPlatformId(value: unknown): value is PlatformId {
  return value === 'instagram' || value === 'tiktok' || value === 'linkedin';
}
