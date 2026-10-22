# Calendar Timeline para Scripting — teste 0.1.1

Versão experimental separada do Scriptable. O motor vem do arquivo Git `Calendar Timeline`, versão 2026.10.11.6. Os arquivos originais e o carregador não são alterados.

## Comportamento implementado

- Widget médio (4×2), com a geometria original de 1092×510.
- Os dias desenhados no cabeçalho recebem áreas de toque nas mesmas coordenadas. Um App Intent grava somente a seleção local e solicita a atualização do próprio widget.
- Hoje usa o instante atual; outro dia abre às 00:00 locais. Os estados de evento em andamento/atraso continuam usando o instante real, sem simular que o dia consultado é hoje.
- Ao tocar na data de hoje, a timeline volta ao instante atual. A escolha expira na próxima virada do dia, sendo aplicada na próxima execução do widget.
- Sem botão Atualizar. Solicitação automática a partir de 15 minutos, sujeita ao iOS. A navegação reutiliza o clima por até 15 minutos, preservando os timestamps das amostras; não atualiza o código.
- Calendário e Lembretes são apenas lidos. Eventos/lembretes não são criados, editados ou apagados.
- Cache privado por projeto. Permissões e credenciais do Scriptable não são transferidas para o Scripting.

## Instalação e teste no aparelho

Instale o Scripting pela App Store. Há duas opções:

1. **Arquivo de teste:** importe o ZIP da pré-release Git `scripting-v0.1.1-alpha.1` no Scripting, substituindo os arquivos do projeto experimental anterior. O ZIP contém a pasta `Calendar Timeline Scripting` com `script.json`, `index.tsx` e os módulos. Se a importação não aceitar a pasta interna, extraia o ZIP e importe essa pasta pelo app Arquivos. Confira se o projeto executado informa a versão 0.1.1.
2. **Servidor de desenvolvimento:** no computador, dentro de `scripting/`, execute `npx --yes scripting-cli@1.5.0 start --editor=none --port=4317 --no-auto-open`. Conecte o Scripting ao IP do computador exibido no terminal; ambos precisam estar na mesma rede. Selecione o projeto `Calendar Timeline Scripting` que aparece na lista de projetos do servidor. O CLI usa `scripts/` e recebe os tipos `.d.ts` da versão conectada.

Execute o projeto uma vez no aplicativo e conceda as permissões nativas de Calendário, Lembretes e Localização. Adicione um widget médio do Scripting à Tela de Início e escolha `Calendar Timeline Scripting`. Confira os toques no widget real, pois a prévia não comprova o comportamento do WidgetKit.

Para atualizar o código, use nova pré-release rastreável do Git ou os arquivos sincronizados deste checkout. Não há `eval` nem download de código durante a execução do widget. Para voltar atrás, selecione novamente o widget Scriptable existente; a instalação dele fica preservada.

## Arquitetura

- `tools/build-scripting.cjs`: deriva o módulo do motor e os textos diagonais a partir do original versionado; inclui seu SHA-256 no arquivo gerado.
- `original-engine.js`: seleção, prioridades, cálculos meteorológicos e geometrias originais. Não editar à mão.
- `drawing.js` e `graph-view.tsx`: traduzem DrawContext/Path para Canvas e camadas recortadas do Scripting, mantendo ordem de desenho.
- `rect-raster.js`: agrupa sequências longas de pequenos retângulos em bitmaps PNG locais, na resolução lógica original. Reduz o tráfego de comandos entre JavaScript e as camadas nativas; textos, caminhos e áreas de toque continuam separados.
- `host.ts`: adapta APIs de calendário, lembretes, localização, rede, formatação e cache privado.
- `selection.ts` e `app_intents.tsx`: validam a data e persistem a seleção; entradas fora de ±7 dias são rejeitadas.
- `widget.tsx`: entrada WidgetKit; `index.tsx`: inicialização de permissões e informações de instalação.

## Privacidade e destinos

Nenhum título, nota ou conteúdo do calendário/lembretes é enviado a servidores. O clima consulta Open-Meteo e MET Norway com coordenadas. Feriados podem consultar IBGE/BrasilAPI e os arquivos públicos do projeto joaopbini/feriados-brasil no GitHub; geocodificação usa a API nativa. As credenciais opcionais de Foreca/Rainbow do Scriptable não estão disponíveis neste app e não são exportadas ou incluídas no pacote. O adaptador restringe a rede a uma lista de hosts HTTPS. O pacote contém somente código, sem snapshots de dados pessoais.

## Correção de desempenho 0.1.1

O usuário confirmou que a versão anterior apareceu na prévia do aplicativo, com demora, mas permaneceu como placeholder na Tela de Início. Sem logs do aparelho, não foi possível determinar se a extensão foi encerrada por tempo, memória ou outro erro.

A inspeção confirmou um gargalo da adaptação: gradientes e restauração do fundo geravam dezenas de milhares de comandos nativos de retângulos. Nos mesmos dez cenários sintéticos, o máximo caiu de 77.388 para 498 operações após agrupar essas sequências em imagens. A ordem de desenho foi preservada e o PNG foi decodificado independentemente em testes. Isso não mede memória nem velocidade no iPhone; continuam existindo até 80 camadas nos cenários testados.

As consultas agora têm limites de espera: no widget, até 5 segundos por consulta de agenda, 2 segundos para obter localização e até 3 segundos por requisição de rede, respeitando uma janela de rede de 6 segundos desde a criação do adaptador. Essas etapas podem se sobrepor ou ocorrer em sequência; não representam um prazo total de renderização. Uma consulta nativa que excede o limite pode continuar internamente. Os caches existentes são reaproveitados quando disponíveis.

O aplicativo mostra o tempo de preparação do modelo e a versão instalada. O armazenamento local mantém fase/tempo de preparação e eventual erro da entrada do widget; a fase `present-requested` confirma apenas a chamada de apresentação, sem provar que o iOS exibiu o widget. Não há botão Atualizar nem envio desses diagnósticos a servidores.

## Validação e limites conhecidos

Passaram as verificações locais de sintaxe TS/TSX, seleção/expiração de data, rejeição de entradas inválidas, mapeamento das APIs nativas por mocks, permissão negada, cache e lista de destinos. O motor completo foi executado com dados sintéticos em dez cenários de dias, fim de semana e virada de ano; as operações Canvas foram percorridas e verificadas. As suítes existentes de movimento do cabeçalho e prioridade da agenda também passaram.

**Confirmado pelo usuário na versão anterior:** a timeline apareceu na prévia dentro do Scripting, mas não na Tela de Início. **Ainda não confirmado na 0.1.1:** substituição dos arquivos no iPhone, tipos da versão instalada do Scripting, Canvas/efeitos no WidgetKit real, acesso às fontes, tempo de resposta, memória e fidelidade visual 1:1. Os testes locais usam mocks das APIs nativas.

Diferenças que exigem conferência visual antes de aprovar a migração:

- O desfoque original reduz/amplia um bitmap; o adaptador usa desfoque gaussiano nativo numa camada isolada. Não são algoritmos pixel a pixel equivalentes.
- Fontes e suas métricas são resolvidas pelo Canvas nativo. Nomes/fallbacks e alinhamento podem diferir do Scriptable.
- O Canvas do Scripting documenta `strokeText` como preenchimento, sem contorno real. Os textos diagonais usam a tipografia/cálculos do original, mas seus contornos precisam ser comparados.
- A memória e a profundidade das camadas devem ser medidas no iPhone. Não há promessa de atualização instantânea.
- A composição dos retângulos usa cobertura fracionária por pixel; a suavização de bordas precisa ser comparada com o rasterizador do Scriptable no aparelho.

Esta pré-release é um candidato de teste, não uma reprodução fiel homologada. A migração não está concluída até passar pela Tela de Início no aparelho.

## Reproduzir verificações locais

```powershell
node tools/build-scripting.cjs
node tests/scripting-engine.cjs
$env:RASTER_BATCH='1'
node tests/scripting-engine.cjs
Remove-Item Env:RASTER_BATCH
node tests/scripting-raster.cjs
# TYPESCRIPT_PATH pode apontar à instalação de TypeScript já disponível no computador.
node tests/scripting-contract.cjs
node tests/header-shared-motion.cjs
node tests/agenda-priority.cjs
```

Documentação consultada: https://scriptingapp.github.io/llms.txt — Canvas, UIImage, CalendarEvent, Reminder, Location, DateFormatter, Storage, Keychain, fetch, Button, Widget, AppIntent, Script, ZStack, position, clipped e blur. Skill oficial de desenvolvimento: https://github.com/ScriptingApp/scripting-app-development.
