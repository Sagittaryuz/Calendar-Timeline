package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.os.*;
import android.widget.*;
import java.time.*;
import java.time.format.*;
import java.util.concurrent.*;

/** Readable details, explicit editing scope and destructive confirmation. */
public final class EventDetailsActivity extends Activity {
  CalendarUi ui;
  CalendarStore.Item item;
  final ExecutorService io = Executors.newSingleThreadExecutor();
  final Handler main = new Handler(Looper.getMainLooper());
  boolean first = true;

  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    ui = new CalendarUi(this);
    try {
      item = EventEditorActivity.deserialize(getIntent().getStringExtra("draft"));
      render();
    } catch (Exception e) {
      finish();
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (first) {
      first = false;
      return;
    }
    io.execute(
        () -> {
          try {
            if (item.reminder) {
              boolean found = false;
              for (CalendarStore.Item x : new ReminderStore(this).all())
                if (x.localId.equals(item.localId)) {
                  item = x;
                  found = true;
                  break;
                }
              if (!found) {
                main.post(this::finish);
                return;
              }
            } else item = new CalendarStore(this).occurrence(item.id, item.start, item.end);
            main.post(
                () -> {
                  if (!isDestroyed()) render();
                });
          } catch (Exception e) {
            main.post(this::finish);
          }
        });
  }

  @Override
  protected void onDestroy() {
    io.shutdown();
    super.onDestroy();
  }

  void render() {
    LinearLayout root = ui.column();
    root.setBackgroundColor(ui.bg);
    root.setFitsSystemWindows(true);
    setContentView(root);
    LinearLayout bar = ui.row();
    bar.setPadding(ui.dp(16), ui.dp(8), ui.dp(16), ui.dp(4));
    bar.addView(ui.action("‹ Calendário", this::finish));
    bar.addView(new android.view.View(this), new LinearLayout.LayoutParams(0, 1, 1));
    if (item.editable)
      bar.addView(
          ui.action(
              "Editar",
              () ->
                  startActivityForResult(
                      new Intent(this, EventEditorActivity.class)
                          .putExtra("draft", EventEditorActivity.serialize(item)),
                      21)));
    root.addView(bar);
    ScrollView scroll = new ScrollView(this);
    LinearLayout body = ui.column();
    scroll.addView(body);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    ui.title(body, item.title);
    LinearLayout card = ui.group(body);
    long start = item.start, end = item.end;
    ZoneId zone = item.allDay ? ZoneId.systemDefault() : ZoneId.of(item.zone);
    DateTimeFormatter fmt =
        DateTimeFormatter.ofPattern(
                item.allDay ? "EEEE, d MMM uuuu" : "EEE, d MMM uuuu · HH:mm", CalendarActivity.PT)
            .withZone(zone);
    ui.fieldRow(
        card, item.reminder ? "Data" : "Início", fmt.format(Instant.ofEpochMilli(start)), null);
    if (!item.reminder)
      ui.fieldRow(
          card, "Término", fmt.format(Instant.ofEpochMilli(item.allDay ? end - 1 : end)), null);
    if (!item.allDay) ui.fieldRow(card, "Fuso", item.zone, null);
    ui.fieldRow(card, "Calendário", item.calendarName, null);
    ui.fieldRow(card, "Alerta", EventEditorActivity.alertLabel(item.alert), null);
    if (!item.rule.isEmpty())
      ui.fieldRow(card, "Repetição", EventEditorActivity.repeatLabelFor(item), null);
    if (!item.location.isEmpty()) {
      LinearLayout location = ui.group(body);
      ui.fieldRow(location, "Localização", item.location, null);
    }
    if (!item.notes.isEmpty()) {
      LinearLayout notes = ui.group(body);
      TextView t = ui.text(item.notes, 17, ui.ink);
      t.setPadding(0, ui.dp(14), 0, ui.dp(14));
      notes.addView(t);
    }
    if (!item.editable)
      ui.note(
          body,
          "Somente leitura. Esta versão edita agendas locais para evitar sincronização não"
              + " autorizada; exceções de séries complexas são preservadas.");
    if (item.reminder)
      body.addView(
          ui.action(
              item.completed ? "Marcar como incompleto" : "Concluir lembrete",
              () ->
                  io.execute(
                      () -> {
                        try {
                          new ReminderStore(this).toggle(item);
                          main.post(
                              () -> {
                                RefreshCoordinator.refresh(this, null);
                                finish();
                              });
                        } catch (Exception e) {
                          main.post(() -> ui.error(e));
                        }
                      })));
    if (item.editable)
      body.addView(
          ui.action(item.reminder ? "Apagar lembrete" : "Apagar evento", this::confirmDelete));
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == 21 && result == RESULT_OK && data != null && !item.reminder) {
      item.id = data.getLongExtra("id", item.id);
      item.start = data.getLongExtra("start", item.start);
      item.end = data.getLongExtra("end", item.end);
    }
  }

  void confirmDelete() {
    if (!item.seriesRule.isEmpty() && item.occurrenceStart != 0)
      OccurrenceScope.choose(this, "Apagar evento recorrente", this::confirmDeleteScope);
    else confirmDeleteScope(CalendarStore.Scope.SINGLE);
  }

  void confirmDeleteScope(CalendarStore.Scope scope) {
    String subject =
        scope == CalendarStore.Scope.SERIES
            ? "a série inteira"
            : scope == CalendarStore.Scope.FUTURE
                ? "esta e as futuras ocorrências"
                : "esta ocorrência";
    new AlertDialog.Builder(this)
        .setTitle(
            item.reminder
                ? "Apagar lembrete?"
                : item.seriesRule.isEmpty() ? "Apagar evento?" : "Apagar " + subject + "?")
        .setMessage("A exclusão será aplicada somente ao escopo escolhido neste aparelho.")
        .setNegativeButton("Cancelar", null)
        .setPositiveButton(
            "Apagar",
            (d, w) ->
                io.execute(
                    () -> {
                      try {
                        if (item.reminder) new ReminderStore(this).delete(item.localId);
                        else new CalendarStore(this).deleteScoped(item, scope);
                        main.post(
                            () -> {
                              RefreshCoordinator.refresh(this, null);
                              finish();
                            });
                      } catch (Exception e) {
                        main.post(() -> ui.error(e));
                      }
                    }))
        .show();
  }
}
