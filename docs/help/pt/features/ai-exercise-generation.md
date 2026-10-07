<!-- Translation: AI-generated, pending native review -->

# Geração de exercícios por IA

Uma lição feita apenas de teoria (sem exercícios) pode ser
transformada numa lição praticável, deixando a IA **gerar
exercícios** a partir dos seus cartões. Este é o pipeline EXP-036.
Precisa de uma chave de IA configurada (Configurações → IA); sem
ela, o botão está visível mas desativado, com o motivo indicado na
dica.

<!-- TODO: Captura de ecrã - o botão "Gerar exercícios" numa lição só de teoria -->

---

## O pipeline

A geração não é uma única chamada à IA - é um pipeline
**gerar → controlo de qualidade → equilibrar → feedback**:

1. **Gerar.** Um prompt de geração pede ao modelo exercícios dos
   tipos suportados; um parser de JSON defensivo tolera as
   habituais peculiaridades de formatação dos modelos.
2. **Controlo de qualidade.** Um controlo determinístico rejeita
   exercícios malformados, triviais ou duplicados de exercícios já
   existentes - antes de alguma vez serem mostrados.
3. **Equilibrar.** O conjunto de exercícios gerados é equilibrado
   entre os tipos de exercício, para que uma lição não tenha toda
   a mesma forma.
4. **Regenerar com feedback.** Se o resultado não estiver certo, é
   possível regenerar com feedback para orientar a tentativa
   seguinte.

---

## Por lição e por conjunto

- **Lição individual:** um botão **"Gerar exercícios"** aparece
  nas lições só de teoria.
- **Conjunto inteiro:** a geração em lote preenche exercícios em
  todas as lições só de teoria de um conjunto numa única execução.

---

## Qualidade e confiança

Como o controlo de qualidade é determinístico, os exercícios
gerados cumprem o mesmo patamar mínimo que os criados por autores
(exercícios suficientes, mais do que um tipo, nenhum cartão vazio).
A geração complementa o conteúdo criado por autores - nunca
substitui silenciosamente os exercícios já existentes.

Para verificar a qualidade do conteúdo *existente* (criado por
autores ou gerado), ver
[Verificação de conteúdo por IA](../user-guide/ai-validation.md).

---

## Páginas relacionadas

- [Verificação de conteúdo por IA](../user-guide/ai-validation.md) - verificações de qualidade em todo o conjunto
- [Criar lições](../content-creation/overview.md) - construir lições à mão
- [Lições e revisões](../user-guide/lessons.md) - os tipos de exercício
