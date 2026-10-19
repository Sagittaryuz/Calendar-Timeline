# Validação Android 0.4.0 de teste

APK `com.sagittaryuz.calendartimeline`, versionCode 6, versão `0.4.0-debug`, mínimo API 26, alvo API 35. Arquivo de 371.360 bytes, SHA-256 `8e09e920456e9286a88f756bad646171e0e4ce427cb180bfd1152db27c59320d`. Certificado debug SHA-256 `78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d`, igual ao da 0.3.0. Nenhuma chave release foi criada.

## Ambiente e escopo

AOSP Android 11/API 30 em AVD descartável, sem KVM; 720×1280, densidade 280, rotação para 1280×720. Wi-Fi e dados móveis desligados durante a validação funcional. Somente calendários LOCAL da aplicação e dados sintéticos; os roteiros opt-in recusam contas externas. Instalação restrita ao emulador. Nenhum celular foi acessado.

## Resultados

| Grupo | Casos | Evidência |
| --- | ---: | --- |
| CalendarFunctionalTest | 11 | CRUD, regras, alertas, permissões negadas, dia inteiro, lembretes, fuso e DST |
| RecurrenceTest | 13 | Exceção única, cancelamento, futuras com COUNT, divisão mensal, DST, preservação de exceções e bloqueio de operação não suportada |
| BackupTest | 8 | Schemas 1/2, prioridades, preferências, validação e rejeição sem alterar dados |
| UpdateTest | 10 | Manifesto, assinatura, SHA-256, estados de release e rede |
| WeatherTest | 7 | Parser, cache e coordenadas |
| CalendarInteractionsTest | 1 | toque real, mover/redimensionar/cancelar, acessibilidade, semana em paisagem, escopos pela UI, prioridades, preferências, escuro e fonte 1,3× |
| CalendarUiTest | 2 | navegação, CRUD, detalhes, exclusão e editor durante rotação |
| TimelineTest e MaintenanceUiTest | 5 | renderer real, cache/widget/redimensionamento e ajustes de backup/atualização |

Total: **57 casos automatizados nativos distintos aprovados** nesta entrega. A bateria completa de 56 casos passou no candidato `aa7fd738b152387b4d4d82ae382efb1d88de9ee26d03f4f5ad3892876d406ff4`. Depois foram corrigidas a cor de fins de semana do mini calendário com segunda-feira e a proteção contra mover uma exceção para outra agenda. O teste adicional de integridade passou e os **49 casos de dados foram repetidos no APK final** identificado acima. O ano com segunda-feira foi aberto e capturado após o ajuste de cor, com restauração da preferência anterior. A última proteção é sem efeito visual; as capturas correspondem à mesma interface funcional.

Build `assembleDebug`, APK de instrumentação e `lintDebug` passaram: 0 erros, 32 avisos de estilo/compatibilidade. Os 33 testes originais e 48 cenários do renderer compartilhado passaram. Os arquivos originais Scriptable não foram modificados.

## Evidências visuais e limites

Capturas nativas incluem dia, prévia e confirmação do arraste, redimensionamento, semana em paisagem, mês detalhado/compacto, preferências, prioridade, escolha do escopo, resultado recorrente e semana escura com fonte ampliada, além do ano com início da semana na segunda-feira. O relatório da Library compara a composição com a imagem pública oficial Apple em painéis de igual tamanho, preservando proporções. Datas e conteúdos diferem; não se trata de comparação exata de pixels.

Um candidato inicial teve timeout de foco no emulador sem aceleração. A grade foi reduzida para linhas desenhadas e colunas acessíveis, com eventos nativos. Para não concorrer com a inicialização do WebView do widget, os roteiros de navegação concluem antes uma renderização real do widget. Desempenho frio em aparelhos físicos continua pendente; este ambiente não comprova fluidez em todos os Android.

Android 13+ (notificações), versões recentes/insets, fabricantes e launchers físicos exigem validação adicional. Alarmes locais continuam inexatos. Regras e exceções com divisão não suportada são bloqueadas, com mensagem, sem simplificação silenciosa. Consulte os limites detalhados no [marco 0.4.0](ANDROID-MARCO-0.4.md).

A 0.3.0 permanece no commit `0d2127a` e como APK separado, SHA-256 `0c4c37d8ae92baab87454ae549255f392610838501b9ff6ba6ab24ea0f5ffc16`. Biblioteca e repositório preservam as versões anteriores. A publicação de anexos no GitHub permanece bloqueada pelo HTTP 401 registrado anteriormente; não houve nova tentativa de contornar autenticação ou release pública.
