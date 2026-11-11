import { useEffect, useRef, useState } from 'react';
import { FILTER_PRESETS, FILTER_PRESET_MAP, pickPreset } from '../data/filters';
import {
  defaultFormatFor,
  IMAGE_FORMAT_IDS,
  IMAGE_FORMATS,
} from '../data/formats';
import {
  downloadBlob,
  exportPhoto,
  renderSlideTo,
  shareBlob,
  type RenderOptions,
} from '../lib/image';
import type {
  FilterPresetId,
  ImageAlign,
  ImageAnchor,
  ImageFormat,
  ImageText,
  PhotoAsset,
  PlatformId,
} from '../types';
import { Icon } from './Icon';

interface PhotoStudioProps {
  photos: PhotoAsset[];
  initialText: ImageText;
  platform: PlatformId;
  onNotify: (text: string, kind: 'success' | 'error' | 'info') => void;
}

const ANCHORS: { id: ImageAnchor; label: string }[] = [
  { id: 'top', label: 'Topo' },
  { id: 'center', label: 'Centro' },
  { id: 'bottom', label: 'Base' },
];

const ALIGNS: { id: ImageAlign; label: string }[] = [
  { id: 'left', label: 'Esquerda' },
  { id: 'center', label: 'Centro' },
  { id: 'right', label: 'Direita' },
];

export function PhotoStudio({
  photos,
  initialText,
  platform,
  onNotify,
}: PhotoStudioProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [presetId, setPresetId] = useState<FilterPresetId>(() => pickPreset(photos));
  const [intensity, setIntensity] = useState(0.82);
  const [text, setText] = useState<ImageText>(initialText);
  const [format, setFormat] = useState<ImageFormat>(() => defaultFormatFor(platform));
  const [showOriginal, setShowOriginal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const photoKey = photos.map((photo) => photo.id).join('|');
  const activePhoto = photos[Math.min(activeIndex, photos.length - 1)];

  useEffect(() => {
    setPresetId(pickPreset(photos));
    setActiveIndex(0);
  }, [photoKey]);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    setFormat(defaultFormatFor(platform));
  }, [platform]);

  useEffect(() => {
    if (activeIndex >= photos.length) setActiveIndex(0);
  }, [activeIndex, photos.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePhoto) return;

    let cancelled = false;

    async function draw() {
      await document.fonts.ready;
      if (cancelled) return;

      const spec = IMAGE_FORMATS[format];
      const previewWidth = 720;
      const previewHeight = Math.round((previewWidth * spec.height) / spec.width);

      await renderSlideTo(
        canvas as HTMLCanvasElement,
        activePhoto,
        {
          presetId,
          intensity,
          text,
          format,
          cover: photos[0],
          original: showOriginal,
        },
        previewWidth,
        previewHeight,
      );
    }

    draw();

    return () => {
      cancelled = true;
    };
  }, [
    activePhoto,
    format,
    intensity,
    photos,
    presetId,
    showOriginal,
    text,
  ]);

  function buildOptions(): RenderOptions {
    return {
      presetId,
      intensity,
      text,
      format,
      cover: photos[0],
    };
  }

  async function handleDownload() {
    if (!activePhoto) return;
    setExporting(true);
    try {
      const blob = await exportPhoto(activePhoto, buildOptions());
      downloadBlob(blob, `postai-${format}-${activeIndex + 1}.jpg`);
      onNotify('Imagem exportada em alta resolução.', 'success');
    } catch {
      onNotify('Não foi possível exportar a imagem.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadAll() {
    setExporting(true);
    try {
      for (let index = 0; index < photos.length; index += 1) {
        const blob = await exportPhoto(photos[index], buildOptions());
        downloadBlob(blob, `postai-${format}-${index + 1}.jpg`);
        await new Promise((resolve) => window.setTimeout(resolve, 260));
      }
      onNotify(
        photos.length > 1
          ? 'Todas as imagens foram exportadas.'
          : 'Imagem exportada em alta resolução.',
        'success',
      );
    } catch {
      onNotify('Não foi possível exportar as imagens.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!activePhoto) return;
    setExporting(true);
    try {
      const blob = await exportPhoto(activePhoto, buildOptions());
      const shared = await shareBlob(
        blob,
        `postai-${format}-${activeIndex + 1}.jpg`,
        text.headline,
      );
      if (!shared) {
        onNotify(
          'Compartilhamento não disponível neste navegador. Use “Baixar imagem”.',
          'info',
        );
      }
    } catch {
      onNotify('Não foi possível compartilhar a imagem.', 'error');
    } finally {
      setExporting(false);
    }
  }

  const preset = FILTER_PRESET_MAP[presetId];

  return (
    <section className="photo-studio" aria-label="Imagem do post">
      <div className="photo-studio-head">
        <div>
          <span className="section-overline">Imagem do post</span>
          <h3>Sua foto, com o filtro e o texto certos</h3>
        </div>
        <span className="studio-ai-badge">
          <Icon name="wand" size={13} /> IA escolheu {preset.name}
        </span>
      </div>

      <div className="photo-studio-grid">
        <div className="photo-preview">
          <div className="photo-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="photo-canvas"
              aria-label="Prévia da imagem com filtro e texto"
            />
            {showOriginal && <span className="photo-preview-tag">Original</span>}
          </div>

          <div className="photo-preview-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleDownload}
              disabled={exporting}
            >
              {exporting ? <span className="spinner" /> : <Icon name="image" size={15} />}
              Baixar imagem
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setShowOriginal((current) => !current)}
              aria-pressed={showOriginal}
            >
              <Icon name="target" size={14} />
              {showOriginal ? 'Ver com filtro' : 'Ver original'}
            </button>
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              className="text-btn"
              onClick={handleDownloadAll}
              disabled={exporting}
            >
              <Icon name="copy" size={13} /> Baixar todas as {photos.length} fotos
            </button>
          )}

          <div className="photo-thumbs" aria-label="Fotos do post">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className={`photo-thumb-btn${index === activeIndex ? ' is-active' : ''}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver foto ${index + 1}`}
                aria-pressed={index === activeIndex}
              >
                <img
                  src={photo.url}
                  alt=""
                  style={{ filter: preset.css }}
                />
                {index === 0 && <span>Capa</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="photo-controls">
          <div className="studio-group">
            <div className="studio-label-row">
              <span className="studio-label">Filtro</span>
              <span className="studio-hint">{preset.description}</span>
            </div>
            <div className="filter-row">
              {FILTER_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`filter-chip${item.id === presetId ? ' is-active' : ''}`}
                  onClick={() => setPresetId(item.id)}
                  aria-pressed={item.id === presetId}
                >
                  <span
                    className="filter-swatch"
                    style={{ background: item.swatch }}
                    aria-hidden="true"
                  />
                  {item.name}
                </button>
              ))}
            </div>
            <div className="intensity-row">
              <label className="studio-hint" htmlFor="filter-intensity">
                Intensidade
              </label>
              <input
                id="filter-intensity"
                className="range"
                type="range"
                min={0}
                max={100}
                value={Math.round(intensity * 100)}
                onChange={(event) =>
                  setIntensity(Number(event.target.value) / 100)
                }
              />
              <span className="intensity-value">{Math.round(intensity * 100)}%</span>
            </div>
          </div>

          <div className="studio-group">
            <div className="studio-label-row">
              <span className="studio-label">Texto na imagem</span>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={text.enabled}
                  onChange={(event) =>
                    setText({ ...text, enabled: event.target.checked })
                  }
                />
                Mostrar
              </label>
            </div>
            <input
              className="input"
              value={text.headline}
              maxLength={60}
              onChange={(event) => setText({ ...text, headline: event.target.value })}
              placeholder="Frase principal"
              aria-label="Frase principal da imagem"
            />
            <input
              className="input"
              value={text.subline}
              maxLength={90}
              onChange={(event) => setText({ ...text, subline: event.target.value })}
              placeholder="Linha de apoio"
              aria-label="Linha de apoio da imagem"
            />
            <div className="studio-segment-row">
              <div className="segmented" aria-label="Posição do texto">
                {ANCHORS.map((anchor) => (
                  <button
                    key={anchor.id}
                    type="button"
                    className={text.anchor === anchor.id ? 'is-active' : ''}
                    onClick={() => setText({ ...text, anchor: anchor.id })}
                    aria-pressed={text.anchor === anchor.id}
                  >
                    {anchor.label}
                  </button>
                ))}
              </div>
              <div className="segmented" aria-label="Alinhamento do texto">
                {ALIGNS.map((align) => (
                  <button
                    key={align.id}
                    type="button"
                    className={text.align === align.id ? 'is-active' : ''}
                    onClick={() => setText({ ...text, align: align.id })}
                    aria-pressed={text.align === align.id}
                  >
                    {align.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="studio-group">
            <div className="studio-label-row">
              <label className="studio-label" htmlFor="image-format">
                Formato
              </label>
              <span className="studio-hint">
                {IMAGE_FORMATS[format].width} × {IMAGE_FORMATS[format].height} px
              </span>
            </div>
            <div className="select-wrap">
              <select
                id="image-format"
                className="select"
                value={format}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'feed' || value === 'square' || value === 'story') {
                    setFormat(value);
                  }
                }}
              >
                {IMAGE_FORMAT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {IMAGE_FORMATS[id].name} · {IMAGE_FORMATS[id].hint}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={16} className="select-chevron" />
            </div>
          </div>

          <div className="studio-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleShare}
              disabled={exporting}
            >
              <Icon name="send" size={14} /> Compartilhar
            </button>
            <span className="studio-note">
              <Icon name="info" size={12} /> O texto é editável; a legenda continua
              na seção abaixo.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
