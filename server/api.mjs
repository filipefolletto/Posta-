import { readFileSync } from 'node:fs';

/* ========================================================================== */
/*  POSTAÍ — API de IA                                                        */
/*                                                                            */
/*  Este módulo concentra as chamadas ao provedor de IA. Ele é usado tanto     */
/*  pelo middleware do Vite em desenvolvimento quanto pelo servidor de        */
/*  produção (`server/index.mjs`). A chave nunca chega ao navegador.          */
/* ========================================================================== */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const DEFAULT_VISION_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 6;
const VISION_PHOTO_LIMIT = 3;
const MAX_PHOTO_DATA_URL_LENGTH = 4 * 1024 * 1024;

const PLATFORMS = new Set(['instagram', 'tiktok', 'linkedin']);
const TONES = new Set([
  'autentico',
  'inspirador',
  'bem-humorado',
  'educativo',
  'direto',
]);
const AUDIENCES = new Set([
  'seguidores',
  'clientes',
  'comunidade',
  'recrutadores',
]);
const FONTS = new Set(['manrope', 'lora', 'inter', 'playfair', 'space']);
const FILTERS = new Set(['papel', 'fresco', 'criativo', 'humano', 'tinta']);
const ANCHORS = new Set(['top', 'center', 'bottom']);
const ALIGNS = new Set(['left', 'center', 'right']);

const PLATFORM_LIMITS = {
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
};

const AUDIENCE_LABEL = {
  seguidores: 'seguidores que já acompanham a marca e buscam identificação',
  clientes: 'clientes e leads que precisam de confiança e clareza',
  comunidade: 'uma comunidade próxima, que valoriza troca e pertencimento',
  recrutadores: 'recrutadores e profissionais que avaliam autoridade e cultura',
};

const FILTER_GUIDE = `
- papel: neutro, quente e editorial; bom para cenas cotidianas e marcas calmas.
- fresco: limpo, claro e levemente frio; bom para luz natural, produtos e leveza.
- criativo: contraste alto com toque lilás; bom para ideias ousadas e cultura urbana.
- humano: quente, solar e acolhedor; bom para pessoas, encontros e bastidores.
- tinta: preto e branco com presença; bom para retratos, arquitetura e drama.
`.trim();

const FONT_GUIDE = `
- manrope: sans moderna e amigável; Instagram autêntico/direto.
- lora: serifada editorial com autoridade; LinkedIn e posts mais calmos.
- inter: sans limpa e objetiva; conteúdo educativo e leitura rápida.
- playfair: serifada elegante; ideias inspiradoras.
- space: geométrica com energia; TikTok e posts bem-humorados/criativos.
`.trim();

const POST_SYSTEM = `
Você é o motor criativo do Postaí, um gerador de posts para Instagram, TikTok e LinkedIn.
Escreva em português do Brasil, com voz natural, específica e sem clichês de IA.
Não invente dados, números, depoimentos, notícias ou resultados.
Responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários e sem texto fora do JSON.
`.trim();

const VISION_SYSTEM = `
Você é o diretor de arte do Postaí. Analise as fotos enviadas e escolha o tratamento visual
que deixa o conjunto mais coerente com o briefing.
Responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários e sem texto fora do JSON.
`.trim();

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*  Ambiente                                                                  */
/* -------------------------------------------------------------------------- */

function loadLocalEnv() {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile();
      return;
    }
  } catch {
    // Sem .env local: segue com as variáveis já presentes no ambiente.
  }

  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equals = trimmed.indexOf('=');
      if (equals < 0) continue;

      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Sem .env local: segue com as variáveis já presentes no ambiente.
  }
}

loadLocalEnv();

function getConfig() {
  const baseUrl =
    (process.env.AI_BASE_URL ?? '').trim() || DEFAULT_BASE_URL;
  const textModel =
    (process.env.AI_TEXT_MODEL ?? '').trim() || DEFAULT_TEXT_MODEL;
  const visionModel =
    (process.env.AI_VISION_MODEL ?? '').trim() || DEFAULT_VISION_MODEL;

  return {
    apiKey: (process.env.AI_API_KEY ?? '').trim(),
    baseUrl: baseUrl.replace(/\/+$/, ''),
    textModel,
    visionModel,
    timeoutMs: Math.max(
      5_000,
      Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    ),
  };
}

export function getAiStatus() {
  const config = getConfig();

  return {
    enabled: Boolean(config.apiKey),
    provider: 'openai-compatible',
    textModel: config.textModel,
    visionModel: config.visionModel,
  };
}

/* -------------------------------------------------------------------------- */
/*  HTTP helpers                                                              */
/* -------------------------------------------------------------------------- */

function sendJson(res, status, payload) {
  if (res.headersSent) return;

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        reject(
          new ApiError(
            413,
            'BODY_TOO_LARGE',
            'O payload enviado é grande demais.',
          ),
        );
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(
          new ApiError(
            400,
            'INVALID_JSON',
            'O corpo da requisição não é um JSON válido.',
          ),
        );
      }
    });

    req.on('error', (error) => reject(error));
  });
}

/* -------------------------------------------------------------------------- */
/*  Validação                                                                 */
/* -------------------------------------------------------------------------- */

function textValue(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeBrief(value) {
  if (!value || typeof value !== 'object') {
    throw new ApiError(400, 'INVALID_BRIEF', 'Briefing inválido.');
  }

  const raw = value;
  const topic = textValue(raw.topic, 280);

  if (topic.length < 8) {
    throw new ApiError(
      400,
      'INVALID_BRIEF',
      'O tema precisa ter pelo menos 8 caracteres.',
    );
  }

  if (!PLATFORMS.has(raw.platform)) {
    throw new ApiError(400, 'INVALID_BRIEF', 'Plataforma inválida.');
  }

  if (!AUDIENCES.has(raw.audience)) {
    throw new ApiError(400, 'INVALID_BRIEF', 'Público inválido.');
  }

  const tones = Array.isArray(raw.tones)
    ? raw.tones.filter((tone) => TONES.has(tone)).slice(0, 2)
    : [];

  if (tones.length === 0) {
    throw new ApiError(
      400,
      'INVALID_BRIEF',
      'Escolha pelo menos um tom de voz.',
    );
  }

  return {
    topic,
    platform: raw.platform,
    tones,
    audience: raw.audience,
  };
}

function normalizeVariant(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeHashtags(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const result = [];

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

function recommendedFontForBrief(brief) {
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

function normalizeGeneratedContent(raw, brief) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError(
      502,
      'AI_INVALID_CONTENT',
      'A IA não retornou o conteúdo esperado.',
    );
  }

  const caption = textValue(raw.caption, 5000);
  if (!caption) {
    throw new ApiError(
      502,
      'AI_INVALID_CONTENT',
      'A IA não retornou uma legenda válida.',
    );
  }

  const imageTextRaw =
    raw.imageText && typeof raw.imageText === 'object' ? raw.imageText : {};
  const fallbackFont = recommendedFontForBrief(brief);

  const imageText = {
    headline:
      textValue(imageTextRaw.headline, 60) ||
      textValue(caption, 60) ||
      'Sua ideia, agora',
    subline: textValue(imageTextRaw.subline, 90) || textValue(brief.topic, 90),
    enabled: imageTextRaw.enabled !== false,
    anchor: ANCHORS.has(imageTextRaw.anchor) ? imageTextRaw.anchor : 'bottom',
    align: ALIGNS.has(imageTextRaw.align) ? imageTextRaw.align : 'left',
    font: FONTS.has(imageTextRaw.font) ? imageTextRaw.font : fallbackFont,
  };

  const hashtags = normalizeHashtags(raw.hashtags);

  return {
    caption,
    hashtags:
      hashtags.length > 0 ? hashtags : [`#${brief.platform}`, '#conteudo'],
    cta:
      textValue(raw.cta, 400) ||
      'Conta aqui nos comentários o que você faria diferente.',
    imageIdea:
      textValue(raw.imageIdea, 600) ||
      'Uma imagem próxima, com luz natural e espaço para o texto.',
    imageText,
  };
}

function normalizePhotos(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(
      400,
      'INVALID_PHOTOS',
      'Envie pelo menos uma foto para a análise.',
    );
  }

  return value.slice(0, MAX_PHOTOS).map((photo) => {
    if (!photo || typeof photo !== 'object') {
      throw new ApiError(400, 'INVALID_PHOTOS', 'Foto inválida.');
    }

    const dataUrl = typeof photo.dataUrl === 'string' ? photo.dataUrl : '';
    if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
      throw new ApiError(
        400,
        'INVALID_PHOTOS',
        'A foto precisa ser enviada como data URL JPEG, PNG ou WebP.',
      );
    }

    if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
      throw new ApiError(
        413,
        'PHOTO_TOO_LARGE',
        'Uma das fotos é grande demais para a análise.',
      );
    }

    const stats =
      photo.stats && typeof photo.stats === 'object' ? photo.stats : null;

    return {
      dataUrl,
      stats,
      name: textValue(photo.name, 80),
    };
  });
}

function normalizePhotoAnalysis(raw, brief) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError(
      502,
      'AI_INVALID_CONTENT',
      'A IA não retornou uma análise válida.',
    );
  }

  return {
    presetId: FILTERS.has(raw.presetId) ? raw.presetId : 'papel',
    font: FONTS.has(raw.font) ? raw.font : recommendedFontForBrief(brief),
    anchor: ANCHORS.has(raw.anchor) ? raw.anchor : 'bottom',
    align: ALIGNS.has(raw.align) ? raw.align : 'left',
    reason: textValue(raw.reason, 180),
  };
}

/* -------------------------------------------------------------------------- */
/*  Provedor                                                                  */
/* -------------------------------------------------------------------------- */

async function callChat({ model, messages, temperature = 0.8 }) {
  const config = getConfig();

  if (!config.apiKey) {
    throw new ApiError(
      503,
      'AI_NOT_CONFIGURED',
      'A IA real não está configurada. Defina AI_API_KEY no servidor.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        '[postai-ai] provedor respondeu',
        response.status,
        raw.slice(0, 600),
      );
      throw new ApiError(
        502,
        'AI_PROVIDER_ERROR',
        `O provedor de IA respondeu com status ${response.status}.`,
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ApiError(
        502,
        'AI_INVALID_RESPONSE',
        'O provedor retornou uma resposta inválida.',
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(
        502,
        'AI_EMPTY_RESPONSE',
        'A IA não retornou conteúdo.',
      );
    }

    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error?.name === 'AbortError') {
      throw new ApiError(
        504,
        'AI_TIMEOUT',
        'A IA demorou demais para responder.',
      );
    }

    console.error('[postai-ai] falha na requisição', error);
    throw new ApiError(
      502,
      'AI_REQUEST_FAILED',
      'Não foi possível falar com o provedor de IA.',
    );
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonContent(content) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Alguns modelos adicionam uma frase antes/depois do JSON.
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // Cai no erro abaixo.
    }
  }

  throw new ApiError(
    502,
    'AI_INVALID_JSON',
    'A IA não retornou um JSON válido.',
  );
}

function buildPostPrompt(brief, variant) {
  const limit = PLATFORM_LIMITS[brief.platform] ?? 2200;
  const variantRule =
    variant > 0
      ? 'Crie uma alternativa claramente diferente da primeira versão: mude o gancho, a estrutura e o CTA.'
      : 'Crie a primeira versão do post.';

  return `
Briefing:
${JSON.stringify(brief, null, 2)}

Contexto:
- Plataforma: ${brief.platform}
- Limite aproximado de legenda: ${limit} caracteres
- Público: ${AUDIENCE_LABEL[brief.audience]}
- Tons: ${brief.tones.join(' + ')}
- Variante: ${variant}
- ${variantRule}

Contrato JSON obrigatório:
{
  "caption": "legenda completa",
  "hashtags": ["#exemplo", "#postai"],
  "cta": "chamada final",
  "imageIdea": "ideia visual",
  "imageText": {
    "headline": "frase principal",
    "subline": "linha de apoio",
    "enabled": true,
    "anchor": "bottom",
    "align": "left",
    "font": "manrope"
  }
}

Regras:
- caption: escreva para a plataforma e o público. Use parágrafos curtos, naturais e específicos. Não repita o briefing literalmente. Evite clichês como "no mundo de hoje", "desbloqueie" e "game changer". Use no máximo 1 emoji.
- hashtags: 5 a 8 tags relevantes, sem espaços, começando com #.
- cta: uma frase curta e específica, adequada ao público.
- imageIdea: descreva uma cena ou imagem possível, sem transformar isso em texto sobre a foto.
- imageText.headline: no máximo 60 caracteres, com força visual.
- imageText.subline: no máximo 90 caracteres, complementando a frase principal.
- imageText.font: escolha exatamente uma opção: manrope, lora, inter, playfair ou space.
- imageText.anchor: top, center ou bottom.
- imageText.align: left, center ou right.
`.trim();
}

function buildVisionPrompt(brief, photos) {
  const stats = photos
    .map((photo, index) => {
      if (!photo.stats) return `Foto ${index + 1}: sem estatísticas de cor.`;

      const luminance = Number(photo.stats.luminance);
      const saturation = Number(photo.stats.saturation);
      const temperature = Number(photo.stats.temperature);

      return `Foto ${index + 1}: luminosidade ${Number.isFinite(luminance) ? luminance.toFixed(2) : '?'}, saturação ${Number.isFinite(saturation) ? saturation.toFixed(2) : '?'}, temperatura ${Number.isFinite(temperature) ? temperature.toFixed(2) : '?'}.`;
    })
    .join('\n');

  return `
Briefing:
${JSON.stringify(brief, null, 2)}

Fotos analisadas: ${photos.length}
${stats}

Opções de filtro:
${FILTER_GUIDE}

Opções de fonte:
${FONT_GUIDE}

Contrato JSON obrigatório:
{
  "presetId": "papel",
  "font": "manrope",
  "anchor": "bottom",
  "align": "left",
  "reason": "frase curta em português"
}

Regras:
- Considere assunto, luz, cores, contraste, espaço negativo e clima das fotos.
- Escolha um filtro que una o conjunto, não apenas uma foto isolada.
- A fonte deve combinar com plataforma, tom e fotos.
- anchor/align devem evitar áreas importantes e aproveitar o espaço negativo.
- reason: no máximo 140 caracteres, explicando a escolha em português.
`.trim();
}

async function generatePostWithAi(brief, variant) {
  const config = getConfig();
  const content = await callChat({
    model: config.textModel,
    temperature: 0.9,
    messages: [
      { role: 'system', content: POST_SYSTEM },
      { role: 'user', content: buildPostPrompt(brief, variant) },
    ],
  });

  return normalizeGeneratedContent(parseJsonContent(content), brief);
}

async function analyzePhotosWithAi(brief, photos) {
  const config = getConfig();
  const selected = photos.slice(0, VISION_PHOTO_LIMIT);

  const content = await callChat({
    model: config.visionModel,
    temperature: 0.3,
    messages: [
      { role: 'system', content: VISION_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt(brief, selected) },
          ...selected.map((photo) => ({
            type: 'image_url',
            image_url: { url: photo.dataUrl, detail: 'low' },
          })),
        ],
      },
    ],
  });

  return normalizePhotoAnalysis(parseJsonContent(content), brief);
}

/* -------------------------------------------------------------------------- */
/*  Rotas                                                                     */
/* -------------------------------------------------------------------------- */

export async function handleApiRequest(req, res, url) {
  const requestUrl =
    url ?? new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(res, 200, getAiStatus());
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/generate-post') {
      const config = getConfig();
      if (!config.apiKey) {
        throw new ApiError(
          503,
          'AI_NOT_CONFIGURED',
          'A IA real não está configurada. Defina AI_API_KEY no servidor.',
        );
      }

      const body = await readJsonBody(req);
      const brief = normalizeBrief(body.brief);
      const variant = normalizeVariant(body.variant);
      const content = await generatePostWithAi(brief, variant);

      sendJson(res, 200, { source: 'ai', content });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/analyze-photos') {
      const config = getConfig();
      if (!config.apiKey) {
        throw new ApiError(
          503,
          'AI_NOT_CONFIGURED',
          'A IA real não está configurada. Defina AI_API_KEY no servidor.',
        );
      }

      const body = await readJsonBody(req);
      const brief = normalizeBrief(body.brief);
      const photos = normalizePhotos(body.photos);
      const analysis = await analyzePhotosWithAi(brief, photos);

      sendJson(res, 200, { source: 'ai', analysis });
      return;
    }

    sendJson(res, 404, {
      error: 'NOT_FOUND',
      message: 'Rota não encontrada.',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, {
        error: error.code,
        message: error.message,
      });
      return;
    }

    console.error('[postai-ai] erro inesperado', error);
    sendJson(res, 500, {
      error: 'INTERNAL_ERROR',
      message: 'Erro interno no servidor de IA.',
    });
  }
}
