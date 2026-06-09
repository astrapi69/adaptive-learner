# Novidades (v1.61 – v1.69)

Uma visão geral orientada ao utilizador dos lançamentos desde a
v1.61.0. As notas técnicas completas por versão estão em
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.69.0 — Links de exemplo + recomendações de livros

- **Links de exemplo na teoria:** Um passo de teoria pode trazer um
  link opcional "Ver exemplo".
- **Recomendações de livros por domínio** no Navegador de Conteúdo
  ([Recomendações de livros](content-creation/books.md)).
- **Atalho Enter também no Replay de Erros** ("Repetir erros").
- **Correção de backup:** o título do conjunto é lido corretamente
  do manifesto ao restaurar.

## v1.68.0 — Exportação de resultados + retro-links de teoria

- **Exportar resultado da lição:** "Copiar resultado" / "Guardar
  como ficheiro" (relatório Markdown para assistentes de IA).
- **Retro-links de teoria:** saltar de um exercício para a teoria
  correspondente e voltar.
- **Exercício de correspondência reformulado:** pares coloridos +
  badges numéricos (seguro para daltónicos).
- **Contraste do modo escuro** corrigido em vários pontos.

## v1.67.1 — Restauro de backup + estabilidade do deploy

- Correção **sistemática de restauro de backup**.
- Recarregamento automático em chunk de deploy desatualizado.
- Polimento do filtro de Subject (oculto com ≤ 1 Subject,
  mais usado primeiro).

## v1.65.0 — Avaliação retomável + atalho Enter

- **Avaliação retomável:** interromper o teste e continuar mais
  tarde de onde paraste.
- **Atalho Enter:** Enter verifica um exercício respondido e avança
  (comutável em Definições → Aprendizagem).
- Exercícios de correspondência mais claros + revisão dos design
  tokens.

## v1.64.0 — Reformulação do onboarding

- **Início rápido apenas com Nome + Tema**; o resto assume
  predefinições.
- **Assistente de onboarding** opcional (uma pergunta por ecrã).
- A **avaliação é agora opcional** ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 — Presets de tema WCAG AA

- **6 temas recomendados** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes com AA por cálculo
  ([Sistema de temas](developer/themes.md)).
- Auditoria sistemática de i18n; filtro do Dashboard orientado ao
  utilizador.

## v1.62.0 — Integridade do backup + proveniência da build

- Reforço do **restauro de backup** (coerção de tipos de dados,
  ordem de FK).
- O About mostra informações reais da build em vez de "unknown".

## v1.61.0 — Conformidade dos botões + retoma de lição

- Conformidade de botões shadcn em toda a aplicação.
- **Lição pausada** continua no passo exato.
- Validação de conteúdo entre repositórios.

---

## Linhas maiores no período

- **Múltiplos repositórios de conteúdo (EXP-023):** ligar repos
  próprios, gerir vários, partilhar por link/QR, níveis de Trust,
  repos recomendados, avaliações locais
  ([Múltiplos repositórios de conteúdo](features/content-repos.md)).
- **Backup como snapshot completo** com importação entre
  identidades
  ([Backup e restauro](features/backup.md)).

---

## Páginas relacionadas

- [Primeiros passos](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — notas completas
