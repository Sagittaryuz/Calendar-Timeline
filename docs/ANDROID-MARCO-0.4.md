# Marco Android 0.4.0 de teste

## O que muda

- Visão semanal de sete colunas, barra compacta e cabeçalhos fixos em paisagem, automática ao girar mês/dia para paisagem. A escolha de dia/mês é preservada ao voltar a retrato.
- Grade horária nativa com sobreposições em colunas por grupo, eventos de dia inteiro, navegação por dia/semana e toque para criar horário.
- Pressionar e arrastar move o evento em passos de 15 minutos; bordas superior/inferior alteram início/término. A seleção mostra contorno e puxadores próprios. A prévia é reversível: cancelar o gesto ou a confirmação não grava dados. Há ações de acessibilidade para editar, mover 15 minutos e aumentar duração.
- Salvar/apagar uma recorrência oferece ocorrência individual, esta e as futuras ou série inteira. O editor começa na ocorrência selecionada, sem deslocar o início da série ao editar seu título.
- Preferências locais: domingo/segunda, mês compacto/empilhado/detalhado, duração e alerta padrão. Prioridade de lembretes locais agora pode ser editada. Preferências e prioridade são incluídas no backup schema 2; importações antigas continuam aceitas.
- Barra de ações e mês com espaçamentos revistos. Fontes do sistema e ícones próprios; nenhum recurso visual proprietário Apple incorporado.

## Integridade e limites

Uma ocorrência modificada permanece na agenda da série; a tentativa de movê-la para outra agenda é bloqueada antes de gravar. A escrita continua restrita a agendas locais; contas permanecem em leitura. Não há novas permissões, autenticação, envio de convites, contatos ou localização. O widget Timeline, clima opcional, backup e atualizador permanecem no fluxo existente.

Exceções são vinculadas por IDs nativos. Em agendas LOCAL criadas pelo app, um UUID interno permite ao provedor AOSP relacionar a série com suas exceções; ele não é credencial e não existe servidor de sincronização. Atualizações completas da série reconstroem instâncias, contornando dois comportamentos do provedor AOSP 11 observados em testes. Não são feitas escritas nas contas de serviços.

A divisão de futuras suporta FREQ DAILY/WEEKLY/MONTHLY/YEARLY com INTERVAL, COUNT, UNTIL e WKST. Regras com BYDAY/BYSETPOS/RDATE/EXRULE e outras combinações não são simplificadas silenciosamente. A divisão de regra não suportada é bloqueada. Se existem exceções futuras, mudar início, fuso ou regra simultaneamente também é bloqueado; alterar título/notas/duração preserva e transfere as exceções. A ocorrência individual continua disponível em RRULE complexa compatível com o provedor. Exceções externas complexas preservam as restrições de leitura anteriores.

Arraste opera na grade visível, sem rolagem automática pelas bordas. Eventos muito curtos/sobrepostos podem ser mais fáceis de editar pelo formulário ou ações de acessibilidade. Alertas locais continuam inexatos; eventos dependem da agenda Android. Lembretes continuam em uma lista local, sem sincronização Apple. Este marco não inclui convites, anexos, mapas, serviços Apple ou equivalência integral com o iOS.

## Referências e comparação

Referências públicas oficiais: [visualizações do Calendário](https://support.apple.com/pt-br/guide/iphone/iphfd1054569/ios), [edição e gestos](https://support.apple.com/pt-br/guide/iphone/iph3d110f84/ios), [lembretes](https://support.apple.com/pt-br/guide/iphone/iph14f1d32a5/ios), [Calendar Provider](https://developer.android.com/identity/providers/calendar-provider), [implementação AOSP 11](https://android.googlesource.com/platform/packages/providers/CalendarProvider/+/refs/heads/android11-release/src/com/android/providers/calendar/CalendarInstancesHelper.java).

A referência pública e as capturas Android são normalizadas ao mesmo tamanho no relatório visual. Os conteúdos e as datas diferem; isso é comparação de composição, sem pontuação de pixels nem alegação de dados idênticos. A imagem pessoal original permanece fora do repositório e das entregas públicas. Somente eventos sintéticos são usados na validação.

## Validação

Build, testes e evidências do APK deste marco estão em [ANDROID-0.4-VALIDACAO.md](ANDROID-0.4-VALIDACAO.md). O roteiro de interface usa `-e calendarUiQa true -e class com.sagittaryuz.calendartimeline.CalendarInteractionsTest#testWeekDragResizeCancelAccessibilityScopeAndPreferences`, somente no AVD descartável.

## Distribuição

APK debug, mesmo identificador e certificado das entregas anteriores. Nenhuma chave permanente foi criada e nenhuma release pública nova será enviada: permanece o bloqueio de autenticação HTTP 401 no upload GitHub anteriormente registrado. APK, capturas e relatório são entregues pela Library. A versão 0.3.0 permanece preservada separadamente, além do histórico da Library.
