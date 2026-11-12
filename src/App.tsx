import { useEffect, useRef, useState } from 'react';
import { Composer } from './components/Composer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Icon } from './components/Icon';
import { ResultPanel } from './components/ResultPanel';
import { Toast } from './components/Toast';
import { MAX_PHOTOS } from './components/PhotoUploader';
import {
  generatePostWithAI,
  getAiStatus,
  type AiStatus,
} from './lib/ai';
import { copyText } from './lib/clipboard';
import { generatePost } from './lib/generator';
import { clearImageCache, preparePhoto, releasePhoto } from './lib/image';
import {
  clearLastPost,
  consumeQuota,
  loadBrief,
  loadPost,
  loadTheme,
  readQuota,
  resetQuota,
  saveBrief,
  savePost,
  saveTheme,
} from './lib/storage';
import type {
  Brief,
  GeneratedPost,
  GenerationStatus,
  PhotoAsset,
  Theme,
  ToastMessage,
} from './types';

const DEFAULT_BRIEF: Brief = {
  topic: '',
  platform: 'instagram',
  tones: ['autentico'],
  audience: 'seguidores',
};

const LOADING_MESSAGES = [
  'Lendo o briefing…',
  'Adaptando o seu tom…',
  'Escolhendo as hashtags…',
  'Ajustando o CTA…',
];

const GENERATION_MS = 1900;
const MESSAGE_MS = 850;
const TOAST_MS = 2800;

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [brief, setBrief] = useState<Brief>(() => loadBrief() ?? DEFAULT_BRIEF);
  const [post, setPost] = useState<GeneratedPost | null>(loadPost);
  const [status, setStatus] = useState<GenerationStatus>(post ? 'ready' : 'idle');
  const [statusMessage, setStatusMessage] = useState(LOADING_MESSAGES[0]);
  const [quota, setQuota] = useState(readQuota);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  const pendingRef = useRef<{ brief: Brief; variant: number } | null>(null);
  const photosRef = useRef<PhotoAsset[]>([]);

  /* Tema ------------------------------------------------------------------ */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  /* Status da IA ---------------------------------------------------------- */
  useEffect(() => {
    let active = true;

    getAiStatus().then((status) => {
      if (active) setAiStatus(status);
    });

    return () => {
      active = false;
    };
  }, []);

  /* Avisos ---------------------------------------------------------------- */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* Fotos ----------------------------------------------------------------- */
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  /* Geração com IA real ou fallback local --------------------------------- */
  useEffect(() => {
    if (status !== 'generating') return;

    const pending = pendingRef.current;
    if (!pending) return;

    const { brief: pendingBrief, variant: pendingVariant } = pending;

    setStatusMessage(LOADING_MESSAGES[0]);
    let index = 0;

    const messageTimer = window.setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setStatusMessage(LOADING_MESSAGES[index]);
    }, MESSAGE_MS);

    const controller = new AbortController();
    let cancelled = false;
    const startedAt = Date.now();

    async function finish() {
      try {
        const result = await generatePostWithAI(pendingBrief, pendingVariant, {
          enabled: aiStatus?.enabled ?? false,
          signal: controller.signal,
        });

        const remaining = Math.max(0, GENERATION_MS - (Date.now() - startedAt));
        if (remaining > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }

        if (cancelled) return;

        pendingRef.current = null;
        setPost(result.post);
        savePost(result.post);
        setStatus('ready');
        setToast({
          id: Date.now(),
          text:
            result.source === 'ai'
              ? 'Post gerado com IA real. Pronto para revisar.'
              : (result.notice ?? 'Demonstração local: post pronto para revisar.'),
          kind: result.source === 'ai' ? 'success' : 'info',
        });
      } catch {
        if (cancelled) return;

        const fallback = generatePost(pendingBrief, pendingVariant);
        pendingRef.current = null;
        setPost(fallback);
        savePost(fallback);
        setStatus('ready');
        setToast({
          id: Date.now(),
          text: 'Não foi possível falar com a IA; usei o gerador local.',
          kind: 'info',
        });
      }
    }

    finish();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(messageTimer);
    };
  }, [aiStatus?.enabled, status]);

  /* Handlers -------------------------------------------------------------- */
  function updateBrief(next: Brief) {
    setBrief(next);
    saveBrief(next);
  }

  function runGeneration(target: Brief, variant: number) {
    pendingRef.current = { brief: target, variant };
    setStatus('generating');
  }

  function notify(text: string, kind: ToastMessage['kind']) {
    setToast({ id: Date.now(), text, kind });
  }

  async function handleAddPhotos(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const available = MAX_PHOTOS - photos.length;

    if (available <= 0) {
      notify(`Você já adicionou o máximo de ${MAX_PHOTOS} fotos.`, 'info');
      return;
    }

    const selected = imageFiles.slice(0, available);
    if (selected.length === 0) {
      notify('Escolha arquivos de imagem (JPG, PNG ou WebP).', 'error');
      return;
    }

    setPhotosBusy(true);
    const prepared: PhotoAsset[] = [];
    let failed = 0;

    for (const file of selected) {
      try {
        prepared.push(await preparePhoto(file));
      } catch {
        failed += 1;
      }
    }

    if (prepared.length > 0) {
      setPhotos((current) => [...current, ...prepared]);
    }

    setPhotosBusy(false);

    if (prepared.length > 0) {
      const plural = prepared.length > 1 ? 's' : '';
      const failure = failed > 0 ? ` ${failed} não pôde ser processada.` : '';
      notify(
        `${prepared.length} foto${plural} adicionada${plural}. A IA vai escolher o filtro ao gerar.${failure}`,
        'success',
      );
    } else {
      notify('Não foi possível abrir as fotos. Tente JPG, PNG ou WebP.', 'error');
    }
  }

  function handleRemovePhoto(id: string) {
    const target = photos.find((photo) => photo.id === id);
    if (target) releasePhoto(target.id, target.url);
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  function handleMakeCover(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (!target || current[0]?.id === id) return current;
      return [target, ...current.filter((photo) => photo.id !== id)];
    });
  }

  function clearPhotos() {
    photos.forEach((photo) => releasePhoto(photo.id, photo.url));
    clearImageCache();
    setPhotos([]);
  }

  function handleSubmit() {
    if (quota.remaining <= 0) {
      setToast({
        id: Date.now(),
        text: 'Cota do dia esgotada. Reinicie a demonstração para gerar mais posts.',
        kind: 'error',
      });
      return;
    }

    const consumed = consumeQuota();
    if (!consumed.ok) {
      setQuota(consumed.quota);
      setToast({
        id: Date.now(),
        text: 'Cota do dia esgotada. Reinicie a demonstração para gerar mais posts.',
        kind: 'error',
      });
      return;
    }

    setQuota(consumed.quota);
    saveBrief(brief);
    runGeneration(brief, 0);
  }

  function handleRetry() {
    // "Tentar de novo" é livre: não consome cota.
    const target = post?.brief ?? brief;
    runGeneration(target, (post?.variant ?? -1) + 1);
  }

  function handleNew() {
    setPost(null);
    setStatus('idle');
    clearLastPost();
    clearPhotos();
    document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('topic')?.focus(), 400);
  }

  function handleUseExample(topic: string) {
    updateBrief({ ...brief, topic });
    document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('topic')?.focus(), 400);
  }

  async function handleCopy(text: string, label: string) {
    const ok = await copyText(text);
    setToast({
      id: Date.now(),
      text: ok
        ? `Copiado: ${label.toLowerCase()}.`
        : 'Não foi possível copiar. Selecione o texto e tente de novo.',
      kind: ok ? 'success' : 'error',
    });
  }

  function handleResetQuota() {
    setQuota(resetQuota());
    setToast({
      id: Date.now(),
      text: 'Demonstração reiniciada: 3 gerações disponíveis.',
      kind: 'info',
    });
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div className="app-shell">
      <Header quota={quota} theme={theme} onToggleTheme={toggleTheme} />

      <main className="app-main">
        <Hero />
        <HowItWorks />

        <section className="workspace" aria-label="Gerador de posts">
          <Composer
            brief={brief}
            onChange={updateBrief}
            onSubmit={handleSubmit}
            generating={status === 'generating'}
            quota={quota}
            photos={photos}
            photosBusy={photosBusy}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            onMakeCover={handleMakeCover}
            onResetQuota={handleResetQuota}
            aiEnabled={aiStatus?.enabled ?? false}
          />
          <ResultPanel
            status={status}
            post={post}
            statusMessage={statusMessage}
            photos={photos}
            onCopy={handleCopy}
            onNotify={notify}
            onRetry={handleRetry}
            onGenerate={handleSubmit}
            onNew={handleNew}
            onUseExample={handleUseExample}
            aiEnabled={aiStatus?.enabled ?? false}
          />
        </section>
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-mark">
              <Icon name="sparkles" size={18} />
            </span>
            <div>
              <strong>Postaí</strong>
              <span>Ideias que viram conversa.</span>
            </div>
          </div>

          <p className="footer-note">
            {aiStatus?.enabled
              ? 'IA real conectada — o briefing e até 3 fotos comprimidas são enviados ao provedor para gerar o post. A chave fica protegida no servidor; as fotos não são armazenadas.'
              : 'Demonstração local — legenda, hashtags, CTA, ideia de imagem e tratamento das fotos acontecem no navegador. Nenhum dado sai daqui.'}
          </p>

          <div className="footer-meta">
            <span>Style guide v1.0</span>
            <a href="#top">Voltar ao topo</a>
          </div>
        </div>
      </footer>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
