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
