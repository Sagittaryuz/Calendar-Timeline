Esta branch prepara a **0.6.0 de revisão dos provedores**, com [configuração OAuth ainda pendente, escopos e limites](../docs/ANDROID-TASK-PROVIDERS.md). Google/Microsoft/Samsung não estão conectados ou validados em contas reais. O APK utilizável entregue na Library continua sendo a **0.5.0**, com [diagnóstico, fontes e permissões](../docs/ANDROID-MARCO-0.5.md). O calendário é a tela inicial; Configurações reúne as opções.

O calendário nativo 0.4.0 de teste inclui mês/ano/dia/semana/lista, semana automática em paisagem, reagendamento e duração por arraste confirmado, escopos de recorrência e preferências locais. Consulte o [marco 0.4.0](../docs/ANDROID-MARCO-0.4.md). Consulte [funções, permissões e limites](../docs/ANDROID-CALENDARIO.md). O widget, o clima e os ajustes anteriores continuam disponíveis.

# Calendar Timeline para Android

App Android nativo (Java, API 26+, Android System WebView atualizado) com widget de tela inicial 4 × 2. O widget é um `AppWidgetProvider` com `RemoteViews/ImageView`: permanece na tela inicial independentemente da abertura do app. Um canvas local, em Android System WebView, rasteriza as mesmas funções do Scriptable; nenhum site externo é carregado. O aplicativo abre no calendário nativo e oferece prévia/configuração do widget em Configurações.

## Compilar e instalar manualmente

Use JDK 17, Node 18+ e Android SDK oficial com Platform 35 e Build Tools 35.0.0. Defina `ANDROID_HOME` ou `sdk.dir` em `local.properties` (não versionado).

```sh
cd android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. É assinado somente com a chave debug local padrão do Android, sem chave release ou publicação. Instale manualmente e abra o aplicativo. Escolha os acessos opcionais no onboarding; os prompts são do Android. A escrita da agenda só é solicitada ao salvar eventos locais. Use “Adicionar widget à tela inicial” e confirme no launcher. Alternativamente, abra a lista de widgets do launcher e escolha Calendar Timeline. Redimensione mantendo a proporção próxima de 1092:510; alturas extras ficam transparentes, sem deformar o desenho.

## Dados e privacidade

- Agenda: `CalendarContract.Instances`, calendários visíveis e recorrências expandidas pelo Android. Contas ficam somente em leitura; a escrita de eventos é local. As agendas locais criadas pelo app suportam exceções individuais e divisão das futuras para regras simples. Contas sincronizadas no próprio Android aparecem conforme o provedor local. O app não cria contas, OAuth ou credenciais, nem conecta diretamente ao iCloud.
- Lembretes: lista local com pendências vencidas, preservada. Esta branch acrescenta adaptadores Tasks/Graph, cache privado, projeção no calendário/widget e telas de consentimento/listas. Configuração OAuth é desativada por padrão e depende de autorização do responsável. Samsung usa a ponte To Do da mesma conta/lista. Sem sincronização universal ou integração iCloud; consulte o documento de provedores para limitações e QA pendente.
- Clima: Open-Meteo, a mesma API pública já usada pelo Scriptable, sem credencial. O onboarding oferece localização aproximada em primeiro plano e os prompts reais do Android. Recusar mantém coordenadas manuais disponíveis; uma posição indisponível não vira previsão inventada. A consulta é limitada a 15 s e cancelada ao sair. Não há localização precisa ou em background. Apenas coordenadas/fuso são enviados à API. Configurações permite desligar o clima/atualização da localização e fornece status de configuração, localização, rede, HTTPS e serviço. Cache de 30 min; atualização manual/toque no widget força consulta. Atribuição Open-Meteo, CC BY 4.0. Foreca/Rainbow não são conectados sem credenciais explicitamente autorizadas.
- Cache: agenda/clima e imagem ficam no armazenamento privado do app, sem backup Android. Resposta de agenda vazia válida substitui a anterior; erro preserva um snapshot compatível com fuso/horizonte. Permissão negada remove o cache da agenda. Clima mantém timestamp da resposta original, usa no máximo 24 h de cache e descarta escopos de coordenadas/fuso diferentes. Falha de rede não renova idade. Desativar o clima impede novas consultas.
- Demonstração: explícita e separada das fontes pessoais. Eventos e clima fictícios, data fixa 17/10/2026 12:10. Desative para usar dados reais.

## Desenho e atualização

`tools/build-android-renderer.cjs` substitui a entrada dependente da plataforma, adapta três operadores lógicos para ES2020 (WebView 83+) e gera assets durante `preBuild`; `Calendar Timeline` e `Calendar Timeline Loader` permanecem byte a byte intactos. Cabeçalho móvel, seleção de linhas, prioridades, clima, curva, blur, cápsulas e régua vêm das funções originais. `android/renderer/scriptable-adapter.js` implementa DrawContext/Path/Color com Canvas e recorta o contorno medido de superelipse. O desenho nunca executa scripts remotos e não tem acesso à rede.

Não distribui fontes San Francisco/SF Symbols da Apple. Usa sans-serif e monospace licenciadas do sistema Android; o original desenha astros por geometria. Métricas tipográficas, WebView, densidade, launcher e espaço disponível causam diferenças. Não há promessa de igualdade pixel a pixel em todos os celulares. Temas preto/escuro e janelas de 1–96 h seguem o renderer; fuso e horário seguem o aparelho.

`JobScheduler` solicita atualizações a cada 15 min, com `AppWidgetProvider` também a cada 30 min; Android e economia de bateria decidem o momento efetivo. Atualização manual no app; redesenho em mudança de tamanho, fuso, data, hora e reinício. Enquanto o app está aberto, atualiza a cada minuto. Todo toque no widget abre o calendário interno e atualiza dados/renderização, mesmo sem imagem pronta. A volta ao app, alterações no Calendar Provider enquanto visível e o ciclo por minuto também atualizam o widget, sem passar pelas configurações.

## Testes

A suíte Node existente em `../tests` verifica o Scriptable. Para os testes de dispositivo, instale o APK de testes em um emulador, adicione o widget ao launcher e execute:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -e class com.sagittaryuz.calendartimeline.TimelineTest,com.sagittaryuz.calendartimeline.WeatherTest com.sagittaryuz.calendartimeline.test/android.test.InstrumentationTestRunner
```

A consulta real é uma verificação separada e explícita, somente em emulador descartável: usa coordenadas públicas fixas de Jataí, altera a configuração de testes e exige internet. Não consulta localização do aparelho.

```sh
adb shell am instrument -w -e liveWeather true -e class com.sagittaryuz.calendartimeline.LiveWeatherTest#testLiveForecastAndWidget com.sagittaryuz.calendartimeline.test/android.test.InstrumentationTestRunner
# Após desligar Wi-Fi e dados móveis do emulador:
adb shell am instrument -w -e offlineWeather true -e class com.sagittaryuz.calendartimeline.LiveWeatherTest#testOfflineCachedForecastAndWidget com.sagittaryuz.calendartimeline.test/android.test.InstrumentationTestRunner
```

Testes de dispositivo usam o WebView real, dimensões e transparência do canvas, atualização RemoteViews em três larguras quando existe widget vinculado, e cache privado. Fotos e resultados da validação desta entrega são descritos em `../docs/ANDROID-VALIDACAO.md`. As capturas de referência com dados pessoais nunca entram no repositório.

A verificação adicional `node ../tools/test-android-renderer.cjs` requer `playwright-core` e um Chromium disponível (`CHROMIUM_PATH` opcional). Ela executa 48 cenários de canvas, estados sem fontes e respostas Open-Meteo em três fusos; é teste em navegador, sem alegar validação Android.

## Backup e atualizações

Abra **Backup e atualizações** para exportar/importar configurações salvas e lembretes locais pelo seletor de documentos do Android. A importação valida o arquivo e pede confirmação antes de substituir dados. Agenda, permissões e caches não fazem parte do backup. O JSON pode conter dados pessoais e não é criptografado.

O aviso de atualização consulta apenas Releases Android publicados com manifesto de versão testada, até uma vez por dia ao abrir o app (opcional), ou por consulta manual. Downloads abrem no navegador e a instalação exige a confirmação normal do Android. Não há token no APK, publicação por commit ou assinatura definitiva criada. As regras e o gerador de metadados estão em [ANDROID-RELEASES.md](../docs/ANDROID-RELEASES.md).

O roteiro adicional `DocumentUiTest` exige emulador descartável em inglês, Wi-Fi/dados desligados e os arquivos sintéticos `Calendar-Timeline-teste-backup.json` e `Calendar-Timeline-invalido.json` preparados em Downloads. É acionado somente com `-e documentQa true -e class com.sagittaryuz.calendartimeline.DocumentUiTest`; não é uma verificação para executar sobre dados pessoais em um telefone. Os detalhes e resultados estão em [ANDROID-BACKUP-VALIDACAO.md](../docs/ANDROID-BACKUP-VALIDACAO.md).
