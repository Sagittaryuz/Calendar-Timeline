# Calendário Android 0.3.0 de teste

O app agora abre um calendário nativo, e tocar no widget abre a agenda do próprio Calendar Timeline. A configuração anterior permanece em Ajustes, com o renderer Scriptable compartilhado, clima manual Open-Meteo, backups e verificação de versões. O APK 0.2.0 e o commit `418101f` permanecem recuperáveis.

## Interface e referências

Foram consultados e inspecionados os exemplos públicos oficiais de [visualizações](https://support.apple.com/pt-br/guide/iphone/iphfd1054569/ios), [criação e edição](https://support.apple.com/pt-br/guide/iphone/iph3d110f84/ios), [vários calendários](https://support.apple.com/pt-br/guide/iphone/iph3d1110d4/ios) e [lembretes no calendário](https://support.apple.com/pt-br/guide/iphone/iph14f1d32a5/ios). A implementação usa controles Android, ícones desenhados no projeto e fontes do sistema. Não distribui imagens, fontes, ícones ou marcas da Apple; não implica afiliação.

- Ano com 12 meses; mês com indicadores e títulos coloridos; dia com escala horária, duração e sobreposição; lista dos próximos 90 dias.
- Hoje, período anterior/próximo, seleção de dia, calendários visíveis e busca por título, local e notas no intervalo de um ano antes/depois da data selecionada. A busca informa o período e limita a apresentação a 400 ocorrências.
- Formulário Evento/Lembrete, detalhes, criação, edição, exclusão com confirmação, notas, localização de eventos, datas, fuso, dia inteiro, repetição e alerta.
- Tema claro/escuro acompanha o Android; rotação preserva o rascunho. Medidas em dp/sp, fontes do sistema e rolagem para diferentes telas.

## Dados e permissões

Eventos usam o [Calendar Provider oficial](https://developer.android.com/identity/providers/calendar-provider). A leitura é solicitada quando a pessoa opta por mostrar agendas; leitura e escrita, quando deseja salvar eventos. Sem permissão, lembretes locais continuam disponíveis. Não há OAuth, criação de contas, integração iCloud, credencial embutida ou transmissão de eventos pelo app.

Agendas de contas existentes são de leitura. A edição é limitada a agendas `LOCAL` com acesso de contribuição; o usuário pode criar uma agenda neste aparelho, após uma explicação. Isso evita que salvar pelo app provoque sincronização não autorizada de contas. O app não muda a visibilidade global das agendas: os filtros são privados e também se aplicam ao widget.

Eventos não recorrentes usam início/fim; recorrentes usam RRULE e duração conforme o provedor. Datas de dia inteiro são civis em UTC no provedor e convertidas para a apresentação local. Lembretes de dia inteiro preservam a data civil ao mudar o fuso do aparelho. A edição e a exclusão afetam **a série inteira**, com indicação e confirmação. Regras existentes são preservadas até a pessoa escolher outra repetição. Alterar título ou data sem mudar o alerta preserva os alertas adicionais existentes. Exceções complexas são apresentadas em leitura.

Lembretes ficam no armazenamento privado e funcionam offline. Podem ser editados, concluídos, reabertos e apagados. Ao concluir um lembrete diário, semanal, mensal ou anual, o app guarda o concluído e avança a próxima data em tempo civil no fuso definido. Datas mensais no fim do mês são ajustadas ao último dia válido. Até 2.000 lembretes, incluindo histórico.

Alertas locais usam notificações privadas e AlarmManager **inexato**, sem permissão especial de alarmes exatos. Android 13+ pede a permissão de notificações em contexto. Há explicação quando bloqueadas; nenhum acesso é concedido automaticamente. [Restrições de bateria podem atrasar avisos](https://developer.android.com/develop/background-work/services/alarms). Alertas de eventos são gravados em CalendarContract.Reminders e dependem do aplicativo de agenda do sistema. Não há promessa de pontualidade para uso crítico.

## Backup e atualização

O formato de exportação passa ao schema 2, incluindo notas, fuso, repetição, alerta e conclusão dos lembretes. Importa schemas 1 e 2 e continua a validar tipos, tamanhos, IDs e datas antes de alterar dados. A versão 0.2.0 importa apenas schema 1; guarde o backup anterior antes de atualizar. Eventos pertencem ao provedor Android e **não** entram no backup de lembretes. Permissões, contas, cache e metadados internos também não entram.

O identificador e o certificado de teste são mantidos. Não foi criada chave permanente de produção, nem publicação Play Store. A publicação GitHub é identificada como APK debug de teste, com manifesto de atualização conferido contra o SHA-256 do arquivo validado. Instalação e atualização são decisões manuais da pessoa.

## Limites de equivalência

A organização visual é inspirada no Calendário do iPhone, com implementação própria. Não existe equivalência total de pixels, gestos ou integrações entre iOS e Android. Não inclui Siri, Apple Intelligence, anexos, mapas/tempo de viagem, convites, compartilhamento de contas, restauração de eventos apagados ou edição de ocorrência individual. O widget conserva o renderer do projeto original; a tela do calendário é nativa Android.

A validação usa exclusivamente eventos, calendários e lembretes sintéticos em AVD descartável. A imagem pessoal de referência permanece fora do repositório e da publicação.
