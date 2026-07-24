# Spécifications des hooks

Les 10 hookspecs se trouvent dans `backend/app/hookspecs.py`.
Chaque hookspec définit le contrat d'appel ; les plugins les
implémentent avec `@hookimpl`. Trois d'entre eux sont des
variantes d'appel IA (sync / async / stream) publiées
progressivement depuis v1.5.0 et v1.6.0 ; les autres sont
inchangés depuis v0.2.0.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """Retourne le pack de questions pour la langue demandée.

    Implémenté par : plugin assessment.
    Mode : list (pas firstresult). La route utilise actuellement
    le résultat du premier plugin ; une future fonctionnalité
    « packs de questions multiples » pourrait laisser les
    fournisseurs enregistrer des packs nommés.
    """
```

Forme de retour :

```python
[
  {
    "id": "q01",
    "type": "single" | "multi",
    "text": "...",
    "answers": [
      {"id": "a", "text": "...", "weights": {"deductive": 1.0}},
      ...
    ]
  },
  ...
]
```

## calculate_profile

```python
@hookspec(firstresult=True)
def calculate_profile(answers: list[dict]) -> dict[str, float]:
    """Agrège les réponses brutes en un profil à 6 méthodes.

    Implémenté par : plugin assessment.
    firstresult : exactement un plugin calcule le profil.
    """
```

Forme de `answers` en entrée :

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Retour : `dict[method, float]` avec les six clés de méthode.

## create_session_prompt

```python
@hookspec(firstresult=True)
def create_session_prompt(
    project: dict,
    profile: dict,
    method: str,
    step: int,
    lang: str,
) -> str:
    """Compose le prompt système pour une cellule (méthode, étape, langue).

    Implémenté par : plugin session.
    firstresult : exactement un plugin compose le prompt.
    """
```

Retour : une chaîne prête à être envoyée comme message de rôle
`system`. L'implémentation du plugin session lit depuis le dict
`_PROMPTS` à 42 cellules et ajoute un bloc de contexte.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Appelle le fournisseur IA, retourne le texte de l'assistant.

    Implémenté par : ai-anthropic, ai-openai, ai-gemini.
    firstresult : le plugin du fournisseur correspondant retourne
    le texte ; les autres retournent None.
    """
```

Chaque plugin fournisseur vérifie le préfixe du `model`
(`claude-*`, `gpt-*`, `gemini-*`) et retourne le texte de
l'assistant s'il est propriétaire du modèle. Les plugins non
correspondants retournent None, laissant firstresult passer au
suivant.

Forme de `messages` (style OpenAI) :

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Les plugins fournisseurs normalisent cette forme vers leur propre
API (Anthropic sépare `system` ; Gemini le plie à l'intérieur).

## ai_complete_async (v1.5.0+)

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """Variante awaitable de ai_complete.

    Implémenté par : ai-anthropic, ai-openai, ai-gemini.
    Utilisé à la limite de cycle étape 6 → 7 pour que
    step-eval + topic-transition se déclenchent en parallèle
    via asyncio.gather (économise ~T_2 de latence).
    """
```

L'utilitaire orchestrateur `call_ai_complete_async` préfère ce
hook ; replie sur `ai_complete` encapsulé dans
`asyncio.to_thread` quand non implémenté.

## ai_complete_stream (v1.6.0+)

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Retourne un itérateur async de deltas de texte.

    Implémenté par : ai-anthropic, ai-openai, ai-gemini,
    chacun utilisant le streaming async natif du SDK fournisseur.
    Alimente ``POST /api/plugins/session/{id}/message/stream``
    (SSE : émet les événements ``start`` / ``chunk`` / ``done``).
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Retourne une recommandation de changement, ou None.

    Implémenté par : plugin session.
    Mode : list. Les plugins retournent des recommandations
    individuelles ; un futur arbitre choisira la non-None de
    plus haute confiance.
    """
```

Forme de retour :

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Trois sessions de compréhension stagnante.",
  "confidence": 0.75,  # optionnel
}
```

Retourner `None` (ou `{"recommended": False}`) quand aucun
changement n'est justifié.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Hook d'effet secondaire : déclenché quand une session est terminée.

    Implémenté par : plugin tracking (écrit un ProgressCommit).
    Mode : list. Chaque abonné s'exécute ; les erreurs sont
    capturées et journalisées mais n'annulent pas la fin de session.
    """
```

Les erreurs dans ce hook NE DOIVENT PAS se propager - le
wrapper `_fire_on_session_complete` dans
`backend/app/main.py` les capture et les journalise.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """Retourne une tranche de namespace du résumé de progression.

    Implémenté par : plugin tracking (retourne la tranche
    de namespace "tracking").
    Mode : list. Les tranches sont fusionnées superficiellement
    dans la route.
    """
```

Chaque plugin retourne un dict clé par un namespace unique.
Le plugin tracking retourne `{"tracking": {...}, "step_evaluation": {...}}`.
Un futur plugin de détection de stagnation pourrait retourner
`{"stagnation": {...}}`, etc.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Retourne les recommandations d'outils externes classées.

    Implémenté par : plugin tools.
    Mode : list. La route utilise actuellement le résultat du
    premier plugin ; un futur recommandeur multi-sources pourrait
    les fusionner.
    """
```

Forme de retour :

```python
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "...",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

## firstresult vs mode list

| Hookspec | Mode | Pourquoi |
|---|---|---|
| get_assessment_questions | list (firstresult effectif) | Actuellement un seul pack ; futur possible avec packs nommés |
| calculate_profile | firstresult | Un seul algorithme |
| create_session_prompt | firstresult | Un seul compositeur de prompt |
| ai_complete | firstresult | Le fournisseur correspondant possède l'appel |
| recommend_method_switch | list | Plusieurs plugins peuvent suggérer |
| on_session_complete | list | Les effets secondaires se diffusent |
| get_progress_summary | list | Les tranches de namespace fusionnent |
| get_tool_recommendations | list (firstresult effectif) | Actuellement une seule source |

Les modes `list` qui se comportent actuellement comme firstresult
sont intentionnels : le contrat est ouvert à l'extension
multi-plugin, mais l'implémentation actuelle utilise seulement
le premier.
