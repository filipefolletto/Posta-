import { recommendedFontFor } from '../data/fonts';
import type {
  AudienceId,
  Brief,
  GeneratedPost,
  ImageText,
  PlatformId,
  ToneId,
} from '../types';

/* ========================================================================== */
/*  POSTAÍ — gerador local (fallback)                                        */
/*                                                                            */
/*  Este arquivo mantém o app funcionando sem IA real. Ele combina            */
/*  estruturas por plataforma, repertório por tom de voz e o briefing do      */
/*  usuário para devolver uma legenda plausível, hashtags, CTA e ideia de     */
/*  imagem.                                                                    */
/*                                                                            */
/*  Quando a IA está configurada, `src/lib/ai.ts` chama o servidor e usa      */
/*  este gerador apenas se a chamada falhar ou for desativada.                */
/* ========================================================================== */

const STOPWORDS = new Set(
  (
    'a o as os um uma uns umas de do da dos das em no na nos nas por para com sem e ou ' +
    'que se ao aos à às é foi são ser ter tem como mais menos muito muita nosso nossa ' +
    'nossos nossas seu sua seus suas este esta estes estas isso isto esse essa esses essas ' +
    'eu você vocês ele ela eles elas nós me te lhe nos vos já não sim também até entre ' +
    'sobre depois antes quando onde qual quais quem cujo cuja pelo pela pelos pelas ' +
    'num numa nuns numas ao aos à às the of and to in for on with'
  ).split(/\s+/),
);

/* -------------------------------------------------------------------------- */
/*  Hooks por tom de voz                                                      */
/* -------------------------------------------------------------------------- */

const HOOKS: Record<ToneId, readonly string[]> = {
  autentico: [
    'Tem coisa que a gente só entende fazendo. E "{theme}" é uma delas.',
    'Vou ser honesto: "{theme}" deu trabalho — e é por isso que vale.',
    'A gente não começou com todas as respostas. "{theme}" foi aparecendo no caminho.',
    'Nem tudo precisa de um roteiro perfeito. "{theme}" é a prova disso.',
  ],
  inspirador: [
    'Imagina o que ainda pode nascer de "{theme}".',
    'Toda ideia começa pequena. "{theme}" é a prova de que dá para ir longe.',
    'Tem assuntos que pedem mais do que um post. "{theme}" pede conversa.',
    'O que existe hoje já foi só uma vontade. "{theme}" começou assim.',
  ],
  'bem-humorado': [
    'Ninguém pediu, mas "{theme}" chegou e já quer o lugar de destaque.',
    'Aviso: "{theme}" pode causar vontade de largar tudo e começar hoje.',
    'Se "{theme}" fosse uma pessoa, chegaria atrasada e roubaria a cena.',
    'A gente tentou resumir "{theme}" em uma frase. Não deu.',
  ],
  educativo: [
    'Três coisas que aprendi com "{theme}" (e que mudaram o meu jeito de olhar).',
    'Vamos falar de "{theme}" sem complicar: o que importa de verdade.',
    '"{theme}" parece simples até você ver o que tem por trás.',
    'O que ninguém te conta sobre "{theme}" — e faz toda a diferença.',
  ],
  direto: [
    '"{theme}", sem rodeio.',
    'Sobre "{theme}": o que você precisa saber.',
    '"{theme}" não é tendência. É escolha.',
    '"{theme}". O resto é conversa.',
  ],
};

/* -------------------------------------------------------------------------- */
/*  Corpo por plataforma                                                      */
/* -------------------------------------------------------------------------- */

const BODIES: Record<PlatformId, readonly string[]> = {
  instagram: [
    'A gente construiu isso pensando nos detalhes que quase ninguém vê — e nos que todo mundo sente.',
    'Cada escolha carrega uma história. A sua também pode começar aqui.',
    'Não é sobre pressa. É sobre fazer com intenção, do começo ao fim.',
    'Tem coisas que a gente faz porque acredita. Essa é uma delas.',
    'O resultado aparece na foto. O cuidado aparece no processo.',
  ],
  tiktok: [
    'POV: você descobriu isso e agora não consegue pensar em outra coisa.',
    'Ninguém te contou esse detalhe — e ele muda tudo.',
    'Se você chegou até aqui, é porque isso também te pegou.',
    'Salva para não esquecer: o detalhe está no processo.',
    'A parte boa não é o resultado. É descobrir como chegar nele.',
  ],
  linkedin: [
    'O que mais me chamou atenção foi o processo, não o resultado.',
    'Toda entrega esconde uma decisão difícil que ninguém vê.',
    'Aprendi que funciona quando a estratégia cabe na rotina.',
    'O resultado chama atenção. O processo é o que sustenta.',
    'Nem toda escolha precisa ser grande para mudar o todo.',
  ],
};

/* -------------------------------------------------------------------------- */
/*  Frase de valor por tom                                                    */
/* -------------------------------------------------------------------------- */

const VALUES: Record<ToneId, readonly string[]> = {
  autentico: [
    'Sem roteiro, sem personagem: é isso que faz soar real.',
    'A parte que ninguém vê também é parte da história.',
    'Foi feito com o tempo que dava, do jeito que fazia sentido.',
  ],
  inspirador: [
    'O primeiro passo é o que separa a ideia do que existe.',
    'Quando o assunto é bom, ele encontra o caminho até as pessoas.',
    'Não precisa estar pronto. Precisa começar.',
  ],
  'bem-humorado': [
    'Sim, a gente se empolgou. Mas olha, valeu a pena.',
    'Não prometemos perfeição. Prometemos história boa.',
    'Se der certo, a gente conta. Se não, a gente também conta.',
  ],
  educativo: [
    'O segredo não é fazer mais. É fazer o que importa, na ordem certa.',
    'Clareza vale mais do que quantidade — sempre.',
    'Entender o porquê muda o jeito de fazer.',
  ],
  direto: [
    'Menos ruído, mais entrega.',
    'O que importa está no detalhe.',
    'Sem atalho: o processo é o produto.',
  ],
};

/* -------------------------------------------------------------------------- */
/*  CTA por plataforma + público                                              */
/* -------------------------------------------------------------------------- */

const CTAS: Record<PlatformId, Record<AudienceId, readonly string[]>> = {
  instagram: {
    seguidores: [
      'E você, o que acha? Conta pra gente nos comentários.',
      'Qual é a sua parte favorita? Deixa aqui embaixo.',
      'Concorda? Discorda? A conversa está aberta.',
    ],
    clientes: [
      'Se isso faz sentido para o seu momento, chama no direct. Vamos conversar.',
      'Quer ver de perto? Manda uma mensagem e a gente te mostra o próximo passo.',
      'Ficou com vontade? Chama no direct que eu te conto os detalhes.',
    ],
    comunidade: [
      'Marca alguém que precisa ver isso — e conta o que você achou.',
      'Compartilha com quem também vive esse assunto.',
      'Salva para depois e manda para alguém da sua turma.',
    ],
    recrutadores: [
      'Quer trocar ideia sobre o que vem por aí? Me chama.',
      'Se isso conversa com o seu trabalho, vamos falar.',
      'Estou aberto a conversas sobre o próximo passo.',
    ],
  },
  tiktok: {
    seguidores: [
      'Salva esse vídeo e me conta nos comentários: qual é a sua favorita?',
      'Comenta aqui se você também passou por isso.',
      'Faz o teste e me conta o resultado nos comentários.',
    ],
    clientes: [
      'Clica no link da bio e vem ver de perto.',
      'Quer o passo a passo? Está no link da bio.',
      'Chama no direct que eu te mando os detalhes.',
    ],
    comunidade: [
      'Compartilha com quem também vive isso.',
      'Marca aquela pessoa que precisa ver esse vídeo.',
      'Salva para não perder e manda para a tua turma.',
    ],
    recrutadores: [
      'Se você trabalha com isso, vamos trocar ideia.',
      'Comenta o que você faria diferente.',
      'Me chama para conversar sobre o próximo passo.',
    ],
  },
  linkedin: {
    seguidores: [
      'Como isso aparece no seu dia a dia? Comente abaixo.',
      'Qual é a sua leitura sobre esse tema? Vamos conversar nos comentários.',
      'Concorda com esse ponto? Deixe a sua visão nos comentários.',
    ],
    clientes: [
      'Se esse tema conversa com o seu negócio, vamos conversar.',
      'Quer aplicar isso na sua empresa? Me chama para trocarmos ideias.',
      'Se faz sentido para o seu momento, comente ou me mande uma mensagem.',
    ],
    comunidade: [
      'Compartilhe com quem pode se identificar.',
      'Marca alguém que precisa ler isso hoje.',
      'Se isso te ajudou, repasse para a sua rede.',
    ],
    recrutadores: [
      'Estou aberto a conversas sobre o próximo passo.',
      'Se você lidera um time, como tem lidado com isso?',
      'Vamos trocar ideia sobre o que vem por aí?',
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Ideia de imagem por plataforma                                            */
/* -------------------------------------------------------------------------- */

const IMAGE_IDEAS: Record<PlatformId, readonly string[]> = {
  instagram: [
    'Close nos detalhes do tema "{theme}", luz natural e fundo neutro. Deixe um espaço limpo para a legenda na imagem.',
    'Carrossel: capa com a frase "{hook}", depois 3 bastidores que mostrem o processo de perto.',
    'Foto horizontal com o resultado em primeiro plano e o ambiente desfocado ao fundo. Nada de excesso de texto.',
    'Registro espontâneo do processo, com as mãos em ação e um detalhe de cor para puxar o olhar.',
  ],
  tiktok: [
    'Vídeo de 8s: comece no detalhe, corte seco para o resultado e deixe o áudio em alta. Texto na tela: "{hook}".',
    'Grave a reação de alguém descobrindo o tema; legenda grande no primeiro segundo e corte no ritmo da música.',
    'Bastidor em plano fechado, sem trilha, só o som ambiente. O contraste com o resultado vem no final.',
    'Antes e depois em 6s, com transição simples e uma frase curta na tela. Sem narração.',
  ],
  linkedin: [
    'Foto horizontal do bastidor, com a equipe ao fundo e o resultado em primeiro plano. Legenda discreta no canto inferior.',
    'Card com a frase "{hook}" em fundo lilás, tipografia grande e sem excesso de texto.',
    'Imagem do processo em preto e branco com um único elemento colorido. O detalhe vira o assunto.',
    'Print de uma anotação real do projeto, com a frase principal destacada em marca-texto.',
  ],
};

/* -------------------------------------------------------------------------- */
/*  Hashtags                                                                  */
/* -------------------------------------------------------------------------- */

const PLATFORM_TAGS: Record<PlatformId, readonly string[]> = {
  instagram: ['Instagram', 'Criatividade', 'Inspiracao'],
  tiktok: ['TikTok', 'FYP', 'Viral'],
  linkedin: ['LinkedIn', 'Estrategia', 'Negocios'],
};

const TONE_TAGS: Record<ToneId, string> = {
  autentico: 'Autenticidade',
  inspirador: 'Inspiracao',
  'bem-humorado': 'Humor',
  educativo: 'Aprendizado',
  direto: 'SemRodeio',
};

const AUDIENCE_TAGS: Record<AudienceId, string> = {
  seguidores: 'Comunidade',
  clientes: 'Negocios',
  comunidade: 'Juntos',
  recrutadores: 'Carreira',
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[seed % list.length];
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? '');
}

function normalizeTheme(topic: string): string {
  const clean = topic.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '');
  if (!clean) return 'esse assunto';
  return clean.length > 120 ? `${clean.slice(0, 117).trimEnd()}...` : clean;
}

function shorten(value: string, max = 64): string {
  return value.length > max ? `${value.slice(0, max - 3).trimEnd()}...` : value;
}

function firstSentence(value: string): string {
  const sentence = value.split(/[.!?]/)[0] || value;
  return shorten(sentence.trim(), 68);
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = stripAccents(tag).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topicTags(topic: string): string[] {
  const tokens = stripAccents(topic)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const meaningful = tokens
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => word.length > 2 && !STOPWORDS.has(word));

  const pairs: string[] = [];
  const singles: string[] = [];

  for (let index = 0; index < meaningful.length; index += 1) {
    const current = meaningful[index];
    const next = meaningful[index + 1];

    if (next && next.index === current.index + 1) {
      pairs.push(titleCase(current.word) + titleCase(next.word));
      index += 1;
    } else {
      singles.push(titleCase(current.word));
    }
  }

  return [...pairs, ...singles].slice(0, 3);
}

function buildHashtags(brief: Brief, theme: string): string[] {
  const tags = [
    ...topicTags(theme),
    ...brief.tones.map((tone) => TONE_TAGS[tone]),
    ...PLATFORM_TAGS[brief.platform],
    AUDIENCE_TAGS[brief.audience],
  ];

  return uniqueTags(tags)
    .slice(0, 8)
    .map((tag) => `#${tag.replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter((tag) => tag.length > 1);
}

/* -------------------------------------------------------------------------- */
/*  Texto sobre a foto                                                         */
/* -------------------------------------------------------------------------- */

const IMAGE_HEADLINES: Record<ToneId, readonly string[]> = {
  autentico: [
    'Do jeito que a gente faz',
    'Sem roteiro, sem atalho',
    'Feito com intenção',
    'A parte real do processo',
  ],
  inspirador: [
    'O próximo passo começa aqui',
    'Toda ideia começa pequena',
    'Comece antes de estar pronto',
    'O que existe hoje já foi vontade',
  ],
  'bem-humorado': [
    'Ninguém pediu, mas chegou',
    'A gente tentou resumir. Não deu.',
    'Pode causar vontade de começar',
    'Chegou atrasado e roubou a cena',
  ],
  educativo: [
    'O que ninguém te conta',
    'Entenda o porquê',
    'Três coisas que aprendi',
    'O detalhe muda tudo',
  ],
  direto: ['Sem rodeio', 'Direto ao ponto', 'É isso.', 'O que importa'],
};

const IMAGE_SUBLINES: Record<PlatformId, readonly string[]> = {
  instagram: [
    'Arraste para ver o processo.',
    'Um detalhe muda tudo.',
    'Salve para depois.',
  ],
  tiktok: [
    'O detalhe está no processo.',
    'Assista até o fim.',
    'Salve para não esquecer.',
  ],
  linkedin: [
    'O processo por trás do resultado.',
    'Uma decisão de cada vez.',
    'O que sustenta a entrega.',
  ],
};

export function generateImageText(brief: Brief, variant = 0): ImageText {
  const theme = normalizeTheme(brief.topic);
  const primaryTone = brief.tones[0] ?? 'autentico';
  const seed =
    hash(
      [
        theme.toLowerCase(),
        brief.platform,
        brief.tones.join(','),
        brief.audience,
      ].join('|'),
    ) +
    variant * 7919;

  const headline =
    primaryTone === 'direto'
      ? shorten(theme, 40)
      : pick(IMAGE_HEADLINES[primaryTone], seed >>> 14);
  const subline =
    primaryTone === 'direto'
      ? pick(IMAGE_SUBLINES[brief.platform], seed >>> 17)
      : shorten(theme, 54);

  return {
    headline,
    subline,
    enabled: true,
    anchor: 'bottom',
    align: 'left',
    font: recommendedFontFor(brief),
  };
}

/* -------------------------------------------------------------------------- */
/*  API pública do mock                                                       */
/* -------------------------------------------------------------------------- */

export function generatePost(brief: Brief, variant = 0): GeneratedPost {
  const theme = normalizeTheme(brief.topic);
  const shortTheme = shorten(theme, 68);
  const primaryTone = brief.tones[0] ?? 'autentico';
  const secondaryTone = brief.tones[1] ?? primaryTone;

  const seed =
    hash(
      [
        theme.toLowerCase(),
        brief.platform,
        brief.tones.join(','),
        brief.audience,
      ].join('|'),
    ) +
    variant * 7919;

  const hook = fill(pick(HOOKS[primaryTone], seed), {
    theme,
    short: shortTheme,
  });
  const body = pick(BODIES[brief.platform], seed >>> 3);
  const value = pick(VALUES[secondaryTone], seed >>> 6);
  const cta = fill(pick(CTAS[brief.platform][brief.audience], seed >>> 9), {
    theme,
    short: shortTheme,
  });
  const imageIdea = fill(pick(IMAGE_IDEAS[brief.platform], seed >>> 12), {
    theme: shortTheme,
    hook: firstSentence(hook),
  });

  const paragraphs = [hook, body];
  if (brief.platform !== 'tiktok') paragraphs.push(value);

  return {
    id: `post_${Date.now()}_${variant}`,
    brief: {
      ...brief,
      tones: [...brief.tones],
    },
    caption: paragraphs.join('\n\n'),
    hashtags: buildHashtags(brief, theme),
    cta,
    imageIdea,
    imageText: generateImageText(brief, variant),
    variant,
    createdAt: Date.now(),
  };
}

export function fullPostText(post: GeneratedPost): string {
  return [post.caption, post.hashtags.join(' '), post.cta]
    .filter(Boolean)
    .join('\n\n');
}
