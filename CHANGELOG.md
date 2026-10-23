# Histórico da edição Scripting

## 0.3.2 — 23/10/2026

- Corrige interrupção da ponte em segundo plano: aguarda sincronização antes de Widget.present encerrar o contexto.
- Processa comandos antes da captura completa da agenda e evita a captura redundante após escrita. Orçamento do widget: até 8 segundos.
- Mantém solicitação de atualização em 1 minuto; execução efetiva continua sob controle do iOS.

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
