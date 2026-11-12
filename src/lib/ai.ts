import { isFilterPresetId, pickPreset } from '../data/filters';
import { isImageFontId, recommendedFontFor } from '../data/fonts';
import { isImageAlign, isImageAnchor } from '../data/formats';
import { generateImageText, generatePost } from './generator';
import { photoToDataUrl } from './image';
import type {
  Brief,
  FilterPresetId,
  GeneratedPost,
  ImageAlign,
  ImageAnchor,
  ImageFontId,
  ImageText,
  PhotoAsset,
} from '../types';

const AI_TIMEOUT_MS = 65_000;
const VISION_PHOTO_LIMIT = 3;

export interface AiStatus {
  enabled: boolean;
  provider: string;
  textModel: string;
  visionModel: string;
}

export type AiSource = 'ai' | 'local';

export interface GeneratePostResult {
  post: GeneratedPost;
  source: AiSource;
  notice?: string;
}

export interface PhotoAnalysis {
  presetId: FilterPresetId;
  font: ImageFontId;
  anchor: ImageAnchor;
  align: ImageAlign;
  reason: string;
  source: AiSource;
  notice?: string;
}

class AiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AiRequestError';
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;

    const cleaned = item.trim().replace(/\s+/g, '');
    if (!cleaned) continue;

    const tag = (cleaned.startsWith('#') ? cleaned : `#${cleaned}`).replace(
      /[^#a-zA-Z0-9_]/g,
      '',
    );

    if (tag.length < 2) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(tag);

    if (result.length >= 8) break;
  }

  return result;
}

function noticeFor(error: unknown): string {
  if (error instanceof AiRequestError && error.code === 'AI_NOT_CONFIGURED') {
    return 'IA real não configurada; usando a demonstração local.';
  }

  return 'IA real indisponível; usando a demonstração local.';
}

async function requestJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const abort = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener('abort', abort);
  }

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!response.ok) {
      const code =
        typeof data?.error === 'string' ? data.error : 'AI_REQUEST_FAILED';
      const message =
        typeof data?.message === 'string'
          ? data.message
          : 'A IA real não respondeu.';

      throw new AiRequestError(message, code, response.status);
    }

    return data as T;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function toGeneratedPost(
  content: unknown,
  brief: Brief,
  variant: number,
): GeneratedPost {
  if (!content || typeof content !== 'object') {
    throw new AiRequestError(
      'A IA não retornou o conteúdo esperado.',
      'AI_INVALID_CONTENT',
      502,
    );
  }

  const raw = content as Record<string, unknown>;
  const caption = cleanText(raw.caption, 5000);

  if (!caption) {
    throw new AiRequestError(
      'A IA não retornou uma legenda válida.',
      'AI_INVALID_CONTENT',
      502,
    );
  }

  const fallback = generatePost(brief, variant);
  const imageTextRaw =
    raw.imageText && typeof raw.imageText === 'object'
      ? (raw.imageText as Record<string, unknown>)
      : {};
  const localText = generateImageText(brief, variant);
  const hashtags = normalizeHashtags(raw.hashtags);

  const imageText: ImageText = {
    headline: cleanText(imageTextRaw.headline, 60) || localText.headline,
    subline: cleanText(imageTextRaw.subline, 90) || localText.subline,
    enabled: imageTextRaw.enabled !== false,
    anchor: isImageAnchor(imageTextRaw.anchor)
      ? imageTextRaw.anchor
      : localText.anchor,
    align: isImageAlign(imageTextRaw.align)
      ? imageTextRaw.align
      : localText.align,
    font: isImageFontId(imageTextRaw.font)
      ? imageTextRaw.font
      : recommendedFontFor(brief),
  };

  return {
    id: `post_${Date.now()}_${variant}`,
    brief: { ...brief, tones: [...brief.tones] },
    caption,
    hashtags: hashtags.length > 0 ? hashtags : fallback.hashtags,
    cta: cleanText(raw.cta, 400) || fallback.cta,
    imageIdea: cleanText(raw.imageIdea, 600) || fallback.imageIdea,
    imageText,
    variant,
    createdAt: Date.now(),
  };
}

function toPhotoAnalysis(
  value: unknown,
  fallback: PhotoAnalysis,
): PhotoAnalysis {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

  return {
    presetId: isFilterPresetId(raw.presetId)
      ? raw.presetId
      : fallback.presetId,
    font: isImageFontId(raw.font) ? raw.font : fallback.font,
    anchor: isImageAnchor(raw.anchor) ? raw.anchor : fallback.anchor,
    align: isImageAlign(raw.align) ? raw.align : fallback.align,
    reason: cleanText(raw.reason, 180),
    source: 'ai',
  };
}

export async function getAiStatus(): Promise<AiStatus> {
  try {
    const response = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error('Health check indisponível.');

    const data = (await response.json()) as Partial<AiStatus>;

    return {
      enabled: Boolean(data.enabled),
      provider:
        typeof data.provider === 'string' ? data.provider : 'openai-compatible',
      textModel: typeof data.textModel === 'string' ? data.textModel : '',
      visionModel: typeof data.visionModel === 'string' ? data.visionModel : '',
    };
  } catch {
    return {
      enabled: false,
      provider: 'local',
      textModel: '',
      visionModel: '',
    };
  }
}

export async function generatePostWithAI(
  brief: Brief,
  variant: number,
  options: { enabled?: boolean; signal?: AbortSignal } = {},
): Promise<GeneratePostResult> {
  if (!options.enabled) {
    return {
      post: generatePost(brief, variant),
      source: 'local',
      notice: 'Demonstração local: configure AI_API_KEY para usar a IA real.',
    };
  }

  try {
    const data = await requestJson<{ content?: unknown }>(
      '/api/generate-post',
      { brief, variant },
      options.signal,
    );

    return {
      post: toGeneratedPost(data.content, brief, variant),
      source: 'ai',
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;

    return {
      post: generatePost(brief, variant),
      source: 'local',
      notice: noticeFor(error),
    };
  }
}

export async function analyzePhotosWithAI(
  photos: PhotoAsset[],
  brief: Brief,
  options: { enabled?: boolean; signal?: AbortSignal } = {},
): Promise<PhotoAnalysis> {
  const fallback: PhotoAnalysis = {
    presetId: pickPreset(photos),
    font: recommendedFontFor(brief),
    anchor: 'bottom',
    align: 'left',
    reason: '',
    source: 'local',
  };

  if (!options.enabled || photos.length === 0) return fallback;

  try {
    const selected = photos.slice(0, VISION_PHOTO_LIMIT);
    const payload = await Promise.all(
      selected.map(async (photo) => ({
        name: photo.name,
        dataUrl: await photoToDataUrl(photo),
        stats: {
          luminance: photo.stats.luminance,
          saturation: photo.stats.saturation,
          temperature: photo.stats.temperature,
        },
      })),
    );

    const data = await requestJson<{ analysis?: unknown }>(
      '/api/analyze-photos',
      { brief, photos: payload },
      options.signal,
    );

    return toPhotoAnalysis(data.analysis, fallback);
  } catch (error) {
    if (options.signal?.aborted) throw error;

    return {
      ...fallback,
      notice: noticeFor(error),
    };
  }
}
