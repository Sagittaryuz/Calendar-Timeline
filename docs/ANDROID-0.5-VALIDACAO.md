# Validação Android 0.5.0 de teste

Artefato: `com.sagittaryuz.calendartimeline`, código 7, Android mínimo 26, alvo 35. APK debug de 401.767 bytes. SHA-256 `181daf8f321726dcad2dcc52153f431ebacd30bc650f7b789f878f6441dce28e`. Certificado público SHA-256 `78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d`, o mesmo das versões anteriores. Nenhuma chave de produção foi criada.

## Resultados

- 33 testes originais Scriptable e 48 cenários canvas (fusos, horizontes, temas e dimensões) aprovados. O script original e o Loader não foram modificados.
- Build debug, APK de instrumentação e lint aprovados: zero erros e 39 avisos de estilo/compatibilidade.
- 68 casos nativos distintos aprovados durante este marco em AOSP Android 11/API 30: dados/CRUD (11), recorrência (13), backup (8), atualizador (10), clima (9), regressões de lembretes/clima (4), localização aproximada (1), UI do calendário (2), interações (1), fluxo de atualização 0.5 (1), widget/canvas/redimensionamento (3), manutenção (2), permissões (1), clima HTTPS real (1), clima em cache offline (1).
- Instalação sobre a 0.4, sem desinstalar: preferências e lembretes privados preservados byte a byte. Certificado compatível. Não houve instalação em telefone.
- Toque real no widget vinculado ao launcher abriu o calendário e renovou `renderedAt`. O teste também cobriu retorno do app e alteração do Calendar Provider enquanto visível.
- Widget vinculado foi redimensionado em três larguras (240/360/480 dp); pixels, transparência, seleção de eventos/lembretes e cache foram verificados.
- Mês, ano, dia, semana, lista/busca, paisagem, arraste, alteração de duração, cancelamento, escopos de recorrência, escuro e fonte 1,3× passaram nos testes de UI.
- Clima real consultou HTTPS Open-Meteo com coordenadas públicas de Jataí, obtendo 336 horas de previsão. O diagnóstico do bitmap confirmou mais de dez rótulos de temperatura e demonstração desligada.
- Com Wi-Fi e dados móveis desativados no AVD, calendário e widget continuaram renderizando a previsão em cache; `fetchedAt` permaneceu idêntico. A rede foi reativada ao terminar.
- Recusa de calendário/localização e recuperação pelo diálogo/Configurações do Android foram exercitadas; lembretes locais continuam disponíveis sem acesso à agenda.

As 56 verificações de dados/localização, as seis de widget/fluxo/manutenção, o clima real/offline e os fluxos de UI foram executados no candidato `43112fe64e9fb917c25b43f403ad851e86847427f499488c91cad7df7e22c94e`. O APK final acrescenta apenas a atualização dos controles de demonstração/localização automática ao retornar do onboarding sem fix de localização. Os 56 casos de dados/localização foram repetidos nesse APK final: todos aprovados em 184,683 s, incluindo abertura de Configurações e aquisição aproximada pelo provedor Android. As capturas e os testes de interação anteriores correspondem ao candidato citado, com o mesmo renderer e dados. A proveniência evita atribuir ao binário final rodadas realizadas antes desse ajuste de vínculo visual.

## Evidência visual

Capturas usam somente agendas/tarefas sintéticas e clima de coordenadas públicas. Foram revisados mês com agenda selecionada, lembretes vencidos, configurações, semana em paisagem, escuro/fonte ampliada, widget online e widget offline. O relatório da Library reúne os links. A imagem pessoal de referência não integra o repositório, APK ou publicação.

O widget reutiliza o renderer Scriptable: linha de horas, transição dia/noite, meia-noite, faixas de eventos e curva de temperatura. O app nativo usa gradientes, bordas e controles foscos próprios com fontes Android. Não utiliza fontes/assets Apple. Launcher, fonte do aparelho, escala, recortes, posicionamento e políticas de atualização podem mudar o resultado em fabricantes diferentes; aparelhos físicos continuam necessários.

## Ambiente e limites

AVDs oficiais sem aceleração de hardware, 720×1280/densidade 280 e paisagem. A tentativa adicional no Android 15/API 35 ficou bloqueada por ANRs do System UI/launcher após retomar a VM; o teste não alcançou o onboarding e não foi aprovado. A VM foi encerrada. Os resultados aprovados acima pertencem ao Android 11, sem extrapolação para aparelhos físicos ou Android 15. A configuração de proxy do AVD estava apontada para um endereço antigo do ambiente; foi corrigida para o proxy já fornecido. Para validar HTTPS real, o certificado público do proxy do ambiente foi montado temporariamente no trust store do AVD de teste. Não se alterou a validação TLS do APK nem se incluiu certificado de proxy no aplicativo.

Não há promessa de alarme exato: o Android pode adiar jobs/alertas. Localização aproximada depende do provedor do sistema e pode não fornecer uma posição em 15 segundos; há coordenadas manuais. Clima tem cache de 30 minutos e validade offline limitada a 24 horas. A opção demonstração substitui as fontes reais; escolher fontes no onboarding a desativa.

Lembretes desta versão são locais. `CalendarContract.Reminders` representa alarmes de eventos, não tarefas de Google/Samsung/iCloud. Integrações de tarefas externas exigem protocolos e consentimentos próprios e não são anunciadas como prontas na 0.5. O diagnóstico e as mudanças estão em [ANDROID-MARCO-0.5.md](ANDROID-MARCO-0.5.md).

Logs completos, capturas originais e provas de upgrade/cache ficam no workspace de validação; não contêm dados do telefone do usuário. Uma publicação do atualizador exige APK e manifesto juntos em uma release publicada. Push de código ou entrega Library não torna a versão disponível no atualizador.
