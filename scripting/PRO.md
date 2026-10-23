# Calendar Timeline 0.3.1

Atualize o mesmo projeto pela branch `scripting`, preservando pareamento e Keychain.
Inclui o registro local de tentativas da 0.2.15, e a correção de lembretes recorrentes no servidor 0.3.1.

- Corpo da timeline: link direto `calshow://`, sem script intermediário. Esse toque
  abre o Calendário e não sincroniza a ponte antes. Não promete abrir uma data específica.
- Dias: App Intent grava seleção local e solicita recarregar widgets de usuário,
  sem esperar rede nem abrir a tela do Scripting.
- Widget: preparação da agenda e ponte começam em paralelo. Solicita execução após
  1 minuto por padrão, configurável em 1/5/15; frequência real depende do iOS.
- Central de Controle: **Sincronizar agenda**, dentro do pareamento/escopo existentes.

## Agenda e criação

O app consulta o dia, lista eventos e lembretes datados não concluídos, identifica
sobreposições e calcula intervalos sem eventos ocupados entre 08h e 18h. Eventos
de dia inteiro e lembretes não são descontados. Não é uma prova de disponibilidade
pessoal. Falha na leitura de calendários não produz um falso dia livre.

**Resumir meu dia** usa IA local se disponível. Caso contrário prepara uma conversa
no Assistente sem envio automático. **Criar por frase** interpreta localmente ou,
somente após escolha explícita, usa o provedor configurado. O usuário revisa tipo,
título, datas, calendário/lista e confirma a gravação. Datas ausentes não recebem
horário ou duração inventados. Itens de dia inteiro usam fim exclusivo.

A criação reutiliza `executeReal`: diário persistido antes da escrita, marcador de
recuperação e confirmação por releitura. **Retomar criação pendente** reutiliza o
comando. Falha ou conflito não autoriza criar outra cópia. Não há exclusão de itens.
Instalação, abertura e consulta não criam eventos ou lembretes.

Ferramenta **Consultar agenda** compartilha com a conversa somente após aprovação
e toque. Não envia notas ou convidados. O painel Início compartilha somente
contagens/horários locais. Preferências exportáveis não incluem agenda ou pareamento.
Uma pasta externa pode ser autorizada para exportações; isso não ativa sync do Drive.

## Verificação e recuperação

Testes locais: ponte/diário anterior, conflitos/intervalos/cobertura parcial, datas
inválidas, criação com revisão e releitura simulada, seleção de dias, rede/cache,
12 cenários do motor e sete prévias Canvas. Geometria do widget foi preservada.
Não confirmados no iPhone: tipos nativos, visual, links, velocidade, Central de
Controle, notificações/IA e primeira criação desta versão. Home exige versão compatível.

Rollback: `scripting-v0.2.15-alpha.1`, preservando armazenamento/pareamento. O toque
antigo volta a passar pelo Scripting. Código vem do Git; Drive é backup privado.
