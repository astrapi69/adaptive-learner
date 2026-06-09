# Sistema de temas

A Fase 58 (v1.41.0) substituiu o antigo par claro/escuro por um
sistema de seis temas clássicos numa única dimensão
`data-theme`, mais uma opção `auto` que segue o sistema operativo. A
Fase 63 (v1.63.0) acrescentou seis **presets WCAG AA recomendados**,
de forma que o seletor passou a ter no total **12 temas**.

## Presets recomendados (Fase 63 / v1.63.0)

O seletor em Definições → Aparência começa com um sub-separador
**Recomendado**:

- **Claro:** `catppuccin-latte`, `supabase`, `graphite`
- **Escuro:** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

Foram gerados a partir de presets tweakcn por
`scripts/generate_preset_themes.py` como temas completos de
44 tokens, com **WCAG AA imposto por cálculo** (`contrast.test.ts`
em todos os 12 temas). Os seis clássicos (`light`, `dark`, `ocean`,
`forest`, `high-contrast`, `sepia`) permanecem inalterados.

## Funcionamento

- Os **tokens de cor canónicos** ficam em
  `frontend/src/styles/themes/theme-<id>.css`, um bloco por valor de
  `data-theme` (`light`, `dark`, `ocean`, `forest`, `high-contrast`,
  `sepia`). Cada ficheiro define o conjunto semântico **completo** de
  tokens - não há fallback para claro.
- Os **tokens independentes do tema** (espaçamentos, raio, tipos de
  letra, a paleta de métodos da marca) e os **aliases legados**
  (`--bg`, `--surface`, `--fg`, `--danger`, ...) ficam em
  `styles/global.css :root`. Os aliases resolvem *através* dos
  tokens canónicos e seguem assim automaticamente o tema ativo.
- Os ficheiros de tema são importados em `main.tsx`, **claro
  primeiro**, para que o tema ativo ganhe o empate de especificidade
  contra `:root`.
- `frontend/src/lib/themes.ts` é o registo: `THEMES`, os tipos
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)` para
  o mapeamento `auto` e as amostras de cor para pré-visualização.
- `frontend/src/hooks/useTheme.ts` possui o atributo `data-theme`
  aplicado e guarda a escolha em `adaptive-learner.theme` (migra a
  antiga chave `adaptive-learner-theme` uma única vez).
- `index.html` contém um pequeno script inline que aplica o tema
  guardado **antes do primeiro paint** (sem flicker). Espelha a
  resolução do hook; mantém ambos sincronizados.
- Os gráficos (Recharts) não conseguem ler variáveis CSS em
  atributos SVG, por isso `lib/chartTheme.ts` + `useChartTheme` leem
  os valores de tokens calculados e voltam a ler em cada mudança de
  `data-theme`.

## Conjunto de tokens (definido por cada tema)

Fundos (`--bg-primary/secondary/surface/elevated/overlay`),
texto (`--fg-primary/secondary/muted/inverse`), bordas
(`--border-primary/subtle/accent`), interativo
(`--interactive-bg/hover/active/disabled`), acento
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), pares de status
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
feedback de exercícios (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, séries de gráficos (`--chart-1..6`) e sombras
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` falha se um tema não tiver um destes
tokens ou tiver um adicional; `styles/contrast.test.ts` verifica
WCAG 2.1 AA em todos os 12 temas. A referência completa de tokens
está em
[Arquitetura de design tokens](../architecture/design-tokens.md).

## Adicionar um novo tema

1. **Copia** um ficheiro existente, p. ex.
   `cp theme-dark.css theme-midnight.css`, e muda o seletor para
   `[data-theme="midnight"]`. Mantém **cada** token - muda apenas os
   valores. Sem estilos de componentes aqui.
2. **Regista-o** em `lib/themes.ts`: adiciona a `THEMES` uma
   entrada `ThemeMeta` (id, `label` em inglês, `family`
   light|dark e um `swatch` para a pré-visualização nas Definições) e
   acrescenta o id na união `ThemeId`.
3. **Importa-o** em `main.tsx` após `theme-light.css` (a ordem só
   conta em relação a claro).
4. **Permite-o no guard de pré-paint**: acrescenta o id ao array
   `valid` no `<script>` inline em `index.html`.
5. **i18n**: adiciona `ui.themes.midnight` em todos os oito
   catálogos sob `backend/config/i18n/*.yaml` e executa
   `make sync-i18n`.
6. **Verifica**: `npx vitest run src/styles/themes src/styles/contrast` -
   os pins de completude e de contraste têm de permanecer verdes
   (ajusta os valores até o contraste no novo tema cumprir AA).

É tudo - o ThemePicker, o script de pré-paint, os gráficos e cada
componente adotam o novo tema automaticamente, porque todos leem os
tokens canónicos.

## Regras

- **Sem cores fixas no código** em componentes.
  `styles/no-hardcoded-colors.test.ts` impõe isto para os estilos
  `.tsx` (uma allowlist documentada cobre resolvers de gráficos,
  confetti decorativo e cores de dados).
- **Cada tema define cada token.** Sem lacunas com herança de claro -
  esse foi o erro da auditoria F1 (tokens indefinidos que mostravam
  hex claro no modo escuro).
- **A mudança de tema é instantânea** - uma troca de `data-theme`,
  nunca um recarregamento.
