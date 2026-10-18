# Validação Android 0.3.0-debug

APK de teste: identificador `com.sagittaryuz.calendartimeline`, versionCode 5, Android 8/API 26 mínimo, alvo API 35. Arquivo de 328.442 bytes; SHA-256 `0c4c37d8ae92baab87454ae549255f392610838501b9ff6ba6ab24ea0f5ffc16`. Certificado debug SHA-256 `78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d`, igual à versão 0.2.0. Nenhuma chave permanente de produção foi criada.

## Evidência funcional

Validação em AOSP Android 11/API 30, WebView 83, AVD sem KVM. Capturas finais em 720×1280/densidade 280, com edição girada para 1280×720. Dados exclusivamente sintéticos em agenda LOCAL isolada. Os testes opt-in interrompem se encontrarem contas externas; não foram executados em celular pessoal.

| Grupo | Casos | O que foi verificado |
| --- | ---: | --- |
| CalendarFunctionalTest | 11 | CRUD real no Calendar Provider, transações de alertas, RRULE/instâncias, série inteira, dia inteiro, filtros, permissões negadas, lembretes, conclusão, backup v2, DST, meia-noite, datas civis entre fusos e preservação de alertas adicionais |
| BackupTest | 7 | Roundtrip, importação v1, detalhes v2, tipos/tamanhos/IDs, arquivos inválidos sem alteração de dados e exclusão de caches/contas/permissões |
| UpdateTest | 10 | Manifesto, versão, assinatura, SDK, URLs canônicas e cache/offline |
| WeatherTest | 7 | Coordenadas PT-BR, menos Unicode, validação de resposta, cache, atualização manual e opt-out |
| MaintenanceUiTest | 2 | Confirmação antes de abrir navegador; URL inválida bloqueada; nenhuma instalação automática |
| TimelineTest | 3 | Renderer real, cache privado e publicação/redimensionamento do widget em 240/360/480 dp |
| CalendarUiTest | 2 | Navegação, busca, criação/edição/exclusão reais pela interface, cancelamento da exclusão, rascunho na rotação, lembretes e seleção de calendários; detalhes usando o modelo persistido |
| LiveWeatherTest | 2 | Consulta HTTPS real Open-Meteo em coordenadas públicas fixas de Jataí e atualização do widget offline usando o mesmo cache |

Total: 44 casos nativos, incluindo os fluxos de interface. Núcleo e navegação foram executados com Wi-Fi e dados móveis desligados. Build `assembleDebug`, APK de instrumentação e `lintDebug` passaram: 0 erros e 31 avisos de estilo/compatibilidade. Testes do projeto original: 33 aprovados; renderer compartilhado: 48 cenários, incluindo três fusos e respostas Open-Meteo. Os dois arquivos originais de distribuição Scriptable permanecem sem alteração no ramo Android.

Na integração de clima, a resposta real forneceu pelo menos 168 horas e 7 dias, com mais de 10 rótulos de temperatura no renderer; o cache manteve a data de coleta original durante o teste offline. Não foi usada localização do dispositivo.

## Revisão visual

Foram capturadas e inspecionadas 12 telas nativas: mês, ano com 12 meses, dia, lista, busca, detalhes de evento, edição, edição em paisagem, confirmação de exclusão, novo lembrete, detalhes de lembrete e seleção de calendários. As imagens estão entregues separadamente na Library, com o relatório visual.

A inspeção corrigiu a data/semana fixa no dia e o corte de texto em lembretes curtos. O ano usa desenho compacto para evitar centenas de controles; a carga de dados preserva a estrutura da tela e o foco dos campos. O widget conserva a geometria e o renderer do projeto original. Fontes vêm do sistema, e ícones foram desenhados no projeto.

As referências foram os exemplos públicos oficiais de [visualização](https://support.apple.com/pt-br/guide/iphone/iphfd1054569/ios) e [edição](https://support.apple.com/pt-br/guide/iphone/iph3d110f84/ios) da Apple. Não há ativos proprietários da Apple no APK nem promessa de paridade total ou pixels idênticos em todos os aparelhos.

## Limites e ambiente

Agendas de contas ficam em leitura; a escrita é local. Não há OAuth, iCloud, convites, anexos ou serviços da Apple. Editar/apagar recorrência afeta a série inteira, com confirmação. Alertas locais são inexatos e podem atrasar com a economia de bateria; alertas de eventos dependem da agenda Android. Notificações em Android 13+, insets em versões recentes e variações de fabricantes exigem validação adicional em aparelho compatível.

O AVD teve falhas de inicialização do System UI/rede e uma sessão de instalador pendente. Essas tentativas foram registradas como falhas, recuperadas e repetidas; os resultados aprovados são os finais. A navegação começou após finalizar o render inicial do widget, pois a execução por software é lenta. O teste HTTPS usou apenas no AVD a CA pública do proxy do ambiente cloud; o APK mantém TLS padrão, sem certificados ou exceções embutidas.

A versão 0.2.0 está preservada no commit `418101f` e como APK separado, SHA-256 `412f81ca5e597e2c74b3eb0d49c75300314d17e26b317f74ffcc5e0d6bcc0003`. Guarde o backup anterior: 0.3.0 importa schema 1 e exporta schema 2; 0.2.0 não importa schema 2. Eventos do provedor Android não entram no backup de lembretes.
