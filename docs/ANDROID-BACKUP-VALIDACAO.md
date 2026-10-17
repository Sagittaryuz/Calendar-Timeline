# Validação de backup e atualizações — Android 0.2.0-debug

APK de teste, versionCode 4. O certificado público SHA-256 continua `78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d`, idêntico aos APKs anteriores; atualização no emulador concluída sem desinstalar. Nenhuma chave de produção ou credencial foi criada.

## Verificações concluídas

- Build e lint aprovados. Avisos: atributos para versões Android mais recentes, JavaScript local intencional e localização de textos em português.
- 28/28 testes instrumentados aprovados em Android 11/API 30, WebView 83 (115,418 s): 6 de backup, 10 de atualizações, 7 de clima, 2 de confirmação/link no navegador e 3 de canvas/cache/widget.
- Backup: ida e volta de configurações e lembretes sintéticos, tipos/limites inválidos, esquema incompatível, identificadores repetidos, JSON excedente, limite de tamanho e exclusão de caches/permissões.
- Atualizações: comparação por versionCode, pacote/certificado/SDK, Release inexistente, draft/prerelease/Scriptable ignorados, links host/protocolo/caminho/porta/query inválidos, canal incompatível, manifesto malformado, cache inválido/expirado, HTTP indisponível, offline e limite de consultas automáticas.
- Interface: nenhuma abertura do navegador antes de confirmar; Intent seguro ACTION_VIEW/CATEGORY_BROWSABLE interceptado no teste, sem baixar APK de fixture. URL inválida não abre confirmação nem navegador.
- Widget publicado em três larguras e canvas Android real aprovado; clima e entrada PT-BR continuam cobertos.
- 33 testes Scriptable e 48 cenários de renderer em navegador aprovados. Os arquivos Scriptable/Loader permanecem byte a byte intactos.
- Consulta real ao GitHub mostrou ausência de Release Android publicada. Não foi publicada nenhuma Release para simular uma atualização.
- Gerador produziu metadados do APK testado, recusou canal stable com certificado debug e recusou SHA-256 diferente. Não assina nem publica.

O renderer não foi alterado. Dados usados nas validações são sintéticos, com coordenadas públicas fixas de Jataí. Não houve acesso a telefone físico.

APK SHA-256: `412f81ca5e597e2c74b3eb0d49c75300314d17e26b317f74ffcc5e0d6bcc0003`.

## Arquivos reais e rede desligada

A consulta manual sem Wi-Fi/dados apresentou falha de conexão sem travar o app. O seletor padrão do Android abriu um JSON sintético em Downloads, mostrou a confirmação de substituição e de clima e restaurou um lembrete. A exportação criou um JSON real de 723 bytes, lido de volta e conferido: versão 0.2.0-debug, coordenadas públicas normalizadas e o lembrete sintético correto, sem caches/status internos.

O provedor Downloads do AVD sofreu um ANR (`android.process.media`) na primeira criação e deixou um arquivo vazio; a tentativa seguinte com o serviço reiniciado concluiu. Nenhum arquivo vazio foi tratado como backup válido. As imagens são capturas reais do Android, não montagens. A assinatura permaneceu a mesma durante a reconexão do ambiente e nenhum outro ambiente foi criado.

O roteiro extra do seletor real passou de ponta a ponta (1/1, 95,518 s): importação com confirmação, um lembrete restaurado, atualização do widget concluída, exportação com confirmação de salvamento e tentativa de importar arquivo inválido. O arquivo inválido manteve a lista de lembretes e o marcador de restauração intactos. A verificação ocorreu com Wi-Fi e dados móveis desligados, restaurados ao terminar. Total: 28 testes da suíte principal + 1 roteiro extra real, além dos 33 Scriptable e 48 cenários de navegador.

`DocumentUiTest` é opt-in, exclusivo do emulador descartável em inglês e depende dos arquivos sintéticos preparados em Downloads. Não executa esse roteiro nem acessa arquivos por padrão. As primeiras tentativas de automação do seletor foram corrigidas para aguardar transições e usar as ações de acessibilidade dos itens, sem alterar o código do produto ou a assinatura.
