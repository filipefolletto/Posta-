import type { ImageAlign, ImageAnchor, ImageFormat, PlatformId } from '../types';

export interface ImageFormatSpec {
  id: ImageFormat;
  name: string;
  hint: string;
  width: number;
  height: number;
}

export const IMAGE_FORMATS: Record<ImageFormat, ImageFormatSpec> = {
  feed: {
    id: 'feed',
    name: 'Feed 4:5',
    hint: 'Instagram',
    width: 1080,
    height: 1350,
  },
  square: {
    id: 'square',
    name: 'Quadrado 1:1',
    hint: 'Feed e LinkedIn',
    width: 1080,
    height: 1080,
  },
  story: {
    id: 'story',
    name: 'Story 9:16',
    hint: 'TikTok e Stories',
    width: 1080,
    height: 1920,
  },
};

export const IMAGE_FORMAT_IDS: readonly ImageFormat[] = ['feed', 'square', 'story'];

export function defaultFormatFor(platform: PlatformId): ImageFormat {
  if (platform === 'tiktok') return 'story';
  if (platform === 'linkedin') return 'square';
  return 'feed';
}

export function isImageFormat(value: unknown): value is ImageFormat {
  return typeof value === 'string' && value in IMAGE_FORMATS;
}

export function isImageAnchor(value: unknown): value is ImageAnchor {
  return value === 'top' || value === 'center' || value === 'bottom';
}

export function isImageAlign(value: unknown): value is ImageAlign {
  return value === 'left' || value === 'center' || value === 'right';
}
