<!-- Translation: AI-generated, pending native review -->

# Endpoints de plugins

As rotas de cada plugin montam em `/api/plugins/{plugin-name}/`.

## Plugin Assessment

```
GET /api/plugins/assessment/questions?lang=en
```

Retorna o pacote de 12 perguntas com `text` resolvido para o idioma
pedido. Cada resposta transporta os pesos por método.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "How do you approach a new topic?",
    "answers": [
      {
        "id": "a",
        "text": "I read the rules and theory first.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

Corpo:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

São aceites tanto formas de seleção única (`answer_id: string`)
como de seleção múltipla (`answer_ids: string[]`). Retorna o
LearningProfile criado:

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

Retorna o LearningProfile mais recente para o projeto.

## Plugin Session

```
POST /api/plugins/session/start
```

Corpo:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

`method`, `cycle_step`, `lang` são opcionais. Retorna a sessão
criada + o prompt do sistema composto:

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Corpo:

```json
{"role": "user", "content": "Gostaria de começar com o presente."}
```

O servidor guarda a mensagem do utilizador, dispara `ai_complete`,
persiste a resposta do assistente, executa o avaliador de passo e
retorna o composto:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "linha de sessão após avanço de cycle_step"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Learner clearly grasped the input.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

Corpo:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Pareceu produtivo."
}
```

Persiste uma linha SessionRating. Retorna a linha.

```
POST /api/plugins/session/{session_id}/end
```

Fecha a sessão. Dispara `on_session_complete` (o plugin tracking
escreve um ProgressCommit). Retorna:

```json
{"session": {"...": "a sessão com status='completed' e ended_at definido"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Retorna:

```json
{"recommended": false, "to_method": null, "reason": null}
```

Ou, quando é detetada estagnação:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Three sessions of flat understanding + high stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Corpo:

```json
{"to_method": "dialogic", "reason": "Pareceu certo."}
```

Atualiza `session.method`, escreve uma linha de auditoria
MethodSwitch, retorna a sessão atualizada.

## Plugin Tracking

```
GET /api/plugins/tracking/progress/{project_id}
```

Retorna o resumo com espaço de nomes; a fatia `tracking` transporta
a saída do agregador:

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

Retorna todas as linhas ProgressCommit para o projeto, em ordem
cronológica.

## Plugin Tools

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

Retorna as 5 ferramentas do catálogo classificadas por relevância
para o perfil do projeto:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

Retorna cartões de ação de repetição espaçada impulsionados pela
recência:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "First practice in deduction.",
    "urgency": 0.5
  },
  ...
]
```

## Plugin Session - streaming + pronúncia (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

Mesmo corpo que `/message`; emite três tipos de evento SSE:

- `start` - payload `{user_message}` (o turno do utilizador agora
  persistido).
- `chunk` - payload `{delta}` (um ou mais fragmentos de texto
  chegando do streaming do fornecedor de IA).
- `done` - payload idêntico à resposta síncrona `/message`:
  mensagem do assistente + cycle_step + timings + cartão de
  transição de ciclo opcional.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

A elegibilidade de pronúncia é condicionada pela taxonomia de
assuntos do projeto (percorre ancestrais à procura de uma raiz
Languages / Sprachen). O endpoint de julgamento retorna
`{matches, score, feedback, missed_sounds}`.

## Plugin Gamification (v1.16.0+)

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

`/streak/{user_id}/heatmap` retorna `[{date, count}, ...]` para
os últimos 365 dias (limita a [7, 730]). O endpoint de reiniciar
confirma duplamente e depois apaga as linhas de `user_xp` +
`user_badges` + `user_streaks`.

## Plugin Anki (v1.17.0+)

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

A extração por IA é iniciada pelo utilizador. O caminho de
extração de conversa também lê `analysis_result.vocabulary`
(desde v1.20.0) para produzir cartões cloze sem uma chamada de IA
extra quando a análise já preencheu o array de vocabulário.

## Plugin NotebookLM (v1.19.0+)

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

`/study-guide/{project_id}` retorna `text/markdown` (uma grande
chamada de IA com recorte de conteúdo a ~30K chars). As edições do
utilizador invertem `edited=True` para que o re-executor de IA as
ignore.

## Descoberta de plugins

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Cada um retorna um mapa chaveado pelo nome do plugin. Usado pela
interface de Definições > Plugins para estado de ativação +
visibilidade de erros de carregamento.
