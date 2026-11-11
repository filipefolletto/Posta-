import type { QuotaState } from '../lib/storage';
import type { Theme } from '../types';
import { Icon } from './Icon';

interface HeaderProps {
  quota: QuotaState;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ quota, theme, onToggleTheme }: HeaderProps) {
  const quotaLabel =
    quota.remaining === 0
      ? 'Cota do dia esgotada'
      : `${quota.remaining} ${quota.remaining === 1 ? 'geração restante' : 'gerações restantes'}`;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="brand" href="#top" aria-label="Postaí — início">
          <span className="brand-mark">
            <Icon name="sparkles" size={22} />
          </span>
          <span className="brand-name">
            Postaí
            <small>Social AI</small>
          </span>
        </a>

        <nav className="app-nav" aria-label="Principal">
          <a href="#composer" className="is-active">
            Criar
          </a>
          <a href="#como-funciona">Como funciona</a>
        </nav>

        <div className="app-header-spacer" />

        <span
          className={`quota-pill${quota.remaining === 0 ? ' is-empty' : ''}`}
          title={`${quota.used} de ${quota.limit} gerações usadas hoje`}
        >
          <span className="quota-dot" aria-hidden="true" />
          {quotaLabel}
        </span>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <span className="avatar" title="Ana Martins" aria-label="Perfil de Ana Martins">
          AM
        </span>
      </div>
    </header>
  );
}
