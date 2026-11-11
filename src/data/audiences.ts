import type { Audience, AudienceId } from '../types';

export const AUDIENCES: Audience[] = [
  { id: 'seguidores', name: 'Seguidores' },
  { id: 'clientes', name: 'Clientes e leads' },
  { id: 'comunidade', name: 'Comunidade' },
  { id: 'recrutadores', name: 'Recrutadores' },
];

export const AUDIENCE_MAP: Record<AudienceId, Audience> = {
  seguidores: AUDIENCES[0],
  clientes: AUDIENCES[1],
  comunidade: AUDIENCES[2],
  recrutadores: AUDIENCES[3],
};

export function isAudienceId(value: unknown): value is AudienceId {
  return (
    value === 'seguidores' ||
    value === 'clientes' ||
    value === 'comunidade' ||
    value === 'recrutadores'
  );
}
