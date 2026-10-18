package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.widget.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.json.*;

/**
 * Explicit source/permission/list choices; never pretends that an unconfigured provider is active.
 */
public final class TaskSourcesActivity extends Activity {
  CalendarUi ui;
  TaskAuth auth;
  ExternalTaskStore store;
  LinearLayout body;
  TextView state;
  final Handler main = new Handler(Looper.getMainLooper());
  boolean busy;

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ui = new CalendarUi(this);
    auth = new TaskAuth(this);
    store = new ExternalTaskStore(this);
    render();
  }

  void render() {
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setFocusableInTouchMode(true);
    body = ui.column();
    body.setFitsSystemWindows(true);
    body.setPadding(ui.dp(18), ui.dp(16), ui.dp(18), ui.dp(24));
    body.setBackground(ui.backdrop());
    scroll.addView(body);
    setContentView(scroll);
    scroll.requestFocus();
    body.addView(ui.action("‹ Calendário", this::finish));
    ui.title(body, "Fontes de lembretes");
    ui.note(
        body,
        "Prévia de integrações · Google e Microsoft dependem de configuração do aplicativo e do seu"
            + " consentimento. Nenhuma conta é conectada automaticamente.");
    state =
        ui.text(
            busy ? "Consultando a fonte…" : "Escolha uma fonte ou consulte suas tarefas em cache.",
            14,
            ui.muted);
    body.addView(state);
    String key = getIntent().getStringExtra("taskKey");
    if (key != null) {
      task(key);
      return;
    }
    LinearLayout local = ui.group(body);
    ui.note(local, "Lembretes locais · disponíveis offline, sem conta");
    local.addView(
        ui.action(
            "Abrir lembretes locais",
            () -> {
              startActivity(
                  new Intent(this, CalendarActivity.class).putExtra("remindersView", true));
              finish();
            }));
    provider(
        "google",
        "Google Tasks",
        "Listas, tarefas, conclusão e data. A API não expõe o horário nem a recorrência; nenhuma"
            + " hora ou série será inventada.");
    provider(
        "microsoft",
        "Microsoft To Do",
        "Tarefas, datas e alertas fornecidos pela origem. Recorrência é preservada; concluir séries"
            + " permanece bloqueado nesta prévia.");
    LinearLayout samsung = ui.group(body);
    ui.note(samsung, "Samsung Reminder via Microsoft To Do");
    ui.note(
        samsung,
        "No Samsung Reminder, ative Sincronizar com Microsoft To Do e escolha a lista. Conecte essa"
            + " mesma conta Microsoft aqui. A lista aparece uma única vez. Samsung Cloud, fotos da"
            + " Galeria e estacionamento Bixby não entram nessa ponte.");
    samsung.addView(
        ui.action(
            "Como sincronizar Samsung Reminder",
            () ->
                startActivity(
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(
                            "https://support.microsoft.com/en-au/todo/sync-microsoft-to-do-with-the-samsung-reminder-app")))));
    ui.note(
        body,
        "Outros aplicativos: precisam oferecer API ou protocolo de tarefas. CalDAV/VTODO e"
            + " provedores públicos locais são caminhos em avaliação; não estão conectados nesta"
            + " prévia. Alertas de eventos do Android não são listas de tarefas.");
    try {
      for (JSONObject account : store.accounts()) account(account);
      List<TaskRecord> records = store.all();
      if (!records.isEmpty()) {
        ui.title(body, "Tarefas conectadas");
        ui.note(
            body,
            "Inclui concluídas e sem data. Tarefas sem data suportada não são colocadas em um dia"
                + " ou horário fictício no calendário/widget.");
        for (TaskRecord r : records)
          body.addView(
              ui.action(
                  (r.completed() ? "● " : "○ ")
                      + r.title()
                      + "\n"
                      + r.source()
                      + " · "
                      + r.listName
                      + " · "
                      + date(r),
                  () ->
                      startActivity(
                          new Intent(this, TaskSourcesActivity.class).putExtra("taskKey", r.key))));
      }
    } catch (Exception e) {
      state.setText("Não foi possível ler as fontes; dados preservados.");
    }
  }

  void provider(String provider, String label, String limits) {
    LinearLayout card = ui.group(body);
    ui.note(
        card,
        label
            + " · "
            + (auth.configured(provider) ? "Disponível para conectar" : "Configuração pendente"));
    ui.note(card, limits);
    card.addView(ui.action("Conectar " + label, () -> connect(provider)));
  }

  void connect(String provider) {
    if (busy) return;
    if (!auth.configured(provider)) {
      new AlertDialog.Builder(this)
          .setTitle("Configuração pendente")
          .setMessage(
              "O responsável pelo aplicativo precisa configurar o cliente OAuth oficial antes desta"
                  + " conexão. Nenhum login ou sincronização está ativo. Não informe senha, token"
                  + " ou segredo neste app.")
          .setPositiveButton("Entendi", null)
          .show();
      return;
    }
    new AlertDialog.Builder(this)
        .setTitle("Acesso às tarefas")
        .setMessage(
            "A fonte mostrará seu próprio consentimento. Depois, você escolhe as listas. Leitura"
                + " permite exibir tarefas; conclusão também pode alterar seu estado na origem."
                + " Você pode cancelar e usar lembretes locais.")
        .setNegativeButton("Cancelar", null)
        .setNeutralButton("Somente leitura", (d, w) -> authorize(provider, false))
        .setPositiveButton("Leitura e conclusão", (d, w) -> authorize(provider, true))
        .show();
  }

  void authorize(String provider, boolean write) {
    auth.connect(
        provider,
        write,
        new TaskAuth.Result() {
          public void failure(String text) {
            state.setText(text);
          }

          public void success(TaskAuth.Session session) {
            run(
                () -> {
                  store.authorize(
                      session.provider, session.account, session.label, session.writable);
                  return TaskSync.api(TaskSourcesActivity.this, session).lists();
                },
                lists -> choose(session, lists));
          }
        });
  }

  interface Work<T> {
    T execute() throws Exception;
  }

  interface Done<T> {
    void accept(T value) throws Exception;
  }

  <T> void run(Work<T> work, Done<T> done) {
    if (busy) return;
    busy = true;
    state.setText("Consultando a fonte…");
    TaskSync.IO.execute(
        () -> {
          try {
            T value = work.execute();
            main.post(
                () -> {
                  busy = false;
                  if (isDestroyed()) return;
                  try {
                    done.accept(value);
                  } catch (Exception e) {
                    ui.error(e);
                  }
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  busy = false;
                  if (!isDestroyed()) {
                    state.setText("A fonte não foi atualizada; cache preservado.");
                    ui.error(e);
                  }
                });
          }
        });
  }

  void choose(TaskAuth.Session session, JSONArray lists) throws Exception {
    JSONObject account = store.account(session.provider, session.account);
    Map<String, String> old = account == null ? Collections.emptyMap() : store.selected(account);
    String[] labels = new String[lists.length()], ids = new String[lists.length()];
    boolean[] checked = new boolean[lists.length()];
    for (int i = 0; i < lists.length(); i++) {
      JSONObject row = lists.getJSONObject(i);
      ids[i] = row.getString("id");
      labels[i] =
          row.optString(session.provider.equals("google") ? "title" : "displayName", "Lista");
      checked[i] = old.containsKey(ids[i]);
    }
    new AlertDialog.Builder(this)
        .setTitle("Listas a exibir")
        .setMultiChoiceItems(labels, checked, (d, w, value) -> checked[w] = value)
        .setNegativeButton("Cancelar", null)
        .setPositiveButton(
            "Salvar e sincronizar",
            (d, w) -> {
              Map<String, String> selected = new LinkedHashMap<>();
              for (int i = 0; i < ids.length; i++) if (checked[i]) selected.put(ids[i], labels[i]);
              run(
                  () -> {
                    store.select(session.provider, session.account, selected);
                    TaskSync.sync(this, session);
                    return true;
                  },
                  value -> changed());
            })
        .show();
  }

  void account(JSONObject account) throws Exception {
    String provider = account.getString("provider"), id = account.getString("id");
    LinearLayout card = ui.group(body);
    ui.note(
        card,
        (provider.equals("google") ? "Google Tasks" : "Microsoft To Do")
            + " · "
            + account.optString("label"));
    long synced = account.optLong("syncedAt");
    ui.note(
        card,
        account.optString("status")
            + (synced > 0
                ? " · última sincronização " + DataRepository.stamp(synced)
                : " · ainda não sincronizado"));
    card.addView(
        ui.action(
            "Listas e sincronização",
            () -> {
              TaskAuth.Session session = TaskAuth.session(provider, id);
              if (session == null) {
                state.setText(
                    "Autorize novamente usando Conectar para obter acesso à conta escolhida.");
                return;
              }
              run(
                  () -> TaskSync.api(TaskSourcesActivity.this, session).lists(),
                  lists -> choose(session, lists));
            }));
    card.addView(
        ui.action(
            "Desconectar esta conta",
            () ->
                new AlertDialog.Builder(this)
                    .setTitle("Desconectar conta?")
                    .setMessage(
                        "Remove desta aplicação as listas e o cache da conta. Não apaga tarefas da"
                            + " origem. O app também tenta limpar/revogar a sessão oficial; você"
                            + " pode revisar os acessos nas configurações Google/Microsoft.")
                    .setNegativeButton("Cancelar", null)
                    .setPositiveButton(
                        "Desconectar",
                        (d, w) ->
                            new Thread(
                                    () -> {
                                      try {
                                        store.disconnect(provider, id);
                                        TaskAuth.forget(provider, id);
                                        main.post(
                                            () -> {
                                              if (!isDestroyed()) {
                                                auth.disconnect(provider, id, () -> {});
                                                changed();
                                              }
                                            });
                                      } catch (Exception e) {
                                        main.post(
                                            () -> {
                                              if (!isDestroyed()) ui.error(e);
                                            });
                                      }
                                    },
                                    "task-disconnect")
                                .start())
                    .show()));
  }

  static String date(TaskRecord r) {
    Long at = r.scheduledAt();
    if (at == null)
      return r.raw.has("due") || r.raw.has("dueDateTime") ? "Data/fuso não suportado" : "Sem data";
    return DateTimeFormatter.ofPattern(r.dateOnly() ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm")
            .withZone(ZoneId.systemDefault())
            .format(Instant.ofEpochMilli(at))
        + (r.dateOnly() ? " · sem horário" : "");
  }

  void task(String key) {
    try {
      TaskRecord r = store.task(key);
      ui.title(body, r.title());
      ui.note(body, r.source() + " · " + r.listName);
      ui.note(body, date(r));
      ui.note(body, r.completed() ? "Concluída" : "Pendente");
      if (r.provider.equals("google")) ui.note(body, r.raw.optString("notes"));
      if (r.recurring())
        ui.note(
            body,
            "Repetição gerenciada na origem. A série não será expandida ou simplificada pelo app.");
      body.addView(
          ui.action(
              r.completed() ? "Reabrir na origem" : "Concluir na origem",
              () ->
                  new AlertDialog.Builder(this)
                      .setTitle(r.completed() ? "Reabrir tarefa?" : "Concluir tarefa?")
                      .setMessage(
                          "Altera esta tarefa em "
                              + r.source()
                              + ". A ação exige acesso de conclusão e uma versão atual da tarefa;"
                              + " não fica pendente para envio offline.")
                      .setNegativeButton("Cancelar", null)
                      .setPositiveButton(
                          "Confirmar",
                          (d, w) ->
                              run(
                                  () -> {
                                    TaskSync.complete(this, r, !r.completed());
                                    return true;
                                  },
                                  value -> changed()))
                      .show()));
    } catch (Exception e) {
      ui.note(body, "Tarefa removida ou fonte desconectada.");
    }
  }

  void changed() {
    getSharedPreferences("settings", 0).edit().putBoolean("demo", false).apply();
    RefreshCoordinator.refresh(this, null);
    render();
  }

  @Override
  protected void onActivityResult(int request, int code, Intent data) {
    super.onActivityResult(request, code, data);
    auth.onActivityResult(request, code, data);
  }
}
