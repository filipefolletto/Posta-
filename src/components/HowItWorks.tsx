import type { IconName } from './Icon';
import { Icon } from './Icon';

const STEPS: Array<{ icon: IconName; number: string; title: string; text: string }> = [
  {
    icon: 'lightbulb',
    number: '01',
    title: 'Briefing',
    text: 'Você conta o tema, escolhe a plataforma, define o tom e pode anexar fotos.',
  },
  {
    icon: 'wand',
    number: '02',
    title: 'Adaptação',
    text: 'O Postaí ajusta gancho, formato, hashtags, CTA e escolhe o filtro das fotos.',
  },
  {
    icon: 'send',
    number: '03',
    title: 'Publicação',
    text: 'Copie a legenda pronta, baixe a imagem tratada e vá para o feed.',
  },
];

export function HowItWorks() {
  return (
    <section className="how" id="como-funciona" aria-label="Como funciona">
      {STEPS.map((step) => (
        <article className="how-step" key={step.number}>
          <span className="how-icon">
            <Icon name={step.icon} size={19} />
          </span>
          <div>
            <span className="how-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
