# Carta de recomendações — Calendar Timeline

Marcos,

Minha recomendação é preservar a identidade atual: agenda no centro, clima como contexto e destaque forte para hoje. O widget já tem bastante informação; acrescentar elementos sem resolver colisões diminuiria sua utilidade.

## 1. Minha prioridade visual: curvas compatíveis com o contorno externo

Concordo com a prioridade do squircle, mas não com a ideia de encontrar um único “raio Apple do iPhone 17 Pro”. A Apple explica que o sistema define a forma do widget, que os raios podem variar entre dispositivos e que formas internas devem acompanhar o contorno do recipiente e seu recuo. Em SwiftUI existe `ContainerRelativeShape` para esse comportamento. [Apple: Build SwiftUI views for widgets](https://developer.apple.com/videos/play/wwdc2020/10033/)

O nosso widget, porém, desenha uma imagem no Scriptable. Não temos aqui uma medição comprovada do contorno nativo do seu widget médio nem um acesso documentado equivalente à forma relativa do SwiftUI. Também não devemos confundir a curva física da tela do iPhone com a curva do widget.

Recomendo uma curva contínua aproximada, calibrada sobre captura original do seu aparelho. Squircle é o objetivo visual; uma superelipse genérica não deve ser apresentada como reprodução exata da Apple.

Roteiro do estudo:

1. Capturar o widget real inteiro, sem redimensionamento, registrando iOS, Scriptable, escala e configuração de tela.
2. Medir o contorno externo e o afastamento da moldura interna nas retas e curvas. Se a foto não permitir identificar a borda, obter uma referência com contraste suficiente.
3. Comparar a forma atual com uma aproximação contínua por Bézier e uma superelipse calibrada. Não fixar expoente 4 ou raio 26 como regra oficial.
4. Usar o mesmo caminho para borda, preenchimento e recorte. Uma borda suave com máscara circular antiga continuará desalinhada.
5. Preservar dimensões, espessura nominal, pontos de união e fonte; alterar apenas a forma dos cantos autorizados.
6. Mostrar as alternativas antes de ativar. Os cantos inferiores dos quadros futuros permanecem retos, conforme seu pedido. Os aros e círculos não viram squircles.

O critério principal é afastamento visual constante e ausência de “quebra” na passagem da reta à curva. O número do raio sozinho não resolve isso.

## 2. Distribuição da agenda antes de acrescentar informação

A reserva fixa da última linha para aniversários contradiz sua prioridade: hoje, cinco eventos viram quatro quando entra um aniversário. Recomendo selecionar todos os charts prioritários primeiro e colocar aniversários apenas na linha seguinte disponível.

Há uma escolha inevitável quando as cinco linhas estão cheias. Para preservar estética e tamanho, recomendo não expulsar evento/lembrete para mostrar aniversário. Se você quiser todos os aniversários sempre visíveis, será necessário autorizar outra solução para esse caso: nova área, redução de conteúdo, página alternativa ou tela de detalhes.

Também existe limite horizontal: nomes ilimitados, fonte fixa e uma única linha não cabem sempre. Desenhar nomes fora da tela não equivale a exibi-los. Minha preferência é manter o espaço generoso e o tamanho atual nos casos normais e decidir explicitamente o caso de excesso, sem comprimí-los até perder legibilidade.

## 3. Dots nos lembretes

Já existe um marcador circular em `drawReminderMarker`. Antes de adicionar outro, eu refinaria o existente: diâmetro único, alinhamento óptico com a primeira linha do texto e cor da lista. Uma versão mais simples pode reduzir ruído, mas é uma sugestão visual, não uma correção automática.

Evitaria somar dot, emoji, vários sinais de prioridade e outra borda ao mesmo item. Preservaria vermelho para pendência relevante e a borda de prolongamento que você definiu. Não mudaria agora a semântica dos estados.

## 4. Grid discreto

Já há grade horária em `drawHourAxis`. Minha proposta é testar refinamento dessa grade, não acrescentar uma segunda: linhas secundárias discretas, meio-dia um pouco mais forte e meia-noite com a estrutura branca atual.

Espessura deve ser avaliada na imagem final do aparelho, não chamada de “1 pixel” sem considerar escala. Opacidade e alinhamento aos pixels devem ser comparados com sol, chuva e blur ativos. Grade não pode competir com as linhas que ligam horários aos eventos.

## 5. Informação adicional útil, mas com baixo peso visual

Depois das correções, eu consideraria um pequeno estado de clima desatualizado/offline, no espaço existente ou em uma tela de diagnóstico ao abrir o app. Seu benefício é indicar que a temperatura não acabou de ser atualizada. Depende de aprovação de posição e aparência.

Eu adiaria vento, umidade, UV, novos contadores e novos ícones permanentes: o ganho marginal é menor que o risco de poluição. Não recomendo trocar provedor principal só por estética nem tornar a grade mais densa por padrão.

## Ordem recomendada

1. Corrigir prioridade, cache e dados inválidos.
2. Unificar máscaras e eliminar colisões tipográficas.
3. Fazer o estudo de curva contínua compatível com a borda externa — primeira mudança visual a avaliar.
4. Refinar o marcador já existente e o grid, um de cada vez.
5. Somente então avaliar indicador discreto de dados antigos.

As sugestões desta carta não foram aplicadas. A alteração imediata foi apenas deixar retos os dois cantos inferiores dos três cartões que não representam hoje. O restante está organizado no roteiro para o Luna Max, com critérios de aceite e pontos que precisam da sua decisão.
