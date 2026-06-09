# Backup e restauro

O Adaptive Learner pode guardar todo o teu estado de aprendizagem
num único ficheiro e restaurá-lo noutro dispositivo, numa
instalação nova ou após uma mudança de browser. Encontras tudo em
**Definições → Dados**.

<!-- TODO: Captura de ecrã — Definições → Dados com os botões "Criar backup" e "Restaurar" -->

---

## O que está no backup

Um backup é um **snapshot completo**: todas as 30 tabelas de dados
(projetos de aprendizagem, sessões, progresso de lições, erros ao
nível do elemento, gamificação com XP/Streak/Badges, missões,
cartões Anki, notas e mais) **mais os teus conjuntos de conteúdo
descarregados**. Nada de importante fica para trás.

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
permanente** (toast) que não desaparece por si — assim não passas
nenhum erro despercebido. No modo programador (Definições →
Interface), a mensagem contém os detalhes técnicos para um issue no
GitHub.

---

## Importação entre identidades

**Não** tens de ser o mesmo utilizador no mesmo dispositivo. Um
backup pode ser importado numa **instalação nova** ou sob um
**perfil de utilizador diferente**. O restauro atribui os dados ao
perfil ativo e, ao fazê-lo, resolve corretamente de novo as
referências internas (chaves estrangeiras), para que o teu progresso
permaneça coerente — incluindo o progresso de passos das lições,
Streak e Badges.

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
armazenamento — servidor (API) e apenas browser (Dexie/IndexedDB).
O formato é um único ficheiro JSON; não existe nenhum formato de
arquivo proprietário.

!!! note "Privacidade"
    O backup fica inteiramente nas tuas mãos. É guardado apenas
    onde o colocares — nada é enviado para um servidor.

---

## Páginas relacionadas

- [Definições](../user-guide/settings.md) — todas as ações de dados num relance
- [Múltiplos repositórios de conteúdo](content-repos.md) — os repos ligados fazem parte do snapshot
