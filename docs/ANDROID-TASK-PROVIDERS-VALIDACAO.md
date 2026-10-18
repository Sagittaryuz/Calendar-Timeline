# Validação da revisão de provedores

O APK utilizável entregue permanece a 0.5.0-debug (`374a354`), preservado na Library e na branch Android anterior. Esta branch é uma revisão separada `0.6.0-providers-preview`, código 8; não tem release, manifesto de atualização ou publicação como integração pronta.

SDKs oficiais GIS auth 22.0.0 e MSAL 8.5.0 foram resolvidos pelos registros Google/Maven Central/feed Microsoft. Build debug, APK de instrumentação e lint passaram, com 0 erros e 43 avisos. Não se alterou o TLS do APK. O trust store usado pelo Gradle inclui somente o certificado público do proxy já fornecido no ambiente, fora do repositório. Não foi criada credencial.

## Verificações

- Identidade por provedor/conta/lista/tarefa, sem deduplicação por título e sem provedor Samsung duplicado.
- Datas Google sem horário e sem deslocamento de dia ao mudar fuso; tarefas sem data fora do widget; concluídas/ocultas preservadas.
- Hierarquia, notas, campos desconhecidos, recorrência Graph e JSON original conservados. Fuso Windows reconhecido; fuso desconhecido não vira UTC/epoch.
- Paginação Google com concluídas/ocultas/excluídas/atribuídas; continuadores externos e ciclos bloqueados antes de transmitir token.
- Falha de página preserva snapshot e timestamp; snapshot completo remove ausências e deduplica IDs.
- Desconexão/reauthorização impede aplicar resposta antiga; conclusão altera somente status com ETag, sem repetição automática de HTTP 412; séries Graph ficam bloqueadas.
- Dados conectados sintéticos alimentam o input do calendário/widget sem modificar lembretes locais; o canvas real seleciona uma tarefa externa sintética.
- Configuração vazia bloqueia login sem efeitos em contas/sessões. Manifest final sem contas, contatos, armazenamento amplo, NFC, localização precisa/background ou acessibilidade.
- Tela nativa mostra configuração pendente, ponte Samsung via To Do, conta/lista sintéticas e tarefa sem data. Nenhuma tela de OAuth real foi aberta.

Os 19 testes iniciais passaram. A revisão visual revelou um erro no texto de data sem horário que a primeira asserção de UI não detectava; o formato foi corrigido e o teste reforçado. Em paralelo, 55 testes anteriores de dados/CRUD, recorrência, backup, atualizador, clima e lembretes passaram, além do teste adicional do canvas externo (56 casos, 131,274 s). Essa regressão ocorreu antes do ajuste final de texto e da supressão de recarregamento quando nenhuma fonte foi sincronizada; os dados, parser, rede e renderer não mudaram nesses ajustes. A rodada seguinte da classe de provedores passou nos 20 casos em 80,84 s e recapturou as telas corrigidas. Depois, foram acrescentadas proteção de escopo Microsoft, limite em bytes UTF-8 e interrupção de novas requisições após desconexão. Cinco casos focados passaram no binário final em 2,652 s: três novos e dois repetidos. São 23 testes novos distintos e 55 testes anteriores de regressão aprovados durante esta revisão; somente os cinco focados foram repetidos depois dessas últimas proteções. As capturas têm a mesma interface, anterior apenas às proteções internas.

Dados usados são sintéticos em AVD AOSP Android 11/API 30. Nenhum celular, conta Google/Microsoft/Samsung, token real ou dado pessoal foi usado. O APK 0.5 entregue não contém os SDKs/provedores desta branch. Os 33 testes originais e 48 cenários do renderer passaram na entrega 0.5; o script e o renderer compartilhado permanecem sem novas alterações nesta revisão.

## Ainda não validado ou implementado

Clientes OAuth e consentimento real, expiração/revogação/recuperação de processo, rotação durante login, contas pessoais/organizacionais, semântica real de ETag/If-Match, conclusão real, Samsung em Galaxy, sincronização de mudanças remotas em background e renovação silenciosa. Após expiração/reinício esta prévia pede reconexão; o widget usa cache. Séries Graph não podem ser concluídas por esta prévia. CalDAV e OpenTasks foram avaliados, mas não implementados. Android 15 e aparelhos físicos continuam pendentes.

As ações de registro/configuração estão **pendentes de autorização específica**, não negadas ou executadas. Pacote, fingerprint, redirect e escopos propostos estão no [documento de configuração](ANDROID-TASK-PROVIDERS.md). Não se deve chamar a integração de ativa antes de configurar e testar esses fluxos.
