<!-- Translation: AI-generated, pending native review -->

# Escrever um plugin

Os plugins estendem o AdaptiveLearner sem tocar no núcleo. O
sistema de plugins usa o [PluginForge](https://github.com/astrapi69/pluginforge)
(um invólucro em torno do [pluggy](https://pluggy.readthedocs.io/)).
Cada plugin é um pacote Poetry independente registado via um ponto
de entrada.

Este tutorial apresenta a criação de um plugin "hello-world" que
adiciona uma rota e ouve um hook.

## 1. Estruturar o diretório

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

O nome do ponto de entrada (`hello` aqui) é o que o registo de
plugins usa para rastrear o plugin. O caminho de classe
(`adaptive_learner_hello.plugin:HelloPlugin`) é o caminho de
importação Python para a classe do plugin.

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # Restrição de identidade pluginforge ^0.10.0. Defina isto como
    # "adaptive_learner" para que o PluginManager do host (que
    # passa ``app_id="adaptive_learner"``) reconheça o plugin como
    # direcionado para esta aplicação. A transição v0.9.0 tornou
    # isto um filtro RIGOROSO - plugins sem isto são rejeitados
    # no momento da descoberta.
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! Session {session['id']} ended.")
```

`BasePlugin` é a classe base do PluginForge. O decorador
`@hookimpl` marca um método como implementando um hook especificado
em `backend/app/hookspecs.py`.

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "Hello from the hello plugin!"}
```

## 5. Registar rotas em plugin.py

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

O gestor de plugins chama `mount_routes()` para cada plugin que
o define, depois de a aplicação principal estar inicializada.

## 6. Testes

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. Instalar + ativar

Adicione o plugin como dependência de caminho em
`backend/pyproject.toml`:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

Depois:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## Os 10 hookspecs

Todas as especificações de hooks vivem em
`backend/app/hookspecs.py`:

1. `get_assessment_questions(lang: str)` - retornar pacote de perguntas.
2. `calculate_profile(answers: list)` - calcular pesos de método
   (firstresult).
3. `create_session_prompt(...)` - compor o prompt do sistema
   (firstresult).
4. `ai_complete(messages, model, api_key, max_tokens)` - chamar
   a IA de forma síncrona (firstresult, fornecedor rotas por prefixo
   de modelo).
5. `ai_complete_async(...)` - variante async para avaliação
   paralela em limite de ciclo (v1.5.0+, firstresult).
6. `ai_complete_stream(...)` - variante em streaming emitindo
   deltas de texto via SSE (v1.6.0+, firstresult).
7. `recommend_method_switch(history, profile)` - retornar uma
   recomendação de mudança ou None.
8. `on_session_complete(session, rating)` - efeito secundário de
   broadcast; gamificação + rastreamento ouvem.
9. `get_progress_summary(project_id, db)` - retornar uma fatia de
   espaço de nomes do resumo do dashboard.
10. `get_tool_recommendations(profile, lang)` - retornar ferramentas
    classificadas.

[Referência completa de hookspecs](../api/hooks.md)

## Semântica firstresult

Os hooks marcados com `firstresult=True` param no primeiro plugin
que retorna um valor não-None. Útil para casos "exatamente um
plugin deve tratar disto" - como `ai_complete`, onde o plugin do
fornecedor correspondente retorna o texto e os outros retornam None.

Os hooks sem `firstresult=True` correm em cada plugin (modo lista).
O chamador recebe uma lista de resultados e decide o que fazer
(fundir, preferir, etc.).
