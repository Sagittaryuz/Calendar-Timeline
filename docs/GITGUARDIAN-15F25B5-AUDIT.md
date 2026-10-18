# Auditoria do alerta GitGuardian — commit 15f25b5

Classificação do achado informado: **falso positivo em identificador público de redirecionamento MSAL**, sem evidência de credencial real exposta neste commit.

O check `GitGuardian Security Checks` de ID `117724924500` retornou falha do detector `Generic High Entropy Secret`. O arquivo apontado é `android/app/src/main/java/com/sagittaryuz/calendartimeline/TaskAuth.java`, constante `REDIRECT` declarada na linha 22, literal na linha 23 do commit `15f25b5f1b429bfe38473b416b0ca98192330778`.

## Evidência do redirect público

1. A assinatura válida do APK 0.5 entregue foi verificada novamente com `apksigner verify --print-certs`. Foi usado somente o certificado público contido no APK, sem leitura da chave privada.
2. O hash SHA-1 público desse certificado, convertido para Base64 e codificado no componente de path da URI, reproduz **exatamente** a constante `REDIRECT` do commit.
3. O `scheme`, `host` e `path` correspondentes no `AndroidManifest.xml` coincidem com esse mesmo resultado. A proposta de autorização e o documento dos provedores também contêm a mesma URI pública.

A estrutura é a exigida pelo [redirect Android/MSAL documentado pela Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-mobile-app-android-prepare-app): esquema `msauth`, package Android e hash público da assinatura. Esse hash identifica o aplicativo; não é a chave privada de assinatura, client secret, access token ou refresh token. Não permite autenticar como o usuário por si só.

O resultado de comparação foi verdadeiro para APK/constante, APK/manifesto e proposta/constante. O valor não foi substituído: alterar o redirect apenas para silenciar o detector quebraria a correspondência de registro e callback do aplicativo.

## Escopo da auditoria

Foram examinados os 18 arquivos adicionados/modificados no commit, com atenção às constantes de autenticação, propriedades de build, manifesto e fixtures. Não foram encontrados arquivos de chave/keystore nem padrões reconhecidos de tokens GitHub, chaves Google/AWS, JWTs ou chaves privadas. A inspeção dos fluxos também não identificou credencial real constante. A conclusão não depende somente da ausência de correspondências de um scanner.

O cliente Microsoft continua vazio por padrão; a configuração Google continua desativada. Os valores de token do código de produção são recebidos em runtime dos SDKs oficiais, sem literal de token real. Nenhum OAuth/client/grant ou login real foi criado/executado nesta implementação.

Em `TaskIntegrationTest.java`, os tokens de exemplo são literais fixos explicitamente sintéticos, introduzidos como fixtures de teste. As chamadas de API usam transportes simulados; não há instanciação de `TaskApi.Https` nesse fixture. Os testes também verificam as flags de configuração desativadas. O teste de desconexão utiliza sessão sintética com um transporte delegado simulado. Essas evidências não indicam segredo de conta.

## Ação e validação

Esta correção acrescenta somente a documentação da auditoria. Redirect, manifesto, assinatura, permissões, código de autenticação e fixtures foram preservados. Não foi criada regra de exclusão do scanner, nem revogada/criada credencial. A identidade pública foi comparada programaticamente com o APK assinado; a diferença de código Android em relação ao commit auditado permanece vazia. Não foi necessário repetir a instrumentação para uma alteração apenas documental.

O APK 0.5 entregue é anterior à revisão de provedores e não foi alterado. O incidente histórico do GitGuardian pode ser classificado como falso positivo pelo responsável na ferramenta, referenciando esta evidência; esta auditoria não declara o incidente encerrado remotamente.
