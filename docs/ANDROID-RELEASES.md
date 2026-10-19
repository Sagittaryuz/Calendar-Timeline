# Atualizações Android e backup

O Android permanece no mesmo repositório e continua incorporando o renderer Scriptable durante o build. O app verifica versões ao abrir, no máximo uma vez por dia, e oferece uma consulta manual em **Backup e atualizações**. Essa verificação automática pode ser desligada. Não executa código baixado nem instala APK silenciosamente.

## Publicação de versões testadas

Não há publicação automática por commit, credencial no APK ou chave definitiva configurada. Uma versão só participa do aviso quando existe um GitHub Release publicado, sem os indicadores draft/prerelease, com tag `android-v…` e o asset `calendar-timeline-update.json`. Releases do Scriptable são ignorados. A consulta lê até os 100 Releases mais recentes.

O manifesto deve declarar `tested: true`, pacote, `versionCode`, nome da versão, Android mínimo, certificado público SHA-256, tipo/canal, nome do APK e SHA-256 do arquivo. O APK precisa constar entre os assets desse mesmo Release. A declaração de testes é uma responsabilidade do publicador; não é uma atestação criptográfica de CI.

Antes de preparar uma publicação:

1. Execute a suíte Scriptable, build, lint e testes Android do artefato que será distribuído. Confira exportação/importação, clima, widget e atualizações. Use somente dados sintéticos na validação publicada.
2. Confirme o pacote e o certificado com `aapt dump badging` e `apksigner verify --print-certs`. Mantenha uma assinatura compatível e um `versionCode` crescente para atualizações normais. Uma nova chave de produção exige autorização e planejamento de migração; ela não foi criada nesta etapa.
3. Revise o APK para excluir dados pessoais e material privado de assinatura. Não inclua keystore, credenciais, backups ou capturas pessoais nos assets. O certificado público do APK é esperado e não contém a chave privada.
4. Anote o SHA-256 exato do APK aprovado. Gere apenas seus metadados com o SDK oficial e `unzip` disponíveis:

```sh
ANDROID_SDK_ROOT=/caminho/do/sdk node tools/create-android-update-manifest.cjs \
  --apk /caminho/Calendar-Timeline-0.2.0-debug.apk \
  --channel test \
  --verified-apk-sha256 SHA256_DO_APK_TESTADO \
  > calendar-timeline-update.json
```

O gerador lê somente o APK e seus metadados públicos, não assina nem publica. Recusa hash diferente, identidade inesperada, arquivos de chave/credencial no ZIP e APK/certificado debug no canal `stable`. `test` exige APK debug e o app o identifica como versão de teste. O canal `stable` é reservado a um APK release com assinatura apropriada, ainda não configurada.

Depois das verificações, a publicação pode ser feita de forma deliberada, com o APK e o manifesto no mesmo Release. Não há workflow que publique cada commit. Modificar arquivos do repositório, sozinho, não atualiza o APK instalado.

## Verificação e instalação

O app compara `versionCode`, pacote, SDK mínimo e certificado público instalado. Assinatura diferente apresenta orientação para exportar dados e planejar migração; não oferece essa instalação como atualização compatível. Links aceitos são HTTPS no caminho exato de Releases deste repositório, sem usuário, porta, query ou fragmento. A leitura do manifesto aceita somente redirecionamentos HTTPS para os hosts de assets do GitHub e tem limites de tamanho, tempo e quantidade de redirecionamentos.

O download do APK abre no navegador após confirmação no app. O navegador/instalador do Android decide as autorizações e confirmações de instalação. O atualizador não solicita `REQUEST_INSTALL_PACKAGES` nem armazenamento amplo. O app oferece separadamente localização aproximada em primeiro plano para clima e notificações opcionais para alertas locais. O instalador Android valida a assinatura real do APK; a consulta do app valida os metadados, sem baixar o APK para calcular seu hash.

Ausência de Release, versão igual/mais antiga, metadados inválidos, incompatibilidade e falha de conexão têm estados distintos. Uma versão compatível já consultada pode permanecer como informação em cache por até sete dias; uma falha de rede não renova o horário da consulta.

## Exportação e importação

**Exportar backup** usa o seletor de documentos do Android. O usuário escolhe onde salvar o JSON, inclusive o provedor de arquivos de sua preferência. O arquivo contém dados pessoais, se houver: coordenadas e títulos/datas dos lembretes. Não há upload feito pelo app nem compartilhamento automático. O arquivo não é criptografado.

Inclui somente configurações salvas (horas, tema, demonstração, clima, coordenadas e verificação automática) e lembretes locais. Exclui eventos/calendários do Android, permissões, contas, tokens, credenciais, cache de clima/agenda, imagem do widget e estado interno de atualização.

A importação lê no máximo 1 MiB, aceita somente o formato/schema do Calendar Timeline e valida tipos, limites, coordenadas, datas, títulos e identificadores únicos. Campos desconhecidos não ganham acesso às preferências. Um arquivo inválido não muda os dados atuais. Um arquivo válido apresenta contagem de lembretes e confirmação de substituição antes de gravar as preferências em uma transação. Restaurar clima habilitado pede consentimento explícito para as coordenadas do arquivo. O widget é solicitado a redesenhar e a tela principal recarrega a configuração importada.

O backup é independente da assinatura Android e serve para uma futura migração planejada. Não restaura permissões de agenda nem reposiciona widgets do launcher após uma reinstalação.
