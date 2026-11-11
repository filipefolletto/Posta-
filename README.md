# Postaí — Ideias que viram conversa

Gerador de posts para **Instagram, TikTok e LinkedIn**. A partir de um briefing curto, o app devolve **legenda, hashtags, CTA e ideia de imagem** adaptados à plataforma, ao tom de voz e ao público. Se quiser, você também envia fotos: a IA escolhe um filtro que faz o conjunto combinar, escreve um texto sobre a imagem e mantém a legenda alinhada ao visual.

> Demonstração com IA simulada: toda a geração acontece no navegador. Nenhuma chave de API, worker ou banco de dados é necessário.

---

## Stack

- **React 18** + **Vite 5** + **TypeScript 5**
- CSS puro com design tokens (sem framework de UI)
- Canvas 2D para filtros, texto sobre a foto e exportação em JPEG
- Persistência em `localStorage` (briefing, último post, tema e cota)
- Mock local de geração — sem chamadas de rede

## Como rodar

```bash
npm install
npm run dev
```

O Vite abre em `http://localhost:5173`.

Outros comandos:

```bash
npm run build      # typecheck + build de produção
npm run preview    # serve o build de produção
npm run typecheck  # apenas checagem de tipos
```

> No Windows com PowerShell bloqueando `npm.ps1`, use `npm.cmd install`, `npm.cmd run dev`, etc.

---

## Como funciona

1. **Briefing** — o usuário descreve o tema, escolhe a plataforma, até 2 tons de voz e o público. Opcionalmente, envia até 6 fotos.
2. **Geração** — o mock combina estruturas por plataforma, repertório por tom e o briefing para montar o post. Com fotos, ele também sugere um filtro, um texto para a imagem e o formato ideal.
3. **Revisão** — o resultado aparece em cartões separados (legenda, hashtags, CTA, ideia de imagem), cada um com botão de copiar. O estúdio de imagem permite trocar filtro, intensidade, texto, posição e formato.
4. **Ajustes** — *Tentar de novo* gera outra variante sem gastar cota; *Novo post* limpa o resultado e as fotos, mantendo o briefing. A imagem pode ser baixada individualmente, em lote ou compartilhada quando o navegador suportar.

### Regras da demonstração

- **3 gerações por dia**, controladas em `localStorage` (`postai.quota`).
- **Tentar de novo é gratuito** e não consome cota.
- Ao esgotar a cota, o botão *Reiniciar demo* libera mais 3 gerações.
- O briefing e o último post são restaurados ao recarregar a página.
- O tema claro/escuro é aplicado antes do primeiro paint para evitar flash.

### Tom de voz

Até dois tons: **Autêntico, Inspirador, Bem-humorado, Educativo e Direto**. O primeiro define o gancho; o segundo, a frase de fechamento. Ao escolher um terceiro, o tom mais antigo sai.

### Público

**Seguidores, Clientes e leads, Comunidade e Recrutadores** — o CTA e o nível de formalidade mudam conforme a seleção.

### Fotos no post

- **Até 6 fotos** por post, com a primeira funcionando como capa e referência de cor.
- **Filtro escolhido localmente** entre Papel, Fresco, Criativo, Humano e Tinta. A escolha considera a dispersão de luminosidade, saturação e temperatura do conjunto.
- **Color matching**: as fotos seguintes recebem uma transferência de cor suave para combinar com a capa.
- **Texto sobre a imagem** editável (frase principal e linha de apoio), com posição e alinhamento ajustáveis. O contraste é calculado automaticamente e um painel de leitura aparece quando necessário.
- **Formatos de exportação**: Feed 4:5 (1080 × 1350), Quadrado 1:1 (1080 × 1080) e Story 9:16 (1080 × 1920).
- **Privacidade**: as fotos ficam apenas na sessão do navegador. Nenhum blob de imagem é salvo em `localStorage`.

---

## Design system

O visual segue o **Postaí Style Guide v1.0**. Os tokens ficam em `src/styles/tokens.css` e nenhum componente usa hex solto.

| Papel | Cor |
| --- | --- |
| Criativo (primária) | `#6C4CF5` |
| Humano (secundária) | `#FF8068` |
| Fresco (acento) | `#C9EEDB` |
| Tinta (texto) | `#201932` |
| Papel (fundo) | `#F7F5EF` |
| Superfície lilás | `#EDE8FF` |

Tipografia:

- **Manrope** — títulos, botões e rótulos (display)
- **Lora itálico** — destaque editorial (ex.: *conversa* no hero)
- **Inter** — corpo de texto e interface

A regra de proporção do guia — **60% base · 25% texto · 10% marca · 5% acento** — orienta a composição. Há suporte completo a tema escuro.

---

## Estrutura do projeto

```
src/
├─ App.tsx                 # estado, fluxo de geração e composição da página
├─ main.tsx                # bootstrap do React
├─ types.ts                # contratos compartilhados
├─ components/
│  ├─ Header.tsx           # marca, navegação, cota e tema
│  ├─ Hero.tsx             # abertura editorial
│  ├─ HowItWorks.tsx       # briefing → adaptação → publicação
│  ├─ Composer.tsx         # formulário, validação, exemplos e upload
│  ├─ PhotoUploader.tsx    # upload, capa e remoção de fotos
│  ├─ PhotoStudio.tsx      # filtro, texto, formato, exportação e share
│  ├─ PlatformPicker.tsx   # seleção de plataforma
│  ├─ TonePicker.tsx       # seleção de até 2 tons
│  ├─ ResultPanel.tsx      # estados vazio/loading/erro/pronto + cópia
│  ├─ Toast.tsx            # avisos de cópia, cota e exportação
│  └─ Icon.tsx             # ícones SVG inline
├─ data/                   # plataformas, tons, públicos, exemplos, filtros e formatos
├─ lib/
│  ├─ generator.ts         # motor mock (ganchos, corpos, CTAs, hashtags e texto da foto)
│  ├─ image.ts             # normalização, filtros, color matching, canvas e exportação
│  ├─ storage.ts           # tema, briefing, último post e cota
│  └─ clipboard.ts         # clipboard API + fallback
└─ styles/
   ├─ tokens.css           # cores, tipografia, espaço, sombras, temas
   ├─ base.css             # reset, botões e utilidades
   └─ app.css              # layout e componentes
```

---

## Plugando uma IA real

O contrato está isolado em `src/lib/generator.ts`. Para trocar o mock por uma API:

1. Faça `generatePost` chamar seu endpoint.
2. Mantenha o retorno no formato `GeneratedPost` (`caption`, `hashtags`, `cta`, `imageIdea`, `imageText`, `variant`, `createdAt`).
3. Ajuste `App.tsx` para aguardar a resposta assíncrona — o estado `generating`, o painel de loading e o tratamento de erro já existem.
4. Para visão computacional real, troque `pickPreset` e `generateImageText` por chamadas que analisem as fotos e devolvam o mesmo contrato. O pipeline de canvas, preview e exportação continua igual.

Nenhuma mudança de UI é necessária.

---

## Acessibilidade

- Navegação por teclado com foco visível.
- `aria-live` nos estados de geração e nos avisos.
- Rótulos associados aos campos e mensagens de erro com `role="alert"`.
- Contraste conferido nos dois temas.
- Respeito a `prefers-reduced-motion`.
