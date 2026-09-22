# Perfil contínuo dos cartões

Os cantos arredondados dos cartões agora usam o expoente 2,45 do contorno
externo, com extensões de referência 102 × 101 no canvas lógico.
Quando dois cantos compartilham uma lateral curta, suas extensões são
reduzidas juntas para evitar cruzamento. Cantos retos seguem retos. O canto
externo do último cartão mantém o caminho já calibrado.

O canto superior direito de hoje reflete o superior esquerdo pelo centro
do cartão. A ponte para a linha móvel usa o mesmo perfil, limitada ao
espaço vertical restante e à distância da virada. Preenchimento e traço
usam o mesmo construtor de caminho. Fontes e posições dos textos não mudam.

Os marcadores superiores de precipitação sobem 5 unidades lógicas,
incluindo o raio que substitui a gota. Barras inferiores não se deslocam.

Verificação: testes Node de espelhamento, finitude, monotonicidade vertical,
extremidades da ponte e preenchimento do centro dos cartões. Todas as
rotinas de regressão e a checagem de sintaxe passam. Renderização e leitura
dos títulos dentro dos novos cantos ainda exigem conferência no Scriptable.
