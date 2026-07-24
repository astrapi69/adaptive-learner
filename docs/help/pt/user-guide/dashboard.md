<!-- Translation: AI-generated, pending native review -->

# O Dashboard

O Dashboard é a sua base. Reúne múltiplas fatias de dados numa
única vista: quem é como aprendente (perfil + XP + emblemas),
como está agora (mapa de calor de sequência + contador de
sessões), o que tem feito (sessões recentes + distribuição de
métodos) e o que fazer a seguir (ferramentas + recomendações
espaçadas).

No topo fica a **barra de filtros Assuntos + Etiquetas** -
escolha um assunto (ex.: Línguas → Espanhol) ou uma etiqueta
para limitar todos os widgets abaixo a projetos com essa
classificação. Os filtros são partilháveis via parâmetros de
consulta de URL.

## Radar de perfil

O gráfico de radar no topo mostra o seu perfil de 6 métodos
da avaliação. Mesma forma que o gráfico pós-avaliação na
página de Avaliação. O método dominante é destacado abaixo do
gráfico com um emblema colorido.

Se ainda não fez a avaliação, o radar mostra uma forma de
zeros e liga para a página de Avaliação.

## XP + Sequência + Emblemas

- **Widget XP** - nível atual + XP total + uma barra de
  progresso para o próximo nível. Os níveis seguem uma curva
  exponencial (`threshold(n) = 50 * n * (n - 1)`); os níveis
  1-5 ficam em 0 / 100 / 300 / 600 / 1000 XP. Base de 50 XP
  por sessão terminada, mais bónus por ciclo + bónus de
  primeiro método + multiplicador de sequência (até 2.75×
  numa sequência de 7 dias).
- **Mapa de calor de sequência** (estilo GitHub) - 365 dias
  de atividade em colunas semanais Seg..Dom. Cinco cores por
  camada via `color-mix` em `var(--accent)`. Ative o modo de
  fim de semana em Definições para ignorar lacunas de Sáb/Dom;
  o estoque de congelamentos (1 por cada 7 dias de sequência,
  máx. 3) funciona como pausa-não-reinício num dia útil perdido.
- **Apresentação de emblemas** - 24 emblemas em 5 categorias
  (getting_started 3, consistency 4, method_explorer 7, depth
  7, polyglot 3). Os conquistados acendem-se coloridos + com
  data; os bloqueados ficam cinzentos.
- **Contador de sessões** - mosaicos para sessões, minutos,
  sequência atual, compreensão média, stress médio.

## Linha do tempo de progresso

Um gráfico de duas linhas abaixo do radar. Duas métricas por
sessão: a sua avaliação de **compreensão** e a sua avaliação
de **stress**, cada uma reescalada da entrada 1-5 para um eixo
0-1. Cinco sessões mais recentes mostradas por defeito;
ordenadas da mais antiga à esquerda para a mais recente à
direita.

O que procurar: uma linha de compreensão ascendente é exatamente
o que quer. Uma linha de compreensão plana com stress crescente
é o sinal exato que a heurística de mudança de método observa;
vai sugerir-lhe que mude de métodos.

## Distribuição de métodos

Um gráfico de barras horizontal que mostra quais dos 6 métodos
tem estado a usar. O comprimento de cada barra é a percentagem
de sessões que usou esse método. As barras são ordenadas de
forma decrescente por contagem; empates mantêm a ordem canónica
dos métodos.

O ponto deste gráfico não é competir consigo mesmo; é um espelho.
Alguns aprendentes fazem 80% de sessões dedutivas e isso é
normal. Outros aprendentes descobrem que nunca usaram realmente
o método contextual e querem experimentá-lo.

## Sessões recentes

As últimas 5 sessões como uma lista compacta: emblema de método,
a avaliação de compreensão da sessão (como uma pequena barra),
e a duração em minutos. Clicar numa linha salta para a página
de Progresso filtrada para essa sessão - útil quando uma sessão
específica correu muito bem ou muito mal e quer ver o que
aconteceu.

## Ferramentas + recomendações espaçadas

Dois cartões de recomendação ao longo da borda inferior:

- **Ferramentas** - ferramentas externas classificadas
  adaptadas ao seu perfil. O Anki + NotebookLM são agora de
  primeira classe com exportações integradas (sem transferência
  manual). Cada uma mostra um "porquê" numa linha no seu idioma
  de interface.
- **Repetição espaçada** - cartões de ação curtos "faça isto
  a seguir" orientados pelos métodos que não praticou
  recentemente. Uma política de cinco bandas (primeiro /
  refrescar / revisão / prática / manter) orienta as sugestões
  de intervalo.

Ambas as listas atualizam em cada carregamento do Dashboard -
são baratas de calcular e refletem a sessão mais recente.

## Iniciar sessão

O grande botão primário no topo: "Iniciar sessão". Abre a
página de Sessão com uma nova linha de sessão criada, o método
ativo pré-escolhido do seu perfil, e o ciclo no passo 1.
