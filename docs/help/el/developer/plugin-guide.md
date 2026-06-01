# Δημιουργία plugin

Τα plugins επεκτείνουν το AdaptiveLearner χωρίς να αγγίζουν τον
πυρήνα. Το σύστημα plugin χρησιμοποιεί
[PluginForge](https://github.com/astrapi69/pluginforge)
(ένα wrapper γύρω από [pluggy](https://pluggy.readthedocs.io/)).
Κάθε plugin είναι ένα αυτόνομο πακέτο Poetry που καταχωρείται μέσω
entry point.

Αυτό το tutorial δείχνει πώς να δημιουργήσεις ένα "hello-world"
plugin που προσθέτει ένα route και ακούει έναν hook.

## 1. Δημιουργία δομής καταλόγου

```bash
mkdir -p plugins/adaptive-learner-plugin-hello/adaptive_learner_hello
mkdir -p plugins/adaptive-learner-plugin-hello/tests
cd plugins/adaptive-learner-plugin-hello
```

## 2. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-hello"
version = "1.0.0"
description = "Adaptive Learner: hello-world plugin"
authors = ["Your Name"]
license = "MIT"

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.10.0"
fastapi = "^0.136.0"

[project.entry-points."adaptive_learner.plugins"]
hello = "adaptive_learner_hello.plugin:HelloPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

Το όνομα entry point (`hello` εδώ) χρησιμοποιείται από το
μητρώο plugin για παρακολούθηση. Η διαδρομή κλάσης
(`adaptive_learner_hello.plugin:HelloPlugin`) είναι η Python
import διαδρομή προς την κλάση plugin.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # PluginForge ^0.10.0 identity gating. Ορίστε αυτό σε
    # "adaptive_learner" ώστε το PluginManager του host (που
    # περνά ``app_id="adaptive_learner"``) να αναγνωρίζει το
    # plugin ως στοχευμένο σε αυτήν την εφαρμογή. Η μετάβαση
    # v0.9.0 το έκανε ΣΚΛΗΡΟ φίλτρο — plugins χωρίς αυτό
    # απορρίπτονται κατά την ανακάλυψη.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! Session {session['id']} ended.")
```

Η `BasePlugin` είναι η βασική κλάση από το PluginForge. Ο
decorator `@hookimpl` χαρακτηρίζει μια μέθοδο ως υλοποίηση
ενός hook που ορίζεται στο `backend/app/hookspecs.py`.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "Hello from the hello plugin!"}
```

## 5. Καταχώρηση routes στο plugin.py

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

Ο plugin manager καλεί `mount_routes()` για κάθε plugin που το
ορίζει, αφού αρχικοποιηθεί η κύρια εφαρμογή.

## 6. Τεστ

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Εγκατάσταση + ενεργοποίηση

Πρόσθεσε το plugin ως path-dep στο `backend/pyproject.toml`:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Έπειτα:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## Οι 10 hookspecs

Όλες οι προδιαγραφές hooks βρίσκονται στο `backend/app/hookspecs.py`:

1. `get_assessment_questions(lang: str)` — επιστρέφει πακέτο ερωτήσεων.
2. `calculate_profile(answers: list)` — υπολογίζει βάρη μεθόδων
   (firstresult).
3. `create_session_prompt(...)` — συνθέτει την system prompt
   (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` — καλεί
   την ΤΝ συγχρονικά (firstresult, δρομολόγηση παρόχου κατά πρόθεμα
   μοντέλου).
5. `ai_complete_async(...)` — ασύγχρονη παραλλαγή για παράλληλη
   αξιολόγηση ορίου κύκλου (v1.5.0+, firstresult).
6. `ai_complete_stream(...)` — παραλλαγή streaming που παράγει
   τμήματα κειμένου μέσω SSE (v1.6.0+, firstresult).
7. `recommend_method_switch(history, profile)` — επιστρέφει
   σύσταση εναλλαγής ή None.
8. `on_session_complete(session, rating)` — broadcast παρενέργεια·
   το gamification + tracking ακούνε.
9. `get_progress_summary(project_id, db)` — επιστρέφει μία
   τομή namespace της σύνοψης Ταμπλό.
10. `get_tool_recommendations(profile, lang)` — επιστρέφει
    κατατεταγμένα εργαλεία.

[Πλήρης αναφορά hookspec](../api/hooks.md)

## Σημασιολογία firstresult

Τα hooks με `firstresult=True` σταματούν στο πρώτο plugin που
επιστρέφει μη-None τιμή. Χρήσιμο για περιπτώσεις "ακριβώς ένα
plugin πρέπει να χειριστεί αυτό" — όπως το `ai_complete`, όπου το
plugin του αντίστοιχου παρόχου επιστρέφει το κείμενο και τα
υπόλοιπα επιστρέφουν None.

Τα hooks χωρίς `firstresult=True` εκτελούνται σε κάθε plugin
(λειτουργία λίστας). Ο caller λαμβάνει λίστα αποτελεσμάτων και
αποφασίζει τι να κάνει (συγχώνευση, προτεραιότητα κ.ο.κ.).
