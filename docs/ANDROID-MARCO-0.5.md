# Android 0.5.0 de teste

## Diagnóstico e comportamento

A análise da 0.4.0 encontrou três problemas concretos:

- O clima era desativado por padrão e exigia latitude/longitude digitadas. Não havia permissão nem aquisição de localização. O calendário interno também não mostrava o estado/previsão disponível no widget.
- `CalendarActivity.onResume` recarregava a lista, mas não chamava o renderer do widget. O toque apenas abria a atividade. Sem passar por ajustes, uma imagem antiga podia continuar no launcher.
- Lembretes locais vencidos fora do mês consultado eram excluídos do carregamento do calendário; a lista de próximos dias também descartava datas passadas. O widget já recebia os lembretes locais incompletos, inclusive vencidos, mas podia conservar a imagem antiga.

A demonstração também substitui as fontes reais do widget: ao escolher fontes reais no onboarding, ela é desligada. Isso não permite concluir que estivesse ativa no telefone do usuário.

Não foi inspecionado o telefone do usuário. Não é possível afirmar qual desses estados estava presente nele. O app não possui integração com iCloud Reminders, Google Tasks ou lembretes de outros apps: `CalendarContract` fornece eventos e alertas de eventos, não a lista de tarefas Apple. Não se transformam tarefas externas em eventos nem se criam contas/credenciais. Os lembretes locais existentes conservam identificador, datas, conclusão e repetição; não há migração destrutiva.

## Calendário e fontes

O launcher e todos os estados do toque no widget abrem o calendário. Configurações concentra preferências, permissões, clima, widget e backup/atualização. Ano, mês, dia, semana, paisagem, busca, edição e escopos locais de recorrência continuam disponíveis. O mês acrescenta a agenda da data selecionada. Pendências vencidas têm um painel; a visualização Lembretes locais mostra a coleção completa e permite incluir concluídos.

As ações/painéis nativos usam superfícies de vidro fosco com gradientes, borda, profundidade e resposta ao toque. São desenhados com recursos Android e fontes do sistema, sem assets Apple nem blur de conteúdo que comprometa texto/desempenho. A adaptação visual não reproduz o framework Liquid Glass da Apple nem promete pixels idênticos entre fabricantes.

O calendário solicita atualização de dados/imagem ao abrir, voltar ao primeiro plano, tocar o widget e receber alterações do Calendar Provider enquanto visível. A atualização por minuto e o agendamento anterior continuam. O toque força a consulta de clima; outras aberturas respeitam o cache. O estado do clima aparece também no calendário, sem inventar temperaturas quando não há previsão válida.

## Permissões e localização

O onboarding da primeira abertura desta versão apresenta escolhas, seguidas dos prompts do Android. Todas podem ser recusadas. Não reabre o onboarding em toda visita; pode ser revisto em Configurações. Leitura de calendário é opcional; escrita só é solicitada ao salvar um evento local. Lembretes locais não dependem dessas permissões. Notificações são opcionais no Android 13+, somente para alertas escolhidos; nas versões anteriores valem as configurações do sistema.

Somente `ACCESS_COARSE_LOCATION` foi acrescentada. A consulta aproximada é limitada a 15 segundos e a atividades visíveis. Interrompe-se ao sair. Não há localização precisa, background location, serviço de rastreamento, alarme exato ou acesso a contatos. Coordenadas aproximadas são arredondadas a duas casas e guardadas privadamente para as consultas posteriores de clima. A opção automática pode ser desligada; coordenadas manuais funcionam se a permissão for negada ou o aparelho não oferecer uma posição de rede recente. Se a primeira aquisição não conseguir uma posição, a escolha fica pendente e tenta novamente ao retornar ao calendário; desligar o clima/automação cancela essa intenção. O estado informa falta de posição, sem atribuí-la à API.

Permitir localização não garante um fix: a localização do sistema e seus provedores também precisam estar disponíveis.

## API e cache

O próprio `Calendar Timeline` original declara `openMeteoBaseURL` e chama `loadOpenMeteoWeather` sem credenciais. Essa mesma API é o padrão Android. O original também oferece MET Norway e integrações opcionais Foreca/Rainbow; as duas últimas dependem de segredos do Keychain do iPhone, ausentes e não transferidos. Não houve criação de credenciais.

A previsão envia somente coordenadas/fuso a `api.open-meteo.com`; títulos, tarefas e contas não entram na requisição. Cache de 30 minutos, limite de 24 horas offline, isolamento por coordenadas/fuso, timestamp original e categorias de falha permanecem. Não se atribui toda ausência de clima à API: desativação, falta/recusa de localização, provedor indisponível, rede, HTTPS, serviço e resposta inválida têm estados próprios.

O backup schema 1/2 continua compatível. A importação de coordenadas seleciona localização fixa, nunca importa permissão ou ativação de rastreamento. Eventos ficam no Calendar Provider e não fazem parte do JSON.

Fontes técnicas: [permissão de localização Android](https://developer.android.com/develop/sensors-and-location/location/permissions), [permissão de notificações](https://developer.android.com/develop/ui/views/notifications/notification-permission), [API Open-Meteo](https://open-meteo.com/en/docs).

O renderer local mantém a pintura da janela invisível pausada; JavaScript e o canvas continuam ativos conforme o contrato de [WebView.onPause](https://developer.android.com/reference/android/webkit/WebView#onPause()). O calendário aguarda foco antes de iniciar o trabalho. Os testes de pixels verificam que o bitmap ainda contém os eventos/lembretes; aparelhos físicos seguem necessários para avaliar o tempo de inicialização.
