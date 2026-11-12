import { FILTER_PRESET_MAP } from '../data/filters';
import { IMAGE_FONT_MAP } from '../data/fonts';
import { IMAGE_FORMATS } from '../data/formats';
import type {
  FilterPresetId,
  ImageText,
  PhotoAsset,
  PhotoStats,
} from '../types';

const MAX_EDGE = 1600;
const STYLED_CACHE_LIMIT = 8;
const PREVIEW_TAG = 'postai:image';

interface NormalizedPhoto {
  canvas: HTMLCanvasElement;
  stats: PhotoStats;
}

export interface RenderOptions {
  presetId: FilterPresetId;
  intensity: number;
  text: ImageText;
  format: keyof typeof IMAGE_FORMATS;
  cover: PhotoAsset;
  original?: boolean;
}

const normalizedCache = new Map<string, NormalizedPhoto>();
const styledCache = new Map<string, HTMLCanvasElement>();

/* -------------------------------------------------------------------------- */
/*  Upload e análise                                                          */
/* -------------------------------------------------------------------------- */

export async function preparePhoto(file: File): Promise<PhotoAsset> {
  const url = URL.createObjectURL(file);

  try {
    const image = await loadImage(url);
    const canvas = normalizeImage(image);
    const stats = analyzeCanvas(canvas);
    const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    normalizedCache.set(id, { canvas, stats });

    return {
      id,
      name: file.name,
      url,
      width: image.naturalWidth,
      height: image.naturalHeight,
      stats,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function releasePhoto(id: string, url: string): void {
  URL.revokeObjectURL(url);
  normalizedCache.delete(id);
  styledCache.clear();
}

/**
 * Gera uma versão comprimida da foto para enviar à análise de visão.
 * A imagem original nunca sai do navegador; só este JPEG reduzido é enviado
 * quando a IA real está configurada.
 */
export async function photoToDataUrl(
  photo: PhotoAsset,
  maxEdge = 640,
): Promise<string> {
  const normalized = normalizedCache.get(photo.id);
  let source: HTMLCanvasElement | HTMLImageElement;
  let sourceWidth: number;
  let sourceHeight: number;

  if (normalized) {
    source = normalized.canvas;
    sourceWidth = normalized.canvas.width;
    sourceHeight = normalized.canvas.height;
  } else {
    const image = await loadImage(photo.url);
    source = image;
    sourceWidth = image.naturalWidth;
    sourceHeight = image.naturalHeight;
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a foto para a IA.');

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function clearImageCache(): void {
  normalizedCache.clear();
  styledCache.clear();
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    image.src = url;
  });
}

function normalizeImage(image: HTMLImageElement): HTMLCanvasElement {
  const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_EDGE / maxSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;

  const histogram = new Uint32Array(256);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    histogram[Math.round(0.299 * r + 0.587 * g + 0.114 * b)] += 1;
    sumR += r;
    sumG += g;
    sumB += b;
  }

  const low = percentile(histogram, total, 0.02);
  const high = percentile(histogram, total, 0.98);
  const levelRange = Math.max(1, high - low);
  const levelScale = 255 / levelRange;

  const meanR = sumR / total;
  const meanG = sumG / total;
  const meanB = sumB / total;
  const gray = (meanR + meanG + meanB) / 3;
  const wbR = clamp(gray / Math.max(1, meanR), 0.7, 1.3);
  const wbG = clamp(gray / Math.max(1, meanG), 0.7, 1.3);
  const wbB = clamp(gray / Math.max(1, meanB), 0.7, 1.3);

  const levelStrength = 0.85;
  const wbStrength = 0.6;

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

    let nextR = (r - low) * levelScale;
    let nextG = (g - low) * levelScale;
    let nextB = (b - low) * levelScale;

    nextR = r + (nextR - r) * levelStrength;
    nextG = g + (nextG - g) * levelStrength;
    nextB = b + (nextB - b) * levelStrength;

    nextR *= 1 + (wbR - 1) * wbStrength;
    nextG *= 1 + (wbG - 1) * wbStrength;
    nextB *= 1 + (wbB - 1) * wbStrength;

    data[index] = clampByte(nextR);
    data[index + 1] = clampByte(nextG);
    data[index + 2] = clampByte(nextB);
    data[index + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function percentile(histogram: Uint32Array, total: number, ratio: number): number {
  const target = total * ratio;
  let accumulated = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= target) return value;
  }

  return 255;
}

function analyzeCanvas(canvas: HTMLCanvasElement): PhotoStats {
  const sample = document.createElement('canvas');
  sample.width = 96;
  sample.height = 96;

  const ctx = sample.getContext('2d', { willReadFrequently: true });
  if (!ctx) return emptyStats();

  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const data = ctx.getImageData(0, 0, sample.width, sample.height).data;

  let count = 0;
  let luminance = 0;
  let saturation = 0;
  let temperature = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumR2 = 0;
  let sumG2 = 0;
  let sumB2 = 0;

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    luminance += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    saturation += max === 0 ? 0 : (max - min) / max;
    temperature += (r - b) / 255;
    sumR += r;
    sumG += g;
    sumB += b;
    sumR2 += r * r;
    sumG2 += g * g;
    sumB2 += b * b;
    count += 1;

    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  if (count === 0) return emptyStats();

  const mean: [number, number, number] = [sumR / count, sumG / count, sumB / count];
  const std: [number, number, number] = [
    Math.sqrt(Math.max(0, sumR2 / count - mean[0] * mean[0])),
    Math.sqrt(Math.max(0, sumG2 / count - mean[1] * mean[1])),
    Math.sqrt(Math.max(0, sumB2 / count - mean[2] * mean[2])),
  ];

  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((bucket) => {
      const bucketCount = Math.max(1, bucket.count);
      return toHex(bucket.r / bucketCount, bucket.g / bucketCount, bucket.b / bucketCount);
    });

  return {
    luminance: luminance / count,
    saturation: saturation / count,
    temperature: temperature / count,
    mean,
    std,
    palette,
  };
}

function emptyStats(): PhotoStats {
  return {
    luminance: 0.5,
    saturation: 0.3,
    temperature: 0,
    mean: [128, 128, 128],
    std: [48, 48, 48],
    palette: ['#F7F5EF', '#EDE8FF', '#FF8068', '#201932'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Filtros e composição                                                      */
/* -------------------------------------------------------------------------- */

function getStyledCanvas(
  photo: PhotoAsset,
  presetId: FilterPresetId,
  intensity: number,
  cover: PhotoAsset,
): HTMLCanvasElement | null {
  const normalized = normalizedCache.get(photo.id);
  if (!normalized) return null;

  const safeIntensity = clamp(intensity, 0, 1);
  const key = [
    photo.id,
    presetId,
    safeIntensity.toFixed(2),
    cover.id,
    PREVIEW_TAG,
  ].join('|');

  const cached = styledCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = normalized.canvas.width;
  canvas.height = normalized.canvas.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(normalized.canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (photo.id !== cover.id) {
    const reference = normalizedCache.get(cover.id);
    if (reference) {
      applyColorTransfer(imageData.data, normalized.stats, reference.stats, 0.65);
    }
  }

  applyPreset(imageData.data, FILTER_PRESET_MAP[presetId], safeIntensity);
  ctx.putImageData(imageData, 0, 0);

  if (styledCache.size >= STYLED_CACHE_LIMIT) {
    const oldest = styledCache.keys().next().value;
    if (oldest) styledCache.delete(oldest);
  }
  styledCache.set(key, canvas);

  return canvas;
}

function applyColorTransfer(
  data: Uint8ClampedArray,
  source: PhotoStats,
  reference: PhotoStats,
  strength: number,
): void {
  const sourceStd = source.std;
  const referenceStd = reference.std;

  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const original = data[index + channel];
      const currentStd = sourceStd[channel] || 1;
      const target =
        ((original - source.mean[channel]) / currentStd) * referenceStd[channel] +
        reference.mean[channel];
      data[index + channel] = clampByte(
        original + (target - original) * strength,
      );
    }
  }
}

function applyPreset(
  data: Uint8ClampedArray,
  preset: (typeof FILTER_PRESET_MAP)[FilterPresetId],
  intensity: number,
): void {
  const bright = preset.brightness * 255 * intensity;
  const contrast = 1 + (preset.contrast - 1) * intensity;
  const saturation = 1 + (preset.saturation - 1) * intensity;
  const temperature = preset.temperature * 24 * intensity;
  const tintAmount = preset.tintAmount * intensity;
  const fade = preset.fade * intensity;

  for (let index = 0; index < data.length; index += 4) {
    let r = data[index] + bright;
    let g = data[index + 1] + bright;
    let b = data[index + 2] + bright;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    r += temperature;
    b -= temperature;

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;

    if (fade > 0) {
      r = r * (1 - fade) + 255 * fade * 0.2;
      g = g * (1 - fade) + 255 * fade * 0.2;
      b = b * (1 - fade) + 255 * fade * 0.2;
    }

    if (tintAmount > 0) {
      r = r * (1 - tintAmount) + preset.tint[0] * tintAmount;
      g = g * (1 - tintAmount) + preset.tint[1] * tintAmount;
      b = b * (1 - tintAmount) + preset.tint[2] * tintAmount;
    }

    data[index] = clampByte(r);
    data[index + 1] = clampByte(g);
    data[index + 2] = clampByte(b);
  }
}

/* -------------------------------------------------------------------------- */
/*  Render                                                                    */
/* -------------------------------------------------------------------------- */

async function ensureTextFonts(text: ImageText): Promise<void> {
  const font = IMAGE_FONT_MAP[text.font] ?? IMAGE_FONT_MAP.manrope;
  const primaryFamily = font.family.split(',')[0].trim();

  if (document.fonts?.load) {
    try {
      await Promise.all([
        document.fonts.load(`${font.headlineWeight} 64px ${primaryFamily}`),
        document.fonts.load(
          `${font.sublineStyle} ${font.sublineWeight} 32px ${primaryFamily}`,
        ),
      ]);
    } catch {
      // Se a fonte não estiver disponível, o Canvas usa a fallback da família.
    }
  }

  await document.fonts.ready;
}

export async function renderSlideTo(
  target: HTMLCanvasElement,
  photo: PhotoAsset,
  options: RenderOptions,
  width?: number,
  height?: number,
): Promise<void> {
  if (options.text.enabled) {
    await ensureTextFonts(options.text);
  } else {
    await document.fonts.ready;
  }

  const spec = IMAGE_FORMATS[options.format];
  const targetWidth = width ?? spec.width;
  const targetHeight = height ?? spec.height;

  target.width = targetWidth;
  target.height = targetHeight;

  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.fillStyle = '#12101a';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  if (options.original) {
    const original = await loadImage(photo.url);
    drawCover(ctx, targetWidth, targetHeight, original);
  } else {
    const normalized = normalizedCache.get(photo.id);
    if (!normalized) {
      const fallback = await loadImage(photo.url);
      drawCover(ctx, targetWidth, targetHeight, fallback);
    } else {
      const styled = getStyledCanvas(
        photo,
        options.presetId,
        options.intensity,
        options.cover,
      );
      if (styled) {
        drawCover(ctx, targetWidth, targetHeight, styled);
      } else {
        drawCover(ctx, targetWidth, targetHeight, normalized.canvas);
      }
    }
  }

  if (options.text.enabled) {
    drawTextOverlay(ctx, targetWidth, targetHeight, options.text);
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: HTMLCanvasElement | HTMLImageElement,
): void {
  const sourceWidth =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sourceHeight =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: ImageText,
): void {
  const headline = text.headline.trim();
  const subline = text.subline.trim();
  if (!headline && !subline) return;

  const margin = width * 0.075;
  const maxWidth = width - margin * 2;
  const fontPreset = IMAGE_FONT_MAP[text.font] ?? IMAGE_FONT_MAP.manrope;
  const headlineSize = Math.round(width * 0.075 * fontPreset.headlineScale);
  const sublineSize = Math.round(width * 0.033 * fontPreset.sublineScale);
  const headlineFont = `${fontPreset.headlineWeight} ${headlineSize}px ${fontPreset.family}`;
  const sublineFont = `${fontPreset.sublineStyle} ${fontPreset.sublineWeight} ${sublineSize}px ${fontPreset.family}`;

  ctx.textBaseline = 'top';

  ctx.font = headlineFont;
  const headlineLines = wrapText(ctx, headline, maxWidth, 3);
  const headlineWidth = maxLineWidth(ctx, headlineLines);

  ctx.font = sublineFont;
  const sublineLines = wrapText(ctx, subline, maxWidth, 2);
  const sublineWidth = maxLineWidth(ctx, sublineLines);

  const lineWidth = Math.max(headlineWidth, sublineWidth);
  const headlineLineHeight = headlineSize * 1.06;
  const sublineLineHeight = sublineSize * 1.4;
  const gap = sublineLines.length > 0 ? sublineSize * 0.9 : 0;
  const accentHeight = Math.max(3, width * 0.004);
  const accentGap = headlineSize * 0.32;
  const blockHeight =
    accentHeight +
    accentGap +
    headlineLines.length * headlineLineHeight +
    gap +
    sublineLines.length * sublineLineHeight;

  const blockY =
    text.anchor === 'top'
      ? margin
      : text.anchor === 'center'
        ? (height - blockHeight) / 2
        : height - margin - blockHeight;

  const padding = headlineSize * 0.42;
  const regionX =
    text.align === 'left'
      ? margin - padding
      : text.align === 'center'
        ? width / 2 - lineWidth / 2 - padding
        : width - margin - lineWidth - padding;
  const regionY = blockY - padding;
  const regionWidth = lineWidth + padding * 2;
  const regionHeight = blockHeight + padding * 2;

  const backgroundLuminance = averageLuminance(
    ctx,
    clamp(regionX, 0, width),
    clamp(regionY, 0, height),
    clamp(regionWidth, 1, width),
    clamp(regionHeight, 1, height),
  );

  const lightText = backgroundLuminance < 0.52;
  const color = lightText ? '#F7F5EF' : '#201932';
  const textLuminance = lightText ? 0.92 : 0.018;
  const contrast =
    (Math.max(backgroundLuminance, textLuminance) + 0.05) /
    (Math.min(backgroundLuminance, textLuminance) + 0.05);

  if (contrast < 4.5) {
    const panelX =
      text.align === 'left'
        ? margin - padding
        : text.align === 'center'
          ? width / 2 - (lineWidth + padding * 2) / 2
          : width - margin - lineWidth - padding;
    ctx.fillStyle = lightText
      ? 'rgba(18, 16, 26, 0.55)'
      : 'rgba(247, 245, 239, 0.78)';
    roundRect(
      ctx,
      panelX,
      blockY - padding,
      lineWidth + padding * 2,
      blockHeight + padding * 2,
      Math.min(24, padding),
    );
    ctx.fill();
  }

  const alignX =
    text.align === 'left'
      ? margin
      : text.align === 'center'
        ? width / 2
        : width - margin;
  const align =
    text.align === 'left' ? 'left' : text.align === 'center' ? 'center' : 'right';

  const accentWidth = Math.min(maxWidth * 0.18, 74);
  const accentX =
    align === 'left'
      ? margin
      : align === 'center'
        ? width / 2 - accentWidth / 2
        : width - margin - accentWidth;

  ctx.fillStyle = lightText ? '#FF8068' : '#6C4CF5';
  ctx.fillRect(accentX, blockY, accentWidth, accentHeight);

  ctx.shadowColor = lightText
    ? 'rgba(0, 0, 0, 0.32)'
    : 'rgba(255, 255, 255, 0.32)';
  ctx.shadowBlur = Math.max(6, width * 0.008);
  ctx.shadowOffsetY = Math.max(1, width * 0.002);

  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = headlineFont;

  let cursorY = blockY + accentHeight + accentGap;
  for (const line of headlineLines) {
    ctx.fillText(line, alignX, cursorY);
    cursorY += headlineLineHeight;
  }

  if (sublineLines.length > 0) {
    cursorY += gap;
    ctx.font = sublineFont;
    ctx.globalAlpha = 0.9;
    for (const line of sublineLines) {
      ctx.fillText(line, alignX, cursorY);
      cursorY += sublineLineHeight;
    }
    ctx.globalAlpha = 1;
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';
  let index = 0;

  while (index < words.length) {
    const word = words[index];
    const test = current ? `${current} ${word}` : word;

    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
      index += 1;
    } else {
      lines.push(current);
      current = '';
      if (lines.length === maxLines) break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (index < words.length) {
    let last = lines[maxLines - 1] ?? '';
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }

  return lines.slice(0, maxLines);
}

function maxLineWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
}

function averageLuminance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const sample = document.createElement('canvas');
  sample.width = 64;
  sample.height = 64;

  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return 0.5;

  sampleCtx.drawImage(ctx.canvas, x, y, width, height, 0, 0, 64, 64);
  const data = sampleCtx.getImageData(0, 0, 64, 64).data;

  let total = 0;
  for (let index = 0; index < data.length; index += 4) {
    total += (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) / 255;
  }

  return total / (64 * 64);
}

/* -------------------------------------------------------------------------- */
/*  Exportação                                                                */
/* -------------------------------------------------------------------------- */

export async function exportPhoto(
  photo: PhotoAsset,
  options: RenderOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await renderSlideTo(canvas, photo, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Não foi possível exportar a imagem.'));
      },
      'image/jpeg',
      0.92,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export async function shareBlob(
  blob: Blob,
  filename: string,
  text: string,
): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;

  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (
    typeof navigator.canShare === 'function' &&
    !navigator.canShare({ files: [file] })
  ) {
    return false;
  }

  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function toHex(r: number, g: number, b: number): string {
  const hex = (value: number) =>
    clampByte(value).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}
