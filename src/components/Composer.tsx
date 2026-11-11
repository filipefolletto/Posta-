import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { AUDIENCES, isAudienceId } from '../data/audiences';
import { EXAMPLE_TOPICS } from '../data/examples';
import type { QuotaState } from '../lib/storage';
import type { Brief, PhotoAsset } from '../types';
import { Icon } from './Icon';
import { PhotoUploader } from './PhotoUploader';
import { PlatformPicker } from './PlatformPicker';
import { TonePicker } from './TonePicker';

const TOPIC_MIN = 8;
const TOPIC_MAX = 280;

interface FormErrors {
  topic?: string;
  tones?: string;
}

interface ComposerProps {
  brief: Brief;
  onChange: (brief: Brief) => void;
  onSubmit: () => void;
  generating: boolean;
  quota: QuotaState;
  photos: PhotoAsset[];
  photosBusy: boolean;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onMakeCover: (id: string) => void;
  onResetQuota: () => void;
}

export function Composer({
  brief,
  onChange,
  onSubmit,
  generating,
  quota,
  photos,
  photosBusy,
  onAddPhotos,
  onRemovePhoto,
  onMakeCover,
  onResetQuota,
}: ComposerProps) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [exampleIndex, setExampleIndex] = useState(0);
  const topicRef = useRef<HTMLTextAreaElement>(null);

  function updateTopic(topic: string) {
    onChange({ ...brief, topic });
    setErrors((current) => ({ ...current, topic: undefined }));
  }

  function updateTones(tones: Brief['tones']) {
    onChange({ ...brief, tones });
    setErrors((current) => ({ ...current, tones: undefined }));
  }

  function fillExample() {
    const example = EXAMPLE_TOPICS[exampleIndex % EXAMPLE_TOPICS.length];
    updateTopic(example);
    setExampleIndex((index) => index + 1);
    topicRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating || photosBusy) return;

    const nextErrors: FormErrors = {};
    if (brief.topic.trim().length < TOPIC_MIN) {
      nextErrors.topic = 'Descreva o tema com pelo menos 8 caracteres.';
    }
    if (brief.tones.length === 0) {
      nextErrors.tones = 'Escolha pelo menos um tom de voz.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.topic) topicRef.current?.focus();
      return;
    }

    setErrors({});
    onSubmit();
  }

  const nearLimit = brief.topic.length > TOPIC_MAX - 30;

  return (
    <aside className="composer" id="composer">
      <div className="composer-head">
        <span className="step-pill">01</span>
        <div className="composer-heading">
          <span className="step-overline">Conteúdo</span>
          <h2>O que vamos contar?</h2>
        </div>
        <span className="draft-chip">
          <span className="draft-dot" aria-hidden="true" /> Rascunho
        </span>
      </div>

      <form className="composer-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <div className="field-head">
            <label className="field-label" htmlFor="topic">
              Tema do post
            </label>
            <span className={`char-count${nearLimit ? ' is-near' : ''}`}>
              {brief.topic.length}/{TOPIC_MAX}
            </span>
          </div>
          <textarea
            ref={topicRef}
            id="topic"
            className={`textarea${errors.topic ? ' is-invalid' : ''}`}
            value={brief.topic}
            maxLength={TOPIC_MAX}
            onChange={(event) => updateTopic(event.target.value)}
            placeholder="Ex.: Nossa nova coleção foi criada por artistas locais e produzida em pequena escala."
            aria-describedby={errors.topic ? 'topic-error' : 'topic-hint'}
            aria-invalid={Boolean(errors.topic)}
          />
          {errors.topic ? (
            <p className="field-error" id="topic-error" role="alert">
              <Icon name="alert" size={14} /> {errors.topic}
            </p>
          ) : (
            <p className="field-hint" id="topic-hint">
              Uma frase basta. Quanto mais contexto, mais específica a legenda.
            </p>
          )}
          <button type="button" className="text-btn" onClick={fillExample}>
            <Icon name="sparkles" size={14} /> Preencher com um exemplo
          </button>
        </div>

        <PhotoUploader
          photos={photos}
          busy={photosBusy}
          onAdd={onAddPhotos}
          onRemove={onRemovePhoto}
          onMakeCover={onMakeCover}
        />

        <div className="field">
          <div className="field-head">
            <span className="field-label">Onde será publicado?</span>
            <span className="field-hint">1 plataforma</span>
          </div>
          <PlatformPicker
            value={brief.platform}
            onChange={(platform) => onChange({ ...brief, platform })}
          />
        </div>

        <div className="field">
          <div className="field-head">
            <span className="field-label">Tom de voz</span>
            <span className="field-hint">até 2 tons</span>
          </div>
          <TonePicker value={brief.tones} onChange={updateTones} />
          {errors.tones ? (
            <p className="field-error" role="alert">
              <Icon name="alert" size={14} /> {errors.tones}
            </p>
          ) : (
            <p className="field-hint">
              {brief.tones.length >= 2
                ? 'Máximo de 2 tons — o mais antigo sai quando você escolhe outro.'
                : 'O primeiro tom define o gancho; o segundo, a frase de fechamento.'}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="audience">
            Para quem é este post?
          </label>
          <div className="select-wrap">
            <select
              id="audience"
              className="select"
              value={brief.audience}
              onChange={(event) => {
                if (isAudienceId(event.target.value)) {
                  onChange({ ...brief, audience: event.target.value });
                }
              }}
            >
              {AUDIENCES.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={16} className="select-chevron" />
          </div>
          <p className="field-hint">O CTA e o nível de formalidade mudam com o público.</p>
        </div>

        <div className="format-box">
          <div className="format-head">
            <Icon name="sparkles" size={16} />
            <span>Formato do conteúdo</span>
            <span className="format-badge">IA adapta</span>
          </div>
          <div className="format-pills">
            <span>
              <Icon name="check" size={12} /> Legenda
            </span>
            <span>
              <Icon name="check" size={12} /> Hashtags
            </span>
            <span>
              <Icon name="check" size={12} /> CTA
            </span>
            <span>
              <Icon name="check" size={12} /> Ideia de imagem
            </span>
            <span>
              <Icon name="check" size={12} /> Filtro + texto na foto
            </span>
          </div>
        </div>

        <div className="composer-actions">
          <button
            className="btn btn--primary btn--lg btn--block"
            type="submit"
            disabled={generating || photosBusy || quota.remaining === 0}
          >
            {generating ? (
              <>
                <span className="spinner" aria-hidden="true" /> Criando...
              </>
            ) : (
              <>
                <Icon name="sparkles" /> Gerar meu post
              </>
            )}
          </button>
          <p className="demo-note">
            <Icon name="info" size={13} /> Demonstração local — as legendas são montadas no navegador.
          </p>
        </div>

        {quota.remaining === 0 && (
          <div className="quota-warning" role="status">
            <Icon name="alert" size={16} />
            <div>
              <strong>Cota do dia esgotada.</strong>
              <span>Reinicie a demonstração para gerar mais 3 posts.</span>
            </div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={onResetQuota}>
              Reiniciar demo
            </button>
          </div>
        )}
      </form>
    </aside>
  );
}
