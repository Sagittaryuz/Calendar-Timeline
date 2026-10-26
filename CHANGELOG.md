## Scripting 0.3.19 — 2026-10-26

- Reduz todos os títulos para SFMono-Heavy 25,5, o maior valor uniforme validado em passos de 0,5, sem comprimir glifos.
- Centra o conjunto horizontal e verticalmente, com métricas comuns de linha e bordas DOM direita / SAB esquerda alinhadas a L2.
- Mantém os quadros originais, margens, cantos, charts, curva térmica, Bridge, dados e toques; não aplica a proposta de recuo/redimensionamento rejeitada.
- Compilação, suíte, visual, 80 cenas e pacote de 25 arquivos aprovados localmente. SFMono/WidgetKit físico pendente. Evidências em docs/header-centering-0.3.19.json.

## Scripting 0.3.18 — 2026-10-26

- Uniformiza os sete títulos em SFMono-Heavy, 38 unidades do motor, sem exceção por hoje/fundo/feriado.
- Ajusta apenas espaçamento interno e posições das linhas em DOM/SAB, mantendo seus alinhamentos por L2 e os limites externos. Não comprime os glifos.
- Mantém os cliques 0.3.17, Bridge, dados, contorno e curva térmica. Compilação, suíte, visual, 40 cenas tipográficas e pacote de 25 arquivos aprovados localmente; iOS físico pendente. Relatório: docs/header-typography-0.3.18.json.

## Scripting 0.3.17 — 2026-10-26

- Restaura abertura direta do Calendário nos charts de eventos/lembretes.
- Restringe RefreshCalendar à legenda de horas e faixa/curva térmica exportada pelo motor; preserva as sete seleções e todas as operações de desenho da 0.3.16.
- Compilação, suíte, limites em sete tamanhos, repetição e pacote de 25 arquivos aprovados localmente. Toques/abertura/arbitragem nativos no iOS pendentes. Evidências em docs/hit-areas-0.3.17.json.

## Scripting 0.3.11 — 2026-10-24

- Área invisível de atualização na legenda de horas, alinhada ao desenho real em médio/extragrande.
- Mantém seleção de dias, link e recarga global; testes locais aprovados, toque nativo pendente.

## Scripting 0.3.10 — 2026-10-24

- Remove ícone de refresh da timeline; recarga global solicitada por Codex/Popular.
- Preserva dias, links, pareamento, intenção/atalho de atualização. Testes locais aprovados; execução nativa global pendente.

## Scripting 0.3.9 — 2026-10-24

- Botão de atualização também volta a timeline para hoje, antes da consulta, inclusive quando a rede falha.
- Rótulo acessível atualizado; regressões locais aprovadas. Toque nativo pendente.

## Calendar Timeline Scripting 0.3.8 — 2026-10-24

- Botão de atualização por AppIntent no canto inferior direito, com cache preservado.
- O botão consulta a agenda/lembretes nativos, sincroniza a ponte dentro do orçamento e tenta renovar o clima sem impor o cache rápido de 15 minutos. A seleção do dia é preservada e o cache continua disponível em falhas.
- Testes locais aprovados; validação do toque nativo pendente.

## Scripting 0.3.7 — 2026-10-24

- Prioridade das cores de sábado/domingo/feriado inclusive em hoje; mesma cor no quadro, timeline e curva.
- Curva inferior esquerda do sábado independente do canto externo direito; máscara dos vizinhos mantém o offset real.
- Três linhas centralizadas verticalmente em todos os quadros.
- Verificação Canvas de sete seleções e quatro cenários de datas especiais; validação física pendente.

# Histórico da edição Scripting

## 0.3.6 — 23/10/2026

- Suporte ao widget systemExtraLarge horizontal do iPad, usando dimensões reais, proporção preservada e áreas de toque reposicionadas.
- Mantém o formato médio e o pacote de 25 arquivos; não reativa extensões Pro.
- Testes de quatro geometrias e da entrada real médio/extragrande aprovados. Verificação física em iPad pendente.


## 0.3.5 — 23/10/2026

- Retorna à estrutura de 25 arquivos da 0.2.15, retirando as extensões Pro e bundles do pacote ativo; preserva fontes e histórico.
- Motor, desenho e outros 16 arquivos são byte a byte iguais à base. Mantém só sete arquivos com diferenças pequenas: versão/textos, ponte prioritária, recorrência, intervalo e link direto.
- Testes da base e de recuperação aprovados, incluindo 18 hashes originais e conclusão recorrente sem repetição. Aceitação no iPhone pendente.


## 0.3.4 — 23/10/2026

- Recuperação com entradas autocontidas, versão embutida e namespace do SDK, preservando detalhes da 0.3.3.
- Fontes editáveis em scripting/entrypoints; geração determinística por npm run build:scripting.
- Diagnóstico independente de inicialização e diagnose.tsx para conferir arquivos, hashes e APIs sem ler agenda/credenciais.
- Testes locais do pacote distribuído aprovados. Causa exata do erro genérico e compilação/renderização no iPhone ainda não confirmadas.


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


## Scripting 0.3.3 / ponte 0.4.0 — campos detalhados

Notas em eventos e lembretes: substituir, acrescentar ao fim/início ou limpar explicitamente. Eventos: localização textual, link HTTP/HTTPS e coordenadas. Lembretes: prioridade 0 a 9. Ambos: substituir/remover alertas absolutos, relativos (segundos) ou por entrada/saída de uma região. Campos omitidos são preservados. Localização de lembretes é configurada no alerta; não há campo textual nativo documentado. Não há geocodificação automática.

A captura semanal continua sem notas, endereços ou alarmes. bridge_request_details solicita leitura pontual sem salvar o item; após execução no iPhone, bridge_get_item(includeDetails=true) retorna os detalhes e sua revisão por até 30 minutos. Edições desses campos exigem expectedDetailsRevision além da revisão principal. Mudança somente nas notas também bloqueia edição conflitante. Marcadores internos de recuperação são preservados e não aparecem nas notas compartilhadas. Clientes antigos não executam comandos detalhados (protocolo 2 necessário).

Atualize o mesmo projeto no Scripting para 0.3.1; mantenha pareamento/armazenamento. O painel Pro e a abertura direta do Calendário foram preservados. Configuração de alerta confirmada por releitura não comprova entrega da notificação; localização requer permissão e teste físico. Sem execução contínua garantida com iPhone bloqueado. Séries, participantes e exclusão permanecem fora das escritas.

Validação: SQLite real com APIs Scripting simuladas, notas Unicode/multilinha, acrescentar/limpar, localização/link/coordenadas, prioridade, alertas, conflito só nas notas, recuperação após ACK perdido, isolamento de clientes antigos e privacidade da captura semanal. Nenhum item real foi alterado durante a implantação. Falta validar novos campos e disparo dos alertas no iPhone.
