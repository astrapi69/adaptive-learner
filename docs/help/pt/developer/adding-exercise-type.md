<!-- Translation: AI-generated, pending native review -->

# Adicionar um novo tipo de exercício

O modelo canónico **não** é alargado por antecipação. Um novo tipo de
exercício só é adicionado quando conteúdo concreto precisa dele, e nesse
caso como um único PR pequeno e aditivo. Esta é a receita vinculativa,
derivada do trabalho real de escolha múltipla `cloze`/`select` (#1342) e
do pipeline de esquema EXP-039.

Antes de começar, confirme que o tipo é um verdadeiro novo **tipo**, e
não uma apresentação ou convenção já coberta pelo
[catálogo de tipos de exercício](authoring-content.md#exercise-type-catalog-status)
(escolha múltipla de texto, Verdadeiro/Falso, dropdown/radio/checkbox
**não** são tipos novos). Tem de ser **avaliável de forma binária pelo
SRS** (um único resultado certo/errado por elemento), essa é a linha que
a lista de "deliberadamente excluídos" do catálogo traça.

## Passos

1. **Entrada EXP / justificação.** Registe a necessidade, a semântica de
   avaliação binária e a delimitação face aos tipos existentes na
   exploração relevante (`docs/explorations/EXP-041-*` para a adequação
   de tipos de exercício, ou uma nova EXP). Nenhum tipo sem uma razão
   documentada.
2. **Alargar o formato no motor.** A casa canónica do formato de lição é
   o pacote
   [learn-content-engine](https://github.com/astrapi69/learn-content-engine):
   adicione o tipo ao seu esquema, à sua camada semântica escrita à mão
   (`src/rules.ts`) e à sua
   [referência de formato](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md),
   e depois publique o motor. Uma alteração de formato **começa no
   motor**: o `schema/*.json` da app é um espelho byte a byte da release
   fixada, com exatamente um escritor
   (`scripts/sync_schema_mirror_from_engine.py`, #2265).
3. **Subir a fixação, executar a sincronização.** Suba a fixação de
   `learn-content-engine` em `frontend/package.json` e execute
   `make sync-schema` no **mesmo PR**: atualiza o espelho
   `schema/*.json` a partir do pacote instalado e regenera todos os
   artefactos derivados, a camada Pydantic estrutural
   (`plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py`
   através de `scripts/generate_pydantic_models.py`), a cópia do esquema
   ajv do navegador
   (`frontend/src/lib/content/validation/lesson.schema.generated.json`)
   com o seu validador autónomo, e o documento de referência de formato. **Nunca edite à mão** um
   artefacto espelhado ou gerado; o gate de desvio
   `make sync-schema-check` falha se o fizer.
4. **Versão do esquema.** Mantenha `CURRENT_SCHEMA_VERSION` em
   `models.py` alinhado com a versão de esquema do motor fixado
   (**minor** = aditiva; o conteúdo antigo continua a validar através da
   correspondência de versão major). Não adicione regras entre campos do
   lado da app a
   `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py`:
   as regras semânticas pertencem ao motor e correm no momento da autoria
   e no frontend antes de um conjunto do utilizador ser guardado (#3245);
   o backend apenas armazena e serve a lição.
5. **Registar o renderizador.** Adicione o ramo + o tipo a
   `SUPPORTED_EXERCISE_TYPES` em
   `frontend/src/components/exercises/shell/ExerciseDispatcher.tsx`. O
   **registo tem de ser igual ao enum**: um teste de paridade impõe-no,
   por isso um tipo sem renderização falha a CI (a invariante que impede
   esquema morto).
6. **Ligar a avaliação / SRS.** Emita um `ExerciseScored` a partir do
   renderizador através de `useControlledExercise`; o caminho partilhado
   `onComplete` → `recordStepResult` em `LessonStepView.tsx` já distribui
   cada tentativa através de `getStorage().elementErrors.recordBulk`.
   Reutilize-o, não adicione um segundo caminho de registo.
7. **Validação do repo de conteúdo.** Alargue o validador do cliente
   (`frontend/src/lib/content/validation/content-validator.ts`). Os
   mínimos de qualidade vivem no `quality-rules.json` do motor
   (espelhado em `schema/quality-rules.json`); se o tipo os afetar,
   alargue-os no motor, não na app.
8. **Documentação de autoria.** Adicione o tipo à
   [tabela do catálogo](authoring-content.md#exercise-type-catalog-status)
   e um bloco de referência `### <type>` com um exemplo JSON (EN + DE).
9. **Testes.** O esquema aceita um exemplo válido e rejeita um inválido
   (campo obrigatório em falta / chave extra); o renderizador renderiza +
   avalia certo/errado; a tentativa SRS é registada; adicione uma
   baseline visual móvel se o aspeto do controlo for novo.
10. **Seguimento (não neste PR).** Os repos de conteúdo
    (`adaptive-learner-content`) adotam o novo tipo quando voltarem a
    fixar a sua release do motor; registe-o, não fique bloqueado por
    isso.

## Porque é que isto se mantém pequeno

Como o formato é espelhado a partir da release fixada do motor e todos
os artefactos da app derivam desse espelho (passo 3), e o teste de
paridade do dispatcher força registo-igual-ao-enum (passo 5), um novo
tipo é uma alteração aditiva com uma forma fixa: motor → fixação →
geração → renderizador → avaliação → documentação → testes. Nenhuma
cópia paralela mantida à mão pode divergir, e nenhum tipo pode ser
entregue sem um renderizador.
