import { isAudienceId } from '../data/audiences';
import { isImageFontId, recommendedFontFor } from '../data/fonts';
import { isImageAlign, isImageAnchor } from '../data/formats';
import { isPlatformId } from '../data/platforms';
import { isToneId, MAX_TONES } from '../data/tones';
import { generateImageText } from './generator';
import type { Brief, GeneratedPost, ImageText, Theme } from '../types';

const KEYS = {
  theme: 'postai.theme',
  brief: 'postai.brief',
  post: 'postai.last-post',
  quota: 'postai.quota',
} as const;

export const QUOTA_LIMIT = 3;

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

interface StoredQuota {
  date: string;
  used: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage cheio ou bloqueado: o app segue funcionando sem persistir.
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Tema                                                                      */
/* -------------------------------------------------------------------------- */

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEYS.theme);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignora storage bloqueado.
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEYS.theme, theme);
  } catch {
    // Ignora storage bloqueado.
  }
}

/* -------------------------------------------------------------------------- */
/*  Briefing                                                                  */
/* -------------------------------------------------------------------------- */

export function sanitizeBrief(value: unknown): Brief | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<Brief>;
  if (typeof raw.topic !== 'string') return null;
  if (!isPlatformId(raw.platform)) return null;
  if (!isAudienceId(raw.audience)) return null;
  if (!Array.isArray(raw.tones)) return null;

  const tones = raw.tones.filter(isToneId).slice(0, MAX_TONES);
  if (tones.length === 0) return null;

  return {
    topic: raw.topic.slice(0, 280),
    platform: raw.platform,
    tones,
    audience: raw.audience,
  };
}

export function loadBrief(): Brief | null {
  return sanitizeBrief(readJson<Brief>(KEYS.brief));
}

export function saveBrief(brief: Brief): void {
  writeJson(KEYS.brief, brief);
}

/* -------------------------------------------------------------------------- */
/*  Último post                                                               */
/* -------------------------------------------------------------------------- */

function sanitizeImageText(value: unknown, brief: Brief): ImageText | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<ImageText>;
  if (typeof raw.headline !== 'string') return null;

  return {
    headline: raw.headline.slice(0, 60),
    subline: typeof raw.subline === 'string' ? raw.subline.slice(0, 90) : '',
    enabled: raw.enabled !== false,
    anchor: isImageAnchor(raw.anchor) ? raw.anchor : 'bottom',
    align: isImageAlign(raw.align) ? raw.align : 'left',
    font: isImageFontId(raw.font) ? raw.font : recommendedFontFor(brief),
  };
}

export function loadPost(): GeneratedPost | null {
  const raw = readJson<GeneratedPost>(KEYS.post);
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.caption !== 'string' || raw.caption.length === 0) return null;
  if (!Array.isArray(raw.hashtags)) return null;

  const brief = sanitizeBrief(raw.brief);
  if (!brief) return null;

  return {
    ...raw,
    brief,
    hashtags: raw.hashtags.filter((tag): tag is string => typeof tag === 'string'),
    imageText:
      sanitizeImageText(raw.imageText, brief) ??
      generateImageText(brief, Number.isFinite(raw.variant) ? raw.variant : 0),
  };
}

export function savePost(post: GeneratedPost): void {
  writeJson(KEYS.post, post);
}

export function clearLastPost(): void {
  try {
    localStorage.removeItem(KEYS.post);
  } catch {
    // Ignora storage bloqueado.
  }
}

/* -------------------------------------------------------------------------- */
/*  Cota de demonstração                                                      */
/* -------------------------------------------------------------------------- */

export function readQuota(): QuotaState {
  const raw = readJson<StoredQuota>(KEYS.quota);
  const used =
    raw && raw.date === todayKey() && Number.isFinite(raw.used)
      ? Math.max(0, Math.floor(raw.used))
      : 0;

  return {
    used,
    limit: QUOTA_LIMIT,
    remaining: Math.max(0, QUOTA_LIMIT - used),
  };
}

export function consumeQuota(): { ok: boolean; quota: QuotaState } {
  const current = readQuota();

  if (current.remaining <= 0) {
    return { ok: false, quota: current };
  }

  writeJson(KEYS.quota, {
    date: todayKey(),
    used: current.used + 1,
  } satisfies StoredQuota);

  return { ok: true, quota: readQuota() };
}

export function resetQuota(): QuotaState {
  writeJson(KEYS.quota, { date: todayKey(), used: 0 } satisfies StoredQuota);
  return readQuota();
}
