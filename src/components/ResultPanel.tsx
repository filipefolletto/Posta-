import { PLATFORM_MAP } from '../data/platforms';
import { EXAMPLE_TOPICS } from '../data/examples';
import { TONE_MAP } from '../data/tones';
import { fullPostText } from '../lib/generator';
import type { GeneratedPost, GenerationStatus, PhotoAsset } from '../types';
import { Icon } from './Icon';
import { PhotoStudio } from './PhotoStudio';

interface ResultPanelProps {
  status: GenerationStatus;
  post: GeneratedPost | null;
  statusMessage: string;
  photos: PhotoAsset[];
  onCopy: (text: string, label: string) => void;
  onNotify: (text: string, kind: 'success' | 'error' | 'info') => void;
  onRetry: () => void;
  onGenerate: () => void;
  onNew: () => void;
  onUseExample: (topic: string) => void;
  aiEnabled: boolean;
}

export function ResultPanel({
  status,
  post,
  statusMessage,
  photos,
  onCopy,
  onNotify,
  onRetry,
  onGenerate,
  onNew,
  onUseExample,
  aiEnabled,
}: ResultPanelProps) {
  return (
    <aside className="result-panel" id="resultado" aria-busy={status === 'generating'}>
      <p className="sr-only" aria-live="polite">
        {status === 'generating'
          ? statusMessage
          : status === 'ready'
            ? 'Post gerado e pronto para revisar.'
            : status === 'error'
              ? 'Erro ao gerar o post.'
              : 'Aguardando o briefing.'}
      </p>

      {status === 'generating' && <LoadingState message={statusMessage} />}

      {status === 'error' && (
        <ErrorState onRetry={post ? onRetry : onGenerate} />
      )}

      {status === 'ready' && post && (
        <ReadyState
          post={post}
          photos={photos}
          onCopy={onCopy}
          onNotify={onNotify}
          onRetry={onRetry}
          onNew={onNew}
          aiEnabled={aiEnabled}
        />
      )}

      {status !== 'generating' && status !== 'error' && !(status === 'ready' && post) && (
        <EmptyState onUseExample={onUseExample} />
      )}
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Estados                                                                   */
/* -------------------------------------------------------------------------- */

function EmptyState({ onUseExample }: { onUseExample: (topic: string) => void }) {
  return (
    <div className="result-empty">
      <div className="empty-orb">
        <Icon name="quote" size={34} />
      </div>
      <span className="status-overline">Status da IA</span>
      <h2>Sua legenda aparece aqui</h2>
      <p>
        Descreva o tema, escolha a plataforma e o tom. O Postaí devolve legenda,
        hashtags, CTA e ideia de imagem — prontos para revisar.
      </p>

      <div className="empty-examples">
        <span>Experimente um tema</span>
        {EXAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            className="example-chip"
            onClick={() => onUseExample(topic)}
          >
            <Icon name="arrow-right" size={13} />
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="result-loading">
      <div className="loading-orb">
        <span className="loading-ring" aria-hidden="true" />
        <Icon name="sparkles" size={30} />
      </div>
      <span className="status-overline">Status da IA</span>
      <h2>{message}</h2>
      <p>Estamos ajustando o gancho, as hashtags e o CTA para a sua plataforma.</p>
      <div className="skeleton-lines" aria-hidden="true">
        <span style={{ width: '92%' }} />
        <span style={{ width: '78%' }} />
        <span style={{ width: '86%' }} />
        <span style={{ width: '54%' }} />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="result-error">
      <div className="empty-orb empty-orb--error">
        <Icon name="alert" size={32} />
      </div>
      <span className="status-overline">Status da IA</span>
      <h2>Algo saiu do previsto</h2>
      <p>Não foi possível montar o post agora. Seu briefing continua aqui — tente de novo.</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        <Icon name="refresh" /> Tentar de novo
      </button>
    </div>
  );
}

function ReadyState({
  post,
  photos,
  onCopy,
  onNotify,
  onRetry,
  onNew,
  aiEnabled,
}: {
  post: GeneratedPost;
  photos: PhotoAsset[];
  onCopy: (text: string, label: string) => void;
  onNotify: (text: string, kind: 'success' | 'error' | 'info') => void;
  onRetry: () => void;
  onNew: () => void;
  aiEnabled: boolean;
}) {
  const platform = PLATFORM_MAP[post.brief.platform];
  const tones = post.brief.tones.map((tone) => TONE_MAP[tone]);
  const limit = platform.characterLimit;
  const total =
    post.caption.length + post.cta.length + post.hashtags.join(' ').length + 4;
  const percent = Math.min(100, Math.round((total / limit) * 100));
  const overLimit = total > limit;

  return (
    <div className="result-ready">
      <div className="result-top">
        <div className="result-status">
          <span className="status-dot" aria-hidden="true" />
          Pronto para revisar
        </div>
        <div className="result-badges">
          <span className={`badge badge--platform badge--${platform.id}`}>
            <Icon name={platform.id} size={14} /> {platform.name}
          </span>
          {tones.map((tone) => (
            <span key={tone.id} className="badge badge--tone">
              {tone.name}
            </span>
          ))}
        </div>
      </div>

      {photos.length > 0 && (
        <PhotoStudio
          photos={photos}
          initialText={post.imageText}
          brief={post.brief}
          onNotify={onNotify}
          aiEnabled={aiEnabled}
        />
      )}

      <div className="result-body">
        <section className="result-section">
          <SectionHead
            overline="Sua legenda"
            title="O texto que vai para o feed"
            onCopy={() => onCopy(post.caption, 'Legenda')}
            copyLabel="Copiar legenda"
          />
          <div className="caption">
            {post.caption.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className={`caption-meta${overLimit ? ' is-over' : ''}`}>
            <span>
              {total.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')} caracteres
            </span>
            <div className="char-meter" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        </section>

        <section className="result-section">
          <SectionHead
            overline="Hashtags"
            title="Para alcançar quem importa"
            onCopy={() => onCopy(post.hashtags.join(' '), 'Hashtags')}
            copyLabel="Copiar hashtags"
          />
          <div className="hashtag-list">
            {post.hashtags.map((tag) => (
              <span className="hashtag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="result-section">
          <SectionHead
            overline="CTA"
            title="O convite para a conversa"
            onCopy={() => onCopy(post.cta, 'CTA')}
            copyLabel="Copiar CTA"
          />
          <div className="cta-box">
            <span className="cta-icon">
              <Icon name="message" size={20} />
            </span>
            <p>{post.cta}</p>
          </div>
        </section>

        <section className="result-section">
          <SectionHead
            overline="Ideia de imagem"
            title="O visual que acompanha"
            onCopy={() => onCopy(post.imageIdea, 'Ideia de imagem')}
            copyLabel="Copiar ideia de imagem"
          />
          <div className="image-idea">
            <span className="image-idea-icon">
              <Icon name="image" size={22} />
            </span>
            <p>{post.imageIdea}</p>
          </div>
        </section>
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onCopy(fullPostText(post), 'Post completo')}
        >
          <Icon name="copy" /> Copiar post
        </button>
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          <Icon name="refresh" /> Tentar de novo
        </button>
        <button type="button" className="btn btn--ghost" onClick={onNew}>
          <Icon name="close" /> Novo post
        </button>
        <span className="result-footnote">
          <Icon name="clock" size={13} /> Variante {post.variant + 1} · gerado agora
        </span>
      </div>
    </div>
  );
}

function SectionHead({
  overline,
  title,
  onCopy,
  copyLabel,
}: {
  overline: string;
  title: string;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className="section-head">
      <div className="section-title">
        <span className="section-overline">{overline}</span>
        <h3>{title}</h3>
      </div>
      <button
        type="button"
        className="copy-btn"
        onClick={onCopy}
        aria-label={copyLabel}
        title={copyLabel}
      >
        <Icon name="copy" size={15} /> Copiar
      </button>
    </div>
  );
}
