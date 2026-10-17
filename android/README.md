# Calendar Timeline para Android

App Android nativo (Java, API 26+, Android System WebView atualizado) com widget de tela inicial 4 × 2. O widget é um `AppWidgetProvider` com `RemoteViews/ImageView`: permanece na tela inicial independentemente da abertura do app. Um canvas local, em Android System WebView, rasteriza as mesmas funções do Scriptable; nenhum site externo é carregado. O aplicativo oferece prévia, configuração e atualização manual.

## Compilar e instalar manualmente

Use JDK 17, Node 18+ e Android SDK oficial com Platform 35 e Build Tools 35.0.0. Defina `ANDROID_HOME` ou `sdk.dir` em `local.properties` (não versionado).

```sh
cd android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. É assinado somente com a chave debug local padrão do Android, sem chave release ou publicação. Instale manualmente e abra o aplicativo. Permita a leitura da agenda se desejar. Use “Adicionar widget à tela inicial” e confirme no launcher. Alternativamente, abra a lista de widgets do launcher e escolha Calendar Timeline. Redimensione mantendo a proporção próxima de 1092:510; alturas extras ficam transparentes, sem deformar o desenho.

## Dados e privacidade

- Agenda: `CalendarContract.Instances`, somente leitura, calendários visíveis, recorrências expandidas pelo Android. Contas sincronizadas no próprio Android aparecem conforme o provedor local. O app não cria contas, OAuth ou credenciais, nem conecta diretamente ao iCloud.
- Lembretes: lista local, criada/concluída pelo app. Não existe API Android equivalente ao EventKit Reminders; não há sincronização com Lembretes Apple, Google Tasks ou outros apps.
- Clima: Open-Meteo opcional, desativado por padrão. Ative, informe latitude/longitude e salve para autorizar a consulta. Envia apenas coordenadas e fuso, nunca títulos da agenda. Sem GPS. Resumos e amostras usam o parser original; lacunas não recebem previsão inventada. Atribuição Open-Meteo, CC BY 4.0. Foreca, MET Norway e Rainbow do Scriptable não foram conectados no Android; nenhum segredo foi embutido.
- Cache: agenda/clima e imagem ficam no armazenamento privado do app, sem backup Android. Resposta de agenda vazia válida substitui a anterior; erro preserva um snapshot compatível com fuso/horizonte. Permissão negada remove o cache da agenda. Clima mantém timestamp da resposta original, usa no máximo 24 h de cache e descarta escopos de coordenadas/fuso diferentes. Falha de rede não renova idade. Desativar o clima impede novas consultas.
- Demonstração: explícita e separada das fontes pessoais. Eventos e clima fictícios, data fixa 17/10/2026 12:10. Desative para usar dados reais.

## Desenho e atualização

`tools/build-android-renderer.cjs` substitui a entrada dependente da plataforma, adapta três operadores lógicos para ES2020 (WebView 83+) e gera assets durante `preBuild`; `Calendar Timeline` e `Calendar Timeline Loader` permanecem byte a byte intactos. Cabeçalho móvel, seleção de linhas, prioridades, clima, curva, blur, cápsulas e régua vêm das funções originais. `android/renderer/scriptable-adapter.js` implementa DrawContext/Path/Color com Canvas e recorta o contorno medido de superelipse. O desenho nunca executa scripts remotos e não tem acesso à rede.

Não distribui fontes San Francisco/SF Symbols da Apple. Usa sans-serif e monospace licenciadas do sistema Android; o original desenha astros por geometria. Métricas tipográficas, WebView, densidade, launcher e espaço disponível causam diferenças. Não há promessa de igualdade pixel a pixel em todos os celulares. Temas preto/escuro e janelas de 1–96 h seguem o renderer; fuso e horário seguem o aparelho.

`JobScheduler` solicita atualizações a cada 15 min, com `AppWidgetProvider` também a cada 30 min; Android e economia de bateria decidem o momento efetivo. Atualização manual no app; redesenho em mudança de tamanho, fuso, data, hora e reinício. Enquanto o app está aberto, atualiza a cada minuto. O toque no widget abre o calendário nativo por Intent; se não houver um instalado, avisa e abre a configuração.

## Testes

A suíte Node existente em `../tests` verifica o Scriptable. Para os testes de dispositivo, instale o APK de testes em um emulador, adicione o widget ao launcher e execute:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w com.sagittaryuz.calendartimeline.test/android.test.InstrumentationTestRunner
```

Testes de dispositivo usam o WebView real, dimensões e transparência do canvas, atualização RemoteViews em três larguras quando existe widget vinculado, e cache privado. Fotos e resultados da validação desta entrega são descritos em `../docs/ANDROID-VALIDACAO.md`. As capturas de referência com dados pessoais nunca entram no repositório.

A verificação adicional `node ../tools/test-android-renderer.cjs` requer `playwright-core` e um Chromium disponível (`CHROMIUM_PATH` opcional). Ela executa 48 cenários de canvas e estados sem fontes; é teste em navegador, sem alegar validação Android.
