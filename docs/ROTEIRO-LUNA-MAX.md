# Calendar Timeline — roteiro de otimização para Luna Max

## Missão e limites

Revisão estática realizada em 18/09/2026 no repositório `Sagittaryuz/Calendar-Timeline`, branch `main`. Base auditada: `92c78c70bbc47efc6082066dfb62ab34a7224e50`. Única alteração funcional já aplicada nesta revisão: `b73964e3e05125f0e13b57def436043c06ca9fe9`, cantos inferiores dos cartões não atuais em 90°. Não reaplicar essa mudança nem reverter hoje.

Você é o executor Luna Max. Corrija defeitos e reduza custo de execução sem redesenhar o widget. Faça commits pequenos e independentes no fluxo autorizado de `main`, sempre verificando se houve alterações remotas. Não reescreva o arquivo inteiro por conveniência. Não apague credenciais, caches ou mudanças do usuário. Não publique dados reais de calendário, localização ou contatos em testes.

A revisão cobriu configuração, aquisição de agenda/clima/localização/feriados, normalização, seleção de linhas, geometria, camadas, tipografia, rotinas astronômicas, caches e distribuição. O arquivo tem mais de 11 mil linhas e cerca de 330 funções. Houve execução isolada de funções em Node e teste estrutural dos cartões; NÃO houve renderização no iPhone, validação das credenciais Foreca nem prova de equivalência visual. A sintaxe válida não garante execução correta no Scriptable.

## Contrato visual que não pode mudar

- Canvas lógico atual: 1092 × 510; `CANVAS`, margens e compressão vertical permanecem referência. Não confundir unidades do canvas, pontos do iOS e pixels físicos.
- Quatro cartões, mesmos tamanhos, espaçamentos, posições e fontes do modo 24h.
- Janela de 1 a 96 horas; valores inteiros acima de 96 limitados a 96. Até 24h, cadência 2h; acima, 12h. Manter as exceções estruturais da meia-noite.
- Cartões não atuais: ambos os cantos inferiores retos. Não alterar topo nem forma integrada de hoje.
- Sábado azul, domingo vermelho, feriado amarelo. Cartões normais futuros em `#232327` durante blur e na cor normal quando ele termina.
- Amanhã: astros, curva, temperaturas, solar, horas e agenda futura abaixo do blur. Itens de hoje e prolongamentos autorizados acima; aro/astro da mudança e círculo do dia acima.
- Eventos conservam duração real. Somente lembretes incompletos elegíveis usam extensão até 06:00; preservar o corte de elegibilidade atual até decisão explícita.
- Nomes dos charts podem ultrapassar a própria barra; não remover caracteres inteiros só porque não cabem. Borda externa continua sendo limite físico.
- Correções de dados, colisões, máscaras e desalinhamentos podem mudar apenas a região defeituosa. Toda mudança visual intencional fora disso exige aprovação.
- Não ativar automaticamente squircle, novos dots, grid diferente, novos indicadores ou paginação. Ver proposta separada.

## Evidências reproduzidas nesta revisão

| Caso isolado | Resultado atual | Resultado correto a testar |
| --- | --- | --- |
| Cinco eventos de hoje, sem aniversário | Cinco eventos selecionados | Preservar |
| Os mesmos eventos + um aniversário | Só quatro eventos, aniversário e `+1` | Aniversário não deve expulsar evento prioritário |
| Cache contendo somente a última hora necessária | Cobertura aprovada | Reprovar início/miolo ausentes |
| Uma hora de 30°C e resumo diário 18/35°C | Cartão recebe 30/30°C | Usar resumo diário válido, não uma amostra parcial |
| Normalização de temperatura `null` | 0°C | Ausência, nunca zero inventado |
| Uma amostra de 25°C consultada 24h depois | 25°C extrapolados | Ausência fora do horizonte válido |

Outros defeitos abaixo foram identificados pelo fluxo do código; reproduza-os em testes antes de corrigir. Candidatos de desempenho não são ganhos medidos.

## Ordem de execução

### Etapa 0 — congelar referência e criar testes

1. Leia a versão remota atual e registre seu SHA. Preserve o cabeçalho Scriptable nas primeiras linhas e o arquivo distribuído `Calendar Timeline`.
2. Capture imagens originais no iPhone 17 Pro, em widget médio real e na prévia do app, com dados fictícios e relógio controlado. Não usar fotos redimensionadas como referência de pixel.
3. Crie harness que injete relógio, dados e mocks das APIs. Não executar o bloco principal de acesso ao calendário nos testes Node. Evoluir para extração por AST ou módulos puros; regex não basta para provar ausência de referências.
4. Execute `node tests/title-card-corners.cjs`, `node --input-type=module --check < 'Calendar Timeline'` e `git diff --check`.
5. Registrar tempo total, tempo de rede, tempo de render, chamadas de desenho e quantidade de imagens temporárias. Não inventar medições de memória não disponíveis.

Aceite: baseline reproduzível, sem consultas pessoais, sem alterar imagem padrão. Esforço médio; dependência de validação visual no aparelho.

### P0-1 — prioridade da agenda e aniversários

Locais: `groupBirthdayItems`, `chooseItems`, `drawTimelineItemLayer`, `drawBirthdayGroupLabel`.

Problema confirmado: `agendaRowLimit = limit - 1` reserva aniversário ANTES de selecionar a agenda. Isso contradiz eventos/lembretes prioritários. A inclusão direta no último índice também pode sobrepor um item que atravessa a meia-noite nessa linha. `overflowMarkers` pode pintar sobre um chart já colocado.

Implementação proposta:

1. Distribuir eventos e lembretes sem reserva antecipada para aniversários; preservar a política existente para eventos de dia inteiro até teste dedicado.
2. Agrupar os aniversariantes por dia, mantendo todos os registros e identidade de ocorrência. Não deduplicar pessoas diferentes pelo nome abreviado.
3. Só incluir o grupo numa linha vazia DEPOIS de todos os charts prioritários daquele dia, considerando intervalos de carryover. Não mover, ocultar ou reduzir charts para encaixá-lo.
4. Se todas as linhas estiverem ocupadas, há conflito real: não é possível manter dimensões/fontes fixas, prioridade total e aniversário sempre visível em uma linha adicional. Solicitar decisão de Marcos antes de definir esse caso. Recomenda-se aniversário aparecer quando houver espaço, nunca substituir evento/lembrete.
5. Remover colisão do `+N` com texto/barra existentes; se não existir área livre dentro do layout atual, apresentar proposta localizada antes de criar nova linha ou indicador.
6. Testar nomes que avançam sobre o dia seguinte, especialmente quando dois grupos ocupam a mesma linha. Não tratar desenhar fora da tela como “todos visíveis”.

Aceite: inserir 1 ou 20 aniversários não reduz o conjunto de eventos/lembretes selecionado; um grupo por dia; nenhuma sobreposição de linhas; caso sem espaço explicitamente decidido. Esforço alto.

### P0-2 — validade, cobertura e procedência do clima

Locais: `loadHourlyWeather`, `weatherCacheCoversRequiredWindow`, `mergeHourlyWeatherHours`, `buildHourlyWeather`, parsers dos dois provedores.

1. Separar `lastAttemptAt` de `fetchedAt`. Hoje, quando ambos os provedores falham mas há cache, a mesclagem antiga é gravada com `updatedAt = Date.now()`. Não renovar a idade dos dados sem resposta válida nova.
2. Guardar origem, instante da obtenção, intervalo válido e fuso por conjunto/amostra. Um sucesso parcial não pode revalidar amostras antigas de outro provedor.
3. Verificar cobertura por hora desde a primeira amostra necessária até a última, incluindo a margem de interpolação e os quatro dias completos dos cartões. Checar somente o maior timestamp é insuficiente.
4. Validar arrays, timestamps, coordenadas, escala e campos numéricos ANTES de `Number()`. Rejeitar `null`, vazio e não finitos; zero real continua válido.
5. Manter Foreca válida como primária e Open-Meteo como complemento das lacunas. Não substituir dado novo por cache antigo. Não mesclar posições em fusos diferentes pelo texto da data.
6. Não prometer que o provedor gratuito é acionado somente após uma lacuna: atualmente as duas chamadas são paralelas em toda atualização sem cache válido. Medir latência e definir política explícita entre consulta paralela ou fallback condicionado.
7. Migrar cache com versionamento e escrita temporária validada; conservar a última cópia legível em falha de escrita. Testar instâncias simultâneas e mudança de local/fuso.

Aceite: offline não rejuvenece cache; uma única hora não prova cobertura; dados ausentes não viram 0°C/sol; troca de local não reaproveita previsão incompatível. Esforço alto.

### P0-3 — mínimas/máximas e horizonte real

Locais: `buildHourlyWeather`, `titleDailyTemperatureForDay`, `temperatureAtTimestamp`, `titleForecastForDay`, `drawTitleWeatherIcon`.

- `dailyOverrides` é ignorado quando há qualquer hora do dia, não apenas série completa. Priorizar resumo diário válido do provedor escolhido; calcular extremos horários apenas com cobertura suficiente ou identificá-los como parciais internamente.
- `temperatureAtTimestamp` repete a primeira/última temperatura fora da série e interpola lacunas sem limite. Definir tolerância explícita; não fabricar previsão fora do horizonte nem unir grandes buracos com uma curva contínua.
- Quando falta clima, `drawTitleWeatherIcon` desenha sol. Usar ausência de ícone ou símbolo neutro no mesmo espaço, sem sugerir céu limpo.
- Revisar mapeamento WMO/Foreca para chuva/neve/neblina/tempestade; código desconhecido não deve cair automaticamente em sol. Testar símbolos de centenas e símbolos internos curtos.
- Verificar semântica da hora da precipitação por provedor; não alterar deslocamento de 1h sem comparar documentação e payload real sanitizado.

A Foreca pública documenta hourly até 7 dias e até 169 passos; o código pede `periods=168`. Isso NÃO demonstra que o host configurado `fnw-us.foreca.com` e a conta concreta entreguem o mesmo horizonte: medir primeiro/último timestamp, número de passos, erros e permissões, sem expor token. Não atribuir quarto cartão vazio a “API de três dias” sem evidência. [Foreca](https://developer.foreca.com/)

Open-Meteo oferece até 16 dias; consultar apenas o necessário. Os quatro cartões e uma janela móvel de 96h podem exigir partes de cinco datas civis. Isso não aumenta a janela visível acima de 96h. [Open-Meteo](https://open-meteo.com/en/docs)

Aceite: quarto cartão correto com Foreca curta; extremos diários corretos com série parcial; testes offline e campos nulos. Esforço médio.

### P1-1 — recorte realmente curvo e tipografia

Locais: `hourLegendVisibleBounds`, `drawHourLegendLabelClipped`, `restoreRoundedSideCorners`, `timelineMoonPointIsVisible`, `drawTitleDayCard`, `birthdayLabelWidth`.

O recorte atual das horas calcula o maior recuo em três alturas e aplica um retângulo. Permite cortar caracteres, mas NÃO acompanha a curva pixel a pixel. A descrição anterior de recorte curvo foi imprecisa.

1. Criar geometria compartilhada para contorno, preenchimento e máscara; respeitar perfis de canto diferentes. Nada de recalcular bordas com fórmulas independentes.
2. Renderizar o texto inteiro e recortar sua camada transparente pela forma real. Sem apagar caracteres inteiros, sem repintar fundo preto por cima dos elementos de hoje.
3. O DrawContext documentado não oferece `ctx.clip()` como Canvas HTML: não copiar métodos de WebView para ele. Usar máscara raster suportada, faixas transparentes ou caminho de renderização comprovado; medir custo.
4. Retomar caminho direto para rótulos totalmente internos, evitando duas imagens novas por horário; preservar posição subpixel, fonte e cor.
5. Testar `12h` e `22h` em ambas as bordas e nas curvas, com fonte regular e pesada. `Math.ceil` em caixa e largura não deve deslocar o texto nem vazar 1px.
6. Medir texto com a fonte real quando possível; `0.62 × fontSize` e `birthdayLabelWidth` são estimativas. Não migrar para fonte de navegador parecida e chamar de equivalência.
7. Testar a segunda linha dos cartões com contagens 0/9/10/100, temperaturas negativas e `--º`. O grupo é centralizado sem limite de largura e pode invadir cartão vizinho. Corrigir apenas colisões comprovadas, sem reduzir fonte globalmente.

Aceite: máscara e contorno coincidentes, caracteres parcialmente visíveis, baseline interno inalterado, nenhuma faixa preta residual. Esforço alto. [API de desenho](https://docs.scriptable.app/drawcontext/)

### P1-2 — agenda, datas, falhas e feriados

- `loadWindow` usa um `try` global: uma falha de Lembretes pode apagar também os eventos já disponíveis. Isolar erros de cada fonte e preservar dados válidos, mantendo o aviso no espaço existente.
- Injetar uma única referência de tempo. `now` capturado no início e chamadas posteriores a `startOfToday()` podem divergir se a execução atravessar meia-noite.
- Testar lembretes recorrentes, datas sem horário em UTC, deduplicação por ocorrência e aniversários atravessando a janela. `isBirthdayText` é heurística ampla; não classificar reunião temática como aniversário sem caso de teste e política definida.
- `loadAutomaticHolidays` considera os anos da janela, mas não o fim dos quatro cartões. Em 30/12 com janela curta pode faltar o ano do quarto cartão. Usar o intervalo completo de dados do cabeçalho.
- Cache de feriados expirado é descartado antes da nova consulta. Não perder datas válidas silenciosamente se a rede cair; separar validade operacional de atualização da fonte, sem declarar informação desatualizada como confirmada.
- Testar a precedência feriado > domingo > sábado, fontes estaduais/municipais e estado sem código IBGE. Não expandir lista legal por suposição.
- Diferenciar fuso do aparelho, fuso da localização e timestamps com offset. Para Open-Meteo considerar epoch e metadados de fuso; testar viagem e horários de verão em locais que os adotem.

Aceite: dados parciais continuam úteis, datas não mudam no meio do render, quatro cartões corretos na virada do ano. Esforço médio/alto.

### P2 — otimização interna e manutenção

1. Construir grafo de chamadas por AST, incluindo funções passadas como callbacks e JavaScript dentro de strings. A varredura textual encontrou candidatos sem referências como `drawTemperatureFooter`, `drawWeatherRainCurtains`, `drawDiagonalWeekdayLabels`, `drawNightScenes`, `loadForecaCredentials` e `compactEventHourMarkers`. Não apagar por regex; há cadeias antigas e caminhos de configuração.
2. `isCompactMode` e `isExtendedDetailedMode` sempre retornam false. Simplificar os ramos mortos após testes; não reintroduzir encolhimento de fontes em >24h.
3. Pré-calcular ticks, datas por pixel/amostra, extremos diários, métricas geométricas e predicado de blur uma vez por execução. Cache em memória deve incluir todas as dependências e não sobreviver indevidamente à mudança de data/local.
4. `drawFixedDaylightGlow` tem loops de faixas × altura e muitas alocações de Color/Rect. Medir; reutilizar cores/gradientes ou raster estático somente se o resultado visual permanecer igual. Não mudar opacidade por soma diferente de camadas.
5. `temperatureAtTimestamp` percorre horas repetidamente; após corrigir cobertura, usar busca binária ou cursor monotônico. Garantir série ordenada e testes de empate.
6. Organizar internamente em dados, regras puras, layout e render. Manter um único arquivo distribuído para o carregador; modularização de desenvolvimento exige build determinístico, não downloads adicionais no widget.
7. Log de diagnóstico opt-in, sanitizado e limitado: duração, origem, quantidade de amostras, cache hit/miss e motivos de fallback. Nunca senha, token, nomes ou coordenadas exatas.
8. Rever comentários obsoletos e duplicação sem mudar o resultado. Documentar no README instalação, URL `main`, parâmetro, cache, licença/atribuição dos provedores e recuperação offline.
9. Carregador fornecido na conversa não está versionado neste repositório. Validar seu apontamento para `main`, download e execução; não supor que foi corrigido no aparelho. Uma mera presença de texto e tamanho mínimo não garante código executável. Propor última versão funcional e fallback de execução sem duplicar efeitos colaterais.
10. `refreshSeconds: 60` é solicitação, não atualização garantida a cada minuto. Não adicionar loops de espera ou animação para forçar o sistema. [Scriptable ListWidget](https://docs.scriptable.app/listwidget/)
11. Astronomia: auditar funções aproximadas, tabela de eclipse fixa e visibilidade local antes de habilitar novos fenômenos. Não ajustar fases/solar 06–18 por preferência técnica: isso alteraria a estética atual.

Aceite: dados e imagens equivalentes nos casos sem defeito; métricas antes/depois no mesmo aparelho/cenário; nenhuma alegação de ganho sem medição. Esforço médio/alto.

## Squircle — prioridade visual, etapa separada

Priorizar o estudo após estabilizar as máscaras, mas não ativar neste pacote conservador. Ver `CARTA-RECOMENDACOES.md`. A borda externa é do sistema; o desenho interno é uma imagem do Scriptable. Não prometer obter automaticamente o caminho nativo nem usar um número supostamente universal de raio.

Entregáveis da fase: comparação de três contornos calibrados (atual, curva contínua aproximada, aproximação por superelipse); captura real com versão do iOS/Scriptable e escala; função compartilhada de caminho/máscara; teste de espessura e recuo; aprovação da comparação antes de ativação. Topos arredondados podem receber o estudo; os cantos inferiores dos cartões futuros continuam em 90°. Círculos dos dias e aros dos astros continuam círculos.

## Matriz mínima de regressão

| Eixo | Casos |
| --- | --- |
| Janela | 1, 12, 24, 25, 36, 48, 72, 96, 97, 168, vazio, zero, negativo, decimal, texto |
| Hora | 00:00, 05:59, 06:00, 11:59, 12:00, 17:59, 18:00, 23:59, execução cruzando 00:00 |
| Agenda | 0/1/5/6/20 itens; dia inteiro; longos; carryover; recorrência; sem horário; permissão parcial |
| Aniversários | 0/1/3/20; nomes iguais com IDs diferentes; cinco eventos + grupo; grupos em dias adjacentes |
| Clima | completo, só primeira/última hora, lacuna central, null/zero/negativo, um provedor falha, ambos falham, cache corrompido |
| Datas | sexta/sábado/domingo/feriado, 28–29/02, 30/12–02/01, troca de fuso e local |
| Render | blur ativo/inativo; texto cruza barras/dias/bordas; contagens longas; todos os perfis de canto |
| Ambiente | iPhone 17 Pro widget médio real, prévia Scriptable, offline, modo de pouca energia; iPad se for utilizado |

Compare imagens com dados e instante fixos. Fora de regiões corrigidas, buscar diferença zero no mesmo ambiente; diferenças de antialiasing devem ser medidas e justificadas, não ignoradas com tolerância ampla. Comparação de canvas com navegador não substitui a fonte/renderização nativos.

## Entrega exigida ao Luna Max

- Um commit por problema ou grupo inseparável, com teste que falhava antes e passa depois.
- Resumo: problema, causa, funções alteradas, teste e impacto visual limitado.
- Tabela de pendências que exigem decisão, especialmente aniversário sem espaço e nomes que excedem a tela.
- Evidência visual antes/depois, métricas reais e limitação do que não foi testado.
- SHA completo publicado e confirmação de que o arquivo servido em `main` corresponde ao validado.
- Não misturar sugestões da carta com correções obrigatórias. Não declarar revisão “100% validada” sem execução real no Scriptable.
