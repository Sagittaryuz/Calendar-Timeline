# Validação Android — 17/10/2026

As demonstrações usam eventos, lembretes e clima fictícios, identificados como demonstração. As imagens de validação não contêm a agenda pessoal.

## Implementação

App Java nativo + `AppWidgetProvider`/RemoteViews com bitmap, formato recomendado 4 × 2. A rasterização usa as funções do arquivo `Calendar Timeline` dentro de um canvas local Android System WebView. Cabeçalho, cores, geometria, ordem de agenda, curva de temperatura, meia-noite, círculo e cápsulas vêm do projeto existente. O contorno externo medido é aplicado pela adaptação Android. Os arquivos originais Scriptable e Loader não foram alterados. Não havia uma versão web separada neste checkout.

A comparação visual considerou estrutura e geometria, sem reproduzir os compromissos da imagem. A fonte Apple arredondada é substituída pelas fontes do sistema Android. A aparência final depende também da versão do System WebView, densidade, tamanho e launcher. Não representa garantia de igualdade pixel a pixel em todos os aparelhos.

## Evidências concluídas

- Build `:app:assembleDebug` e `:app:assembleDebugAndroidTest` com JDK 17, Gradle 8.13, AGP 8.9.2, Android SDK 35/Build Tools 35.0.0.
- Android Lint sem erros. Avisos remanescentes: textos em português ainda não extraídos para localização, atributos de widget ignorados antes da API 31, e ativação intencional de JavaScript restrita aos assets locais.
- 33/33 testes Node existentes aprovados. Sintaxe do Scriptable e `git diff --check` aprovados.
- Parser ES2020 aprovado nos três assets JavaScript; três operadores ES2021 dos coletores são convertidos no pacote Android para compatibilidade com WebView 83+.
- 48 composições de canvas aprovadas em Chromium: fusos America/Sao_Paulo, UTC e America/New_York; janelas 1/24/48/96 h; início/meio/fim do dia e limite de parada do cabeçalho. Verificadas transparência dos cantos, composição íntegra, mudança por horário/horizonte, limpeza de overlays, ausência de temperaturas inventadas sem fonte e títulos tratados como dados.
- APK debug verificado pelo `apksigner`, assinatura v2. Nenhuma chave release, publicação na Play Store ou instalação em telefone físico.

## Dispositivo e QA visual

AVD oficial **Android SDK built for x86_64**, Android 11 / API 30, System WebView **83.0.4103.120**, launcher AOSP Launcher3. Dados fictícios fixos em 17/10/2026 às 12:10.

| Cenário | Evidência |
| --- | --- |
| Widget no launcher | Instância real adicionada pelo diálogo Android, 4 × 2, captura 720 × 1280 / 320 dpi |
| App e segundo perfil | Captura 1080 × 1920 / 420 dpi |
| Rotação | App em paisagem 1920 × 1080, prévia completa acessível por rolagem, configurações preservadas |
| Tamanhos do widget | RemoteViews publicado em 240/360/480 dp com uma instância vinculada, sem exceções |
| Toque | Abriu `com.android.calendar/.AllInOneActivity` com Intent para a hora atual |
| Permissão | Diálogo runtime real de READ_CALENDAR e concessão confirmada pelo sistema; sem WRITE_CALENDAR/GPS |
| Offline | Wi-Fi e dados móveis desativados; job periódico 201 forçado concluiu e gravou imagem nova, em demonstração |
| Cache/render | 3/3 testes instrumentados aprovados, incluindo dimensões 1092 × 510 e transparência dos cantos |

As telas do app e launcher são capturas reais do emulador. O detalhe 1092 × 510 é o bitmap exportado pelo próprio renderer Android, identificado separadamente. A cápsula da meia-noite e o texto diagonal estão presentes; o teste adicional verifica que suas camadas não ficam transparentes após fechar o documento temporário.

A API 35 foi usada para compilar. O emulador Android 15 apresentou ANRs do System UI e falhas de captura sem KVM; não há aprovação visual nessa versão nem em telefone físico. As imagens finais correspondem ao Android 11. Os ANRs foram registrados durante a preparação do emulador; as capturas finais não foram editadas para removê-los.

A grade e os espaços reservados são controlados pelo launcher. A imagem conserva a proporção 1092:510, inclusive quando a área do widget reserva altura extra. Fontes do Android e seu antialiasing diferem do iOS; não se afirma igualdade pixel a pixel.

APK inicial 0.1.0: SHA-256 `70b3a27aacea9ed811de387a8f9f297f5abf2d3ce9513de764713c198b0bcea3`. Substituído pela atualização abaixo.

## Limites de integração

Android consulta calendários locais visíveis e suas recorrências pelo CalendarContract. Lembretes são locais: não sincronizam com Lembretes Apple/Google Tasks. Clima usa somente Open-Meteo com ativação explícita e coordenadas manuais; não usa GPS, credenciais, OAuth, Foreca, Rainbow ou MET Norway. Feriados aparecem quando fornecidos pelos calendários locais; as consultas regionais automáticas do Scriptable não foram conectadas. Agenda e cache permanecem privados e sem backup. Atualização em segundo plano é solicitada a cada 15 min e depende do agendador/bateria Android; o app aberto redesenha a cada minuto. Toque abre o calendário instalado, com fallback para configuração quando não existe aplicativo compatível.


## Atualização do clima — 0.1.1-debug

O clima continua opcional, sem GPS e sem localização presumida. O botão “Configurar clima” fica junto à prévia; ativar e salvar coordenadas autoriza a consulta e desliga a demonstração. O status mostra Open-Meteo e o horário da consulta, ou indica clima desligado, localização ausente, rede, conexão segura ou resposta inválida. “Atualizar agora” ignora o intervalo de 30 min do cache. Uma falha não substitui uma previsão válida nem renova sua idade; mudanças de coordenadas/fuso não reutilizam o clima anterior.

A validação real usa somente coordenadas públicas fixas de Jataí (-17.8814, -51.7144), agenda vazia e demonstração desligada. O teste separado de consulta real passou (1/1, 41,442 s). O botão “Atualizar agora” foi acionado na interface do APK final: o horário da consulta mudou de 21:28 para 21:34 UTC, confirmando uma nova requisição dentro dos 30 minutos de cache. O atalho “Configurar clima” revelou as coordenadas públicas corretas e a fonte habilitada; o toque no widget abriu o calendário nativo. A consulta HTTPS nativa recebeu 336 horas e 14 resumos diários; o canvas Android desenhou 50 rótulos de temperatura. A geometria do renderer original permanece intacta. A suíte final aprovou 8/8 testes instrumentados: canvas real, publicação do widget em três larguras, cache privado e cinco regressões de clima (opt-in, localização ausente, consulta forçada, resposta inválida, troca de localização e expiração). Os 33 testes Scriptable e os 48 cenários de navegador também passaram, com a resposta Open-Meteo verificada nos três fusos.

O teste offline separado passou no APK final (1/1, 31,021 s), com Wi-Fi e dados móveis desligados. A atualização forçada publicou uma nova imagem mantendo as 336 amostras e os 50 rótulos de temperatura, exibiu “cache, sem conexão com Open-Meteo” e preservou o timestamp da consulta de 21:34 UTC. A rede foi restaurada após o teste. As capturas reais do app e launcher em 1080 × 1920 mostram o clima real com agenda vazia.

O emulador cloud exige o proxy de saída do ambiente. A CA já confiável no host foi adicionada somente à sessão descartável do AVD; nenhuma CA, endereço de proxy ou exceção TLS entra no APK. A primeira tentativa sem essa configuração falhou por rede; não foi tratada como sucesso de consulta. Validação em telefone físico continua pendente.

APK 0.1.1-debug SHA-256: `f8f03b7ebe2f789992ef92c7d1f619c6d67a83ac8cc455c00e1f61957862d731`.


## Entrada de coordenadas — 0.1.2-debug

Vírgula decimal e sinal negativo `-` já eram normalizados. Esta atualização também aceita o sinal menos Unicode `−` copiado de mensagens e impede que o filtro numérico do Android remova silenciosamente a vírgula ou esse sinal antes da validação. O teclado continua numérico; valores inválidos ou fora dos limites continuam rejeitados. Nenhuma permissão ou solicitação de GPS foi adicionada.

Verificados em Android 11 os valores `-17,88`, `−17,88`, `-51,71` e `−51,71`, com colagem nos contextos PT-BR e inglês. A suíte de clima aprovou 7/7 testes no APK final (7,403 s), incluindo separadores, ambos os sinais negativos, preservação de colagem e os cinco testes de cache/ativação. Build e lint aprovados; APK debug atualiza a instalação anterior com a mesma assinatura. As capturas de clima real anteriores continuam representando o renderer, que não foi alterado.

APK 0.1.2-debug (versionCode 3), SHA-256: `397d3a01bcc42e6a03685ab625c202b0786634d811bb6191478ce0a2b2df37da`.
