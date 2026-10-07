<!-- Translation: AI-generated, pending native review -->

# Navegação

A navegação principal da aplicação é um pequeno conjunto de **entradas
agrupadas** (EXP-037, seguindo a recomendação Nielsen-Norman de "5-7
itens") **sem perda de funcionalidade** - todas as páginas continuam
acessíveis e as ligações antigas continuam a funcionar através de
redirecionamentos.

<!-- TODO: Captura de ecrã - a navegação principal agrupada e a barra de separadores inferior no telemóvel -->

---

## Computador: entradas agrupadas

A navegação no computador está organizada em grupos com etiqueta
através de um componente reutilizável `NavGroup`:

- **Aprender** - Painel, Percurso de aprendizagem e Sessão.
- **Conteúdo** - o **hub de Conteúdo** (`/content`) com quatro
  separadores: *Descobrir* (o catálogo), *Meu conteúdo* (o que foi
  descarregado), *Importar* e *Criar* (uma nova lição própria). O hub
  abre no primeiro separador da ordem definida; por predefinição é
  Descobrir. A ordem pode ser alterada em *Configurações > Geral >
  Aparência*.
- **Progresso** - o **ProgressHub** (`/progress`), com Visão geral,
  Estatísticas e Meus caminhos como separadores.
- **Configurações** e **Ajuda** completam a barra.

O Anki não é uma entrada própria; é uma ação na página Conteúdo, e a
sua rota `/anki` continua a funcionar.

### Uma navegação principal por viewport

Em larguras de computador, a barra superior horizontal é a **única**
navegação principal - não há botão hamburger nem gaveta. Em larguras
estreitas / de telemóvel, as mesmas entradas agrupadas passam para
trás de uma **gaveta hamburger**. Ambas as apresentações são geradas a
partir de uma única lista partilhada de destinos, por isso levam
sempre às mesmas páginas. O item ativo tem `aria-current`, cada alvo
tem pelo menos 44px e tudo funciona em todos os temas. (A página
Configurações tem a sua própria barra lateral de secções para os seus
separadores - essa não tem relação com a navegação principal.)

---

## Telemóvel: barra de separadores inferior (opcional)

Num telemóvel, a navegação fica por predefinição no topo, como botão de
menu. Em *Configurações > Geral > Interface*, **Posição do menu
(celular)** muda-a para **Embaixo (barra de abas)**: uma barra com
cinco separadores fáceis de alcançar com o polegar - **Aprender /
Conteúdo / Percurso de aprendizagem / Progresso / Mais**. *Mais* abre
uma folha inferior com Configurações e Ajuda. A gaveta hamburger
continua disponível em ambas as posições. Os alvos têm 44px, a barra
respeita todos os temas e oculta-se no funil de onboarding e durante
uma lição, para que nada tape o conteúdo.

---

## Hubs e redirecionamentos

Duas páginas são **hubs com separadores**, que montam apenas o
separador ativo:

- **ProgressHub** (`/progress`) integra Progresso + Estatísticas de
  aprendizagem + Currículo.
- **hub de Conteúdo** (`/content`) integra Descobrir + Meu conteúdo +
  Importar + Criar.

Os URLs antigos são preservados por redirecionamentos, p. ex.
`/statistics` → `/progress?tab=stats`, `/curriculum` →
`/progress?tab=paths`, `/discover` → `/content?tab=discover`,
`/import` → `/content?tab=import`.

---

## Páginas relacionadas

- [Progresso](progress.md) - os separadores do ProgressHub
- [Navegador de conteúdo](../features/content-browser.md) - Meu conteúdo
- [Descobrir conteúdo](../features/discover.md) - o catálogo
