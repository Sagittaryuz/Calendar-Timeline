# Calendar Timeline

Widget médio para Scriptable que combina Calendário, Lembretes, previsão do
tempo e uma timeline contínua de até 96 horas.

## Instalação

1. Crie um script no Scriptable com o carregador do widget.
2. Faça o carregador buscar o arquivo distribuído em `main`:

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
complementa as primeiras quatro horas. A resposta do Rainbow fica em cache por
15 minutos (até 96 consultas por dia para uma localização), abaixo da franquia
gratuita anunciada pelo serviço para um único widget.
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
