# Calendar Timeline — edição Scripting Pro

Fonte: `Sagittaryuz/Calendar-Timeline`, branch `scripting`, pasta
`scripting/scripts/Calendar Timeline Scripting`. Base 0.2.15 incorporada à 0.3.0,
incluindo diário local de falhas. Originais Scriptable e outros produtos preservados.

TSX nativo com motor existente. Detalhes diários calculados no aparelho; criação
reutiliza diário/releitura da ponte. IA local opcional ou envio escolhido pelo usuário.
Nenhum backend novo ou migração de credenciais. Links diretos e App Intents.
Arquitetura/ativação em `scripting/PRO.md`, critérios em `PLANS.md`.

Padrão: `Sagittaryuz/development-standards`, commit
`722279eb8ec4bac318f8fa2ad50ac34b128e90dc`, GIT-FIRST 1.0.1, WEBAPP-WORKFLOW 1.2.3.
Git é origem; Drive recebe cópia privada com histórico recuperável.


## Scripting 0.3.3 / ponte 0.4.0 — campos detalhados

Notas em eventos e lembretes: substituir, acrescentar ao fim/início ou limpar explicitamente. Eventos: localização textual, link HTTP/HTTPS e coordenadas. Lembretes: prioridade 0 a 9. Ambos: substituir/remover alertas absolutos, relativos (segundos) ou por entrada/saída de uma região. Campos omitidos são preservados. Localização de lembretes é configurada no alerta; não há campo textual nativo documentado. Não há geocodificação automática.

A captura semanal continua sem notas, endereços ou alarmes. bridge_request_details solicita leitura pontual sem salvar o item; após execução no iPhone, bridge_get_item(includeDetails=true) retorna os detalhes e sua revisão por até 30 minutos. Edições desses campos exigem expectedDetailsRevision além da revisão principal. Mudança somente nas notas também bloqueia edição conflitante. Marcadores internos de recuperação são preservados e não aparecem nas notas compartilhadas. Clientes antigos não executam comandos detalhados (protocolo 2 necessário).

Atualize o mesmo projeto no Scripting para 0.3.1; mantenha pareamento/armazenamento. O painel Pro e a abertura direta do Calendário foram preservados. Configuração de alerta confirmada por releitura não comprova entrega da notificação; localização requer permissão e teste físico. Sem execução contínua garantida com iPhone bloqueado. Séries, participantes e exclusão permanecem fora das escritas.

Validação: SQLite real com APIs Scripting simuladas, notas Unicode/multilinha, acrescentar/limpar, localização/link/coordenadas, prioridade, alertas, conflito só nas notas, recuperação após ACK perdido, isolamento de clientes antigos e privacidade da captura semanal. Nenhum item real foi alterado durante a implantação. Falta validar novos campos e disparo dos alertas no iPhone.
