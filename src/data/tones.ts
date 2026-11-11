import type { Tone, ToneId } from '../types';

export const TONES: Tone[] = [
  {
    id: 'autentico',
    name: 'Autêntico',
    hint: 'Parece uma pessoa, não uma marca',
  },
  {
    id: 'inspirador',
    name: 'Inspirador',
    hint: 'Abre espaço para o que pode virar',
  },
  {
    id: 'bem-humorado',
    name: 'Bem-humorado',
    hint: 'Leve, sem forçar a piada',
  },
  {
    id: 'educativo',
    name: 'Educativo',
    hint: 'Ensina sem parecer aula',
  },
  {
    id: 'direto',
    name: 'Direto',
    hint: 'Sem rodeio, sem enchimento',
  },
];

export const TONE_MAP: Record<ToneId, Tone> = {
  autentico: TONES[0],
  inspirador: TONES[1],
  'bem-humorado': TONES[2],
  educativo: TONES[3],
  direto: TONES[4],
};

export const MAX_TONES = 2;

export function isToneId(value: unknown): value is ToneId {
  return (
    value === 'autentico' ||
    value === 'inspirador' ||
    value === 'bem-humorado' ||
    value === 'educativo' ||
    value === 'direto'
  );
}
