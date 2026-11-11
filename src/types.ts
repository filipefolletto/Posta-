export type PlatformId = 'instagram' | 'tiktok' | 'linkedin';

export type ToneId =
  | 'autentico'
  | 'inspirador'
  | 'bem-humorado'
  | 'educativo'
  | 'direto';

export type AudienceId =
  | 'seguidores'
  | 'clientes'
  | 'comunidade'
  | 'recrutadores';

export type Theme = 'light' | 'dark';

export type FilterPresetId = 'papel' | 'fresco' | 'criativo' | 'humano' | 'tinta';

export type ImageFormat = 'feed' | 'square' | 'story';

export type ImageAnchor = 'top' | 'center' | 'bottom';

export type ImageAlign = 'left' | 'center' | 'right';

export interface Platform {
  id: PlatformId;
  name: string;
  handle: string;
  hint: string;
  characterLimit: number;
}

export interface Tone {
  id: ToneId;
  name: string;
  hint: string;
}

export interface Audience {
  id: AudienceId;
  name: string;
}

export interface Brief {
  topic: string;
  platform: PlatformId;
  tones: ToneId[];
  audience: AudienceId;
}

export interface ImageText {
  headline: string;
  subline: string;
  enabled: boolean;
  anchor: ImageAnchor;
  align: ImageAlign;
}

export interface PhotoStats {
  luminance: number;
  saturation: number;
  temperature: number;
  mean: [number, number, number];
  std: [number, number, number];
  palette: string[];
}

export interface PhotoAsset {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  stats: PhotoStats;
}

export interface GeneratedPost {
  id: string;
  brief: Brief;
  caption: string;
  hashtags: string[];
  cta: string;
  imageIdea: string;
  imageText: ImageText;
  variant: number;
  createdAt: number;
}

export type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}
