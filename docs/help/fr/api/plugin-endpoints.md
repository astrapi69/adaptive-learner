# Endpoints des plugins

Les routes de chaque plugin sont montées sous `/api/plugins/{nom-du-plugin}/`.

## Plugin Assessment

```
GET /api/plugins/assessment/questions?lang=fr
```

Retourne le pack de 12 questions avec `text` résolu dans la langue
demandée. Chaque réponse porte les poids par méthode.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "Comment abordez-vous un nouveau sujet ?",
    "answers": [
      {
        "id": "a",
        "text": "Je lis d'abord les règles et la théorie.",
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

Corps :

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

Les deux formes de sélection unique (`answer_id: string`) et
multiple (`answer_ids: string[]`) sont acceptées. Retourne le
LearningProfile créé :

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

Retourne le dernier LearningProfile pour le projet.

## Plugin Session

```
POST /api/plugins/session/start
```

Corps :

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "fr"
}
```

`method`, `cycle_step`, `lang` sont optionnels. Retourne la
session créée + le prompt système composé :

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

Corps :

```json
{"role": "user", "content": "Je voudrais commencer par le présent."}
```

Le serveur sauvegarde le message utilisateur, déclenche
`ai_complete`, persiste la réponse de l'assistant, exécute
l'évaluateur d'étape et retourne le résultat composite :

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "ligne session après avancement de cycle_step"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "L'apprenant a clairement saisi l'input.",
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

Corps :

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Session productive."
}
```

Persiste une ligne SessionRating. Retourne la ligne.

```
POST /api/plugins/session/{session_id}/end
```

Clôture la session. Déclenche `on_session_complete` (le plugin
tracking écrit un ProgressCommit). Retourne :

```json
{"session": {"...": "la session avec status='completed' et ended_at défini"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Retourne :

```json
{"recommended": false, "to_method": null, "reason": null}
```

Ou, quand une stagnation est détectée :

```json
{"recommended": true, "to_method": "dialogic", "reason": "Trois sessions de compréhension plate + stress élevé."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Corps :

```json
{"to_method": "dialogic", "reason": "Me semblait juste."}
```

Met à jour `session.method`, écrit une ligne d'audit MethodSwitch,
retourne la session mise à jour.

## Plugin Tracking

```
GET /api/plugins/tracking/progress/{project_id}
```

Retourne le résumé par namespace ; la tranche `tracking` porte
la sortie de l'agrégateur :

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

Retourne toutes les lignes ProgressCommit du projet, par ordre
chronologique.

## Plugin Tools

```
GET /api/plugins/tools/recommendations/{project_id}?lang=fr
```

Retourne les 5 outils du catalogue classés par pertinence pour
le profil du projet :

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Flashcards à répétition espacée - idéal pour ancrer les règles et corrections d'erreurs sur le long terme.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=fr
```

Retourne les cartes d'action à répétition espacée pilotées par
la récence :

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "Première pratique en déduction.",
    "urgency": 0.5
  },
  ...
]
```

## Plugin Session - streaming + prononciation (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

Même forme de corps que `/message` ; émet trois types d'événements
SSE :

- `start` - payload `{user_message}` (le tour utilisateur
  maintenant persisté).
- `chunk` - payload `{delta}` (un ou plusieurs morceaux de texte
  arrivant depuis le stream du fournisseur IA).
- `done` - payload identique à la réponse synchrone `/message` :
  message de l'assistant + cycle_step + timings + carte de
  transition de cycle optionnelle.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

L'éligibilité à la prononciation est conditionnée par la
taxonomie de sujets du projet (remonte les ancêtres à la
recherche d'une racine Languages / Sprachen). L'endpoint judge
retourne `{matches, score, feedback, missed_sounds}`.

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

`/streak/{user_id}/heatmap` retourne
`[{date, count}, ...]` pour les 365 derniers jours (clampé à
[7, 730]). L'endpoint de réinitialisation demande double
confirmation puis efface les lignes `user_xp` + `user_badges`
+ `user_streaks`.

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

L'extraction IA est déclenchée par l'utilisateur. Le chemin
d'extraction depuis une conversation lit également
`analysis_result.vocabulary` (depuis v1.20.0) pour produire des
cartes Cloze sans appel IA supplémentaire quand l'analyse a déjà
renseigné le tableau de vocabulaire.

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

`/study-guide/{project_id}` retourne `text/markdown` (un grand
appel IA avec troncature du contenu à ~30 Ko). Les modifications
utilisateur basculent `edited=True` afin que le ré-exécuteur IA
les ignore.

## Découverte des plugins

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Chacun retourne une carte indexée par nom de plugin. Utilisé par
l'interface Paramètres > Plugins pour l'état d'activation + la
visibilité des erreurs de chargement.
