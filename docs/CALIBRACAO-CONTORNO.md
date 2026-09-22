# Primeiro teste do contorno contínuo — 22/09/2026

Base: c1b7e1f7d018af2d397ef4a376ffa1552e24271b. Aparelho informado: iPhone 17 Pro.

## Medição e limite da evidência

A captura recebida mede 1206 × 602 e contém uma prévia do widget, não a
tela inicial inteira em resolução nativa. Não foi inferida uma medida em
pontos do iOS nem um raio universal do aparelho. A imagem pessoal não foi
incluída no repositório; os testes guardam somente amostras da silhueta.

O limite observado fica aproximadamente em x=68,2…1116,2 e y=13,6…506,4.
O ajuste por mínimos quadrados de cada canto, isoladamente, encontrou:

| Canto | Extensão na captura | Expoente | Erro RMS horizontal |
|---|---:|---:|---:|
| Superior esquerdo | 97,28 px | 2,453 | 0,302 px |
| Superior direito | 97,21 px | 2,456 | 0,300 px |
| Inferior esquerdo | 94,56 px | 2,372 | 0,302 px |
| Inferior direito | 96,08 px | 2,428 | 0,313 px |

São ajustes à borda visível com limiar de luminosidade 55/255, sujeitos a
compressão JPEG, antialiasing e contornos sobrepostos. Não são erros medidos
da renderização nativa após a alteração.

## Perfil aplicado

- Canvas 1092 × 510, preservado.
- Cantos de superelipse locais: extensão X=102, Y=101, expoente 2,45.
- Retas entre os cantos; não se aplica uma superelipse ao retângulo inteiro.
- Centro do traço externo recuado 4 unidades lógicas. O traço branco mede 4:
  sua borda permanece dentro do perfil, com folga para rasterização.
- Preenchimento de hoje, moldura lateral, contorno inferior direito,
  canto externo do último cartão, recorte de horas e limite dos aros
  compartilham o perfil. O iOS continua responsável pelo recorte final.
- Removidas as máscaras circulares externas antigas do painel, que
  competiam com o recorte do sistema. Os cantos internos conservam suas regras.
- Cartões futuros começam em y=2, hoje em y=4; nenhum começa em y negativo.
- Títulos usam a maior fonte que permite encaixar as duas linhas: nesta
  geometria, 38 em vez de 40 unidades. Mesma altura e fonte nos quatro.
- Fundo permanece até as bordas. Não foram restauradas margens de 30 px.
- Círculos e aros continuam circulares. Elementos temporais nas extremidades
  podem continuar parcialmente recortados; os títulos fixos devem caber.

## Verificação

`node tests/continuous-contour.cjs` executa funções reais de geometria e do
renderer dos títulos com dados sintéticos. Verifica ajuste às amostras,
igualdade de máscara/caminho, espessura do traço dentro da curva, datas e
detalhes dentro da área, alinhamento dos quatro títulos, círculos e viradas
próximas da borda. Não lê agenda, contatos, clima ou localização.

Executar também os demais testes em `tests/*.cjs`, a verificação de sintaxe
em modo módulo e `git diff --check`.

## Aceite no aparelho ainda pendente

1. Atualizar pelo carregador no Scriptable e observar a prévia média.
2. Conferir o widget real na tela inicial, incluindo os quatro cantos.
3. Enviar captura original da tela inteira e versão do iOS para confirmar
   se a prévia e o widget real têm a mesma escala e curva.
4. Conferir hoje normal e especial, blur ativo/inativo e janelas 24/96h.

Não houve execução no Scriptable/iPhone nem medição de desempenho no aparelho.
Os testes Node não validam métricas exatas da fonte nativa ou antialiasing.
