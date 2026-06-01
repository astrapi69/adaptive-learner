<!-- Translation: AI-generated, pending native review -->

# Arquitetura de missões diárias

As missões diárias (EXP-010, Fase 56) adicionam motivação ativa
e opt-in por cima das recompensas passivas de XP/emblemas/sequência.
Correm em ambos os modos de armazenamento e adicionam exatamente
uma tabela de rastreamento.

## Componentes

| Módulo | Papel |
|---|---|
| `plugins/.../missions/templates.yaml` | Catálogo de missões estático (22 modelos, 5 categorias), sincronizado para o frontend por `make sync-missions`. |
| `MissionTemplate` (Pydantic) | Forma de entrada do catálogo (configuração, NÃO uma tabela). |
| `UserMission` (modelo) | A única nova tabela: atribuição por utilizador/por dia + progresso + guarda `xp_awarded`. Alembic `0021`, Dexie v20, superfície de sincronização (MUTÁVEL). |
| `lib/missions/generator.ts` + `generator.py` | Seleção adaptativa determinística (PRNG com semente): uma escolha por slot de dificuldade, elegibilidade por historial (novo/ativo/veterano), sem repetições consecutivas. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Apenas verificações computáveis a partir de dados existentes são atribuíveis (as outras 5 entradas do catálogo ficam não atribuídas até que o rastreamento exista). |
| `lib/missions/progress.ts` | `check_function` puro + instantâneo de estatísticas -> {current, target, completed}. |
| `lib/missions/schedule.ts` | `today` à meia-noite local (idioma->fuso horário) + coringa de sequência. |
| `storage/missions-dexie.ts` | Dexie: recolher um instantâneo de estatísticas de "hoje", atribuir de forma idempotente, avaliar, atribuir XP na conclusão. |
| `service.py` do plugin missions | Mesmo fluxo contra SQLAlchemy para o modo API (`GET /today`, `POST /regenerate`). |

## Fluxo

1. O widget do dashboard (ou conclusão de lição) chama
   `getStorage().missions.getDaily(userId, {todayIso})`.
2. Se não existirem linhas para esse dia local, o gerador atribui
   um novo conjunto (com semente por `userId + date`,
   excluindo os do dia anterior).
3. O progresso é re-avaliado contra dados existentes
   (LessonProgress / ElementError / sequência). Uma missão
   recém-concluída inverte `completed` e, uma vez, atribui o seu
   `xp_reward` (idempotente via `xp_awarded`).
4. `celebrateMissions` (celebration bus) toca o som de missão +
   apresenta uma frase de elogio; uma limpeza total toca o som
   maior + uma explosão de confetes.

## Regras

- Determinístico por (userId, date); um utilizador usa um backend
  de armazenamento, pelo que a paridade exata entre backends não
  é necessária.
- Sem rastreamento além de `UserMission`; verificações não
  rastreáveis não são atribuídas.
- As missões são suplementares — uma falha nunca interrompe o
  fluxo da lição (todas as leituras são defensivas). Sem
  penalização por dias perdidos.
