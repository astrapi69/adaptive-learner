<!-- Translation: AI-generated, pending native review -->

# Integração de IA

O Adaptive Learner executa cada conversa de aprendizagem através de
até **três** chamadas de IA por ciclo de pedido-resposta - a
resposta em streaming, o avaliador de passo e (no passo 7) o
avaliador de transição de tópico. Três fornecedores são incluídos
de série; novos fornecedores conectam-se via a família de hooks
`ai_complete*`.

## O hook ai_complete

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Return the assistant text, or None if this plugin doesn't handle ``model``."""
```

`firstresult=True` significa que o pluggy para no primeiro retorno
não-None. Cada plugin de fornecedor verifica o prefixo `model` e
retorna o texto do assistente se possuir o modelo:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... chamar a API Anthropic, retornar o texto ...
```

Três plugins são incluídos: `ai-anthropic` (claude-*), `ai-openai`
(gpt-*), `ai-gemini` (gemini-*).

## Variantes async + streaming

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Aguardável; mesma forma que ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Retorna um iterador assíncrono de deltas de texto. v1.6.0+."""
```

`ai_complete_async` é usado pela rota de sessão no limite de ciclo
passo 6→7 para que a avaliação de passo + transição de tópico
disparem concorrentemente via `asyncio.gather`
(`async_evaluation: true` em `app.yaml`).

`ai_complete_stream` alimenta o endpoint SSE de streaming
`POST /api/plugins/session/{id}/message/stream` que emite eventos
`start` / `chunk` / `done`.

## Lógica de seleção de fornecedor (v1.20.0)

O `_resolve_active_key()` da rota de sessão chama
`services/settings.resolve_api_key(db, user_id, provider)` que
percorre a cadeia de três camadas:

1. Variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` em
   `~/.config/adaptive_learner/secrets.yaml`.
3. `UserSettings.api_key_<provider>` desencriptado com Fernet.
4. `None` - a chamada apresenta `ai_error` na interface.

`resolve_default_model(db, user_id, provider)` percorre a mesma
cadeia para a substituição do modelo (env > yaml > substituição UI >
`DEFAULT_MODELS[provider]`).

Depois `ai_complete*` dispara com os valores resolvidos. O plugin
do fornecedor correspondente retorna o texto; os outros retornam
None (firstresult para no primeiro acerto).

## Arquitetura de duplo prompt (v0.5.0) + auto-loop (v1.4.0)

Cada `POST /api/plugins/session/{id}/message` para um papel
`user` faz até três chamadas de IA:

1. **Resposta de aprendizagem** - em streaming via `ai_complete_stream`.
   Prompt do sistema composto por `build_prompt(project, profile,
   method, cycle_step, lang)` a partir da matriz de 42 células.
   `max_tokens=1024`. SSE emite eventos `start` / `chunk` /
   `done`.
2. **Avaliador de passo** - prompt de sistema separado
   (`EVALUATION_SYSTEM_PROMPT`) pedindo à IA para ler a troca e
   emitir um veredicto JSON (`advance`, `confidence`, `reason`,
   `suggested_step`). `max_tokens=256`. O veredicto do avaliador
   dirige o avanço de `cycle_step` (com condição de
   `confidence ≥ 0.6`).
3. **Transição de tópico** - apenas no passo 7. Uma terceira
   chamada de IA julga se o tópico foi integrado e se deve iniciar
   um novo ciclo num novo subtópico. Limite de `max_cycles=5` por
   sessão.

Se o avaliador retornar JSON inanalisável, o avanço determinístico
+1 entra em ação (limitado a 7) e `fallback_used=True` fica
registado.

O limite de ciclo (passo 6 → 7) dispara avaliação de passo +
transição de tópico concorrentemente via `asyncio.gather` (poupa
~T₂ de latência). Retornado no bloco `timings` da resposta de
mensagem (`learning_ms`, `evaluation_ms`, `topic_transition_ms`,
`total_ms`, `parallel_saved_ms`).

## A matriz de 42 prompts

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
contém um `dict[method, dict[step, dict[lang, str]]]` - seis
métodos, sete passos, dois idiomas, 84 células. Cada célula tem
1 a 2 frases definindo o papel da IA + a tarefa do passo. Um
bloco de contexto ("Learning project: 'X' | Goal: 'Y'. Profile
hint: …") é acrescentado no momento da composição.

Para o modo Dexie, os prompts são exportados verbatim para
`frontend/src/data/session-prompts.json` e carregados por
`frontend/src/storage/prompts.ts`. Mesmo texto, mesmo formato de
bloco de contexto - sem possibilidade de divergência.

## Adicionar um novo fornecedor

1. Criar `plugins/adaptive-learner-plugin-ai-newprovider/`.
2. Implementar o hookimpl `ai_complete`: verificar o prefixo do
   modelo, chamar a API HTTP do fornecedor, retornar o texto.
3. Adicionar o prefixo do fornecedor a `DEFAULT_MODELS` em
   `ai_orchestration.py` com um modelo padrão económico.
4. Adicionar o nome do fornecedor ao enum `AIProvider` em
   `app/schemas/__init__.py`.
5. Adicioná-lo a `AI_PROVIDERS` em
   `frontend/src/lib/constants.ts`.
6. Para paridade no modo Dexie: adicionar um cliente a
   `frontend/src/storage/ai-providers.ts` e roteá-lo a partir de
   `aiComplete()`.

Cada plugin de fornecedor testa o seu hookimpl + chamada de
fornecedor em isolamento - consulte
`plugins/adaptive-learner-plugin-ai-anthropic/tests/` para um
modelo (a chamada HTTP do fornecedor é simulada).

## Chamadas diretas do navegador (modo Dexie)

No modo Dexie a chamada de IA não passa pelo sistema de plugins.
`storage/ai-providers.ts` faz o pedido HTTP diretamente. O
Anthropic requer o cabeçalho
`anthropic-dangerous-direct-browser-access: true` para limpar a
preflight CORS; o OpenAI e o Gemini aceitam chamadas diretas do
navegador de série.

A lógica de duplo prompt é a mesma em ambos os modos -
`storage/session-flow.ts` chama `aiComplete()` duas vezes e analisa
o JSON do avaliador da mesma forma que o backend.

## Limiar de confiança

`session.step_evaluation.confidence_threshold` do
`backend/config/app.yaml` (padrão 0.6) condiciona se um veredicto
real do avaliador (não fallback) realmente move o passo do ciclo.
Defina mais alto para ser mais conservador, mais baixo para ser
mais ágil. Os veredictos de fallback (falhas de análise) aplicam
sempre o avanço +1 independentemente.

A porta Dexie espelha isso com um 0.6 fixo em
`storage/session-flow.ts`. Uma fase futura irá expor isto na
interface de Definições.

## Outras superfícies de IA (resumo apenas de leitura)

Várias funcionalidades não relacionadas com sessões usam os mesmos
plugins de fornecedor de IA via `ai_complete*`:

- **Analisador de conversa** (Fase 12 / v0.9.0+) -
  `frontend/src/chat_import/analysis.ts` divide transcrições
  importadas em fragmentos de 16K chars com sobreposição de 2
  mensagens, dispara `ai_complete` por fragmento, funde
  resultados. Extrai tópico / pontos fracos / error_patterns /
  método recomendado / vocabulário (desde v1.20.0). Analisador
  JSON tolerante lida com comportamento irregular de modelos Haiku
  (saída delimitada, prosa de preâmbulo).
- **Extração de Anki** (Fase 30 / v1.17.0) - `plugins/.../
  anki/card_extraction.py` extrai candidatos a flashcard de uma
  sessão ou conversa; o caminho de vocabulário corre no lado do
  cliente sem IA quando `analysis_result.vocabulary` está
  preenchido.
- **Questões de estudo + guia NotebookLM** (Fase 32 /
  v1.19.0) - `plugins/.../notebooklm/question_generator.py` +
  `study_guide.py`; analisador JSON tolerante; questões editadas
  pelo utilizador saltam a re-geração.
- **Juiz de pronúncia** (Fase 31 / v1.18.0) -
  `plugins/.../pronunciation.py` gera frases alvo + julga a
  semelhança de áudio do aprendente (elegibilidade condicionada
  pela taxonomia de assuntos de Línguas).
