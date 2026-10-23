# Estado atual: Scripting 0.2.12 / serviço 0.2.0

A seção 0.2.12 ao final define o escopo atual de leitura real. As seções anteriores documentam o piloto e não descrevem os limites atuais de consulta.

# Calendar Timeline Bridge · prova 0.1.1

Incluída no Calendar Timeline Scripting desde a versão 0.2.6. Atualize o mesmo projeto e toque em **Ponte com ChatGPT**. Nenhuma credencial acompanha os arquivos. O projeto separado antigo permanece para compatibilidade; sua instalação não é necessária.

1. Abra o painel privado: https://calendar-timeline-bridge.sagittaryuz.chatgpt.site
2. Gere a configuração privada no painel. Ela aparece uma vez; copie somente para o Scripting, não para o chat.
3. Atualize o projeto existente pelo Git no Scripting:
   `https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting`
4. No painel, prepare os dois itens. Eles ficam pendentes até a execução no aparelho.
5. Abra `Calendar Timeline Scripting`, toque em **Ponte com ChatGPT**, cole a configuração e execute a prova. Conceda Calendário/Lembretes quando o iOS solicitar. Somente o evento e o lembrete `[CT TESTE]` usam a lista/calendário padrão.
6. Volte ao painel/plugin e confirme a chegada dos dois itens. Peça pelo plugin uma alteração ou conclusão, execute novamente o projeto no iPhone e confira a confirmação `applied`.

Ferramentas do plugin: `bridge_get_status`, `bridge_list_test_items`, `bridge_queue_test_change`, `bridge_get_command`. Uma alteração precisa do identificador e da revisão recebida na última leitura. Somente `applied` significa confirmação por releitura; `pending` significa apenas comando na fila. O endpoint MCP é exposto pelo plugin privado provisionado no Sites, não por configuração local do Codex.

O piloto limita uma criação de cada tipo por pareamento, não envia agenda pessoal, não permite excluir itens, não modifica convidados/recorrência e rejeita dados fora do escopo. Alterações feitas manualmente nos dois itens são enviadas na próxima execução. Se houver edição concorrente, a ponte retorna conflito em vez de sobrescrever.

Em falha, a caixa de saída e o diário local retomam o comando na próxima execução. Não apague o projeto nem seu armazenamento para tentar resolver uma falha: isso remove o Keychain e o histórico local da prova. No painel é possível revogar a conexão; isso não apaga os itens Apple. Para colar uma nova configuração, abra `scripting://run/Calendar%20Timeline%20Scripting?configure=1`. Não revogue/repareie para contornar erros sem antes conferir os itens existentes.

Versão 0.1.1: cada rodada reserva os comandos por cinco minutos para reduzir colisões entre execuções simultâneas. Se o iOS interromper a execução antes da confirmação, aguarde a reserva expirar e execute novamente; o diário e o marcador no item recuperam a gravação quando possível. Isso não é uma garantia distribuída de execução exatamente uma vez: uma suspensão longa no meio da chamada nativa ainda exige conferência no aparelho. O snapshot final não reserva comandos que chegaram durante a rodada.

Esta versão não comprova sincronização automática com tela bloqueada. Atalhos pode chamar o Intent de sincronização depois do pareamento, mas isso não equivale a um serviço continuamente ativo.

Testes: `node tests/bridge-device.mjs`; sintaxe TS/TSX conferida. O serviço privado possui seus testes de banco/transporte em seu Git privado. Nenhuma escrita real no iPhone foi confirmada durante a implantação pelo computador.

Rollback: continue usando o widget existente, revogue a conexão no painel e preserve os dois itens para inspeção. Versões de código vêm do Git; backup privado no Drive não é canal de atualização.

A ponte e o widget são distribuídos no mesmo repositório Calendar-Timeline. O serviço privado existente preserva sua hospedagem gerenciada, identidade e dados. Nenhum novo serviço foi criado nesta integração.

A ponte executa pelo botão no aplicativo ou pelo Intent do mesmo projeto. O widget não inicia gravações e não aguarda a rede da ponte. O pareamento deve ser feito uma vez neste projeto, pois o armazenamento do projeto separado não é migrado. Não use os dois projetos simultaneamente com a mesma configuração. Atualização do código vem do Git; sincronização de dados ocorre ao executar a ponte.

0.2.7: ao tocar na ponte, o andamento aparece abaixo do botão. Cancelamentos, falhas e o resultado também aparecem ali. Se o diálogo não abrir, informe a etapa/erro exibido, sem compartilhar a configuração privada. A versão usa Dialog global conforme https://scriptingapp.github.io/guide/Views/Dialog/index_example .


## Calendar Timeline 0.2.8 — execução automática no próprio projeto

A ponte roda na abertura do app, no toque no corpo (antes de abrir o Calendário), na seleção de dia e nas execuções do widget pelo iOS. Não há necessidade de automações no Atalhos. Pairing/consentimento permanecem necessários uma vez. O botão fica disponível para configurar e diagnosticar, mas não é preciso tocá-lo em cada rodada.

O iOS determina quando executar o widget. `policy: after` pede uma nova execução a partir de 15 minutos; não é um agendador preciso. Sem execução do projeto/widget, a ponte não é despertada por um comando no servidor. Não há promessa de tempo real, serviço contínuo ou execução com o telefone bloqueado. BackgroundKeeper e notificações push não foram ativados.

A nova leitura por intervalo trata o cenário em que a busca por identificador devolve um objeto antigo. Essa é uma correção a validar no iPhone do usuário, não uma confirmação da causa interna do Scripting. O último título realmente lido aparece na tela do app e fica em `bridge-event-read`/`bridge-local-items`, somente no aparelho. Nem notas nem outros eventos entram no snapshot enviado.

Testes reproduzíveis no repositório: `tests/scripting-bridge-automatic.cjs`, `tests/scripting-bridge-integration.cjs`, `tests/scripting-bridge-ui.cjs`, `tests/scripting-contract.cjs`, `tests/bridge-device.mjs`, `tests/scripting-engine.cjs`. TYPESCRIPT_PATH pode indicar a instalação local de TypeScript. APIs nativas precisam de validação no iPhone.

Referências oficiais: https://scriptingapp.github.io/guide/Device%20Capabilities/CalendarEvent , https://scriptingapp.github.io/guide/Script/Script , https://scriptingapp.github.io/guide/AppIntent , https://scriptingapp.github.io/guide/Device%20Capabilities/Safari/ .


## 0.2.11 — proteção contra regressão do evento

A leitura combina `CalendarEvent.get` e `getAll`, compara `lastModifiedDate` documentada pela API e guarda um checkpoint local. Leituras anteriores ou conflitantes sem versão distinta são adiadas; não se presume que a consulta por intervalo é sempre mais recente. O conteúdo de `revision` permanece compatível com comandos existentes. Lembretes não recebem metadados de modificação não documentados.

O serviço 0.1.2 admite snapshots de evento atomicamente por versão nativa, preservando milissegundos. Clientes antigos não podem substituir um estado versionado. Omissão em consulta não é tratada como exclusão. Resultados antigos de comandos não são confirmados como aplicados; a caixa de saída é relida após atualização. A origem e versão do cliente acompanham os snapshots aceitos. Pareamento e escopo dos dois itens de teste são preservados.

Testes locais cobrem as duas fontes nativas alternadamente antigas, checkpoint, versões iguais conflitantes, clientes antigos, omissão e renomeação posterior legítima. APIs do iPhone são simuladas nesses testes. O cache interno do Scripting não foi inspecionado; a admissão sem controle de versão era uma falha comprovada do nosso código. A confirmação do título real exige executar esta versão no aparelho. Atualização de código e sincronização dos dados são operações distintas.


## 0.2.12 — agenda real do iPhone para consulta

Autorização do proprietário nesta conversa: ampliar a leitura para eventos e lembretes reais, sem Google Agenda. O serviço privado 0.2.0 mantém pareamento e identidade. Escritas permanecem limitadas ao evento e lembrete de teste; não há ferramenta de escrita nem exclusão para registros reais.

O Scripting lê todos os calendários disponíveis via CalendarEvent.getAll, e Reminder.getAll para preservar lembretes concluídos. Só transmite ocorrências na semana atual e próxima (segunda a segunda, fim exclusivo). Lembretes sem data, vencidos antes da janela ou apenas futuras recorrências não concretizadas ficam fora. API Reminder não expande recorrências. Campos enviados: identificador, título, calendário/lista, tipo, início/fim ou vencimento, dia inteiro, fuso e conclusão. Notas, participantes, localização e URLs não são enviados. Marcador nas notas é usado localmente somente para resolver o teste.

A leitura do teste agora busca o marcador exclusivo em todos os calendários da janela, compara versões nativas e pode religar um identificador alterado. No servidor, essa religação exige o marcador do comando original de criação e uma versão nativa posterior, com atualização condicional atômica. Nenhuma regra procura a palavra EDITADO ou reescreve o título.

A agenda é enviada antes do fluxo dos testes e independe dele. O servidor conserva somente a captura vigente por aparelho, com controle de concorrência, janela, contagem, cobertura e truncamento. Erros de permissão não viram agenda vazia; versões anteriores de eventos são preservadas e sinalizadas. Limite de 1500 itens e tamanho limitado no aparelho; truncamento é explícito. Lembretes não possuem lastModifiedDate documentado; seu estado é o observado na captura mais recente, sem garantia de detecção de cache nativo.

Consulta: bridge_list_agenda com start/end YYYY-MM-DD (end exclusivo), kind opcional, includeCompleted (padrão true), limit até 200 e offset/nextOffset. Padrão é a próxima semana. bridge_get_status também contém a primeira página da próxima semana em agenda, para continuidade com o plugin já instalado. Conferir available, covered, complete, stale, capturedAt e nextOffset. Dados fora da janela capturada não são tratados como vazios.

Atualize o mesmo projeto no Scripting e abra-o sem tocar no botão Ponte. Não refaça o pareamento. O app mostra o recebimento da agenda separadamente do teste. Execução pelo iOS e rede continuam necessárias; nenhuma consulta no chat desperta o iPhone. Não há uso de Atalhos ou acesso ao Google Agenda.

Testes: SQLite real e transporte/projeção nativos simulados, autenticação/revogação, leitura real sem escrita, novo identificador do evento com busca antiga, proteção contra regressão, independência do envio da agenda, dia inteiro/fuso, recorrências de eventos, lembretes datados/concluídos, paginação, erros de cobertura, privacidade e rejeição de campos extras. A migração 0003 adiciona somente bridge_agenda e preserva os dados existentes. Validar no iPhone após atualização: título real EDITADO, captura com origin app-open e a lista real da próxima semana. Publicação e testes locais não confirmam esse resultado no aparelho.

APIs verificadas: https://scriptingapp.github.io/guide/Device%20Capabilities/CalendarEvent e https://scriptingapp.github.io/guide/Device%20Capabilities/Reminder .
