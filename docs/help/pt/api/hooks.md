<!-- Translation: AI-generated, pending native review -->

# Especificações de hooks

Os 10 hookspecs vivem em `backend/app/hookspecs.py`. Cada
hookspec define o contrato de chamada; os plugins implementam-nos
com `@hookimpl`. Três deles são variantes de chamada de IA
(síncrona / assíncrona / streaming), lançadas progressivamente
nas versões v1.5.0 e v1.6.0; os restantes permanecem
inalterados desde v0.2.0.

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """Retorna o pacote de perguntas para o idioma pedido.

    Implementado por: plugin assessment.
    Modo: list (não firstresult). A rota utiliza atualmente
    o resultado do primeiro plugin; uma futura funcionalidade
    de "múltiplos pacotes de perguntas" poderia permitir que
    os fornecedores registassem pacotes nomeados.
    """
```

Forma de retorno:

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
    """Agrega as respostas em bruto num perfil de 6 métodos.

    Implementado por: plugin assessment.
    firstresult: exatamente um plugin calcula o perfil.
    """
```

Forma de entrada `answers`:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

Retorno: `dict[method, float]` com as seis chaves de método.

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
    """Compõe o prompt do sistema para uma célula (método, passo, idioma).

    Implementado por: plugin session.
    firstresult: exatamente um plugin compõe o prompt.
    """
```

Retorno: uma string pronta a ser enviada como mensagem de papel
`system`. A implementação do plugin session lê a partir do
dicionário `_PROMPTS` de 42 células e acrescenta um bloco de
contexto.

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Chama o fornecedor de IA e retorna o texto do assistente.

    Implementado por: ai-anthropic, ai-openai, ai-gemini.
    firstresult: o plugin do fornecedor correspondente retorna
    o texto; os outros retornam None.
    """
```

Cada plugin de fornecedor verifica o prefixo `model`
(`claude-*`, `gpt-*`, `gemini-*`) e retorna o texto do
assistente se for proprietário do modelo. Plugins não
correspondentes retornam None, permitindo que firstresult
passe para o seguinte.

Forma de `messages` (estilo OpenAI):

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

Os plugins de fornecedor normalizam esta forma para a sua
própria API (Anthropic separa `system`; Gemini integra-o).

## ai_complete_async (v1.5.0+)

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """Variante aguardável de ai_complete.

    Implementado por: ai-anthropic, ai-openai, ai-gemini.
    Utilizado na fronteira de ciclo passo 6 -> 7 para que
    step-eval + topic-transition sejam disparados
    concorrentemente via asyncio.gather
    (poupa ~T_2 de latência).
    """
```

O helper orquestrador `call_ai_complete_async` prefere
este hook; volta a `ai_complete` encapsulado em
`asyncio.to_thread` quando não implementado.

## ai_complete_stream (v1.6.0+)

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """Retorna um iterador assíncrono de deltas de texto.

    Implementado por: ai-anthropic, ai-openai, ai-gemini, cada
    um usando o streaming assíncrono nativo do SDK do fornecedor.
    Alimenta ``POST /api/plugins/session/{id}/message/stream``
    (SSE: emite eventos ``start`` / ``chunk`` / ``done``).
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """Retorna uma recomendação de mudança, ou None.

    Implementado por: plugin session.
    Modo: list. Os plugins retornam recomendações individuais;
    um futuro árbitro escolhe a de maior confiança não-None.
    """
```

Forma de retorno:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Three sessions of stagnant understanding.",
  "confidence": 0.75,  # opcional
}
```

Retornar `None` (ou `{"recommended": False}`) quando não é
necessária nenhuma mudança.

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """Hook de efeito secundário: disparado quando uma sessão termina.

    Implementado por: plugin tracking (escreve um ProgressCommit).
    Modo: list. Cada subscritor é executado; os erros são
    capturados e registados, mas não fazem rollback do
    encerramento da sessão.
    """
```

Os erros neste hook NÃO DEVEM propagar-se — o wrapper
`_fire_on_session_complete` em `backend/app/main.py`
captura-os e regista-os.

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """Retorna uma fatia de espaço de nomes do resumo de progresso.

    Implementado por: plugin tracking (retorna a fatia de
    espaço de nomes "tracking").
    Modo: list. As fatias são fundidas superficialmente na rota.
    """
```

Cada plugin retorna um dict chaveado por um espaço de nomes
único. O plugin tracking retorna
`{"tracking": {...}, "step_evaluation": {...}}`. Um futuro
plugin de deteção de estagnação poderia retornar
`{"stagnation": {...}}`, etc.

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """Retorna recomendações de ferramentas externas classificadas.

    Implementado por: plugin tools.
    Modo: list. A rota utiliza atualmente o resultado do
    primeiro plugin; um futuro recomendador multi-fonte poderia
    fundir os resultados.
    """
```

Forma de retorno:

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

## firstresult vs modo list

| Hookspec | Modo | Porquê |
|---|---|---|
| get_assessment_questions | list (firstresult efetivo) | Atualmente um pacote; futuro poderia registar pacotes nomeados |
| calculate_profile | firstresult | Exatamente um algoritmo |
| create_session_prompt | firstresult | Exatamente um compositor de prompts |
| ai_complete | firstresult | O fornecedor correspondente é proprietário da chamada |
| recommend_method_switch | list | Múltiplos plugins podem sugerir |
| on_session_complete | list | Os efeitos secundários propagam-se |
| get_progress_summary | list | As fatias de espaço de nomes fundem-se |
| get_tool_recommendations | list (firstresult efetivo) | Atualmente uma fonte |

Os modos `list` que atualmente se comportam como firstresult são
deliberados: o contrato está aberto a extensão multi-plugin,
mas a implementação v0.7.0 utiliza apenas o primeiro.
