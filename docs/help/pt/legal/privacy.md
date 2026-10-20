<!-- Translation: AI-generated, pending native review -->

# Política de privacidade

> Esta página é uma tradução automática do original em alemão e serve apenas para informação. Só a versão alemã é juridicamente vinculativa.

Última atualização: 20 de outubro de 2026

A presente política abrange a versão web pública do Adaptive Learner em
`astrapi69.github.io/adaptive-learner`, a pré-visualização pública da próxima
versão em `astrapi69.github.io/adaptive-learner-content-test` e estas páginas
de documentação. Se instalar o Adaptive Learner por conta própria (desktop
launcher ou Docker), a aplicação é executada no seu próprio dispositivo e o
operador destas páginas só recebe o que o utilizador lhe enviar por iniciativa
própria, por exemplo uma lição partilhada ou um relatório de erro. Mesmo nesse
caso, a
aplicação e o launcher consultam `api.github.com` sobre novas versões, os
conteúdos de aprendizagem vêm do GitHub e o seu próprio servidor envia os
pedidos de IA ao fornecedor escolhido.

## Responsável pelo tratamento

Asterios Raptis, Seestraße 68, 71638 Ludwigsburg, Alemanha

E-mail: asterios.raptis@web.de

## Resumo

O Adaptive Learner não tem servidor próprio. A aplicação e estas páginas não
definem cookies, não utilizam serviços de análise ou de rastreamento e não
carregam tipos de letra nem scripts de terceiros. O seu progresso, as suas
estatísticas e as suas definições ficam no seu browser, para si. O operador só
recebe o que o utilizador lhe enviar por iniciativa própria, e outros só
recebem partes disso quando uma funcionalidade que utiliza precisa delas, por
exemplo a IA com a sua própria chave.

Os dados só saem do seu dispositivo nos seguintes casos, descritos em
pormenor mais abaixo:

- Quando abre a aplicação e estas páginas, o GitHub, enquanto prestador de
  alojamento, trata o seu endereço IP.
- A aplicação carrega os conteúdos de aprendizagem a partir do GitHub e
  verifica lá também, por iniciativa própria, se há novidades.
- Quando partilha uma lição com a comunidade ou utiliza funcionalidades do
  GitHub com o seu próprio token de acesso, os dados vão para o GitHub; o
  operador também recebe as contribuições partilhadas.
- O GitHub só recebe um relatório de erro quando o próprio utilizador o abre
  no GitHub.
- As funcionalidades de IA enviam os seus pedidos, com a sua própria chave,
  diretamente ao fornecedor que escolheu.
- Para a entrada por voz e a leitura em voz alta, o seu browser pode utilizar
  um serviço online, consoante o fabricante.
- Os botões de partilha e as ligações externas só abrem outros sítios depois
  de clicar.
- Envia um e-mail ao operador.

## Alojamento no GitHub Pages

A aplicação, a pré-visualização e esta documentação são disponibilizadas pelo
GitHub Pages, um serviço da GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
Francisco, CA 94107, EUA. Em cada pedido, o GitHub trata o endereço IP do seu
dispositivo e os habituais dados de ligação (hora, ficheiro solicitado, tipo
de browser); segundo as suas próprias indicações, o GitHub regista e conserva
o endereço IP para fins de segurança. O operador não recebe estes dados.

O fundamento jurídico é o interesse legítimo numa disponibilização segura e
eficiente (artigo 6.º, n.º 1, alínea f), do RGPD (Regulamento Geral sobre a
Proteção de Dados)). O GitHub está certificado ao abrigo do Quadro de
Privacidade de Dados UE-EUA (EU-US Data Privacy Framework), pelo que a
transferência para os EUA está abrangida por uma decisão de adequação
(artigo 45.º do RGPD). Mais informações:
[GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Além disso, estas páginas de documentação não carregam nada de outros
servidores: utilizam os tipos de letra do seu sistema, e a pesquisa é
executada no seu browser, sem que os seus termos de pesquisa saiam dele.

## Carregamento de conteúdos de lições

Os conteúdos de aprendizagem encontram-se em repositórios de conteúdo no
GitHub. O seu browser carrega-os diretamente a partir de
`raw.githubusercontent.com`, e os repositórios com token de acesso próprio
através de `api.github.com`. O destinatário, que é ele próprio responsável
pelo tratamento, é a GitHub, Inc. (ver acima). A aplicação carrega:

- ao abrir, transferir ou atualizar um conjunto, as respetivas lições e
  imagens,
- ao abrir a página "Conteúdo", o catálogo: repositórios recomendados,
  índices de pesquisa, listas de multimédia e de livros, e capas de livros,
- no final de cada lição, a lista de multimédia complementar,
- quando adiciona ou verifica um repositório, resgata um código de convite ou
  abre uma ligação partilhada para um conjunto, um convite ou um repositório,
  os ficheiros necessários para isso.

Além disso, a aplicação verifica por iniciativa própria, sem que clique em
nada, se os seus conjuntos têm novas versões e que revisões estão pendentes.
Para isso, lê os ficheiros de manifesto do catálogo oficial e dos seus
repositórios ligados: no arranque, ao mudar de página e quando a janela volta
ao primeiro plano; sincroniza os repositórios ligados no arranque quando a
última sincronização tem mais de um dia. O seu browser responde normalmente aos
pedidos repetidos em pouco tempo a partir da sua cache. A verificação é
executada em todas as páginas da aplicação, exceto a página inicial, a criação
do seu primeiro projeto de aprendizagem e a avaliação do tipo de aprendizagem,
ou seja, também logo numa primeira visita através de uma ligação partilhada ou
direta e na página de erro de um endereço mal escrito, incluindo em /docs/.

O GitHub recebe o seu endereço IP, os habituais dados do browser (tipo e
versão do browser, sistema operativo, idioma), em regra a origem do pedido
(`astrapi69.github.io`) e o caminho do ficheiro solicitado. O caminho mostra
que repositórios, conjuntos e lições utiliza, incluindo repositórios que
adicionou por si, e, ao resgatá-lo, o código de convite. Não são definidos nem
enviados cookies.

O fundamento jurídico é, para os conteúdos que solicita, a disponibilização
da funcionalidade (artigo 6.º, n.º 1, alínea b), do RGPD) e, para a
verificação automática, o interesse legítimo em mostrar-lhe conteúdos
atualizados e as revisões pendentes (artigo 6.º, n.º 1, alínea f), do RGPD).
Quanto à transferência para os EUA, ver acima.

## Funcionalidades do GitHub com o seu próprio token de acesso

Algumas funcionalidades utilizam a API do GitHub (`api.github.com`) com um
token de acesso pessoal que o próprio utilizador introduz, nas "Configurações"
em "Integrações" ou para um repositório específico. O token permanece no seu
browser e é enviado apenas ao GitHub. Com ele, a aplicação age em seu nome:

- Verifica o token e lê, nesse processo, o seu nome de utilizador do GitHub.
- Lê os repositórios privados que ligou, também durante a verificação
  automática acima descrita.
- Partilha uma lição com a comunidade: como pull request para o repositório
  público `astrapi69/adaptive-learner-content` do operador, através de uma
  cópia (fork) na sua conta.
- Submete o seu próprio repositório de conteúdo para a pesquisa, também como
  pull request para `astrapi69/adaptive-learner-content`.
- Exporta um conjunto para um novo repositório na sua conta, privado por
  predefinição.
- Para os coaches, cria, lista e desativa códigos de convite na pasta `codes/`
  do seu próprio repositório.

Sem token, "Compartilhar com a comunidade" abre em vez disso a página de
edição do GitHub (`github.com`); se a lição couber no endereço dessa página, o
seu conteúdo figura nele. "Preparar envio" (Configurações > Dados > Registe o
seu repositório) consulta em `api.github.com` o estado mais recente do
repositório que indicar, com o token desse repositório, se o tiver guardado.

O GitHub recebe o token, o seu endereço IP, os habituais dados do browser, os
nomes dos repositórios e ficheiros e tudo o que partilha ou exporta: a lição
ou os ficheiros do conjunto, a mensagem de commit, o título e a descrição do
pull request com os dados da lição, a entrada do registo e, se o indicar, o
seu nome como autor ou autora. Um código de convite contém o código, o
repositório, o ramo, o número máximo de utilizações, a data de expiração, uma
nota e, se o incorporar, um token de leitura; qualquer pessoa que possa ler o
ficheiro do código pode ler esse token.

O que envia para `astrapi69/adaptive-learner-content` torna-se um pull
request público com o seu nome de utilizador do GitHub e, se o indicar, o seu
nome de autor. O operador recebe-o, analisa-o e, se for caso disso, integra a
contribuição nos conteúdos (artigo 6.º, n.º 1, alíneas b) e f), do RGPD). O
pull request e o histórico de versões do repositório são conservados enquanto
o repositório existir. Para as restantes funcionalidades, o fundamento
jurídico é o seu pedido (artigo 6.º, n.º 1, alínea b), do RGPD). O
destinatário é a GitHub, Inc. (ver acima).

## Relatórios de erro

Prepara um relatório de erro com o botão de uma mensagem de erro ("Reportar
problema"), com "Comunicar um problema" quando não foi possível carregar uma
vista, ou com "Criar relatório de erro" nas "Configurações", em "Diagnóstico e
suporte". Vê primeiro o relatório. Só quando clica em "Abrir no GitHub" é que a
aplicação abre, num novo separador, um formulário pré-preenchido para um novo
issue no repositório `astrapi69/adaptive-learner` em `github.com`. O relatório
consta do endereço dessa página, pelo que o GitHub o recebe logo que o
separador se abre, antes de enviar lá o que quer que seja. Perante um erro
interno ao criar uma lição, "Relatar o problema" abre diretamente um formulário
desse tipo, apenas com essa mensagem de erro.

O relatório contém a mensagem de erro com dados técnicos (por exemplo, código
de estado, endpoint, hora ou stack trace) e a sua própria descrição. A
aplicação só acrescenta as informações do ambiente (versão da aplicação,
browser, sistema operativo, página atual) e o histórico de ações (ver
Armazenamento no seu dispositivo) se assinalar a respetiva caixa; ambas
começam por não estar assinaladas.

Se submeter o issue no GitHub, este é público e fica associado à sua conta do
GitHub. O operador recebe-o e utiliza-o para corrigir o erro (artigo 6.º,
n.º 1, alínea f), do RGPD); é conservado enquanto o issue existir. O
destinatário é a GitHub, Inc. (ver acima).

## Funcionalidades de IA com a sua própria chave

As funcionalidades assistidas por IA só existem se introduzir nas
"Configurações", em "IA", a sua própria chave de API de um fornecedor. O seu
browser envia então os pedidos diretamente a esse fornecedor; o operador não
recebe estes dados. Tem um contrato próprio com o fornecedor, e aplicam-se as
condições e o aviso de privacidade deste. O destinatário é o fornecedor cuja
chave utiliza:

- Anthropic (`api.anthropic.com`): para clientes no EEE, a Anthropic Ireland,
  Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29,
  Irlanda. A chave segue no cabeçalho do pedido.
- OpenAI (`api.openai.com`): para clientes no EEE, a OpenAI Ireland Limited,
  1st Floor, The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1,
  D01 YC43, Irlanda. A chave segue no cabeçalho do pedido.
- Google (`generativelanguage.googleapis.com`, a API do Gemini): na utilização
  paga com endereço de faturação no EEE, a Google Cloud EMEA Limited, 70 Sir
  John Rogerson's Quay, Dublin 2, Irlanda (com endereço de faturação em
  França, Itália ou Polónia, a sociedade da Google Cloud desse país); na
  utilização gratuita, a Google LLC, 1600 Amphitheatre Parkway, Mountain View,
  CA 94043, EUA. Aqui a chave segue no endereço do pedido e não no seu
  cabeçalho.

São enviados pedidos quando utiliza uma funcionalidade de IA: sessões de
aprendizagem (incluindo a avaliação automática de cada passo), "Perguntar à
IA" nas lições, a verificação das suas respostas pela IA, a geração de
exercícios e lições, a análise de conversas importadas, os cartões de estudo e
o guia de estudo, a prática de pronúncia e a verificação e geração de
conteúdos pela IA. Sem que escreva nada, a aplicação envia ainda:

- uma consulta dos modelos disponíveis quando abre a página "Sessão" ou a
  seleção de modelo nas "Configurações",
- um pedido de teste ao fornecedor de uma chave quando guarda a chave, restaura
  uma cópia de segurança da chave ou clica em "Testar", mesmo que esse
  fornecedor não esteja ativo,
- uma única vez, os primeiros pedidos de uma sessão de aprendizagem que inicia
  a partir de uma conversa importada; contêm a conversa colada.

Cada pedido inclui a sua chave, o seu endereço IP e os habituais dados do
browser, incluindo a origem do pedido (`astrapi69.github.io`). A consulta de
modelos e o pedido de teste são uma mesma consulta da lista de modelos e não
contêm mais nada; depois de uma consulta bem-sucedida, a aplicação não volta a
enviá-la para a mesma chave no mesmo separador durante uma hora. Os restantes
pedidos contêm, consoante a funcionalidade:

- as suas mensagens, perguntas e respostas e o histórico da sessão até ao
  momento,
- os conteúdos de aprendizagem em causa (lições, exercícios, cartões),
- o tema e o objetivo do seu projeto de aprendizagem e o seu método de
  aprendizagem preferido com o respetivo peso,
- os títulos e resultados das lições que concluiu, a lição em que está a
  trabalhar e os seus erros mais recentes com a sua resposta e a resposta
  esperada,
- para o guia de estudo, além disso, o prazo, os minutos por dia, todos os
  pesos dos métodos, o vocabulário das conversas analisadas e até dez das suas
  últimas sessões concluídas com hora de início e método,
- nas conversas importadas, o respetivo título e o texto colado completo,
- na prática de pronúncia, a frase-alvo e o texto reconhecido da sua
  tentativa,
- o idioma em que a IA deve responder.

O fundamento jurídico é a funcionalidade que utiliza (artigo 6.º, n.º 1,
alínea b), do RGPD); para a consulta de modelos e o pedido de teste, o
interesse legítimo em mostrar-lhe os modelos disponíveis e assinalar de
imediato uma chave inválida (artigo 6.º, n.º 1, alínea f), do RGPD).

Os fornecedores também podem tratar os dados fora da UE, em especial nos EUA.
Segundo as suas condições contratuais, a Anthropic baseia as transferências
para países terceiros nas cláusulas contratuais-tipo da Comissão Europeia
(artigo 46.º, n.º 2, alínea c), do RGPD), e a OpenAI em cláusulas
contratuais-tipo ou numa decisão de adequação; a Google LLC está certificada
ao abrigo do Quadro de Privacidade de Dados UE-EUA (artigo 45.º do RGPD).
Avisos de privacidade dos fornecedores:

- [Anthropic](https://www.anthropic.com/legal/privacy)
- [OpenAI](https://openai.com/policies/eu-privacy-policy/)
- [Google](https://policies.google.com/privacy) e os
  [termos da API do Gemini](https://ai.google.dev/gemini-api/terms)

## Entrada por voz

Quando toca no microfone (no campo de introdução da sessão de aprendizagem e
na prática de pronúncia), a aplicação utiliza o reconhecimento de voz do seu
browser. A gravação só começa depois de tocar, e o seu browser pede antes
autorização para usar o microfone. O reconhecimento é feito pelo browser, não
pela aplicação: o Google Chrome envia para isso a gravação e o idioma
escolhido a um serviço da Google (`www.google.com`); os outros browsers
procedem consoante o fabricante. O fabricante do browser é responsável por
este tratamento, e aplica-se o respetivo aviso de privacidade. No Chrome
trata-se da Google; para os utilizadores no EEE, segundo a
[política de privacidade da Google](https://policies.google.com/privacy), da
Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda; a
Google também pode tratar os dados nos EUA, e a Google LLC está certificada ao
abrigo do Quadro de Privacidade de Dados UE-EUA.

A aplicação recebe apenas o texto reconhecido. Na sessão de aprendizagem, ele
vai para o campo de introdução e, na prática de pronúncia, para a sua
tentativa; quando o envia, segue para o seu fornecedor de IA. O fundamento
jurídico para iniciar o reconhecimento é o seu pedido (artigo 6.º, n.º 1,
alínea b), do RGPD). Nas "Configurações", em "Aprendizagem", "Mostrar botão do
microfone" oculta a entrada por voz. As gravações dos exercícios de expressão
oral, pelo contrário, são feitas pela própria aplicação e ficam no seu
browser.

## Leitura em voz alta

Inicia a leitura em voz alta com os botões de leitura, a tecla R ou "Ler
tudo"; a leitura automática só funciona se a ativar. São lidos os textos das
lições, os enunciados, as perguntas da avaliação do tipo de aprendizagem, as
respostas da IA e as frases da prática de pronúncia. Para isso, a aplicação
utiliza a síntese de voz do seu browser ou do seu sistema operativo. Escolhe
uma voz que funciona no seu dispositivo e só recorre a uma voz online se não
existir nenhuma voz local para o idioma ou se o próprio utilizador tiver
escolhido uma voz online nas "Configurações".

Uma voz online envia o texto a ler ao respetivo fornecedor. No Google Chrome,
trata-se de vozes da Google; o texto figura então no endereço do pedido a
`www.google.com`. No Linux, o Chrome oferece em regra apenas vozes deste tipo.
O responsável é o fornecedor da voz, no Chrome a Google (ver Entrada por voz).
O fundamento jurídico é o seu pedido (artigo 6.º, n.º 1, alínea b), do RGPD).

## Botões de partilha

Aparece um botão de partilha no "Painel", nas linhas de "Continuar a aprender",
assim que conclui uma lição com resultado, e no final de uma lição, se estiver
ativado nas "Configurações", em "Aprendizagem", em "Resumo após as lições" (por
predefinição, está desativado). Se o seu dispositivo oferecer uma caixa de
diálogo de partilha própria, a aplicação abre-a, e escolhe aí onde partilhar.
Caso contrário, mostra ligações para o Facebook, o LinkedIn, o X e o WhatsApp e
uma opção para copiar.

Só quando clica numa destas ligações é que o seu browser abre a página da
rede; a rede recebe então o seu endereço IP, os habituais dados do browser e
os cookies que ela própria tenha definido no seu dispositivo. O Facebook e o
LinkedIn recebem apenas o endereço da aplicação; o X e o WhatsApp, um texto
pré-preenchido com o título da lição, o seu resultado (percentagem e número de
respostas corretas) e o endereço da aplicação, que ainda pode alterar antes de
publicar. A aplicação não incorpora scripts nem botões destas redes; a partir
do clique aplicam-se os respetivos avisos de privacidade. O fundamento
jurídico é o seu pedido (artigo 6.º, n.º 1, alínea b), do RGPD).

## Ligações externas

A aplicação e estas páginas contêm ligações para serviços externos (entre os
quais GitHub, Amazon, YouTube, AnkiWeb, plataformas de donativos). Os vídeos e
as imagens dos conteúdos de aprendizagem ou das respostas da IA que remetem
para outros servidores também são mostrados pela aplicação como ligação; nada
é carregado antes de clicar. Com o clique, sai da aplicação ou destas
páginas; a partir desse momento aplica-se o aviso de privacidade do respetivo
fornecedor. Não estão incluídos quaisquer scripts, botões ou conteúdos
incorporados destes fornecedores.

## Armazenamento no seu dispositivo

O que cria na aplicação é armazenado localmente pelo seu browser em IndexedDB
e localStorage: perfil, projetos de aprendizagem, progresso e estatísticas,
notas, conversas importadas, lições transferidas, gravações dos exercícios de
expressão oral, cópias de segurança automáticas e as suas definições,
incluindo as suas chaves de API e o seu token do GitHub, bem como catálogos em
cache. A aplicação utiliza ainda:

- o sessionStorage, que o seu browser apaga ao fechar o separador, para o
  histórico de ações destinado aos relatórios de erro (as suas ações mais
  recentes na aplicação, como botões clicados, mudanças de página, opções
  escolhidas, mensagens e erros, mas nenhuma introdução pelo teclado) e, se
  tiver introduzido uma chave de IA, para a lista de modelos do seu
  fornecedor, durante uma hora e guardada sob uma impressão digital curta da
  sua chave em vez da própria chave,
- o Cache Storage para os ficheiros da aplicação e as lições transferidas,
  para que funcione também offline.

Estas páginas de documentação guardam apenas o esquema de cores (claro ou
escuro) no localStorage. A pré-visualização pública encontra-se no mesmo
domínio (`astrapi69.github.io`) que a aplicação, pelo que ambas partilham o
armazenamento do seu browser.

Este armazenamento é estritamente necessário para as funcionalidades que
utiliza e enquadra-se na exceção prevista no § 25, n.º 2, ponto 2, da TDDDG
alemã (Lei alemã de Proteção de Dados nas Telecomunicações e nos Serviços
Digitais); não é necessário consentimento. O armazenamento em si não
transmite nada; as secções acima descrevem quando os dados saem do seu
dispositivo. Pode exportar ou eliminar os dados a qualquer momento nas
"Configurações", ou apagar os dados do sítio no seu browser.

## Contacto por e-mail

Se enviar um e-mail ao operador, os seus dados são armazenados para tratar o
pedido (artigo 6.º, n.º 1, alíneas b) e f), do RGPD) e eliminados assim que o
pedido estiver resolvido e não se aplique nenhuma obrigação legal de
conservação.

## Os seus direitos

Perante o responsável pelo tratamento, tem o direito de acesso (artigo 15.º
do RGPD), de retificação (artigo 16.º), de apagamento (artigo 17.º), à
limitação do tratamento (artigo 18.º), de portabilidade dos dados
(artigo 20.º) e de oposição ao tratamento com base em interesses legítimos
(artigo 21.º). Pode ainda apresentar reclamação junto de uma autoridade de
controlo em matéria de proteção de dados (artigo 77.º do RGPD), por exemplo a
autoridade do seu local de residência ou da sede do responsável pelo
tratamento.

Uma vez que o operador não detém os seus dados de aprendizagem, os pedidos de
acesso e de apagamento relativos a esses dados são tratados no seu próprio
dispositivo: Configurações, Dados, Exportar ou Eliminar. Para as
contribuições, os relatórios de erro e os e-mails que o operador recebeu de
si, contacte o endereço de e-mail indicado acima.

## Alterações

A presente política é atualizada quando a aplicação ou a situação jurídica se
alteram. A data da versão atual é indicada no topo.

Consulte também o [aviso legal](imprint.md).
