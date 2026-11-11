import { Icon } from './Icon';

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="eyebrow">
          <span className="eyebrow-line" aria-hidden="true" />
          Social AI · Style guide v1.0
        </span>
        <h1>
          Ideias que viram <em>conversa.</em>
        </h1>
        <p className="hero-lede">
          Transforme qualquer assunto em legenda, hashtags, CTA e ideia de imagem —
          com o tom certo para cada plataforma e público.
        </p>
        <div className="hero-platforms" aria-label="Plataformas disponíveis">
          <span>
            <Icon name="instagram" size={16} /> Instagram
          </span>
          <span>
            <Icon name="tiktok" size={16} /> TikTok
          </span>
          <span>
            <Icon name="linkedin" size={16} /> LinkedIn
          </span>
        </div>
      </div>

      <aside className="hero-aside" aria-hidden="true">
        <span className="hero-aside-label">O que está em jogo</span>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Estratégia</strong>
              <small>O que contar e para quem</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Conteúdo</strong>
              <small>O texto que soa humano</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Consistência</strong>
              <small>A mesma voz em todo lugar</small>
            </div>
          </li>
        </ol>
      </aside>
    </section>
  );
}
