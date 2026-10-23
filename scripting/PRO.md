# Calendar Timeline 0.3.5 — recuperação pela base anterior

A prioridade desta versão é restaurar a execução da estrutura 0.2.15. O motor e o desenho original foram preservados; 18 dos 25 arquivos são byte a byte iguais à base 565bba1. As telas de dia, criação por frase, exportações, painel Início, ferramenta do Assistente, Central de Controle e edição de detalhes foram temporariamente retiradas do pacote ativo. O código permanece no Git e em scripting/experimental-pro e scripting/entrypoints; a tag scripting-v0.3.4-alpha.1 preserva o pacote anterior completo.

A ponte e o pareamento anteriores continuam. A fila pessoal pode criar/editar campos básicos, concluir e reabrir lembretes; lembretes recorrentes mantêm suas regras. Eventos recorrentes, participantes e fontes não graváveis permanecem fora do escopo de escrita. A conclusão precisa de gravação e releitura no aparelho. Nada é criado ou concluído apenas por instalar.

A fila é processada antes da captura da agenda, para aproveitar o tempo concedido à execução do widget. O widget aguarda a ponte antes de apresentar a timeline e solicita nova execução após 1 minuto. O iOS decide a frequência efetiva; não há garantia de execução a cada 60 segundos. O corpo abre o Calendário diretamente.

Atualize o mesmo projeto e preserve Storage e Keychain. O pacote Git possui 25 arquivos e não usa o gerador de bundles Pro. npm run build:scripting verifica o pacote ativo sem reescrever as entradas. npm run test:scripting inclui comparação da árvore com a 0.2.15 e conclusão recorrente simulada, com preservação de regras/notas/alarmes e sem segunda gravação na repetição de comando. Compilação/renderização no iPhone e recibo da Saneago continuam pendentes de verificação física.
