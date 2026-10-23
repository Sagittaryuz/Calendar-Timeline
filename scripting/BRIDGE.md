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
