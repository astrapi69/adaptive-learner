# Arquitetura de design tokens

Todas as propriedades visuais da aplicação são controladas por
**design tokens** (variáveis CSS). Quem quiser recolorir a aplicação
ou construir um novo tema edita um único ficheiro `theme-*.css` e
não toca em nenhum componente. Esta regra é imposta por testes, não
é apenas uma convenção. A referência completa de tokens está em
[`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md).

---

## As camadas de tokens

1. **Tokens por tema** — o conjunto canónico de 44 tokens,
   definido uma vez por tema em
   `frontend/src/styles/themes/theme-<id>.css` (fundos, texto,
   bordas, interativo, acento, status, feedback de exercícios,
   estrela, gráficos, sombras). Mudar `[data-theme]` inverte
   todos. **Cada tema tem de definir exatamente o mesmo
   conjunto** (fixado por `themes.test.ts`).
2. **Tokens agnósticos ao tema** — valores que, por construção,
   são iguais em todos os temas (p. ex. paleta da marca, cores de
   sintaxe, espaçamentos de layout). Ficam em `global.css :root`.
3. **Aliases legados** — nomes antigos como `--surface`, `--danger`,
   que resolvem **através** dos tokens canónicos.

---

## As regras (em resumo)

- **Sem literais de cor crus** (`#hex`, `rgb()`, `hsl()`) numa
  declaração consumidora. Um literal só é permitido como valor de
  uma definição `--token:`. Em componentes e regras CSS,
  referencias tokens: `color: var(--fg-primary)`.
- **Sem utilitários Tailwind de paleta fixa** (`bg-blue-500`).
  Usa utilitários assentes em tokens (`bg-accent` → `var(--accent)`)
  ou um arbitrary value sobre um token.
- **Sem estilos inline com valores de cor.**
- **Sombras, raios, espaçamentos também são tokens**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Construir ou adaptar um tema

1. Copia um `theme-<id>.css` existente como modelo.
2. Define todos os 44 tokens canónicos (a paridade é obrigatória).
3. Atenta ao **contraste WCAG AA** — `contrast.test.ts` verifica
   todos os temas computacionalmente.
4. Regista o tema; o seletor em Definições → Aparência adota-o.

Se uma nova funcionalidade precisar de uma nova cor: **adiciona um
token**, não um literal. Se variar por tema, acrescenta-o em todos
os `theme-*.css`; se for igual em todo o lado, em `global.css :root`.

---

## Imposição

Três guards correm em `make test`
(`no-hardcoded-colors.test.ts`): literais de cor em `.tsx` (através
de uma allowlist que só encolhe), literais de cor em CSS não-tema e
utilitários Tailwind de paleta fixa (têm de ser zero). Adicionalmente
`themes.test.ts` (paridade de tokens) e `contrast.test.ts` (AA em
todos os temas).

---

## Páginas relacionadas

- [Sistema de temas](../developer/themes.md) — os temas fornecidos + seletor
- [`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md) — lista completa de tokens
