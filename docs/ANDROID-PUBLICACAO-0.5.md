# Android 0.5 publicado e verificado

Publicação concluída em 18/10/2026 às 17:39 UTC por execução manual única, após autorização específica do proprietário para o workflow e sua permissão por job.

- [Release Android 0.5.0 de teste](https://github.com/Sagittaryuz/Calendar-Timeline/releases/tag/android-v0.5.0-debug): ID `416542156`, `draft: false`, `prerelease: false`.
- [Execução Actions](https://github.com/Sagittaryuz/Calendar-Timeline/actions/runs/39150585964): `completed/success`, tentativa 1, commit da rotina `bbb1bb07c835a0d422767c7707957f907bf15f8f`.
- Source commit da aplicação: `374a35489975d133f3a23647804106a3d34b9165`.

## Artefatos

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `Calendar-Timeline-Android-debug.apk` | 401.767 | `181daf8f321726dcad2dcc52153f431ebacd30bc650f7b789f878f6441dce28e` |
| `calendar-timeline-update.json` | 486 | `0ba20da5aac837b038e4ae3b05d6dbcee58766d611c63b67d32fa457e1e1d6ae` |

O job verificou os arquivos locais, enviou os assets ausentes, baixou/conferiu ambos ainda no draft e somente então publicou. Os digests informados pelo GitHub coincidem. Depois da execução, downloads públicos sem header de autorização retornaram HTTP 200 e os mesmos tamanhos/hashes. A assinatura válida do APK público foi novamente conferida: certificado SHA-256 `78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d`, igual ao anterior. Não houve recompilação ou nova assinatura.

## Rotina e acesso

O workflow é exclusivamente `workflow_dispatch`, restrito a `main`, com confirmação inicialmente falsa. O nível geral usa `permissions: {}`; apenas o job de publicação recebe `contents: write` com o token efêmero padrão do Actions. Não foi criado token pessoal, secret, keystore ou grant OAuth, nem alterada permissão global. Os dois arquivos validados também estão versionados em `release-inputs/android/0.5.0-debug/` para que o runner não dependa da sessão privada da Library.

A rotina recusa hashes/arquivos/tag divergentes, preserva assets corretos existentes, não força tags nem substitui assets silenciosamente e interrompe erro 401 sem repetição automática. `make_latest: false` preserva a classificação latest anterior do repositório. Novas versões exigem novos artefatos testados e revisão dos hashes/destino; pushes não publicam automaticamente.

A falha 401 anterior no ambiente cloud não teve causa final comprovada. A rota oficial do Actions, com o token efêmero autorizado para o job, foi efetivamente validada. Leituras administrativas Actions por aquela integração continuavam sem acesso; nenhuma ampliação dessa integração foi feita.

## Consulta no Android

Testes ao vivo em AVD AOSP Android 11/API 30, com a API e os assets públicos reais:

- Instalado 0.5/código 7: consulta forçada retornou `CURRENT`, sem cache/offline, e o botão nativo mostrou ausência de versão mais recente.
- Instalado 0.4/código 6, mesma assinatura: consulta forçada retornou `AVAILABLE`, versão 0.5/código 7, hash e certificado esperados. A tela nativa ofereceu download e exigiu confirmação. O intent do navegador foi interceptado no teste e conferido contra o URL real do APK; não houve instalação silenciosa.
- O APK público foi instalado sobre o anterior somente no emulador, preservando os lembretes existentes. Não houve acesso ou instalação em telefone.

O certificado público do proxy já fornecido no ambiente foi montado temporariamente no AVD para a conexão HTTPS de teste; não foi incluído no APK e não se alterou seu TLS. Capturas e logs completos ficam no workspace de validação e o relatório da Library reúne as imagens.

## Lembretes e limites

Seis testes existentes foram repetidos no APK 0.5: passaram, incluindo vencidos fora do mês, exclusão de concluídos, seleção efetiva de lembretes no canvas junto de eventos, data sem horário/fuso e funcionamento local sem permissão de calendário. A lista privada de lembretes foi comparada antes/depois e preservada. No código, `showReminders` controla sua visibilidade; o modo demonstração substitui as fontes reais. Isso não comprova o estado de um telefone particular.

Lembretes **sem horário** têm data; lembretes **sem data** não fazem parte do modelo local da 0.5. Samsung Reminder é outra fonte, ainda não importada por esta versão. Sua ponte oficial Microsoft To Do pertence à revisão separada de provedores e depende de configuração/consentimento. Publicar a 0.5 não torna essa integração ativa. Android 15, Samsung S25 Ultra e outros aparelhos físicos não foram declarados validados por estes testes no AVD.
