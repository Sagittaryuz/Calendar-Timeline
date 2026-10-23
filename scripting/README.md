## 0.2.12 — consulta real do iPhone e leitura por marcador

Atualize o mesmo projeto no Scripting e abra-o. Sem refazer o pareamento, sem Atalhos e sem Google Agenda. A ponte privada compartilha a semana atual e próxima (segunda a segunda, fim exclusivo), em modo de consulta: títulos, calendários/listas, datas, horários e conclusão dos lembretes disponíveis ao Scripting. Notas, convidados, locais e URLs não são enviados. Lembretes sem data e futuras ocorrências ainda não concretizadas pela API ficam fora.

O teste passa a ser localizado pelo marcador exclusivo em todos os calendários na janela de busca, com comparação de versões e religação segura quando o identificador muda. Não há título forçado para EDITADO. A versão real do iPhone precisa ser confirmada após a atualização; os testes locais simulam APIs nativas.

O serviço privado 0.2.0 adiciona `bridge_list_agenda`, com paginação e indicação de cobertura, erro, truncamento e idade da captura. `bridge_get_status` inclui a primeira página da próxima semana. Escritas continuam exclusivas dos dois testes. O desenho do widget é preservado. Consulte [BRIDGE.md](BRIDGE.md) para arquitetura, campos e limites atuais. As seções abaixo registram versões anteriores.

## 0.2.10 — centralização dos quadros e destaque de hoje menor

As três linhas são centralizadas horizontalmente em todos os quadros, incluindo domingo e sábado. A primeira linha e as temperaturas usam alinhamento nativo ao centro dos seus retângulos, sem depender de estimativas para posicionar o texto. O conjunto permanece na posição inferior adotada na 0.2.9. O limite superior da fonte de hoje passa de 42 para 36 unidades de referência (na prévia: 41 para 38 unidades do desenho), mantendo sua hierarquia.

A tela agora identifica a origem da última sincronização automática: abertura do projeto, toque na timeline, seleção de dia ou execução do widget. O servidor atual informa o último contato, mas não armazena essa origem. Portanto, um contato após usar também o botão manual não comprova isoladamente a atualização periódica em segundo plano.

Verificação real em 23/10/2026: a API da ponte recebeu o título do evento com EDITADO e o lembrete concluído; último contato observado às 10:58:37 de São Paulo. O usuário informou ter usado também o botão manual. A leitura do título editado está confirmada; a execução periódica sem interação ainda precisa ser observada separadamente.

Validação local desta versão: sete composições Canvas, centralização das três linhas, tamanho menor de hoje, limites da moldura, contrato do widget e regressão da leitura/execução automática simulada. Tipografia final depende da renderização no iPhone.

## 0.2.9 — cabeçalhos maiores e mais abaixo

A primeira linha dos sete quadros ganha destaque (na prévia: 28 em vez de 21 unidades); hoje pode crescer ainda mais até os limites do próprio quadro. Os demais dias usam o mesmo tamanho, inclusive sábado e domingo. A segunda linha passa de 19 para 22 unidades e a terceira de 16 para 17 na referência local. O grupo fica ancorado perto da base do quadro, com espaçamentos compactos: temperaturas e contagens permanecem alinhadas nos sete dias. Mantém o ícone entre máxima/mínima e os alinhamentos especiais dos fins de semana. O encaixe considera a moldura externa e impede o aumento quando não cabe.

Prévia Canvas local aproximada, com verificação de hierarquia, posição inferior, alinhamentos, ícones e recortes. Fontes e encaixe final precisam de conferência no iPhone.

## 0.2.8 — atualização pelo toque e ponte automática sem Atalhos

- O corpo do widget executa uma nova instância do mesmo projeto (`scripting://run_single/Calendar%20Timeline%20Scripting?refresh=1`), tenta sincronizar os dois itens do piloto, prepara os dados locais, solicita o redesenho e abre `calshow://`. Há uma passagem pelo Scripting. Falha da ponte não bloqueia a tentativa de atualização local nem o destino Calendário.
- A ponte também roda automaticamente ao abrir o projeto, ao selecionar um dia e quando o iOS executa o widget. As sete áreas de dia e o desenho foram preservados. Não é necessário configurar o app Atalhos.
- Uma rodada automática exige o pareamento e o consentimento já guardados neste projeto. O escopo continua sendo somente os dois itens sintéticos `[CT TESTE]`. O widget não abre diálogos de autorização.
- Rodadas do widget têm orçamento de rede de 4,5 segundos; toque no corpo usa 6,5 segundos e abertura do app usa 8 segundos. Chamadas nativas podem acrescentar duração. Execuções automáticas sem toque são espaçadas em pelo menos um minuto; não há loop de recarga. A solicitação periódica do widget continua a partir de 15 minutos, sujeita ao iOS. Isso não garante execução contínua ou imediata com tela bloqueada.
- A leitura do evento passou a consultar novamente seu calendário por um intervalo limitado de 30 dias, conferindo o identificador e o marcador da prova. Não reenvia a cópia de `get(id)` como atual se a nova consulta falhar. Eventos pessoais encontrados localmente não são enviados. Um título EDITADO só é confirmado quando for recebido do aparelho; não é preenchido pelo código.
- Sem comandos, uma única requisição transmite o snapshot e consulta a fila. Quando há gravações, diário, caixa de saída, reserva e releitura continuam ativos. Pendentes não são apresentados como aplicados.
- A tela do projeto mostra o último título de evento realmente lido, o estado do lembrete e o resultado automático; o conteúdo pode ser rolado.

Validação local: callbacks do widget, degradação offline, limite de rede, consentimento, espaçamento de tentativas, snapshot contendo EDITADO com `get(id)` antigo, lembrete concluído, exclusão de registros pessoais do envio, recusa de vínculo ambíguo/alterado, contrato do widget e 12 renderizações do motor. Teste com o cliente atualizado + serviço real em SQLite local confirmou criação, leitura, edição manual, conclusão/reabertura, recuperação de ACK perdido e conflito, com APIs nativas simuladas. Toque, permissões de extensão, leitura no iPhone e frequência em segundo plano ainda dependem do aparelho.

Rollback: instalar a release 0.2.7 preservando o armazenamento/Keychain do mesmo projeto. Não refaça o pareamento para atualizar código.

## 0.2.7 — retorno visível do botão da ponte

Corrige o uso de Dialog conforme o exemplo oficial (global nativo). O botão usa callback assíncrono com andamento/erro/resultado na própria tela, sem abrir uma apresentação de resultado sobre a página atual. Toques repetidos são bloqueados enquanto há uma execução. O erro também fica visível se o diálogo falhar. Testes executam os callbacks reais com adaptadores simulados; não comprovam UI/rede no iPhone. O estado do servidor ainda não tinha contato confirmado na publicação desta versão. Pareamento e fila existentes foram preservados.

## 0.2.6 — ponte incluída no widget

Atualize o projeto existente pelo Git no Scripting. Na tela do aplicativo, toque em **Ponte com ChatGPT** para parear e executar a prova. Não é necessário outro projeto. Veja [BRIDGE.md](BRIDGE.md). O pareamento inicial ainda é necessário. O desenho do widget foi preservado e não aguarda a rede da ponte.

# Calendar Timeline para Scripting — teste 0.2.5

Versão experimental separada do Scriptable. O motor vem do arquivo Git `Calendar Timeline`, versão 2026.10.11.6. Os arquivos originais e o carregador não são alterados.

## Comportamento implementado

- Widget médio (4×2), com a geometria original de 1092×510.
- Os dias desenhados no cabeçalho recebem áreas de toque nas mesmas coordenadas. Um App Intent grava somente a seleção local e solicita a atualização do próprio widget.
- Sete cartões fixos de domingo a sábado, recuperados do commit `3bcb13b` (geometria e três linhas). A semana se ancora na data real; a seleção destaca um dos sete dias sem transladar o cabeçalho.
- Qualquer dia, inclusive hoje, mostra de 00h até a próxima meia-noite local. A régua não acompanha o relógio. Estados de evento em andamento/atraso continuam usando o instante real, sem simular que o dia consultado é hoje.
- A seleção expira na virada do dia e retorna a hoje na próxima execução. Datas fora da semana exibida são rejeitadas.
- Sem guias/legendas de contagem regressiva dos eventos e sem cápsula de contagem até o fim do dia. A contagem de chuva do motor original permanece.
- Sem botão Atualizar. Solicitação automática a partir de 15 minutos, sujeita ao iOS. A navegação reutiliza o clima por até 15 minutos, preservando os timestamps das amostras; não atualiza o código.
- Calendário e Lembretes são apenas lidos. Eventos/lembretes não são criados, editados ou apagados.
- Cache privado por projeto. Permissões e credenciais do Scriptable não são transferidas para o Scripting.

## Instalação e teste no aparelho

**0.2.5 — tipografia uniforme e encaixe dos fundos:** os sete títulos usam um único tamanho de fonte, calculado em conjunto para caber também nas extremidades do contorno externo. Mantém as temperaturas e contagens centralizadas e os alinhamentos especiais da primeira linha no domingo/sábado. O ajuste comum pode reduzir a fonte em relação aos títulos maiores da versão anterior; nenhum fim de semana recebe uma redução individual.

Os seis cartões não selecionados agora têm máscara independente, com furo correspondente ao contorno selecionado expandido pela metade do traço mais o espaçamento padrão dos cartões (1,2287 unidades). O deslocamento segue as normais da polilinha da superelipse real, em vez de reduzir raios de círculos. Isso preserva as cores e remove os preenchimentos perpendiculares que encobriam as curvas do fundo selecionado. O mesmo recorte se aplica à borda, aos textos e ícones dos cartões; a máscara externa do widget permanece. Testes locais cobrem sete seleções, igualdade de fonte, os dois lados das junções, afastamento da máscara, cores, recorte e regressão da agenda. A carga sintética com clima manteve 893 operações, passando de 10 para 17 camadas Canvas; memória e desempenho nativos precisam de conferência no iPhone.

**0.2.4 — ícone do clima, contagens maiores e eventos no dia correto:** restaura a condição climática representativa de cada dia entre a máxima e a mínima, usando os desenhos originais e somente quando há previsão disponível. A terceira linha passa de 10 para até 15 unidades lógicas, limitada à largura do cartão. Preserva os alinhamentos de domingo/sábado e o recorte externo.

Corrige também a extensão indevida de eventos de hoje ao navegar: a consulta de hoje se refere ao dia real, mas a compatibilidade de término usava o fim do dia selecionado. Ao selecionar sexta no dia 22, eventos de quinta eram estendidos até sábado. Agora essa regra usa a meia-noite seguinte ao dia real. Regressão pelo carregamento completo verifica dois eventos de quinta ausentes na sexta, evento próprio de sexta, eventos de vários dias e eventos com horário atravessando a meia-noite. A prévia local confirma os sete ícones entre temperaturas e a terceira linha maior. O resultado nativo desta versão ainda requer conferência no iPhone.

**0.2.3 — hierarquia do cabeçalho e corte de excessos:** remove os dois caminhos que desenhavam o círculo inferior com o dia da semana, sem substituto. A primeira linha agora mostra dia e número da data em fonte maior; a segunda contém máxima (vermelha) e mínima (azul), centralizadas; a terceira mostra `E: X | L: Y` em fonte pequena, centralizada. Domingo alinha a borda direita da primeira linha com a segunda, e sábado a borda esquerda. O tamanho da primeira linha se adapta nas extremidades para respeitar o contorno. O mês sai da primeira linha para dar espaço ao destaque solicitado.

O gráfico completo tem uma máscara nativa Canvas pelo contorno externo, que corta os prolongamentos das imagens/caminhos e textos aninhados; ela não altera as áreas de toque. Os textos do cabeçalho também têm recorte nas áreas de seus cartões. O teste local confirma transparência em amostras fora do contorno e verifica alinhamentos, três linhas, destaque tipográfico, contagem menor e remoção do círculo. O contrato da UI verifica o Canvas usado na máscara. A máscara é documentada no Scripting (`mask: VirtualNode`), mas a execução final, fontes e recorte nativo da 0.2.3 ainda precisam de teste no aparelho.

**0.2.2 — correção da interpretação da curva e novos toques:** a curva pedida é a junção externa entre o cartão selecionado e a timeline, não um arredondamento independente do fundo de cada cartão. A moldura branca agora é um único caminho fechado que envolve o cartão e todo o painel, com junções curvas simétricas à esquerda/direita em dias úteis. Sábado/domingo preservam a exceção de junções retas. Os demais cartões voltam à geometria inferior anterior. O blur foi retirado de todos os dias por pedido do usuário. Permanecem fundos, cores de origem dos charts/linhas, posição fixa dos sete dias e marcador verde em hoje.

O desenho de fundo usa um `Link` com `calshow://` (o mesmo destino do original) para abrir o Calendário da Apple. Os sete botões de dia ficam acima do link e mantêm seus App Intents de seleção. O código não promete abrir uma data específica no Calendário. Foram verificados localmente a árvore de UI (um link de fundo + sete intents independentes), os dois arcos de junção na trajetória da moldura, os limites do canvas e ausência de blur. A abertura real do aplicativo e a disputa de toques entre Link/Buttons ainda precisam de reteste no iPhone. As prévias Canvas locais continuam aproximadas.

**0.2.1 — revisão visual:** todo o painel da timeline recebe blur nativo quando a data escolhida não é hoje; os sete cartões permanecem legíveis e interativos. Hoje usa preto, outros dias úteis usam o cinza `#3B3C3E`; fins de semana e feriados não atuais preservam suas cores especiais. Charts mantêm sua cor de origem mesmo durante eventos em andamento, sem preenchimento branco por estado. As cores rgba são normalizadas antes de entrar no motor; cores antigas com prefixo `#rgba(...)` também são recuperadas. As linhas de início seguem a cor do evento/lembrete. O marcador verde indica a hora real somente em hoje, na última execução; ele não desloca a régua nem garante atualização contínua entre execuções do iOS.

Os cartões úteis têm os dois cantos inferiores curvos; sábado/domingo têm junções inferiores retas. O bloco de três linhas é centralizado em cada cartão e sobe em relação à antiga compensação para o contorno móvel. O deslocamento/compressão horizontal `shiftWidgetImage` do original foi desabilitado nesta edição: desenho e áreas de toque agora usam diretamente o mesmo canvas final. A moldura externa é um contorno único, com traço dentro de `[0,1092] × [0,510]` e margem lógica de 4 unidades. O recorte físico do iOS pode variar com aparelho, escala e versão; não foi calibrado em um dispositivo nesta revisão.

`tests/scripting-visual.cjs` gera prévias locais aproximadas por Canvas para hoje, outro dia útil e sábado. Verifica blur integral, fundos, cores das linhas, marcador atual, centralização vertical das três linhas e pontos da moldura dentro do canvas. Essas imagens usam fontes/renderizador locais, não são capturas do Scripting nem comprovação de fidelidade no iPhone.

**0.2.0:** atualização no mesmo vínculo remoto, com semana fixa e seleção por App Intent. A 0.1.4 foi confirmada pelo usuário na Tela de Início. A 0.2.0 passou nos testes locais: sete áreas de toque fixas em todos os dias da semana e em dois horários reais, janela diária completa, ausência das contagens removidas e motor com/sem clima. O comportamento nativo dos toques e o visual da 0.2.0 ainda precisam de reteste. A cor `rgba(255, 0, 0, 1.00)` registrada no aparelho agora é convertida para hexadecimal e alpha; o teste reproduz esse valor. Os arquivos originais do Scriptable ficam preservados.

**Proteção 0.1.4:** a captura do iPhone confirmou `Cor raster inválida` no brilho solar na 0.1.3. A causa numérica exata não foi reproduzida nos testes locais ampliados: 24 cenários, incluindo 15h18, clima vazio e clima sintético com sol/chuva. Cores/alpha inválidos agora são omitidos do bitmap, com contagem e primeiro valor em `raster-warnings`, exibidos no app. Isso evita abortar a agenda por uma pintura inválida; se houver avisos, parte do visual pode faltar. Não equivale a confirmar a causa nem a fidelidade visual. Nenhum dado de agenda entra nesse registro. Com clima sintético, o máximo local foi 1.502 operações e 80 camadas, contra 498 operações nos cenários sem clima. Consumo de memória, tempo e execução na Tela de Início continuam sem medição no aparelho.

**Correção 0.1.3:** o diagnóstico no iPhone confirmou `undefined is not an object (evaluating 'scripting_1.Data.fromUint8Array')` durante a preparação do desenho na 0.1.2. O adaptador importava utilitários nativos pelo módulo de UI, mas esses utilitários são usados como globais nos exemplos oficiais. Foram removidas essas importações do adaptador e a importação de `UIImage` do componente de desenho. O teste agora separa os globais do módulo de UI e exercita a conversão PNG no adaptador, para não mascarar novamente esse erro. A execução nativa após a correção ainda depende de reteste no iPhone.

**Importação remota:** use `https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting`. A branch `scripting` é o canal de distribuição. A versão 0.1.2 substitui o aviso genérico de permissões pelo erro e pela etapa de preparação, somente no aparelho. As capturas anteriores confirmaram que Calendários, Lembretes e Localização estavam habilitados; não confirmaram a causa da falha. A correção funcional depende do erro real retornado nesta versão. Importe/atualize pelo vínculo remoto e confira a versão antes de testar; não há confirmação de atualização automática no aparelho.

Instale o Scripting pela App Store. Há duas opções:

1. **Arquivo de teste:** importe o ZIP da pré-release Git `scripting-v0.2.5-alpha.1` no Scripting, substituindo os arquivos do projeto experimental anterior. O ZIP contém a pasta `Calendar Timeline Scripting` com `script.json`, `index.tsx` e os módulos. Se a importação não aceitar a pasta interna, extraia o ZIP e importe essa pasta pelo app Arquivos. Confira se o projeto executado informa a versão 0.2.5.
2. **Servidor de desenvolvimento:** no computador, dentro de `scripting/`, execute `npx --yes scripting-cli@1.5.0 start --editor=none --port=4317 --no-auto-open`. Conecte o Scripting ao IP do computador exibido no terminal; ambos precisam estar na mesma rede. Selecione o projeto `Calendar Timeline Scripting` que aparece na lista de projetos do servidor. O CLI usa `scripts/` e recebe os tipos `.d.ts` da versão conectada.

Execute o projeto uma vez no aplicativo e conceda as permissões nativas de Calendário, Lembretes e Localização. Adicione um widget médio do Scripting à Tela de Início e escolha `Calendar Timeline Scripting`. Confira os toques no widget real, pois a prévia não comprova o comportamento do WidgetKit.

Para atualizar o código, use nova pré-release rastreável do Git ou os arquivos sincronizados deste checkout. Não há `eval` nem download de código durante a execução do widget. Para voltar atrás, selecione novamente o widget Scriptable existente; a instalação dele fica preservada.

## Arquitetura

- `tools/build-scripting.cjs`: deriva o módulo do motor e os textos diagonais a partir do original versionado; inclui seu SHA-256 no arquivo gerado.
- `original-engine.js`: seleção, prioridades, cálculos meteorológicos e geometrias originais. Não editar à mão.
- `drawing.js` e `graph-view.tsx`: traduzem DrawContext/Path para Canvas e camadas recortadas do Scripting, mantendo ordem de desenho.
- `rect-raster.js`: agrupa sequências longas de pequenos retângulos em bitmaps PNG locais, na resolução lógica original. Reduz o tráfego de comandos entre JavaScript e as camadas nativas; textos, caminhos e áreas de toque continuam separados.
- `host.ts`: adapta APIs de calendário, lembretes, localização, rede, formatação e cache privado.
- `selection.ts` e `app_intents.tsx`: validam a data e persistem a seleção dentro da semana exibida; cada toque solicita a execução do widget, que relê agenda e lembretes.
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
