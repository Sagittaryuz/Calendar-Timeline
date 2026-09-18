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

## Parâmetro da janela

O parâmetro do widget ou `?hours=` aceita horas inteiras de `1` a `96`.
Valores vazios, inválidos ou menores que `1` usam `24`; valores acima de `96`
são limitados a `96`. A janela não é ampliada além desse teto.

- Até `24` horas: legenda e amostras visuais a cada 2 horas.
- Acima de `24` horas: legenda e amostras visuais a cada 12 horas.

O tamanho, as posições e as fontes do widget permanecem os do modo de 24
horas; somente a cadência muda.

## Cache e recuperação offline

O clima é atualizado conforme a validade da previsão e fica armazenado no
`FileManager.local()` do Scriptable. Uma falha de rede não renova a idade do
cache: a última previsão legível pode ser usada offline, mas amostras fora do
horizonte ou com lacunas inválidas não são inventadas. A localização e os
feriados regionais também usam cache local; uma atualização parcial preserva
as datas regionais já conhecidas.

Calendário e Lembretes permanecem dados locais do aparelho. Não há dados
pessoais incluídos no repositório ou nos testes.

## Fontes e atribuições

- Foreca é a fonte meteorológica primária quando as credenciais configuradas
  estão disponíveis; o token não deve ser versionado nem aparecer em logs.
- Open-Meteo complementa lacunas do clima. Consulte a licença e a atribuição
  CC BY 4.0 da API antes de redistribuir o widget.
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
node tests/window-and-holidays.cjs
node tests/hour-legend-clip.cjs
node --input-type=module --check < 'Calendar Timeline'
git diff --check
```

Os testes usam dados fictícios e mocks. A equivalência final de renderização
precisa ser conferida no Scriptable e no widget médio real do aparelho.
