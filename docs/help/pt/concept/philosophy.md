<!-- Translation: AI-generated, pending native review -->

# Filosofia de aprendizagem

O Adaptive Learner é construído sobre uma premissa simples: **não
existe um único método ótimo de aprendizagem**. Pessoas diferentes
aprendem de formas diferentes; o mesmo aprendente aprende de forma
diferente consoante o tópico, o contexto e o estado de espírito.

---

## O modelo dos seis métodos

Asterios Raptis, na sua série *Von Theorie zur Praxis* (Medium,
2024), identifica seis métodos fundamentais de aprendizagem que
cobrem a maior parte de como as pessoas realmente adquirem novos
conhecimentos:

| Método | Núcleo |
|---|---|
| Dedutivo | Regra → aplicação |
| Indutivo | Exemplos → regra |
| Baseado em erros | Erro → compreensão |
| Dialógico | Conversa → clareza |
| Contextual | Situação → transferência |
| Adaptativo por IA | Histórico → seleção dinâmica |

Nenhum deles é superior. Cada um tem condições sob as quais
supera os outros. O sistema mede as suas condições e alinha-se
com elas.

---

## Porquê a adaptação importa

As abordagens tradicionais de e-learning escolhem um método (na
maioria das vezes: repetição flash + questionários) e aplicam-no
a todos os utilizadores e tópicos. Isso produz resultados médios
para utilizadores médios.

O Adaptive Learner traça o seguinte:

1. **O seu perfil de aprendizagem** - quais métodos correspondem
   ao seu estilo cognitivo (medido pelo teste de avaliação).
2. **O seu estado de sessão** - stress, compreensão, adequação
   do método (medidos em tempo real pelo avaliador de duplo
   prompt).
3. **A trajetória do tópico** - quais métodos produziram
   progresso *para este tópico* nas últimas sessões.

A confluência destas três fontes de dados orienta o método, a
dificuldade e o passo do ciclo de cada sessão.

---

## O ciclo de 7 passos

Cada sessão de aprendizagem segue um ciclo estruturado:

```
1. Input       ← o aprendente recebe material
2. Tentativa   ← o aprendente aplica
3. Erro        ← o equívoco torna-se visível
4. Feedback    ← o princípio é explicado
5. Adaptação   ← o aprendente ajusta
6. Repetição   ← variações reforçam
7. Integração  ← a ligação torna-se estável
```

O avaliador de duplo prompt corre paralelamente. Após cada passo,
uma segunda instância da IA pesa a compreensão do aprendente e
sinaliza se o ciclo deve avançar, repetir ou mudar de método.

→ [Ciclo de 7 passos em detalhe](seven-steps.md)

---

## O que isto não é

- **Não é um chatbot**. O prompt do sistema é diferente para cada
  método × passo × idioma (42 células numa grelha). A IA age como
  um professor, não como um assistente genérico.
- **Não é um LMS**. Não há cursos, créditos ou certificados. É uma
  ferramenta de aprendizagem, não um sistema de gestão.
- **Não é um substituto do empenho**. O sistema adapta o caminho;
  percorrê-lo é com o aprendente.

---

## A tensão que o sistema gere

Cada par de métodos tem uma tensão produtiva:

- **Dedutivo vs. indutivo** - clareza imediata vs. compreensão
  mais profunda
- **Baseado em erros vs. dialógico** - desafio vs. segurança
- **Contextual vs. baseado em regras** - transferência vs.
  solidez

O sistema não elimina estas tensões - navega-as. Quando o stress
é alto, muda para métodos mais seguros. Quando a confiança está
sólida, aumenta a exigência. O objetivo é manter o aprendente na
zona de desenvolvimento proximal: desafiado mas não
sobrecarregado.
