# Calendar Timeline

Widget médio para Scriptable que combina Calendário, Lembretes, previsão do
tempo e uma timeline contínua de até 96 horas.

## Instalação

1. No Scriptable, cole o conteúdo de
   [Calendar Timeline Loader](https://raw.githubusercontent.com/Sagittaryuz/Calendar-Timeline/main/Calendar%20Timeline%20Loader)
   no **script carregador existente**, mantendo seu nome. Para uma instalação
   nova, crie esse script e selecione-o no widget.
2. O carregador continua buscando o arquivo distribuído no mesmo destino:

   `https://raw.githubusercontent.com/Sagittaryuz/Calendar-Timeline/main/Calendar%20Timeline`

3. Permita ao Scriptable acessar Calendário, Lembretes, Localização e rede.
4. Execute o script uma vez no aplicativo para autorizar as fontes e conferir
   a prévia.

O arquivo servido no `main` é autocontido e deve ser executado pelo Scriptable;
os arquivos em `tests/` são testes Node e não fazem consultas ao calendário
pessoal.

O canto inferior direito mostra a versão gravada no script executado, acima do
blur. A revisão `v2026.09.30.13` centraliza a segunda linha pelo retângulo de
cada quadro, com tamanho e altura comuns aos sete dias, sem compensar
as curvas. A revisão `v2026.10.02.1` desenha os títulos da timeline por inteiro,
com a fonte original, e recorta somente os pixels no contorno externo do widget.
Nomes longos não recebem abreviação ou reticências do layout de texto; letras
na borda podem aparecer parcialmente. O encaixe do círculo inferior permanece na posição aprovada. Permite títulos e aniversariantes além do fim
do chart ou do dia, limitando o texto somente pelo contorno externo.
Os textos dos quadros são centralizados pela área visível,
considerando o contorno externo e as curvas dos quadros adjacentes a hoje.
Textos e marcadores da timeline respeitam margens curvas, sem mover os charts
ou seus horários; temperaturas nas extremidades usam recorte pelo contorno. A moldura branca fica somente no dia de hoje. O conjunto
das duas linhas mantém o deslocamento de 10 px para baixo e os títulos alinham
a borda direita ao clima no domingo e a borda esquerda no sábado. A curva
esquerda mantém direção e raio; os quadros adjacentes acompanham os traços
com o espaçamento existente. Dias úteis sob blur usam cinzas mais claros.
A altura do cabeçalho e o encaixe inferior aprovado permanecem fixos. Se a versão não
aparecer, confira se o carregador está buscando o arquivo de `main`, em vez de
executar uma cópia antiga em cache.


A revisão `v2026.10.08.1` remove posições fixas e reservas de linhas para
eventos de dia inteiro e aniversários. Eventos com horário, lembretes e
feriados mantêm sua prioridade relativa; depois entram os eventos de dia
inteiro e, por último, aniversários. Os itens usam as linhas livres de cima
para baixo: sozinhos, também podem ocupar a primeira linha. Continuações
preservam a linha e a geometria do dia de origem.

A revisão `v2026.10.08.2` liga também os charts dos lembretes com horário
à régua de horas, usando os mesmos trechos, cor, espessura, posição e regras
de visibilidade dos eventos. Lembretes sem horário não recebem essa conexão
vertical; a data original e a ordenação da agenda permanecem preservadas.

A revisão `v2026.10.08.3` mantém a bolinha e o título dos lembretes junto
à margem esquerda da barra. Quando há excedentes, o indicador `+N` ocupa a
extremidade direita da barra do lembrete. O título, seu prefixo e a sombra são
recortados na área disponível antes do indicador ou do fim da barra, também
nas curvas do widget, evitando invadir o chart seguinte. O texto original,
a fonte, as datas e as linhas até os horários permanecem preservados. Eventos
mantêm a regra anterior de títulos integrais recortados pelo contorno externo.

A revisão `v2026.10.08.4` define o toque do widget como abertura do
Calendário nativo do iOS, usando `calshow://` diretamente em `widget.url`.
Essa propriedade tem precedência sobre a configuração de toque do Scriptable:
[documentação de ListWidget.url](https://docs.scriptable.app/listwidget/#url).
Links antigos de atualização ainda recalculam o widget e encaminham ao
Calendário. A atualização periódica, o parâmetro de horas e os caches são
preservados; nenhuma preferência ou dado de calendário é apagado.

A rota abre o aplicativo, sem escolher uma data ou evento. O esquema
`calshow` não tem contrato público da Apple para navegação por data e não foi
testado nesta revisão em um iPhone físico. Execute o carregador atualizado
ou aguarde uma atualização do widget para substituir a URL da cópia anterior.

A revisão `v2026.10.08.5` coloca lembretes com horário definido antes dos
lembretes de dia inteiro/sem horário, mesmo quando estes últimos estão
atrasados. A seleção e as linhas respeitam essa precedência dentro do dia.
Após compartilhar uma linha, o próximo lembrete usa a primeira faixa vazia,
evita lacunas e mantém os sem horário abaixo dos com horário.

A hierarquia efetiva por dia, da maior para a menor prioridade, é:

1. Eventos com horário.
2. Lembretes com horário atrasados.
3. Lembretes com horário não atrasados.
4. Lembretes sem horário atrasados.
5. Lembretes sem horário não atrasados.
6. Feriados provenientes do Calendário.
7. Outros eventos de dia inteiro.
8. Aniversários, agrupados por dia.

Dentro de cada classe, menor início vem primeiro, depois menor fim; empates
preservam a ordem de entrada. Nomes dentro do grupo de aniversários seguem
ordem alfabética em português. Os estados de evento em andamento, próximo,
conflitos e a prioridade nativa dos lembretes afetam a apresentação, mas não
substituem esse comparador. O helper legado `itemImportance` não é chamado
pelo motor de seleção.

As consultas regulares trazem lembretes incompletos. Pendências de dias
anteriores reaparecem como atrasadas no dia atual quando a opção de atrasados
está habilitada; o horário já vencido de hoje não recebe automaticamente essa
classificação de dia anterior. Dias futuros mantêm seu próprio agrupamento.
A janela visível filtra os intervalos. Itens temporizados podem compartilhar
uma linha compatível; lembretes sem horário não compartilham. Continuações
que cruzam a meia-noite conservam a linha e a grade de origem. Essas regras
geométricas não representam uma nova prioridade. As grades diárias usam cinco
ou seis linhas conforme a contagem existente, sem posições fixas ou reservas
para eventos de dia inteiro e aniversários. Excedentes geram o indicador diário
`+N`; aniversários sem linha livre ficam ocultos sem gerar excedente artificial.

A revisão `v2026.10.08.6` remove a extensão iniciada às 12h que levava
charts de lembretes pendentes até as 06h do dia seguinte. Cada chart de
lembrete termina, no máximo, nas 00h que encerram seu próprio dia; intervalos
menores já existentes não são ampliados. A regra vale antes, exatamente e
depois do meio-dia, para lembretes com ou sem horário, futuros e atrasados.
Pendências antigas reapresentadas em hoje usam a meia-noite que encerra hoje.
Na virada, a reapresentação como atrasado continua a cargo da consulta normal,
sem uma barra estendida desde o dia anterior.

A limitação atua somente sobre a cópia preparada para o desenho. Datas,
horários de vencimento, títulos e prioridades da fonte não são alterados.
Eventos reais que atravessam a meia-noite mantêm sua duração. Hierarquia,
margens, linhas até os horários e toque no Calendário permanecem preservados.
A regressão diária está em `tests/reminder-day-end.cjs`.

A revisão `v2026.10.08.7` mantém o fim temporal da barra do lembrete, mas
permite que o título use o espaço livre até o contorno da timeline. A curva do
widget continua recortando também as sombras; o espaço do `+N` segue reservado,
e a seleção de linhas impede sobreposição com charts do mesmo trecho e de dias
adjacentes. A barra não é ampliada para acomodar o título. O teste de desenho
está em `tests/timeline-title-clip.cjs`.

## Parâmetro da janela

O parâmetro do widget ou `?hours=` aceita horas inteiras de `1` a `96`.
Valores vazios, inválidos ou menores que `1` usam `24`; valores acima de `96`
são limitados a `96`. A janela não é ampliada além desse teto.

- Até `24` horas: legenda e amostras visuais a cada 2 horas.
- Acima de `24` horas: legenda e amostras visuais a cada 12 horas.

O tamanho, as posições e as fontes do widget permanecem os do modo de 24
horas; somente a cadência muda.

## Quadros da semana

O cabeçalho mostra sete quadros fixos da semana corrente, de domingo a sábado.
A moldura branca acompanha o dia atual. As larguras dividem a faixa em sete;
a altura atual do cabeçalho é fixa. Cada dia usa cinco linhas quando há até
cinco charts e seis quando há seis ou mais. A contagem considera somente os charts de origem daquele dia e agrupa
aniversários na sua linha conjunta. As continuações de dias anteriores não
entram nessa contagem; mantêm posição, altura, fonte e título de origem.
Os dias com cinco linhas recuperam as barras e fontes maiores; nos dias com
seis, as barras e os textos menores preservam os vãos. A regra vale de forma
independente para hoje, amanhã e os demais dias da janela.

As duas linhas preservam o deslocamento vertical de 10 px. O centro horizontal
da primeira linha considera a área disponível em toda sua altura, incluindo
as curvas externas e as curvas dos cartões vizinhos ao dia atual. No domingo, a borda direita do grupo dia + data coincide com a borda direita
da linha completa mínima/ícone/máxima; no sábado, coincidem as bordas esquerdas.
Os demais dias preservam o centro disponível da primeira linha.
A segunda linha usa o centro retangular e a mesma regra de tamanho nos sete
quadros, sem deslocamento ou redução por causa das curvas:

- `DOM 27`: dia da semana e dia do mês em fonte de maior peso, com letras bem
  próximas e o maior tamanho que cabe no contorno. Domingo alinha o grupo pela
  direita ao clima; sábado alinha pela esquerda.
- Mínima, ícone do clima e máxima: fonte menor, mínima azul e máxima vermelha,
  centradas na porção inferior do conjunto. Os contadores E/L saem do cabeçalho.

Os cantos internos superiores da moldura de hoje têm raio suave de 6 unidades
verticais, preservando as curvas externas do widget.

A agenda cobre a semana inteira. O Open-Meteo inclui os dias anteriores e seus
resumos diários de mínima, máxima e condição do clima. Esses resumos são
preservados no cache e fornecem o ícone se faltarem amostras horárias válidas.
O cache passa por migração e só é reutilizado sem consulta quando cobre também
os dias anteriores da semana. Dados ausentes continuam como `--º` e nenhuma
condição é inventada. Os resumos representam os dados de modelo fornecidos
pela API, não medições de uma estação meteorológica.

## Contagem até eventos e lembretes

As contagens usam horas com uma casa decimal (`2h`, `2,5h`) e minutos abaixo
de uma hora. A cápsula da mudança de dia mantém `2h e 30m`.

Na mesma faixa, os números ficam alinhados ao centro: margem inicial de
15 px, texto, vão de 2 px, trecho tracejado de 45 px e novamente margem de
15 px antes do próximo número. Os tracejados ocupam níveis igualmente
espaçados por `1/(N+1)`, do evento mais próximo no alto ao mais distante embaixo.
Quando o espaço até os charts diminui, as últimas contagens somem primeiro;
a primeira também some se não couber. Isso vale igualmente para uma contagem
sozinha, sem um limite fixo de uma hora.

## Cache e recuperação offline

O clima é atualizado conforme a validade da previsão e fica armazenado no
`FileManager.local()` do Scriptable. Uma falha de rede não renova a idade do
cache: a última previsão legível pode ser usada offline, mas amostras fora do
horizonte ou com lacunas inválidas não são inventadas. A localização e os
feriados regionais também usam cache local; uma atualização parcial preserva
as datas regionais já conhecidas.

## Consenso de previsão de chuva

A timeline combina Foreca, Open-Meteo e MET Norway por hora: usa a mediana
para reduzir o efeito de um valor isolado, registra a amplitude e o desvio
absoluto mediano (MAD), e calcula uma indicação de concordância entre os
modelos. Essa análise é local e determinística; não treina nem chama um modelo
de linguagem. Com uma chave opcional, o nowcast de precipitação do Rainbow.ai
complementa as primeiras quatro horas. A última resposta válida do Rainbow é preservada para recuperação offline.
A atualização automática solicita 15 minutos; cada toque ou execução manual
pode consultar novamente, portanto não há um teto diário imposto pelo cache.
Os intervalos do nowcast mantêm a resolução de 15 minutos: trechos secos
cobertos pelo radar não herdam a coluna horária dos modelos, e as barras
chuvosas aparecem no horário previsto pelo radar.

Para conectar o Rainbow, crie uma chave no portal de desenvolvedores e execute
o script no app Scriptable com o parâmetro `rainbow=connect`. A chave é salva
no Keychain do iPhone e nunca deve ser colada no repositório. Exemplo de URL
do Scriptable: `scriptable:///run?scriptName=Calendar%20Timeline&rainbow=connect`.

Calendário e Lembretes permanecem dados locais do aparelho. Não há dados
pessoais incluídos no repositório ou nos testes.

## Fontes e atribuições

- Foreca, Open-Meteo e MET Norway fornecem os modelos horários combinados;
  nenhum provedor substitui sozinho os demais.
- Rainbow.ai fornece nowcast de precipitação de curto prazo. A integração é
  opcional e requer chave pessoal no Keychain.
- Consulte as condições de redistribuição e atribuição de cada API antes de
  publicar o widget.
- Datas nacionais são calculadas localmente; datas estaduais e municipais são
  consultadas no projeto
  [feriados-brasil](https://github.com/joaopbini/feriados-brasil).

## Testes locais

Na raiz do repositório:

```sh
node tests/title-card-corners.cjs
node tests/title-card-fill-and-birthday.cjs
node tests/agenda-priority.cjs
node tests/weather-data.cjs
node tests/window-hours.cjs
node tests/window-and-holidays.cjs
node tests/hour-legend-clip.cjs
node tests/timeline-title-clip.cjs
node tests/event-arrival-guide.cjs
node tests/all-day-event-start.cjs
node tests/reminder-day-end.cjs
node tests/overflow-day-projection.cjs
node tests/refresh-safety.cjs
node tests/widget-tap-target.cjs
node tests/loader-offline.cjs
node --input-type=module --check < 'Calendar Timeline'
git diff --check
```

Os testes usam dados fictícios e mocks. A equivalência final de renderização
precisa ser conferida no Scriptable e no widget médio real do aparelho.

A revisão `v2026.10.09.1` liga o cabeçalho à coordenada temporal da
próxima meia-noite. HOJE ocupa exatamente 1/7 da largura útil, com topo e
lado direito retos e curva somente embaixo à esquerda. Na janela padrão de
24 horas, começa à direita, desliza com a régua e para inteiro na primeira
posição às 20:34:17 aproximadamente; a régua continua até a meia-noite.
O novo dia reinicia à direita. A curva na primeira posição usa raio menor
para permanecer visível dentro do canvas e não cruzar o clima.

Os demais quadros mantêm datas consecutivas e o mesmo deslocamento, sem
sobreposição. Quadros que ainda não cabem inteiros nas extremidades não
mostram textos parciais; entre posições inteiras há seis quadros completos.
Janelas de 1–96 horas preservam a transformação real da timeline: a âncora
segue sua meia-noite visível e é limitada às extremidades do cabeçalho. Assim,
em janelas maiores que 24 horas, HOJE começa mais à esquerda e chega à
primeira posição antes; os eventos não mudam de escala para forçar o cabeçalho.
O horizonte de clima cobre os seis dias anteriores e os seis seguintes.

Validação local: `node tests/moving-day-header.cjs` cobre 160 composições,
quatro larguras, textos completos, alinhamentos, fundo selecionado, cantos,
parada, meia-noite e viradas de mês/ano. A prévia sintética usa as funções
reais de desenho e dados fictícios. Sem teste físico em iPhone/Scriptable.
A suíte `event-arrival-guide.cjs` já falhava na revisão base `5f45eb4`,
na assertion da linha 730; o mesmo erro permanece e não foi alterado neste
escopo. Não há workflow de GitHub Actions versionado no repositório.

A revisão `v2026.10.09.2` permite recortar normalmente os quadros não
atuais nas duas extremidades. Suas posições e seus textos acompanham
exatamente o deslocamento da coordenada temporal da meia-noite, inclusive
depois da parada de HOJE. Só HOJE recebe clamp; os outros passam por baixo
de sua camada sem empurrar ou travar os próximos dias. O quadro parcial do
sétimo dia futuro também entra à direita. As datas continuam depois de
domingo, inclusive segunda-feira, cruzando semanas, meses e anos.

Open-Meteo solicita no mínimo oito dias de previsão (hoje e sete seguintes),
com seis dias anteriores e fuso do dispositivo. O cache fresco exige resumos
diários futuros válidos, com condição e timestamps de atualização próprios;
uma série horária completa não basta para ocultar um resumo ausente ou antigo.
Dados ausentes continuam sem temperaturas/ícone inventados. A documentação
permite até 16 dias: https://open-meteo.com/en/docs . Uma consulta pública
de teste em America/Sao_Paulo retornou 03–16/10/2026, incluindo segunda-feira
12/10; o parser e o renderizador foram verificados com esse retorno real.

Validação: 160 composições do cabeçalho; recortes parciais nas duas bordas;
progressão por minuto antes/depois do clamp, inclusive janelas 1/12/24/48/96h;
resumos diários, ausência/freshness e viradas de datas. Prévia sintética
inspecionada. A imagem do relato não pôde ser materializada: o helper oficial
da Library retornou HTTP 403; não foi alegada sua inspeção. A falha antiga de
`event-arrival-guide.cjs` continua registrada. Sem teste físico em iPhone.

A revisão `v2026.10.09.3` centraliza o grupo dia/data de sábado e domingo
no mesmo centro da segunda linha de clima. Remove os antigos alinhamentos
pelas bordas do clima. Dias úteis preservam exatamente as posições de .2;
cores, fontes, temperaturas, movimento, recortes e clamp não mudam.

QA: nove estados comparáveis de .2 e .3, com mesmos dados públicos e canvas,
incluindo SÁB/DOM inteiros, recortes esquerdo/direito e HOJE útil/sábado/domingo
antes/depois da parada. Comparação de 7539 operações de desenho: apenas 120
posições de glifos SÁB/DOM diferem. Rasterização também confirma zero mudanças
fora das áreas dos títulos de fim de semana. Prévia sintética rasterizada,
sem teste físico em Scriptable/iPhone. Falha preexistente de conectores na
linha 730 permanece documentada.

A revisão `v2026.10.10.1` finaliza o badge e seu recorte de título ao terminar
a seleção de cada dia, antes de reservar linhas no dia seguinte. Antes, um
título longo de hoje podia reservar uma linha de amanhã mesmo quando seus
pixels já seriam ocultados pelo `+N`, produzindo um excedente artificial sem
barra de apoio. Com oito tarefas hoje e sete amanhã, a fixture anterior
mostra `+2`/`+2`; a corrigida mostra `+2`/`+1`. Com seis amanhã, o segundo
badge desaparece. Oito em cada dia continuam mostrando dois `+2` legítimos.

O indicador segue a projeção temporal do próprio dia e o contorno visível;
se não houver espaço para seus 62 px completos, ele não migra para outro dia.
Eventos que atravessam a meia-noite conservam suas reservas reais. Prioridade,
títulos fonte, cabeçalho móvel/sticky, clima e consultas permanecem preservados.
Os mocks de consultas verificam cópias repetidas e ocorrências com o mesmo
identificador em datas distintas.

QA: 27 arquivos de teste locais aprovados; regressão nova com 107 cenários
mais janelas 1/12/24/48/96h e grades 6→5, também em UTC, America/Sao_Paulo,
America/New_York e Pacific/Auckland. Inclui zero/múltiplos ocultos, movimento,
virada de dia/mês/ano, DST, extremos e eventos multi-dia. Captura original
v2026.10.09.3 materializada pela Library e inspecionada localmente; imagem
antes/depois produzida com dados fictícios e geometrias do motor real.
Essa simulação não confirma os registros pessoais da captura nem substitui
validação física no Scriptable/iPhone.

A revisão `v2026.10.10.2` muda o toque principal para executar novamente o
carregador pelo nome atual de `Script.name()`, com `refresh=1` e a janela de
horas preservada. Cada execução lê Calendário e Lembretes locais e tenta
novas previsões antes de recorrer ao cache, inclusive quando a cópia ainda
é recente. Não modifica eventos ou lembretes reais. O resultado do toque
mostra data/frescor de cada fonte e oferece “Abrir Calendário” separadamente.

Os snapshots de Calendário e Lembretes são separados e ficam somente no
`FileManager.local()` do aparelho. Uma fonte incompleta, negada, inválida ou
com timeout não substitui seu snapshot válido. Uma resposta local vazia
válida substitui corretamente os dados antigos. O clima conserva amostras
antigas para preencher lacunas, com datas originais por amostra; dados mistos
são identificados como parcial/cache. HTTP de erro, JSON inválido e falhas de
rede não renovam sua idade. Escritas são verificadas em arquivo temporário,
mantêm uma cópia anterior e recuperam essa cópia quando a atual está ausente
ou corrompida. Filtros de calendários/listas são conferidos ao recuperar dados.
Localização sem resposta válida também não recebe uma nova data artificial.

O rodapé mostra C/L/T com data da última resposta válida e indicação de cache
quando necessário. Cópias antigas podem conter registros que foram alterados
desde sua coleta; mantêm suas datas e só aparecem nos intervalos conhecidos.
Sem uma coleta válida anterior, não há dados a recuperar. Clima fora do seu
horizonte continua ausente, sem inventar previsão.

`refreshAfterDate` solicita nova execução **a partir de 15 minutos**; não é um
timer garantido. A frequência e a atualização da tela inicial são decididas
pelo iOS conforme energia e uso, como descreve a
[documentação do Scriptable](https://docs.scriptable.app/listwidget/#refreshafterdate).
Toques manuais podem realizar consultas adicionais, inclusive ao Rainbow.
O carregador precisa continuar encaminhando `args` e executando o código
baixado; o link usa seu nome real, sem instalar outro script.

Validação: 28 arquivos de teste locais aprovados, incluindo execução do ramo
de toque/Widget/Siri/prévia, preservação de nome e horas do carregador, cliques
repetidos, offline→online, permissões e respostas locais inválidas, cache
faltante/corrompido e recuperação por fonte. Também cobre HTTP/JSON/timeout,
lista vazia válida e conclusão de execuções fora de ordem. São doubles
Scriptable em Node; sem teste físico no iPhone nem promessa de sincronização
imediata dos serviços iCloud ou de redesenho da tela inicial pelo iOS.

O **Calendar Timeline Loader v2026.10.10.1** fecha a inicialização offline.
O carregador externo que já estava no iPhone não foi localizado nos arquivos
acessíveis, nos 585 commits das três branches do projeto (`main`,
`codex/seven-day-week-cards`, `feature/diagonal-date-label`) nem nas buscas de
código disponíveis. Portanto não há evidência de que ele guardava código
local, e a atualização remota do widget não consegue corrigir esse script
externo quando seu próprio download falha antes da execução do programa.

A versão pronta acima conserva o destino, encaminha as mesmas referências de
`args`/`config` e mantém `Script.name()`. Antes do cache, tenta código novo com
timeout de oito segundos e pedido `Cache-Control: no-cache`. HTTP de erro,
HTML/JSON/vazio/truncamento, sintaxe inválida e execução quebrada não promovem
o candidato ao cache. O código só é gravado após concluir sua execução. A
finalização nativa `Script.complete()` é encaminhada depois da persistência;
`Script.setWidget()` mantém sua entrega imediata, antes do diálogo ao toque.
Cache, backup e metadados de versão/data ficam no `FileManager.local()`, com
checksum contra corrupção acidental e escrita temporária verificada.

Mesmo sem qualquer cache anterior, o carregador inclui o programa completo
`v2026.10.10.2`, SHA-256
`6b73e29a077166c35994b3866f398f1e14858db719d1cdd84d1f56af09cec448`, para
iniciar offline. A versão obtida e executada com sucesso online tem preferência
nas próximas recuperações; se as cópias locais falharem, usa o programa
incluído. Isso fornece código executável, sem inventar clima ou dados de
fontes que nunca foram coletadas. A data do código não muda em tentativas
offline. Se nem o programa incluído conseguir executar, apresenta um estado
de indisponibilidade com nova tentativa, em vez de simular uma agenda vazia.

Teste adicional `loader-offline.cjs`: compila o programa completo, verifica
que o bundle coincide byte a byte com o arquivo distribuído e executa sua
entrada principal com doubles de coleta/desenho. Cobre inicialização offline
sem cache, offline→online, parâmetros/nome/toque/prévia/Siri, checksum/backup,
HTTP/HTML/JSON/sintaxe/runtime e escrita interrompida. Não confirma execução
física no iPhone ou alteração do carregador que já está instalado. É preciso
substituir seu conteúdo pelo arquivo pronto, conservando nome e configuração.

Ao publicar uma nova versão do programa, mantenha o bootstrap atualizado:

```sh
node tools/update-loader-bundle.cjs
node tests/loader-offline.cjs
node --input-type=module --check < 'Calendar Timeline Loader'
```
