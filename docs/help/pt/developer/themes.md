<!-- Translation: AI-generated, pending native review -->

# Sistema de temas

A Fase 58 (v1.41.0) substituiu o antigo par claro/escuro por um
sistema de seis temas numa única dimensão `data-theme`, mais uma
escolha `auto` que segue o sistema operativo.

## Como funciona

- Os **tokens de cor canónicos** vivem em
  `frontend/src/styles/themes/theme-<id>.css`, um bloco por
  valor de `data-theme` (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Cada ficheiro define o conjunto
  **completo** de tokens semânticos — não há passagem para o modo
  claro.
- Os **tokens agnósticos ao tema** (espaçamento, raio, fontes, a
  paleta de método da marca) e os **aliases legados** (`--bg`,
  `--surface`, `--fg`, `--danger`, ...) vivem em
  `styles/global.css :root`. Os aliases resolvem *através* dos
  tokens canónicos, por isso as regras mais antigas seguem
  automaticamente o tema ativo.
- Os ficheiros de tema são importados de `main.tsx`, **claro
  primeiro**, para que o tema ativo ganhe o empate de igual
  especificidade contra `:root`.
- `frontend/src/lib/themes.ts` é o registo: `THEMES`, os tipos
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)`
  para o mapeamento `auto` e os swatches do cartão de pré-
  visualização.
- `frontend/src/hooks/useTheme.ts` possui o atributo `data-theme`
  aplicado e persiste a escolha sob `adaptive-learner.theme`
  (migra a chave `adaptive-learner-theme` anterior ao 58E uma vez).
- `index.html` transporta um pequeno script inline que aplica o
  tema guardado **antes da primeira renderização** (sem flash).
  Espelha a resolução do hook; mantenha os dois em sincronia.
- Os gráficos (Recharts) não conseguem ler variáveis CSS nos
  atributos SVG, por isso `lib/chartTheme.ts` + `useChartTheme`
  leem os valores de tokens calculados e releem na alteração de
  `data-theme`.

## Conjunto de tokens (definido por cada tema)

Fundos (`--bg-primary/secondary/surface/elevated/overlay`),
texto (`--fg-primary/secondary/muted/inverse`), bordas
(`--border-primary/subtle/accent`), interativo
(`--interactive-bg/hover/active/disabled`), acento
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), pares de estado
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
feedback de exercício (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, séries de gráficos (`--chart-1..6`) e sombras
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` falha se algum tema estiver a
faltar algum destes ou adicionar um extra;
`styles/contrast.test.ts` asserta WCAG 2.1 AA em todos os seis
temas.

## Como adicionar um novo tema

1. **Copie** um ficheiro existente, p.ex.
   `cp theme-dark.css theme-midnight.css`, e mude o seletor para
   `[data-theme="midnight"]`. Mantenha **todos** os tokens —
   mude apenas os valores. Não adicione estilos de componentes aqui.
2. **Registe-o** em `lib/themes.ts`: adicione uma entrada
   `ThemeMeta` a `THEMES` (id, `label` em inglês, `family`
   claro|escuro, e um `swatch` para a pré-visualização nas
   Definições) e adicione o id à união `ThemeId`.
3. **Importe-o** em `main.tsx` depois de `theme-light.css`
   (a ordem só importa relativamente ao claro).
4. **Permita-o no guarda pré-renderização**: adicione o id ao
   array `valid` no `<script>` inline em `index.html`.
5. **i18n**: adicione `ui.themes.midnight` a todos os oito
   catálogos em `backend/config/i18n/*.yaml`, depois execute
   `make sync-i18n`.
6. **Verifique**: `npx vitest run src/styles/themes src/styles/contrast`
   — os pins de integridade + contraste devem permanecer verdes
   (ajuste os valores até o contraste passar AA no seu novo tema).

É tudo — o ThemePicker, o script pré-renderização, os gráficos e
cada componente captam o novo tema automaticamente porque todos
leem os tokens canónicos.

## Regras

- **Sem cores fixas** nos componentes. `styles/no-hardcoded-colors.test.ts`
  impõe-no para estilos `.tsx` (uma lista de permissões documentada
  cobre resolvedores de gráficos, confetes decorativos e cores de
  dados).
- **Cada tema define cada token.** Sem lacunas de herança do claro
  — esse foi o bug da auditoria F1 (tokens indefinidos a renderizar
  o hex do modo claro no modo escuro).
- **A troca de tema é instantânea** — uma troca de `data-theme`,
  nunca um recarregamento.
