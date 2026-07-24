<!-- Translation: AI-generated, pending native review -->

# Lições + internos do SRS

Esta página documenta como a pilha de funcionalidades de lições de
conteúdo + SRS das versões v1.27.0–v1.31.0 está ligada no backend,
frontend e dois plugins. Para a visão geral voltada para o
utilizador, consulte
[`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Visão geral da arquitetura

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: visualizador de lições + sessão de revisão     │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  um de  │
│   pages/Review.tsx           ↓               4 componentes│
│                              ↓               de exercício │
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   Fronteira IStorageService
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   espelha o serviço do  │
   │   errors            │      │   backend 1:1 contra    │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - matriz de transição upsert                      │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - agendador de bandas 1d/3d/7d                    │
   │    - ordenação por em atraso → error_count → last_error_at│
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress com inversão mark_completed     │
   │      desencadeia lesson_session_unification          │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - dispara on_session_complete via manager._pm.hook│
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Plugin Gamification             │
            │   despacho on_session_complete  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (fórmula de lição)│
            │     else →                      │
            │       award_xp_for_session      │
            │       (fórmula de chat, inalterada)│
            │   badge_service.evaluate_user   │
            │     → 4 novos predicados de lição│
            └─────────────────────────────────┘
```

---

## Rastreamento de erros ao nível de elemento (v1.30.0 / Fase 46B)

### Modelo

`app/models/__init__.py:ElementError` com uma restrição UNIQUE
composta em
`(user_id, set_id, lesson_id, exercise_id, element_key)`.
Chaves de elemento com âmbito de lição por decisão **D2** - a
mesma palavra em duas lições diferentes é duas linhas.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # id do conjunto de conteúdo (string, não FK)
    lesson_id: str         # id da lição de conteúdo (string, não FK)
    exercise_id: str       # id do exercício dentro da lição
    element_key: str       # a palavra/par/frase específica
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incrementado em cada tentativa errada
    correct_streak: int    # incrementado no correto, reiniciado no errado
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True sse correct_streak ≥ 3
    mastered_at: datetime | None
```

Desacoplado de `learning_sessions` (sem FK) por design -
as lições de conteúdo referenciam IDs de conjunto de conteúdo /
lição por string, não via join relacional. Isso significa que a
tabela sobrevive a evicções de cache independentemente de qualquer
linha de sessão.

### Matriz de transição upsert

`app/services/element_errors.py:upsert_element_error` é o único
mutador. Comportamento:

| Acionador | Ação |
|---|---|
| Primeiro avistamento (correto) | INSERIR linha, `correct_streak=1` |
| Primeiro avistamento (errado) | INSERIR linha, `error_count=1` |
| Linha existente, tentativa correta | `correct_streak += 1`; inverter `mastered=True` sse streak atinge `MASTERY_THRESHOLD` (3) |
| Linha existente, tentativa errada numa linha não dominada | `error_count += 1`, `correct_streak = 0` |
| Linha existente, tentativa errada numa linha **dominada** | rebaixar: `mastered=False`, `mastered_at=None`, `correct_streak=0`, `error_count += 1` |

O limiar de domínio é uma constante ao nível do código
(`MASTERY_THRESHOLD = 3`); por decisão **D4**, é intrínseco à
semântica do SRS, não um parâmetro configurável.

### Espelho Dexie

`frontend/src/storage/element-errors-dexie.ts` espelha o serviço
do backend 1:1 contra IndexedDB. O contrato em
`IElementErrorsNamespace` é idêntico nas duas implementações de
armazenamento, por isso o portão de lançamento do modo Dexie
(`make test-dexie-smoke`) deteta qualquer deriva.

---

## Agendamento SRS (v1.30.0 / Fase 46C)

### Política de intervalo

`app/services/element_srs.py:next_review_due_at` projeta a próxima
revisão de uma linha não dominada:

| `correct_streak` | Intervalo |
|---|---|
| 0 | 1 dia após `last_attempt_at` |
| 1 | 3 dias |
| 2 | 7 dias |
| ≥ 3 | dominado - excluído da fila |

### Ordenação por prioridade

O endpoint da fila de revisão ordena por:

1. **Em atraso primeiro** (`next_review_due_at < now` fica acima
   de `next_review_due_at > now`)
2. **Contagem de erros decrescente** (mais erros = maior
   prioridade)
3. **Erro mais recente primeiro** (falha mais recente fica acima
   das mais antigas, resolução em microssegundos via
   `-last_error_at.timestamp_us`)

A tupla é chaveada por `_sort_key` retornando
`tuple[int, int, int]` (o hotfix de CI v1.30.0 `9275841` fixou
a anotação mypy após uma refatoração de datetime para microssegundos
inteiros).

### Endpoint

`GET /api/users/{user_id}/element-errors/review-queue`
retorna a fila priorizada. Equivalente Dexie:
`computeReviewQueueDexie` em `element-errors-dexie.ts`. O widget
`<ReviewQueueCard>` do Dashboard chama um ou outro dependendo do
modo de armazenamento configurado e renderiza a contagem + emblema
de em atraso + um CTA para a sessão de revisão.

---

## Unificação LessonProgress ↔ LearningSession (v1.31.0 / Fase 46F)

### A decisão

O trabalho `ElementError` da v1.30.0 desacoplou-se
intencionalmente de `LearningSession`. A Fase 46F da v1.31.0
adiciona a camada de unificação: cada conclusão de lição de
conteúdo agora escreve uma linha `LearningSession` para que a
maquinaria de gamificação + rastreamento + sequência existente
a capture sem novos hooks.

Três decisões orientam a forma:

- **D1 (pseudo-projeto lazy)**: um `LearningProject`
  "Lições de Conteúdo" com `kind="content"` é criado
  automaticamente na primeira conclusão de lição (nunca
  semeado durante a integração). Um por utilizador.
- **D2 (`method="content"` 7.º valor)**: adicionado ao conjunto
  de valores válidos de `LearningSession.method` especificamente
  para o caminho de unificação. Os outros seis métodos
  (deductive / inductive / error_based / dialogic / contextual /
  ai_adaptive) cobrem as sessões de chat sem alterações.
- **D5 (reutilizar, não estender)**: sem novo hookspec.
  `record_lesson_completion_session` dispara o hook existente
  `on_session_complete` via `manager._pm.hook`. Os handlers
  existentes dos plugins gamification + tracking correm como se
  a lição fosse uma sessão de chat, com despacho em `method`.

### Alteração de esquema

```python
# app/models/__init__.py - Fase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Alembic `0020_learning_project_kind` adiciona a coluna via
`batch_alter_table` + `add_column` com `server_default="standard"`
para que as linhas existentes sejam preenchidas automaticamente no
SQLite. A superfície de sincronização capta a coluna para que o
ciclo completo via `ApiStorage` ↔ `DexieStorage` funcione em
ambas as direções.

### Helper de unificação

`app/services/lesson_session_unification.py` tem duas funções
públicas:

- `find_or_create_content_pseudo_project(db, user_id)` -
  pesquisa idempotente; cria apenas em caso de ausência.
- `record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)` -
  escreve a linha `LearningSession`, faz commit, depois dispara
  `on_session_complete`.

Ambas são invocadas a partir de
`app/services/lesson_progress.py:upsert_progress` quando a linha
passa de `in_progress` para `completed`. As próprias escritas de
BD do helper propagam exceções (problema real de BD), mas o
caminho de disparo do hook envolve exceções de subscritores por
padrão `_fire_on_session_complete` do `routes.py` do plugin de
sessão - uma falha de gamificação não pode reverter a lição que
o utilizador já viu no ecrã de resumo.

### Filtro frontend

`frontend/src/lib/learning-project.ts` expõe
`isStandardProject` + `filterStandardProjects`. Três consumidores
aplicam o filtro:

- `DashboardFilterBar.tsx` (o seletor de projetos do dashboard)
- `ExportSection.tsx` (seletor de exportação)
- `Anki.tsx` (dropdown de projeto Anki)

O endpoint do backend ainda expõe intencionalmente o
pseudo-projeto para que uma futura vista de administração "toda a
atividade" possa optar por incluí-lo. O filtro é uma decisão de
política de UI, não ocultamento de dados.

---

## Regra XP de fórmula de lição (v1.31.0 / Fase 46E.1)

`adaptive_learner_gamification.xp_service` ganha:

- `compute_stars(correct, total)` - 0 a 3 a partir de uma
  pontuação, com bandas em 50% / 75% / 90%. Espelha o
  `computeStars` do frontend em `lib/lesson-summary.ts` para que
  ambos os lados projetem a mesma classificação em estrelas.
- `calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)` - calculadora pura. 30 base + 10/estrela + 20
  primeira-tentativa-3-estrelas + mesmo multiplicador de
  sequência +25%/dia (limitado a 7) que a fórmula de chat.
- `_is_first_attempt(db, lesson_progress_id)` - lê o JSON
  `LessonProgress.step_results` e retorna True sse cada linha de
  passo tem `attempts == 1`.
- `award_xp_for_lesson_session(db, *, session)` - invólucro de
  persistência que resolve user_id a partir do FK do projeto e
  aplica a fórmula.

O despacho acontece em `GamificationPlugin.on_session_complete`
com base em `session["method"]`. Os métodos de chat ficam em
`award_xp_for_session`. O método de conteúdo encaminha para a
fórmula de lição. O payload da sessão do helper de unificação
transporta as chaves específicas da lição
(`lesson_progress_id`, `score_correct`, `score_total`); os
payloads de sessão de chat não têm, por isso o invólucro XP de
lição degradaria graciosamente se o despacho alguma vez
vazasse - mas o teste de pin de regressão em
`backend/tests/test_lesson_session_unification.py` asserta o prémio
exato da lição (100 XP para uma conclusão de primeira tentativa
4/4 + sequência de primeiro dia) para que um vazamento
aparecesse imediatamente.

---

## Emblemas de lição (v1.31.0 / Fase 46E.2)

Quatro novos predicados adicionados a
`adaptive_learner_gamification.badge_service._EVALUATORS`:

| Chave | Predicado | Helper |
|---|---|---|
| `first_lesson` | `_completed_lesson_count >= 1` | conta `LessonProgress.status="completed"` (não via LearningSession - a linha de lição é autoritária) |
| `lessons_10` | `_completed_lesson_count >= 10` | idem |
| `three_star_streak` | `_last_n_lessons_all_three_star(n=3)` | lê as últimas 3 `LessonProgress` concluídas do utilizador por `completed_at` desc; projeta cada uma via `xp_service.compute_stars` |
| `review_master` | `_mastered_elements_count >= 50` | conta `ElementError.mastered=True` |

Contagem do catálogo: **24 → 28** (+1 getting_started + 1
consistency + 2 depth). O teste de simetria existente "cada emblema
yaml tem um avaliador" (em
`backend/tests/test_gamification_badges_integration.py`) deteta
deriva entre as duas listas.

---

## Ressalvas do modo de armazenamento

A cadeia de rastreamento de elementos + SRS funciona identicamente
em **ambos** os modos de armazenamento - o contrato
`IElementErrorsNamespace` é agnóstico ao modo e o portão de
lançamento do modo Dexie (18 especificações incl. a rota
`/review`) bloqueia qualquer regressão.

A unificação de sessão de lição + efeitos secundários de
gamificação são **apenas para o modo API**. No modo Dexie, a
conclusão da lição ainda escreve `LessonProgress`, ainda regista
linhas `ElementError` e ainda dirige a fila de revisão - mas a
escrita `LearningSession` + hook `on_session_complete` nunca
disparam (sem backend, sem hookable). Os utilizadores no modo Dexie
obtêm o ciclo de revisão completo; os prémios XP / emblemas do
caminho de sessão de chat ainda funcionam, mas as conclusões de
lições ainda não contribuem para esse total.

Uma futura unificação dos efeitos secundários de gamificação em
`DexieStorage` (para que a conclusão de lição de um utilizador no
modo Dexie também atribua XP localmente) é um não-objetivo
deliberado para a v1.31.0 - exigiria duplicar a implementação da
fórmula em TypeScript ou um shim de service-worker do hook
on_session_complete. Ambas são refatorações maiores do que o
âmbito v1.31.0 permite.

---

## Onde procurar a seguir

- `backend/app/services/element_errors.py` - a matriz de
  transição upsert.
- `backend/app/services/element_srs.py` - o agendador.
- `backend/app/services/lesson_session_unification.py` -
  o pseudo-projeto + disparo do hook.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py` -
  `calculate_lesson_session_xp` + despacho.
- `plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py` -
  os quatro novos predicados.
- `frontend/src/lib/learning-project.ts` - o helper de filtro
  de pseudo-projeto.
- `e2e/dexie/dexie-mode.spec.ts` - o portão de lançamento que
  previne regressões no modo Dexie (especificação de lições em
  `/lesson/...`, especificação de revisão em `/review/...`).

---

## Diferença de token + cloze + ronda de correção (v1.35.0 / Fase 52)

Três adições em camadas que transformam a reprodução passiva em
aprendizagem ativa:

**Diferença de token + DiffHighlight** - As respostas erradas de
texto livre e mosaicos de palavras agora renderizam
`<DiffHighlight tokens={tokenDiff(input, canonical)} />` inline
abaixo do parágrafo de resultado. A análise por exercício do resumo
da lição mostra a mesma diferença para texto livre + mosaicos de
palavras quando o `user_answer` armazenado em v1.35.0+ está
disponível (linhas mais antigas voltam para a linha apenas canónica).
Algoritmo em `frontend/src/lib/exercises/token-diff.ts` - LCS puro
ao nível de palavras, normalizado NFC, sensível a maiúsculas +
acentos.

**Tipo de exercício Cloze (esquema 1.1)** - quinto ExerciseType:
preencher-os-espaços com marcadores `___` visíveis. Dois modos de
renderização: `type` (padrão, `<input>`) e `select`
(`<select>` com opções de `distractors`). Fan-out SRS por espaço
via `deriveClozeAttempts` - um ElementAttempt por espaço, para que
o rastreamento de domínio por espaço funcione claramente.
Renderizador em
`frontend/src/components/exercises/ClozeExercise.tsx`;
esquema em
`plugins/adaptive-learner-plugin-content-loader/
adaptive_learner_content_loader/schema.py`.

**Gerador Cloze** - `generateClozeFromError(error,
sourceExercise, sourceCard)` sintetiza um passo cloze a partir de
um ElementError. Algoritmo:

1. Se `sourceCard.token_roles` tem uma entrada cujo
   `token === error.correct_answer`, esvazia esse token em
   `sourceCard.front`.
2. Caso contrário, se `sourceCard.front` contém literalmente
   `error.correct_answer` exatamente uma vez, esvazia-o.
3. Caso contrário, se a fonte é free_text e o seu prompt
   contém a resposta exatamente uma vez, esvazia-a.
4. Caso contrário, retorna null - o chamador volta para
   reprodução.

Determinístico: mesmas entradas → saída byte-idêntica. Sem IA,
sem aleatoriedade, sem async. Os distractores transportam
`error.user_answer` primeiro (quando diferente do correto),
depois `sourceExercise.distractors` filtrado + deduplicado. Código
em `frontend/src/lib/exercises/cloze-generator.ts`.

**Ronda de correção no final da lição** -
`<CorrectionBlock />` monta dentro de `LessonSummary` entre a
pontuação / análise e os botões de ação. Na montagem, lê linhas
ElementError para a lição recém-concluída, gera um cloze para
cada falha não dominada (limite 5) e guia o utilizador por elas.
Cada cloze concluído escreve novas linhas ElementAttempt contra o
mesmo element_key que a falha original foi registada, para que
a sequência SRS + domínio avance. Auto-oculta-se numa pontuação
perfeita / sem erros / sem cloze construível. Código em
`frontend/src/components/exercises/CorrectionBlock.tsx`.

**Cloze em sessões de revisão (Fase 52G)** -
O ramo por item de `synthesizeReviewLesson`
(`_buildReviewStep`) agora escolhe:

- fonte free_text ou word_tiles → tentar cloze, voltar para
  reprodução
- matching, picture_choice, cloze → sempre reprodução

Critérios de decisão documentados em
`frontend/src/lib/review-lesson.ts`. Os ids de passo de reprodução
começam com `review-`; os ids de passo cloze gerados começam com
`review-cloze-` para rastreabilidade.

**Papéis de token nos cartões (Fase 52I)** - anotação opcional
`token_roles: list[{token, role}]` em Card com um enum fechado de
papéis gramaticais (article / verb / noun / adjective /
preposition / gender_marker / tense_marker). O gerador usa estes
para escolher um espaço semanticamente significativo em vez de
depender da correspondência de substring. Adicionar um papel é um
incremento menor de schema_version - mantenha o enum fechado.
