# Histórico da edição Scripting

## 0.3.1 — 23/10/2026

- Ponte pessoal permite editar/concluir/reabrir lembretes recorrentes, preservando regras, notas e alarmes.
- Capacidade explícita distingue cliente antigo; diário impede segunda gravação após resultado não confirmado.
- Servidor privado atualizado sem novo plugin, pareamento ou perda de dados. Testes SQLite/mocks aprovados; iPhone pendente.

## 0.3.0 — 23/10/2026

- Incorpora o registro de tentativas da 0.2.15.
- Detalhes diários, conflitos, intervalos e criação por frase com revisão/releitura.
- Assistente, Central de Controle, painel Início e preferências exportáveis.
- Corpo abre Calendário diretamente; seleção de dia sem espera de rede.
- Solicita atualização em 1 minuto, configurável. Geometria preservada.
- Testes locais/mocks/Canvas aprovados; execução nativa ainda não confirmada.

Versões anteriores: `scripting/README.md` e tags Git.


## Scripting 0.3.1 / ponte 0.4.0 — campos detalhados

Notas em eventos e lembretes: substituir, acrescentar ao fim/início ou limpar explicitamente. Eventos: localização textual, link HTTP/HTTPS e coordenadas. Lembretes: prioridade 0 a 9. Ambos: substituir/remover alertas absolutos, relativos (segundos) ou por entrada/saída de uma região. Campos omitidos são preservados. Localização de lembretes é configurada no alerta; não há campo textual nativo documentado. Não há geocodificação automática.

A captura semanal continua sem notas, endereços ou alarmes. bridge_request_details solicita leitura pontual sem salvar o item; após execução no iPhone, bridge_get_item(includeDetails=true) retorna os detalhes e sua revisão por até 30 minutos. Edições desses campos exigem expectedDetailsRevision além da revisão principal. Mudança somente nas notas também bloqueia edição conflitante. Marcadores internos de recuperação são preservados e não aparecem nas notas compartilhadas. Clientes antigos não executam comandos detalhados (protocolo 2 necessário).

Atualize o mesmo projeto no Scripting para 0.3.1; mantenha pareamento/armazenamento. O painel Pro e a abertura direta do Calendário foram preservados. Configuração de alerta confirmada por releitura não comprova entrega da notificação; localização requer permissão e teste físico. Sem execução contínua garantida com iPhone bloqueado. Séries, participantes e exclusão permanecem fora das escritas.

Validação: SQLite real com APIs Scripting simuladas, notas Unicode/multilinha, acrescentar/limpar, localização/link/coordenadas, prioridade, alertas, conflito só nas notas, recuperação após ACK perdido, isolamento de clientes antigos e privacidade da captura semanal. Nenhum item real foi alterado durante a implantação. Falta validar novos campos e disparo dos alertas no iPhone.
