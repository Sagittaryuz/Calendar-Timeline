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
blur. A revisão `v2026.09.30.7` amplia novamente a fonte e o espaçamento entre
as letras dos títulos. A moldura branca fica somente no dia de hoje. O conjunto
das duas linhas mantém o deslocamento de 10 px para baixo e os títulos mantêm
recuos de 5 px no domingo e no sábado. A curva
esquerda mantém direção e raio; os quadros adjacentes acompanham os traços
com o espaçamento existente. Dias úteis sob blur usam cinzas mais claros.
A altura do cabeçalho e o encaixe inferior aprovado permanecem fixos. Se a versão não
aparecer, confira se o carregador está buscando o arquivo de `main`, em vez de
executar uma cópia antiga em cache.

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
cinco charts e seis quando há seis ou mais. A contagem inclui compromissos
que atravessam a meia-noite e agrupa aniversários na sua linha conjunta.
Os dias com cinco linhas recuperam as barras e fontes maiores; nos dias com
seis, as barras e os textos menores preservam os vãos. A regra vale de forma
independente para hoje, amanhã e os demais dias da janela.

Cada quadro usa duas linhas centradas em conjunto pela caixa dos quadros comuns,
inclusive no dia atual:

- `DOM 27`: dia da semana e dia do mês em fonte de maior peso, com letras bem
  próximas e o maior tamanho que cabe no contorno. Domingo recua 5 px para a
  direita; sábado recua 5 px para a esquerda.
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
node tests/event-arrival-guide.cjs
node tests/all-day-event-start.cjs
node --input-type=module --check < 'Calendar Timeline'
git diff --check
```

Os testes usam dados fictícios e mocks. A equivalência final de renderização
precisa ser conferida no Scriptable e no widget médio real do aparelho.
