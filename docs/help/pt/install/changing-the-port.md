<!-- Translation: AI-generated, pending native review -->

# Mudar a porta (e manter os dados)

O launcher de desktop permite mudar a porta em que o Adaptive
Learner corre (por predefinição **8501**). Isto é útil quando outra
aplicação já usa essa porta - mas há uma consequência que vale a
pena conhecer antes de o fazer.

## Porque é que a porta importa para os dados

O armazenamento de uma aplicação web está ligado ao seu endereço
web exato, incluindo a porta. `http://localhost:8501` e
`http://localhost:8502` são, para o browser, dois endereços
**diferentes**, e cada um tem o seu próprio armazenamento separado.

O que isto significa na prática depende da forma como o Adaptive
Learner é executado:

- **Modo servidor** (a predefinição do launcher de desktop). Os
  conjuntos, as lições e o progresso ficam no backend da própria
  aplicação, não no browser. **Não** são afetados por uma mudança de
  porta - a aplicação volta a encontrá-los automaticamente no novo
  endereço.
- **Modo de armazenamento no browser** (a opção que se pode ativar
  em *Configurações > Geral > Modo de armazenamento*, e o modo que a
  versão web pública usa). Os
  conjuntos, o progresso e os exercícios de autoria própria ficam
  **no browser**, ligados ao endereço atual. Depois de uma mudança
  de porta, a aplicação abre no novo endereço com o armazenamento do
  browser vazio, pelo que parece um começo do zero. **Os dados não
  são apagados** - continuam guardados sob a porta anterior, apenas
  não estão visíveis na nova.

## Passar os dados para a nova porta

Quando se usa o modo de armazenamento no browser e a porta já foi
mudada, os dados estão à espera no endereço antigo. Uma cópia de
segurança trá-los para o novo:

1. Voltar **à porta anterior** (por exemplo
   `http://localhost:8501`). Os dados voltam a aparecer.
2. Abrir **Configurações > Dados > Criar backup** e
   guardar o ficheiro `.alb`.
3. Mudar para a **nova porta**.
4. No ecrã de boas-vindas, escolher **Restaurar a partir de um backup existente**
   e selecionar o ficheiro `.alb`. Tudo - conjuntos, progresso,
   exercícios e configurações - é restaurado.

Ver [Backup e restauro](../features/backup.md) para mais sobre
cópias de segurança.

## Evitar a surpresa: fazer primeiro uma cópia de segurança

O hábito mais seguro é **exportar uma cópia de segurança antes de
mudar a porta**, para a poder restaurar no novo endereço se faltar
alguma coisa. Uma cópia de segurança regular é, em geral, um bom
seguro - também permite levar a aprendizagem de um dispositivo para
outro.

## Mudar a porta não abre a aplicação à rede

Seja qual for a porta escolhida, a aplicação continua a escutar
apenas em `127.0.0.1` - acessível a partir deste computador, não a
partir de outros dispositivos. Não tem login, por isso aceder-lhe a
partir do telemóvel ou de outra máquina é um passo separado e
deliberado (`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0`), e só faz
sentido numa rede de confiança - ver
[Iniciar o launcher de desktop](launcher.md) ("Quem consegue aceder
à aplicação").
