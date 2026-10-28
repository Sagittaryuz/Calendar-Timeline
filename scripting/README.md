## Atualização 0.3.31 — navegação sem refresh e regiões pelos charts

Todos os toques do widget deixam de solicitar refresh: as áreas antigas de curva/horas não têm mais Button/AppIntent de atualização. O Calendário usa Link direto `calshow://`, sem iniciar o projeto, buscar dados ou aguardar preparação. Os nomes de intents antigos permanecem registrados somente como compatibilidade e abrem Calendário uma vez, sem Storage, seleção, modelo ou reload. O link legado `refresh=1` também apenas navega. Flags antigos de clima forçado ficam preservados, mas são ignorados pelo widget. A execução normal do iOS continua carregando os dados locais e solicitando a próxima atualização; não foi aplicada outra otimização do modelo.

O divisor é a borda inferior do último chart efetivamente desenhado, considerando suas coordenadas finais, segmentos entre dias, overflow e eventual contorno externo. Uma região vai do topo do desenho até esse limite e abre Calendário; a inferior fica reservada ao Weathergraph. Sem charts visíveis, usa-se o fim lógico reservado ao bloco de eventos (388,5266 no canvas atual), estável nos cenários testados. Os alvos são adjacentes, sem sobreposição de área, escalados pela mesma transformação do desenho em iPhone/iPad. Nenhum retângulo colorido foi acrescentado ao widget; as cores da prévia são guias de hitbox.

**Pendência específica: Weathergraph.** Não foi localizada uma rota verificável de abertura da tela principal na documentação pública/FAQ ou neste projeto. O arquivo oficial de associação de links identifica o app, mas cobre apenas `/in-app-events/*`; não foi inventado um evento, um esquema customizado ou um link para a loja. A região inferior permanece sem ação até existir uma URL oficial ou um atalho de abertura existente e confirmado. Nenhum outro aplicativo a substitui; nenhum app foi instalado. Fontes consultadas: [site/FAQ oficial](https://weathergraph.app/), [associação oficial](https://weathergraph.app/.well-known/apple-app-site-association).

As duas linhas de domingo se deslocam juntas **+5 unidades de canvas**; sábado, **−5**. Alinhamento interno domingo direita/sábado esquerda, pesos, fonte 38 e demais dias permanecem. As caixas de linha conservam o mesmo eixo vertical; apenas a translação horizontal foi solicitada. Layout dos quadros, moldura contínua, curvas/gap, cores, blur, dados locais e Bridge removida permanecem.

Validação: suíte ativa aprovada, 11 módulos compilados/importados e pacote de 16 arquivos verificado. Regiões: 72 cenas, 2.016 pontos em sete dimensões e 24 comparações com operações de desenho idênticas à 0.3.30; casos vazios, um/seis itens, overflow, aniversário, fora da janela, início próximo e passagem de data. Cabeçalhos: 96 cenas/672 quadros/4.704 escalas, translação e bordas relativas verificadas, sem cortes no modelo local. Caminhos legados: 31 navegações sem preparação, refresh ou mutação de armazenamento. A conferência de moldura/curvas e fontes também passou. [Registro e hitboxes](../docs/touch-regions-0.3.31.json).

Preview com dados fictícios e fontes desktop aproximadas; sem teste físico iOS. A arbitragem exata na borda compartilhada e o momento do novo render são do sistema. A abertura do Weathergraph não foi executada, pelo bloqueio acima; o restante foi implementado e publicado no canal estabelecido.

## Atualização 0.3.30 — agenda local, sem Bridge; títulos maiores

Retirada a integração Calendar Timeline Bridge da abertura, do render do widget e do refresh. Nove módulos de configuração, sincronização, captura/upload da agenda, leitura remota, filas e processamento de comandos saíram do pacote. Os botões e o painel da ponte também foram retirados. O refresh solicita a atualização local sem esperar sincronização remota. Clima, leitura nativa de eventos/lembretes e cache local continuam funcionando; não foi aplicada outra otimização da pesquisa anterior.

Migração não destrutiva: a entrada `intent.tsx` usada por atalhos antigos informa que a Bridge foi desativada, sem ler credenciais, consumir comandos, enviar ACKs ou executar gravações nativas. Links antigos com `bridge=1`/`configure=1` chegam à tela local, sem painel de pareamento. Storage/Keychain de credenciais, journals e outboxes ficam preservados e inertes; eventos/lembretes do iPhone, dados remotos e grants não foram apagados/revogados. Caso uma importação mescle arquivos antigos, as entradas novas não importam os módulos órfãos. A mudança vale nas execuções da nova versão; atualizar código não cancela retroativamente uma execução anterior. Atualize o mesmo projeto pelo vínculo remoto, sem apagar dados nem reinstalar. O plugin iCloud e outros projetos não foram alterados.

A primeira linha dos sete quadros passa de **29 para 38** (+31%), com os mesmos pesos Avenir Next Condensed Demi Bold/Heavy e destaque adicional de hoje, sem círculo. A segunda linha conserva fontes/tamanhos/cores e mínima à esquerda/máxima à direita. O agrupamento continua centralizado horizontal e verticalmente nas caixas comuns de cada quadro; hoje segue o mesmo padrão. Domingo conserva a borda direita interna e sábado a esquerda, sem qualquer inversão dos alinhamentos. Fonte 38 deixou 5,18 unidades de folga mínima no modelo local; 40 deixou apenas 0,50 e 42 cortou conteúdo. Não se alteraram quadros, margens, raios, gap, curva/moldura contínua, charts, blur ou interações de navegação.

Validação: suíte completa aprovada, 11 módulos compilados/importados e pacote de 16 arquivos com CRC e conteúdo conferidos. A árvore de dependências de todas as entradas não inclui Bridge nem o endpoint de comandos. Testes com credenciais/filas fictícias pré-existentes verificam 20 refreshes, atalhos antigos, ausência de rede/escrita nativa, preservação de estado e leitura local. Renderer/adaptador/clima/rotas de navegação são idênticos à 0.3.29; o motor difere somente no tamanho da primeira linha. Há 96 cenas/672 cabeçalhos/4.704 escalas, 24 cenas de alinhamento, 63 cenas de curvas e 59 de continuidade da moldura.

Desempenho sintético: a intenção anterior aguardou ~3,206 s com uma Bridge artificial de 3,2 s; a versão nova não a chamou, e 20 pedidos locais somaram ~0,48 ms neste executor. Isso comprova a retirada da dependência, não mede interação nativa, desenho completo ou tempo de atualização no iPhone. EventKit/clima/desenho e escalonamento iOS ainda têm seus próprios custos; não se promete instantaneidade. Preview com dados fictícios e fontes desktop aproximadas; não houve teste físico desta versão.

[Retirada e migração](../docs/local-only-0.3.30.json) · [Métricas dos títulos](../docs/header-size-0.3.30.json). As seções anteriores descrevem versões históricas; as funcionalidades da Bridge nelas mencionadas não estão ativas na 0.3.30. Os testes antigos exclusivos da integração permanecem como histórico no Git e saíram da suíte ativa.

## Atualização 0.3.29 — faces reais e peso tipográfico

O original Scriptable usa fábricas de fonte de sistema (por exemplo, `blackRoundedSystemFont`), que escolhem família e peso nativamente. O adaptador vinha substituindo essas fábricas por nomes como `SFProRounded-Black` e `SFMono-Heavy`, enviados ao Canvas apenas como `{name,size}`. Isso não transmite a semântica de peso de sistema e depende de uma face customizada resolver pelo nome. Além disso, os títulos dos dias comuns pediam explicitamente Regular. O fallback regular observado no aparelho é uma hipótese compatível; não houve inspeção do resolvedor UIKit/SwiftUI neste executor. As prévias antigas mapeavam esses nomes a fontes desktop Bold, portanto não comprovavam a resolução real no iPhone.

A ponte agora resolve os aliases para faces públicas de iOS: Menlo Bold/Regular, Avenir Next Heavy/Bold/Regular e Helvetica Neue Bold/Medium. O mesmo resolvedor é usado em `measureText` e `fillText`, sem campos de peso não documentados e sem duplicar texto para engrossá-lo. O caminho diagonal já usa a face CondensedBlack explícita e permanece igual. Os charts que pediam Black Rounded recebem Avenir Next Heavy. O primeiro título usa Avenir Next Condensed Demi Bold nos dias comuns e Heavy em hoje, mantendo fonte **29** e sem círculo. A variante condensada permite peso real sem reduzir tamanho nem alterar os quadros; as posições são recalculadas a partir das novas métricas, com um espaço comum medido nos dois pesos. Domingo mantém a borda direita interna; sábado, a esquerda; cada bloco permanece centralizado.

Nenhuma conversão de cores, alpha, tamanho ou escala foi alterada. As diferenças de aparência entre os renderizadores também podem envolver rasterização/antialiasing; não se comprovou um defeito RGB nem se prometeu equivalência física entre eles. Raio, gap 1,2287, temperaturas mínima/máxima, moldura contínua 0.3.28, blur, movimento, Bridge e toques preservados. Não foi aplicada nenhuma proposta da pesquisa de desempenho.

Validação: todos os testes da suíte aprovados, incluindo contrato de faces até o Canvas, 96 cenas/672 cabeçalhos/4.704 escalas, 24 cenas de espaços/alinhamentos, 63 cenas de curvas e 59 de continuidade da moldura. Folga mínima no modelo desktop: 7,61 unidades. Teste raster com Barlow/Open Sans confirma maior densidade das faces fortes; isso não mede Avenir/Menlo no iOS. Comparação de comandos gravados mantém cores/alpha e geometria. Compilação/importação de 20 módulos e pacote de 25 arquivos validados.

Benchmark existente, uma rodada comparável de três repetições: motor 173,3→179,0 ms e replay local 67,7→70,1 ms; mesmas 98 camadas de desenho, 11.329 chamadas ao backend e 5,05 MB de PNGs. Variação de executor, sem inferência estatística ou extrapolação para o aparelho. A correção não acrescenta passagens de texto.

[Registro, métricas e comparação](../docs/font-weight-0.3.29.json). Preview com DejaVu, Open Sans e Barlow, dados fictícios e pesos intencionais simulados antes/depois; não reproduz o fallback físico nem executa SF/Avenir no iPhone. Fonts Barlow/OFL são somente fixtures de teste e não entram no pacote. Fontes primárias: [Canvas Scripting](https://scriptingapp.github.io/guide/Changelog/3.1.0/Canvas%20(Web%202D%20drawing%20context)/), [FontPicker/PostScript](https://scriptingapp.github.io/guide/Device%20Capabilities/FontPicker), [catálogo de fontes Apple](https://developer.apple.com/fonts/system-fonts/). Atualize pelo vínculo remoto existente, preservando dados e pareamento.

## Atualização 0.3.28 — continuidade da linha superior

A captura física enviada foi materializada e inspecionada. O vão aparece quando a divisória de meia-noite avança para a esquerda da curva inferior esquerda do quadro fixo de hoje: o traçado recortado deixava intencionalmente dois contornos separados. Agora o próprio traçado branco recebe somente a ligação horizontal entre essas extremidades, calculada pela geometria existente, sem coordenadas fixas da captura. Quando os contornos já se tocam, nenhum segmento é acrescentado. A ligação respeita o limite externo do widget no último minuto do dia.

A moldura inferior continua restrita ao período de hoje; não se retomou o perímetro completo de amanhã. Sem preenchimento adicional, segunda camada ou mudança de espessura. Curvas, raios, gap dos quadros, títulos, fonte 29, cores/negrito, mínima/máxima, blur, movimento, dados, Bridge e ações permanecem idênticos.

Validação: 59 cenas nos sete dias, antes/durante/depois do contato, último minuto, virada semanal e de ano; 21 estados com vão corrigido. Comparação com a 0.3.27 confirma todos os demais comandos e bitmaps idênticos, uma única operação de contorno branco, cobertura única da ligação e nenhuma extensão da borda inferior para amanhã. Compilação/importação de 20 módulos e pacote de 25 arquivos validados. [Registro e medidas](../docs/frame-continuity-0.3.28.json). A comparação usa dados fictícios e DejaVu Mono; a captura original foi somente referência privada. A correção não foi executada fisicamente no iPhone. Atualização pelo vínculo remoto existente, preservando dados e pareamento.

## Atualização 0.3.27 — hoje em negrito, sem disco

Removido o disco/círculo branco do número de hoje e a cor vermelha especial dos dígitos. O número usa a cor normal do respectivo dia/quadro, como o nome da semana. Ambos continuam em SFMono-Heavy somente em hoje; demais dias mantêm o peso regular. Fonte 29 preservada.

A retirada não altera as posições de palavra, número ou temperaturas, o espaço tipográfico nem as caixas de linha comuns: o disco nunca entra no avanço do texto e agora não participa da caixa visual. Mantidos os blocos centralizados, domingo pela direita e sábado pela esquerda, curvas adjacentes, gap, moldura, blur, movimento, Bridge, dados e ações.

Validação focada: 24 cenas/168 cabeçalhos comparados à 0.3.26 com posições e avanços idênticos; 96 cenas/672 cabeçalhos e 4.704 combinações de escala sem cortes; nenhuma elipse no desenho dos cabeçalhos. Nove casos da regra de blur e nove datas de hoje, compilação/importação de 20 módulos e pacote de 25 arquivos validados. [Evidências](../docs/today-no-disk-0.3.27.json). Preview com dados fictícios e DejaVu Mono; sem teste físico no iPhone. Atualize pelo mesmo vínculo remoto, preservando armazenamento e pareamento.

## Atualização 0.3.26 — curvas adjacentes e blocos centralizados

Os quadros vizinhos acompanham a mesma curva-mestra da timeline por um contorno paralelo: meia espessura da moldura mais o gap original de **1,2287 unidades**. A máscara anterior tinha uma junção divergente quando o canto direito invertia e o preenchimento do próximo quadro terminava no retângulo original. A junção agora é resolvida contra o plano paralelo da timeline; somente o canto inferior esquerdo do próximo quadro ganha o preenchimento local necessário. Nenhum quadro muda de posição, tamanho ou distância entre slots.

Regra explícita mais recente: **domingo, primeira e segunda linhas pela direita; sábado, pela esquerda**. O conjunto de texto fica centralizado horizontal e verticalmente no próprio quadro; hoje usa a mesma regra. O disco continua centrado na caixa medida dos dígitos, sem alterar o espaço tipográfico comum. A folga horizontal da segunda linha foi ajustada internamente para acomodar esses alinhamentos nos cantos externos. Fonte 29 mantida: 29,25 deixa apenas 0,54 unidade de folga no sábado com temperaturas negativas e 29,5 corta o disco; não se reduziu a fonte nem se moveram os quadros. Mínima/máxima, destaque de hoje, blur, moldura, movimento, dados, Bridge e ações permanecem.

Validação geométrica: 63 cenas (sete dias, antes/durante/depois da inversão e extremos), 6.231 amostras de offset, erro máximo do gap de 1,09×10⁻¹³ unidades, sem auto-interseções nem coordenadas divergentes. Cabeçalhos: 96 cenas, 672 quadros e 4.704 combinações de escala; folga mínima de 2,04 unidades. Verificados o centro do disco, o espaço uniforme e a ancoragem absoluta do texto. [Relatório das curvas](../docs/adjacent-curves-0.3.26.json). A comparação visual usa dados fictícios e DejaVu Mono; não houve teste físico iOS e as métricas nativas de SFMono continuam dependentes do aparelho. Atualize pelo mesmo vínculo remoto, preservando armazenamento e pareamento.

## Atualização 0.3.25 — centro medido, espaço uniforme e nova regra dos fins de semana

O disco branco é centrado na caixa medida do número vermelho, em vez da altura nominal da fonte. As métricas do Canvas são adaptadas à convenção de ancoragem reportada pelo host; essa conversão afeta somente o disco, sem mover o texto por offsets de baseline. O número vem depois do avanço do nome do dia e de um espaço tipográfico comum, medido nos dois pesos. Ligar/desligar a decoração não altera avanço, posições ou espaçamento do texto.

Nova regra explícita: **domingo, ambas as linhas à esquerda; sábado, ambas à direita**. Hoje segue a regra do próprio dia; os demais dias continuam centralizados. O alinhamento é pelas bordas do texto; o disco não entra no cálculo do avanço. Mantida a fonte 29. Para acomodar os cantos sem reduzir fonte, o recuo interno seguro é 35 unidades nos fins de semana e foram compactadas apenas as folgas horizontais ao redor do ícone da segunda linha. Temperaturas, cores, tamanhos e ícones permanecem iguais; mínima à esquerda e máxima à direita. Moldura, blur leve, timeline móvel, dados, Bridge e interações preservados.

Validação: suíte completa, 20 módulos compilados/importados, 96 cenas de cabeçalho e 4.704 escalas, mais 24 cenas focadas/168 cabeçalhos. Os testes específicos medem erro zero no centro do disco, no avanço do espaço e nas bordas de alinhamento; cobrem dias úteis/domingo/sábado com 01/11/28/31, meio-dia/fim do dia e três convenções de métricas. Folga mínima local nos cantos: 3,5 unidades. Comparação de operações/bitmaps confirma corpo da timeline inalterado.

[Medidas e diagnóstico](../docs/header-metrics-spacing-0.3.25.json) · [Limites dos cabeçalhos](../docs/header-alignment-0.3.25.json). Preview com dados fictícios e DejaVu Mono. Não houve teste físico no iPhone; a documentação do Canvas informa que medição UIKit e desenho SwiftUI podem variar ligeiramente. Atualize pelo mesmo vínculo remoto, preservando armazenamento e pareamento.

## Atualização 0.3.24 — centralização, disco de hoje e blur suave

A primeira linha passa de 28 para 29. Ambas as linhas ficam centralizadas horizontalmente no próprio quadro, inclusive hoje, com eixos de linha comuns entre os dias. A instrução mais recente substitui os antigos alinhamentos especiais de domingo/sábado; não há deslocamento vertical exclusivo de fim de semana. Hoje mantém nome e número em negrito e número vermelho. O destaque agora é um disco branco sólido atrás somente dos dígitos, sem contorno, cerca de 14,5% menor. Mínima azul à esquerda, máxima vermelha à direita, ícones e demais dados preservados.

O blur do trecho de amanhã foi suavizado: raio de 4,17 para 2 unidades locais e véu de 36% para 20%. A regra de aplicação não muda: pendências/compromissos válidos de hoje ou falha de leitura protegem o contexto futuro; itens começados hoje continuam nítidos. Moldura, movimento temporal, extensões, toques e Bridge não mudaram.

Validação: suíte completa e 20 módulos compilados/importados; 96 cenas, 672 cabeçalhos e 4.704 escalas, mais 9 casos da regra de blur e 9 discos de datas. Verificados preenchimento branco opaco antes do número vermelho, circularidade, pixels dos dígitos dentro do disco, separação do nome/temperaturas, centros das duas linhas, domingo/sábado, datas largas, meses e ano. A fonte 29 preservou ao menos 1,63 unidades de folga no raster local; 29,5 caiu para 0,13 e 30,5 cortou conteúdo. Todos os pontos de texto continuam usando caixas de linha estáveis, sem aplicar offsets de baseline UIKit.

[Geometria dos cabeçalhos](../docs/centered-days-0.3.24.json) · [Blur, disco e pacote](../docs/soft-blur-disk-0.3.24.json). Comparação com dados fictícios e DejaVu Mono: não é uma captura física nem certifica a métrica de SFMono no iPhone. Atualize pelo mesmo vínculo remoto, preservando armazenamento e pareamento; a política de atualização do iOS permanece a mesma.

## Atualização 0.3.23 — quadros em duas linhas e destaque de hoje

Removida somente a exibição da terceira linha E/L. Eventos, lembretes, contagens do modelo/painel e Bridge continuam preservados. A primeira linha passa de 25,5 para 28 em todos os quadros. Hoje usa SFMono-Heavy no nome do dia e no número, número vermelho e círculo branco de contorno somente ao redor do número; os demais dias usam SFMono-Regular, mantendo a distinção de peso e suas cores de dia/feriado. O texto de domingo mantém a borda direita alinhada à segunda linha; sábado mantém a esquerda. O círculo participa da reserva de espaço, sem deslocar esses alinhamentos de texto ou cobrir o nome.

Na segunda linha, a mínima azul fica à esquerda e a máxima vermelha à direita. Mantidos valores, tamanhos adaptativos e ícones; quando falta um extremo, aparece `--º` somente nele e o outro valor disponível permanece. O formato numérico original com dois dígitos foi preservado. Não houve alteração nas dimensões dos quadros, moldura de hoje, curvas, timeline móvel, blur, extensões, toques ou Bridge.

Validação: suíte ativa completa, 20 módulos compilados/importados, 96 cenas, 672 cabeçalhos e 4.704 combinações de escala. Cobertos hoje comum/sábado/domingo/feriado, viradas de mês/ano, dias civis de um e dois dígitos, caso isolado com um único glifo no círculo, valores negativos/ausentes, separação do círculo, ícones vetoriais/bitmap e regressão de ancoragem. Folga mínima no modelo local: 2,95 unidades do canvas; fonte 28,5 fica abaixo da reserva de 2 unidades e 29 corta o círculo de sábado. O preview usa dados fictícios e DejaVu Mono, não SFMono medido no iPhone. [Relatório e medidas](../docs/header-two-rows-0.3.23.json).

Atualize pelo mesmo vínculo remoto, mantendo armazenamento e pareamento. A execução física da 0.3.23 e as decisões de refresh do iOS continuam sem confirmação no aparelho.

## Atualização 0.3.22 — moldura somente no conjunto de hoje

A moldura branca agora envolve o quadro superior de hoje e a área da timeline até a próxima meia-noite, sem contornar a faixa de amanhã. Na 0.3.21 o stroke usava o mesmo polígono de largura integral empregado pelo fundo e pelas máscaras. A correção mantém esses fundos/máscaras e deriva somente o stroke: recorta o corpo na divisória e remove a borda compartilhada com o quadro. Quando a divisória já passou à esquerda do quadro, o contorno fica segmentado; uma ligação contínua acrescentaria uma área de amanhã ou criaria auto-interseção. O divisor existente continua responsável pelo trecho entre astro e círculo, evitando linha duplicada ou sobre texto.

Preservados movimento, fontes/posições, curvas dos quadros, marcador de virada, blur, extensões, toques e Bridge. A comparação automatizada confere todas as operações restantes, incluindo SHA-256 dos bitmaps de retângulos. Passaram 56 comparações com agenda, 77 passagens nas sete colunas e 4 casos de meia-noite/ano; a suíte de movimento também continua aprovada. [Medidas e registro](../docs/today-frame-0.3.22.json).

A captura física recebida foi usada apenas como referência privada do contorno indevido; ela não comprova a versão instalada. O preview de antes/depois contém dados fictícios e fonte substituta DejaVu Mono. A correção ainda não foi executada no iPhone; não há garantia nova de cadência de refresh do iOS. Atualize pelo mesmo vínculo remoto, preservando o armazenamento e o pareamento.

## Atualização 0.3.21 — timeline móvel e regras históricas

A timeline de 24h volta a começar no horário real de cada render. Os sete quadros ficam nas posições aprovadas, com a tipografia 25,5 e os mesmos alinhamentos internos; o toque para escolher outro dia foi removido. A migração ignora e remove somente `selected-day`, preservando agenda, lembretes, configurações e dados da Bridge. Intents antigos ainda em widgets já renderizados solicitam atualização de hoje sem selecionar uma data.

O canto inferior direito interno encolhe conforme a virada se aproxima, chega a zero e inverte pelo sinal da distância. O canto externo de sábado conserva seu contorno calibrado. Retornam a linha/círculo de mudança do dia e o blur do contexto de amanhã enquanto houver evento com horário ainda válido ou lembrete pendente de hoje (também em falha de leitura). Eventos de dia inteiro/aniversários, itens encerrados e itens somente de amanhã não ativam o blur. Charts começados hoje continuam nítidos sobre ele. A extensão histórica de lembretes começa após o meio-dia e termina às 6h de amanhã, somente para pendência elegível já devida, vencida ou sem horário; altera a cópia do desenho. Eventos mantêm a duração real. A linha verde do horário atual foi removida.

Charts abrem o Calendário pelo handoff já suportado do Scripting: preparação de dados aguardada por até 1,2 segundo, pedido de `Widget.reloadAll()` e uma única abertura `calshow://`. Offline/timeout preserva cache e navegação. O próximo render consome o pedido de clima fresco mesmo se o iOS o atrasar. Horas e curva térmica preservam o intent de atualização e a ordem da Bridge. Não há nova ação nos quadros.

`Widget.present` solicita execução após o próximo minuto; o iOS decide quando executá-la. Não há animação contínua, loop ou promessa de atualização por minuto. APIs: [Scripting Widget](https://scriptingapp.github.io/guide/Widget/Widget%20API), [AppIntent](https://scriptingapp.github.io/guide/AppIntent), [política WidgetKit](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date).

Validação: suíte ativa, importação/compilação de 20 módulos, geometria em 59 cenas UTC e 59 em America/New_York, 7 dimensões de hit areas, timeout/offline/repetição, migração e regressão do corte físico anterior. A comparação usa dados fictícios e DejaVu Mono, não captura iOS. O círculo segue a coordenada temporal verdadeira e recebe o recorte externo nas bordas do viewport; não foi movido para dentro artificialmente. SFMono físico, gestos nativos e decisões de atualização do iOS continuam sem teste no aparelho. [Registro e medidas](../docs/timeline-restoration-0.3.21.json).

## Atualização 0.3.20 — hotfix do corte físico dos títulos

A captura física da 0.3.19 mostrou todos os títulos cortados pelo topo, não apenas DOM/SAB. Temperaturas, contagens e o corpo continuavam visíveis. A validação anterior com Canvas Web não reproduziu o runtime do Scripting e foi insuficiente.

Causa no código: a 0.3.19 passou a transformar métricas verticais de fonte em offsets para texto ancorado no topo, além de posicionar grupos em contextos traduzidos. O Scripting mede com UIKit e desenha por âncoras SwiftUI; a conversão presumiu a mesma convenção do Canvas Web. Não foram registrados os valores exatos de ascent/descent retornados pelo iPhone, portanto não se atribui ao aparelho um valor de métrica inferido pela simulação.

Correção restrita ao adaptador: as posições verticais usam caixas de linha uniformes e deixam de depender de ascent/descent externos. Pontos de texto, retângulos de recorte, imagens e caminhos recebem coordenadas absolutas, seguindo o caminho de desenho da 0.3.18 que já funcionava. Mantidos os títulos 25,5, centralização das caixas de linha nos dois eixos, eixos comuns de linha, DOM direita / SAB esquerda de L2. Não houve redução adicional de fonte, deslocamento exclusivo de fim de semana ou alteração dos quadros, margens, cantos, gráficos, curva térmica, dados, Bridge ou toques.

Teste novo `scripting-header-native-anchor.cjs`: carrega o adaptador real da 0.3.19 e combina métricas de baseline simuladas com desenho ancorado no topo. A versão antiga emite os 21 títulos em Y negativo nas três seleções; o hotfix emite todos em Y positivo e igual, independentemente da convenção de métricas verticais. Na reprodução escolhida, Y passa de −14,11 para +15,04 unidades. Esses números são da simulação, não de medição no iPhone. O teste é parte da suíte ativa e teria falhado na 0.3.19.

Compilação/imports dos 20 módulos, suíte ativa, verificação visual e pacote CRC/bytes de 25 arquivos aprovados. Os 80 cenários de geometria e conteúdo continuam aprovados; a folga mínima dos glifos no raster local foi 3,12 unidades. As métricas de tinta locais agora são verificadas separadamente das caixas usadas pelo layout, evitando tratar baseline calculada como prova de pixels desenhados. [Relatório](../docs/header-anchor-hotfix-0.3.20.json).

Atualize o mesmo projeto pelo [Git da branch scripting](https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting), sem apagar armazenamento ou refazer pareamento. A prévia de regressão usa DejaVu Mono e métricas simuladas, explicitamente identificadas; não é uma captura SFMono. O hotfix ainda precisa de reteste físico no Scripting instalado. Não há CI Scripting configurado. O pacote foi validado localmente; upload de asset de release anteriormente bloqueado por HTTP 401 não foi repetido.

## Atualização 0.3.19 — fonte menor e centralização nos dois eixos

Os sete títulos passam de 38 para **25,5 unidades** do motor (8,5 pontos no widget de 364 × 170). É o maior tamanho uniforme aprovado na busca local em passos de 0,5; 26 já invade o contorno de DOM/SAB ao centrar o conjunto. Preserva SFMono-Heavy, sem compressão de glifos nem espaçamento negativo entre letras.

Os quadros mantêm integralmente posição, largura, altura, margens e cantos da 0.3.18. Não foi aplicado o recuo lateral de 48 nem o arredondamento alternativo da proposta rejeitada. O Canvas mede os textos, compartilha as métricas das três linhas entre os sete dias e centra o bloco em X e Y no quadro visível. O ajuste de 2 unidades do traço selecionado é considerado para manter o mesmo centro visual. As linhas têm os mesmos eixos verticais em todos os dias. DOM alinha a borda direita de L1 à de L2; SAB alinha as bordas esquerdas. Contagens ficam centradas; cores e regras de feriados permanecem.

A linha de temperaturas mantém largura estável, inclusive com valores curtos, negativos ou ausentes. Sua fonte é comum aos sete dias, até 22 unidades, reduzida proporcionalmente quando a maior string ultrapassa três caracteres. Contagens usam um único tamanho comum até 17, ajustado pela maior contagem da semana; todos os valores são preservados. Os ícones conservam seu tamanho. O espaçamento entre linhas considera suas bordas reais para evitar sobreposição.

Validação: 80 cenas com hoje comum/sábado/domingo/feriado, viradas de mês/ano, temperaturas curtas/negativas/ausentes e contagens de até quatro dígitos; 560 cabeçalhos e 3.920 transformações em sete tamanhos. Centros X/Y e bordas DOM/SAB coincidiram até a precisão numérica local; menor folga até o contorno foi 1,65 unidade. A comparação completa das operações fora dos cabeçalhos, geometria dos quadros, charts, curva térmica e toques é idêntica à 0.3.18. Compilação/imports dos 20 módulos, suíte ativa, visual e pacote CRC/bytes de 25 arquivos aprovados. [Relatório](../docs/header-centering-0.3.19.json). Gerar comparação: `node tools/preview-header-typography.cjs`.

O posicionamento usa `measureText` do [Canvas nativo documentado](https://scriptingapp.github.io/guide/Changelog/3.1.0/Canvas%20(Web%202D%20drawing%20context)/), com cache de medições por conjunto. Normaliza métricas de baseline UIKit e usa largura/caixa de fonte quando limites de tinta laterais não são fornecidos. Testes locais usam DejaVu Mono; não equivalem à medição de SFMono no iOS. A documentação também registra possível diferença entre medição UIKit e desenho SwiftUI; encaixe final no iPhone/iPad físico permanece pendente.

Atualize o mesmo projeto pelo [Git da branch scripting](https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting), preservando Storage, Keychain e pareamento. Bridge, dados, charts, curva térmica, sete seleções e cliques da 0.3.17 permanecem. Não há CI Scripting configurado. O pacote `.scripting` foi validado localmente; upload de asset de release anteriormente bloqueado por HTTP 401 não foi repetido sem nova evidência de acesso.

## Atualização 0.3.18 — títulos com o mesmo estilo

Todos os sete títulos usam `SFMono-Heavy` com 38 unidades no motor de 1092 × 510, o estilo maior que já era usado em hoje nos dias comuns. A diferença anterior era de tamanho (26 nos demais), não de família/peso, e não era provocada pelo fundo preto. A regra agora independe de hoje, seleção, fundo e feriado.

Os dois cartões de extremidade mantêm o quadro, contorno e margens externas. Apenas seu espaço interno muda: espaçamento entre letras de −3,161 unidades, título ligeiramente abaixo e linhas de temperatura/contagem reposicionadas dentro do mesmo quadro. Os glifos continuam em 38, sem escala horizontal. O Canvas mede os avanços reais antes de posicionar cada letra. Domingo conserva a borda direita do título alinhada à borda direita da linha de temperaturas; sábado conserva as bordas esquerdas. Os dias úteis mantêm o alinhamento central aprovado. A largura do ícone é preservada e o vão interno se ajusta para temperaturas negativas mais longas.

Orientação de manutenção: usar um único tamanho de título, sem exceção por hoje/cor. Conferir as bordas de L1/L2 e os glifos, em vez de deduzir o alinhamento pelo centro do cartão. Não resolver recorte diminuindo a fonte nem ampliando o quadro. A solução mantém as famílias/pesos das três linhas e as cores anteriores.

Validação local: 40 cenas, incluindo hoje comum/sábado/domingo/feriado, mudanças de mês/ano, temperaturas curtas/negativas/ausentes; 280 cabeçalhos medidos e 1.960 transformações em sete tamanhos. Nenhuma cobertura de tinta do título foi perdida no raster local. Bordas das caixas de avanço de DOM/SAB coincidem com L2; as bordas de tinta individuais podem diferir por side bearings dos glifos (até 1,37 unidades na fonte substituta). Operações fora do cabeçalho, margens, contornos, curva térmica, agenda e geometria de toques idênticos à 0.3.17. Compilação/imports dos 20 módulos, suíte ativa, visual e pacote de 25 arquivos aprovados. [Relatório](../docs/header-typography-0.3.18.json); gerar comparação com `node tools/preview-header-typography.cjs`.

Atualize o mesmo projeto pelo [Git da branch scripting](https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting), mantendo Storage, Keychain e pareamento. Os cliques da 0.3.17 permanecem: charts abrem Calendário, horas/temperatura atualizam e sete cartões selecionam os dias. Não há CI Scripting configurado. A prévia usa DejaVu Mono como substituta local; SFMono, compilação/encaixe e toque no iPhone/iPad físico ainda exigem confirmação. O pacote `.scripting` foi validado localmente; o upload de assets de release anteriormente bloqueado por HTTP 401 não foi repetido sem nova evidência de acesso.

## Atualização 0.3.17 — áreas de toque

Charts de eventos/lembretes abrem diretamente o Calendário (`calshow://`). A atualização existente fica somente na legenda inferior de horas e na faixa de temperaturas/curva térmica; continua voltando para hoje e solicitando clima novo. Os sete cartões mantêm suas ações de seleção.

Causa: a 0.3.14 envolveu o GraphView inteiro no botão RefreshCalendar. Solução: restaurar o Link de fundo e acrescentar um botão invisível irmão para a faixa térmica, calculado pelo motor com os mesmos limites usados pelos rótulos e pela curva. A legenda mantém seu botão anterior. Não há botões dentro do Link nem intenções sobrepostas entre si. A arbitragem do Link de fundo com os botões acima dele ainda requer teste físico.

Validação local: compilação dos 20 módulos, suíte ativa, 14 cenas com/sem eventos, lembretes e clima, sete seleções, 98 árvores de UI em sete tamanhos médio/extragrande, 18.228 amostras de toque e 20 execuções repetidas das intenções. Operações de desenho e campos anteriores do modelo idênticos à 0.3.16; pacote de 25 arquivos validado por CRC, bytes e versão. Vinte arquivos permanecem iguais à distribuição anterior normalizando CRLF para LF. Relatório: [hit-areas-0.3.17.json](../docs/hit-areas-0.3.17.json).

Atualize o mesmo projeto pelo [vínculo Git existente](https://github.com/Sagittaryuz/Calendar-Timeline/tree/scripting/scripting/scripts/Calendar%20Timeline%20Scripting), preservando Storage, Keychain e pareamento. O pacote `Calendar-Timeline-Scripting-0.3.17.scripting` foi gerado e validado localmente. Sua publicação como asset da pré-release foi bloqueada pelo GitHub uploads (`HTTP 401: Bad credentials`); a atualização pelo vínculo Git acima está publicada. A consulta posterior não encontrou release/tag 0.3.17 nem o rascunho transitório retornado pelo comando. Nenhum dado de agenda ou pareamento foi acessado ou alterado por estes testes. Abertura do Calendário, ausência de disparo duplo e repetição dos toques no WidgetKit real ainda dependem de teste no iPhone/iPad; os testes locais simulam o despacho pelo elemento superior e as APIs nativas. Reversão disponível na 0.3.16 sem apagar o projeto. Não há workflow de CI Scripting configurado nesta branch; o workflow Android permanece inalterado.

## Atualização 0.3.16

O canto inferior direito de domingo fica reto quando outro dia estiver selecionado. O arredondamento usa o raio existente somente quando domingo for selecionado, seguindo a mesma regra já aplicada ao sábado. Testes cobrem quarta-feira, sábado e domingo selecionados. Validação física pendente.

## Atualização 0.3.15

O canto inferior esquerdo do quadro de sábado permanece reto enquanto outro dia estiver selecionado. O arredondamento aparece somente com sábado selecionado, usando o ombro e raio existentes do quadro ativo. Domingo e demais elementos preservados. Testes com quarta-feira selecionada e sábado selecionado. Validação física pendente.

## Atualização 0.3.14

Corrige o canto inferior direito do domingo e o inferior esquerdo do sábado usando o raio comum, incluindo o ombro do domingo selecionado. Toques nos dias selecionam e redesenham com nova leitura local; legenda de horas e corpo/curva térmica atualizam e voltam para hoje. Nenhum toque do corpo abre o Calendário.

O antigo ×2 era o contador de sobreposições (um evento simultâneo além do próprio). Removido do texto dos charts; os dados de conflito da agenda continuam preservados.

Desempenho: os três widgets já usam Canvas nativo do Scripting. O Calendar mantém o adaptador necessário para reproduzir sua geometria. A máscara dos vizinhos agora é calculada uma vez por render, em vez de seis; a segmentação do desenho é memoizada por imagem/viewport; o toque de dia não espera a ponte e sua próxima execução local lê a agenda sem repetir essa espera. O refresh manual solicita clima novo no único render seguinte, evitando preparar um modelo descartável antes de renderizá-lo novamente. Clima válido continua reutilizado na navegação entre dias. Sincronizações regulares da ponte permanecem; tocar um dia não promete concluir comandos remotos nesse instante.

Testes: 12 cenários completos, navegação/semana/virada de ano, camadas Canvas, cantos, eventos sobrepostos, ponte e lembretes recorrentes, seleção, clima forçado, cache da máscara e segmentação. Fixture com clima e batching produziu máximo de 893 operações/17 camadas, sem medição física de latência. O orçamento de ponte e o iOS ainda podem influenciar atualizações. Compilação e toques no iPhone/iPad desta versão pendentes. Estrutura original de 25 arquivos, pareamento, Keychain e dados preservados. Reversão: scripting-v0.3.13-alpha.1.

## Atualização 0.3.13 — abertura imediata e painel independente

A tela do projeto aparece antes das consultas, com estado real de carregamento e erro, mantendo a ponte antes da nova leitura da agenda. Herda os alinhamentos e otimizações da 0.3.12. O novo teste de abertura exerce a entrada e comprova apresentação anterior à consulta; latência nativa ainda pendente.

O projeto Meu Painel vive em Sagittaryuz/scripting-home (privado). O Calendar fornece apenas um registro local limitado em Storage shared, com dia, contagens e até seis títulos/horários, sem notas, credenciais, localização ou motor compartilhado. Datas antigas/parciais de cache são preservadas. Nenhuma interface de homepage ou import do painel foi acrescentado ao pacote ativo.

Atualize este mesmo projeto; instale Meu Painel separadamente e selecione-o na aba Início. Os resumos são locais ao aparelho e acessíveis a outros scripts instalados no Scripting. As três fontes são independentes; recarregar o painel não comprova que o iOS executou os widgets.

## Atualização 0.3.12 — alinhamentos e preparação mais leve

Domingo alinha o título à borda direita da linha de temperaturas; sábado à esquerda. Mantém cores, curvas, fontes, centralização vertical, toques e dimensões.

Agenda e localização começam juntas; clima e feriados seguem em paralelo depois da localização. A ponte continua terminando antes da leitura local, preservando comandos, confirmação de gravações e vida útil da extensão. Abrir o app ou preparar um refresh consulta os dados sem construir o desenho descartável; a extensão renderiza normalmente. O encaixe compartilhado dos títulos é calculado uma vez por renderização. Cache do clima com data futura deixa de ser tratado como válido.

Validação: comparação completa das operações de desenho com 0.3.11, exceto os dois títulos solicitados; sete prévias Canvas, cenários de feriado e extragrande; regressões de ponte, recorrência, idempotência, offline e permissões. Teste proporcional de desempenho: 204 para 30 verificações de encaixe; I/O sintético equivalente de 156 para 99 ms, sem equivaler à velocidade nativa. Preparação sem desenho cria zero DrawContext. Ver tests/scripting-performance.cjs.

Revisão de arquitetura: preservados JavaScript/TypeScript e o adaptador nativo, sem novas dependências ou migração. O SDK do Scripting executa este formato; reescrever em Swift não seria uma otimização incremental deste projeto. Preservados rasterização em lotes, limites de rede, caches por fonte e controle de repetição da fila. O maior tempo variável restante é a ponte e as APIs nativas/rede, não uma linguagem diferente. tools/build-scripting.cjs é um gerador histórico de importação, não o comando de release da base recuperada; npm run build:scripting verifica as fontes distribuídas atuais.

Atualize o mesmo projeto pelo Git, preservando Storage, Keychain e pareamento. Reversão: scripting-v0.3.11-alpha.1. Compilação, renderização e latência desta versão no aparelho ainda exigem confirmação; os testes locais não as comprovam.

## Atualização 0.3.11 — toque invisível na legenda de horas

A legenda inferior de horas agora aciona RefreshCalendar sem desenhar ícone. A área usa coordenadas exportadas pelo próprio motor e a mesma transformação proporcional do desenho no iPad. Preserva o link calshow no restante da timeline e os sete botões de dia.

A intenção existente volta para hoje, sincroniza a ponte, tenta renovar clima/agenda e solicita Widget.reloadAll(), inclusive em falha. Testes locais de coordenadas e alinhamento em quatro tamanhos, 12 renderizações, intenção, cache e recuperação aprovados. Compilação/visual/toque físicos desta versão ainda não confirmados.

## Atualização 0.3.10 — recarga pelos outros widgets

Remove apenas o botão de refresh sobreposto ao Calendar. Codex 1.1.5 e Popular 0.2.4 usam Widget.reloadAll(), que solicita recarga de todas as timelines do Scripting. Calendar conserva seleção de dias, link ao Calendário, atualização periódica solicitada e sua intenção/atalho de atualização. A recarga externa respeita o dia selecionado e o cache/clima do Calendar; não equivale ao botão antigo que voltava para hoje e forçava clima novo. Testes de geometria, navegação, estrutura e intenção aprovados; simultaneidade no aparelho pendente.

## Atualização 0.3.9 — atualizar e voltar para hoje

O botão ↻ volta a seleção para o dia local atual antes de sincronizar e renovar agenda/clima. O retorno para hoje também é preservado se a consulta falhar; os caches continuam disponíveis. Não altera o comportamento dos botões de seleção de dia. Teste local cobre seleção antiga, ordem antes da rede e falha; toque nativo desta versão pendente.

## Atualização 0.3.8 — botão de atualização

Botão pequeno de seta circular no canto inferior direito, usando AppIntent em segundo plano, sem solicitar abertura do app. O botão consulta a agenda/lembretes nativos, sincroniza a ponte dentro do orçamento e tenta renovar o clima sem impor o cache rápido de 15 minutos. A seleção do dia é preservada e o cache continua disponível em falhas.

Os widgets solicitam atualização após 1 minuto por padrão. O campo Parâmetro não altera a frequência. Codex/Popular permitem selecionar 1, 5 ou 15 minutos nas preferências do projeto. O iOS decide quando executar; a solicitação de 1 minuto não garante execução nesse intervalo. O botão pede dados atuais disponíveis e recarrega mesmo em falhas, preservando caches. Não altera o código instalado.

Testes locais de intenções, consulta forçada, sucesso/falha e geometria aprovados. Toque, renderização e execução nativa desta versão no iPhone/iPad ainda precisam de confirmação. Atualize o mesmo projeto pelo Git, preservando dados, permissões e pareamento.

## Atual: 0.3.7 — cores, curva do sábado e linhas centralizadas

Sábado mantém fundo azul, domingo vermelho e feriado amarelo, inclusive quando é hoje. Feriados têm prioridade sobre a cor do fim de semana. Quadro selecionado, timeline e preenchimento das curvas usam a mesma cor; os tons existentes foram preservados.

O sábado selecionado agora tem a curva inferior esquerda com o mesmo perfil de superelipse dos dias úteis. O recorte do quadro de sexta usa o offset do próprio contorno, incluindo metade do traço e o vão entre quadros. O canto externo direito permanece no contorno do widget. As três linhas de cada quadro foram centralizadas verticalmente como um conjunto, preservando o alinhamento horizontal.

Validação local: sete composições com verificação de geometria, pixels do preenchimento, afastamento do vizinho e centro das três linhas; quatro cenários adicionais para sábado/domingo/feriado em hoje e feriado no sábado; regressões do pacote e formato extragrande. São simulações Canvas e APIs simuladas; visual/compilação no iPad e iPhone não foram confirmados nesta versão. Atualize o mesmo projeto pelo Git, preservando dados e pareamento. Reversão disponível na tag scripting-v0.3.6-alpha.1.

## Histórico: 0.3.6 — extragrande horizontal do iPad

O widget agora aceita systemMedium e systemExtraLarge. No iPad, adicione o widget de usuário do Scripting no tamanho extragrande horizontal e selecione o mesmo projeto Calendar Timeline Scripting. A disponibilidade desse tamanho depende do app/iPadOS; o script não instala uma nova extensão nativa. Usa Widget.displaySize, com desenho proporcional centralizado e sete áreas de toque alinhadas. O formato médio mantém sua geometria anterior. Os 25 arquivos da base de recuperação são preservados, sem reativar as extensões Pro.

Testes locais: entrada real para médio/extragrande, ajuste a quatro dimensões horizontais, limites e datas dos sete toques, regressões do motor e comparação com a base. Ainda falta validação física em iPad. Versão do código e atualização dos dados são coisas separadas; a frequência de execução continua sob controle do iPadOS.

Referências oficiais: https://developer.apple.com/documentation/widgetkit/widgetfamily/systemextralarge e https://scriptingapp.github.io/guide/Widget/Widget%20API .

## Histórico: 0.3.5 — retorno à estrutura anterior

O pacote ativo voltou aos 25 arquivos da versão 0.2.15, commit 565bba1. Dezoito arquivos são idênticos byte a byte ao original, incluindo motor, desenho, modelo, adaptador e seleção. Foram retiradas do diretório distribuído as telas Pro, extensões novas e entradas geradas da 0.3.4. Fontes e histórico foram preservados em scripting/experimental-pro, scripting/entrypoints e na tag scripting-v0.3.4-alpha.1.

As únicas diferenças da base são a identificação 0.3.5, a solicitação de atualização em 1 minuto, o link direto ao Calendário, a prioridade da fila antes da captura, a permissão para concluir lembretes recorrentes e textos da tela. A ponte termina antes de Widget.present, como já ocorria na 0.2.15. O pareamento e seus nomes de armazenamento/Keychain não mudaram.

Atualize o mesmo projeto pelo vínculo Git. O pacote distribuído deve conter 25 arquivos; uma atualização parcial que conserve extensões antigas pode não representar este pacote. Não apague o projeto nem o armazenamento. Os testes locais foram aprovados; a compilação e o widget no iPhone ainda precisam ser confirmados. As seções seguintes são histórico e não descrevem as funções Pro disponíveis nesta recuperação.

## 0.3.4 — pacote de recuperação

Atualize o projeto existente pelo mesmo vínculo Git, preservando armazenamento e pareamento. As entradas index.tsx, widget.tsx e extensões são autocontidas: cada uma inclui sua versão e dependências do projeto. Não dependem de módulos internos antigos no cache para executar. O código-fonte editável das entradas está em scripting/entrypoints; npm run build:scripting gera os arquivos distribuídos.

Se a tela principal não abrir, selecione **diagnose.tsx** no seletor de arquivos e execute esse arquivo. Ele não importa nenhum módulo do Calendar. Exibe arquivos ausentes/divergentes, versão do pacote e APIs indisponíveis, usando apenas o código local. Não lê agenda, credenciais ou pareamento. O build-manifest.json registra os hashes esperados.

A recuperação elimina dependências de módulos internos na construção das entradas e usa um único import de namespace do SDK. Acrescenta alerta independente caso falhe a inicialização ou a própria tela de diagnóstico. A mensagem genérica do iPhone não revelou a causa exata; compilação nativa, renderização e execução da fila ainda exigem verificação no aparelho. Os testes locais não equivalem a essa confirmação.

## 0.3.0 — Scripting Pro e acesso direto

Inclui as correções da 0.2.15. Agenda detalhada, conflitos/intervalos, criação por
frase com revisão e releitura, assistente, Central de Controle, painel Início e
preferências exportáveis. Corpo abre Calendário diretamente; dias não esperam a
ponte. Solicita atualização em 1 minuto. [Ativação, testes e limites](PRO.md).
Atualize o mesmo projeto pelo Git; preserve o pareamento. iPhone ainda não validado.

## 0.2.13 — status e Último evento lido pela captura da agenda real

A linha de leitura usa o registro da agenda aceito pelo servidor, com data da captura, e deixa de exibir o cache antigo do piloto. Leitura confirmada e execução de comandos são estados separados: uma consulta bem-sucedida não aparece como deferred só porque a revisão do teste divergiu. A tela informa quando comandos não foram consultados; não simula confirmação de gravações. Mensagem automática duplicada removida. Versão do cliente e versão da tela usam a mesma constante.

Atualize o mesmo projeto e abra-o, preservando o pareamento. O serviço privado 0.2.3 devolve o recibo canônico dos registros vinculados, sem liberar edição dos itens reais. Os testes reproduzem EDITADO com data de modificação inalterada e uma leitura antiga concorrente. Visual final no iPhone ainda requer conferência após atualizar. A conversão de dia inteiro agora produz fim exclusivo também no próprio cliente.

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


## 0.2.14 — escrita pessoal pela ponte

A mesma ponte privada agora oferece bridge_list_calendars, bridge_get_item e bridge_queue_change para criação/edição de eventos e lembretes reais e conclusão/reabertura de lembretes. Atualize este projeto pelo Git e abra-o para anunciar os destinos de escrita. Não refaça o pareamento. A fila pessoal funciona independentemente dos checkpoints dos dois testes antigos. Nenhuma escrita pessoal é feita apenas por instalar ou abrir: é necessário um comando solicitado pelo proprietário no ChatGPT.

A confirmação continua exigindo gravação e releitura no iPhone. A escrita é suspensa em conflito, permissão insuficiente, recorrência ou participantes. Notas/alarmes existentes são preservados; um marcador em novos itens permite recuperação de criação interrompida. Não há exclusão remota. Consulta/descoberta continua na semana atual e próxima; lembretes sem data não aparecem na consulta semanal. Vencimentos de lembretes têm precisão de minuto; dias inteiros usam fim exclusivo. Sem garantia de execução contínua ou imediata com iPhone bloqueado. Um resultado pendente não significa gravação.

Validação local cobre o protocolo, transporte e banco SQLite com APIs nativas simuladas. A primeira escrita real da 0.2.14 depende de atualizar e executar no aparelho. O widget, sua geometria e os arquivos Scriptable originais foram preservados. Rollback: release anterior 0.2.13, mantendo o armazenamento e o pareamento; ela não processa a fila pessoal. Código vem do Git; o Drive armazena somente backup privado sem credenciais ou agenda pessoal.


## 0.2.15 — registro local de tentativas da ponte

Cada rodada efetivamente iniciada guarda horário, origem, versão e resultado em um histórico local limitado a 12 entradas. A última falha/adiamento fica em registro separado e não é apagada pelo sucesso de uma rodada posterior. Na abertura normal do projeto, a tela captura esse registro antes da sincronização automática e exibe “Registro local anterior”, inclusive se o desenho posterior falhar. Tentativas puladas por ausência de pareamento ou limitação de frequência não são apresentadas como falha de rede.

O registro distingue falha de conexão, limite de espera/tempo da rodada, recusa HTTP, resposta inválida e causa não identificada. Falha de conexão não comprova ausência de internet: o serviço também pode estar indisponível. Uma entrada iniciada sem resultado é apresentada como possivelmente interrompida, sem alegar falha nem gravação. Falhas da captura da agenda continuam registradas quando o restante da rodada consegue prosseguir. O histórico não é enviado ao servidor.

São guardados somente campos permitidos, sem mensagens nativas brutas, títulos, conteúdo de comandos, identificadores de itens, tokens ou credenciais. Nenhuma permissão ou novo pareamento é necessário. O toque no widget continua silencioso e abre calshow://; os resultados anteriores aparecem ao abrir diretamente o projeto, não pelo toque no widget. O motor e a geometria do widget permanecem intactos.

Testes: scripting-bridge-attempts.cjs usa o cliente real com APIs nativas/rede simuladas para reproduzir falha -> persistência -> abertura seguinte -> sucesso sem apagar o registro, erros HTTP/formato/captura parcial, limite de histórico, interrupção e preservação da abertura do Calendário. Também passaram os testes automáticos, UI, recibo canônico, integração e contrato. A apresentação e persistência final no Scripting instalado exigem reteste após atualizar. Rollback: release 0.2.14, preservando armazenamento, pareamento e filas. Esta mudança não altera o serviço privado nem escreve na agenda durante a implantação.


## Scripting 0.3.3 / ponte 0.4.0 — campos detalhados

Notas em eventos e lembretes: substituir, acrescentar ao fim/início ou limpar explicitamente. Eventos: localização textual, link HTTP/HTTPS e coordenadas. Lembretes: prioridade 0 a 9. Ambos: substituir/remover alertas absolutos, relativos (segundos) ou por entrada/saída de uma região. Campos omitidos são preservados. Localização de lembretes é configurada no alerta; não há campo textual nativo documentado. Não há geocodificação automática.

A captura semanal continua sem notas, endereços ou alarmes. bridge_request_details solicita leitura pontual sem salvar o item; após execução no iPhone, bridge_get_item(includeDetails=true) retorna os detalhes e sua revisão por até 30 minutos. Edições desses campos exigem expectedDetailsRevision além da revisão principal. Mudança somente nas notas também bloqueia edição conflitante. Marcadores internos de recuperação são preservados e não aparecem nas notas compartilhadas. Clientes antigos não executam comandos detalhados (protocolo 2 necessário).

Atualize o mesmo projeto no Scripting para 0.3.1; mantenha pareamento/armazenamento. O painel Pro e a abertura direta do Calendário foram preservados. Configuração de alerta confirmada por releitura não comprova entrega da notificação; localização requer permissão e teste físico. Sem execução contínua garantida com iPhone bloqueado. Séries, participantes e exclusão permanecem fora das escritas.

Validação: SQLite real com APIs Scripting simuladas, notas Unicode/multilinha, acrescentar/limpar, localização/link/coordenadas, prioridade, alertas, conflito só nas notas, recuperação após ACK perdido, isolamento de clientes antigos e privacidade da captura semanal. Nenhum item real foi alterado durante a implantação. Falta validar novos campos e disparo dos alertas no iPhone.
