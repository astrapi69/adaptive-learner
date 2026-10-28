# Backup e restauro

O Adaptive Learner pode guardar todo o teu estado de aprendizagem
num único ficheiro e restaurá-lo noutro dispositivo, numa
instalação nova ou após uma mudança de browser. Encontras tudo em
**Definições → Dados**.

<!-- TODO: Captura de ecrã - Definições → Dados com os botões "Criar backup" e "Restaurar" -->

---

## O que está no backup

Um backup é um **snapshot completo**: todas as tabelas de dados
(projetos de aprendizagem, sessões, progresso de lições, erros ao
nível do elemento, gamificação com XP/Streak/Badges, missões,
cartões Anki, notas e mais) **mais os teus conjuntos de conteúdo
descarregados**.

**Também incluídos:** os repositórios de conteúdo ligados, os
convites utilizados e se o Learning Repository está ativo.
No modo de navegador, os resultados das tuas verificações de conteúdo
por IA também são incluídos, por isso o selo "Verificado por IA" mantém-se.

**Não são incluídos**, por exemplo:

- o token de acesso de um repositório privado (introduz-o de novo
  depois de restaurar);
- a pasta do Learning Repository, que pertence ao dispositivo;
- no modo servidor, o progresso de lições e as gravações de voz que
  foram feitos offline e ainda não chegaram ao servidor;
- os índices de pesquisa e as listas de multimédia em cache, o contador
  do backup automático e a posição da sincronização LAN.

Já a definição que indica se o backup automático está ligado ou
desligado vem incluída. No modo servidor, a aplicação guarda neste
browser o que é criado offline: até 50 alterações ao progresso de
lições e às gravações de voz; se se acumularem mais, as mais antigas
são descartadas. Transfere-as por si própria quando a ligação volta
enquanto a aplicação está aberta, ou no próximo arranque com ligação.
Do que é criado offline, só entra no backup o que já chegou ao
servidor; por isso, no modo servidor, só cries um backup quando a
aplicação tiver voltado a correr com ligação depois de aprenderes
offline, não antes.

Antes da exportação, a aplicação mostra uma pré-visualização
**"O teu backup contém …"** com contagens de registos por área,
para que vejas antes de guardar o que será salvaguardado.

---

## Criar backup

1. Abre **Definições → Dados**.
2. Prime **Criar backup**.
3. No modo apenas browser podes escolher diretamente um local de
   gravação através da File System Access API
   ("Guardar no disco"); se o browser não o suportar, a aplicação
   descarrega o ficheiro em vez disso.

**Auto-backup:** Opcionalmente, a aplicação mantém um anel rolante
dos últimos snapshots, para que nunca fiques totalmente sem
salvaguarda.

---

## Restaurar

1. **Definições → Dados → Restaurar**.
2. Escolhe o ficheiro de backup.
3. A aplicação importa cada tabela e desloca para o topo até um
   **resumo por tabela** (adicionado / atualizado / ignorado),
   para que vejas exatamente o que foi importado.

Se algo correr mal durante a importação, aparece um **aviso de erro
permanente** (toast) que não desaparece por si - assim não passas
nenhum erro despercebido. No modo programador (Definições >
Diagnóstico e suporte), a mensagem contém os detalhes técnicos para um issue no
GitHub.

---

## Importação entre identidades

**Não** tens de ser o mesmo utilizador no mesmo dispositivo.

- **Num dispositivo vazio**, o melhor é importar o backup logo no início
  (ver "Backup no primeiro login"). A app assume então o perfil do backup.
- **Num dispositivo onde já criaste um perfil**, podes importar o backup em
  Definições > Dados. Se pertencer a outro perfil, o diálogo de confirmação
  diz-to antes da importação. O progresso do backup é então atribuído ao
  teu **perfil ativo** e combinado com o teu: o progresso das lições, os
  erros, as rodadas, as gravações, os projetos e o histórico são
  acrescentados, e o teu próprio progresso mantém-se. O XP, o Streak e as
  definições são retirados do backup. O teu perfil ativo continua ativo;
  não é criado um segundo perfil.

---

## Backup no primeiro login

Se reinicias a aplicação (ou a usas pela primeira vez num
dispositivo), o Adaptive Learner oferece-te ativamente importar um
backup existente em vez de começar com estado vazio. Assim
regressas imediatamente ao teu fluxo de aprendizagem após uma
mudança de dispositivo ou browser.

---

## Ambos os modos de armazenamento

O backup e o restauro funcionam em **ambos** os modos de
armazenamento - servidor (API) e apenas browser (Dexie/IndexedDB).
O backup é um **ficheiro `.alb`** - um arquivo ZIP que reúne as
tabelas de dados, o instantâneo do localStorage e os conjuntos de
conteúdo. Os ficheiros `.alb` são aceites em todos os pontos de
importação de backup (Definições > Dados e a Zona de perigo). Os
backups antigos num único ficheiro JSON continuam a ser importados
sem problemas.

!!! note "Privacidade"
    O backup fica inteiramente nas tuas mãos. É guardado apenas
    onde o colocares - nada é enviado para um servidor.

---

## Páginas relacionadas

- [Definições](../user-guide/settings.md) - todas as ações de dados num relance
- [Múltiplos repositórios de conteúdo](content-repos.md) - os repos ligados e os convites utilizados viajam com o backup
