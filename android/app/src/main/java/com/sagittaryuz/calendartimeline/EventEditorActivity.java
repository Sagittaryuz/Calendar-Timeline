package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Real event/reminder editor with civil all-day dates and explicit series edits. */
public final class EventEditorActivity extends Activity {
  final ExecutorService io = Executors.newSingleThreadExecutor();
  final Handler main = new Handler(Looper.getMainLooper());
  CalendarUi ui;
  CalendarStore store;
  CalendarStore.Item item;
  List<CalendarStore.Agenda> agendas = new ArrayList<>();
  LinearLayout root, form;
  EditText title, notes, location;
  TextView calendarValue;
  boolean saving, dirty;
  String initial;
  static final String[] REPEATS = {"Nunca", "Todos os dias", "Toda semana", "Todo mês", "Todo ano"};
  static final String[] RULES = {"", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"};
  static final int[] ALERTS = {-1, 0, 5, 15, 30, 60, 1440};
  static final String[] ALERT_LABELS = {
    "Nenhum",
    "Na hora",
    "5 minutos antes",
    "15 minutos antes",
    "30 minutos antes",
    "1 hora antes",
    "1 dia antes"
  };

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ui = new CalendarUi(this);
    store = new CalendarStore(this);
    try {
      item =
          deserialize(
              saved == null ? getIntent().getStringExtra("draft") : saved.getString("draft"));
      initial = saved == null ? serialize(item) : saved.getString("initial");
      dirty = saved != null && saved.getBoolean("dirty");
      render();
      loadAgendas();
    } catch (Exception e) {
      ui.error(e);
      finish();
    }
  }

  @Override
  protected void onSaveInstanceState(Bundle b) {
    capture();
    super.onSaveInstanceState(b);
    b.putString("draft", serialize(item));
    b.putString("initial", initial);
    b.putBoolean("dirty", dirty);
  }

  @Override
  protected void onDestroy() {
    io.shutdown();
    super.onDestroy();
  }

  static String serialize(CalendarStore.Item x) {
    try {
      return new JSONObject()
          .put("id", x.id)
          .put("calendarId", x.calendarId)
          .put("title", x.title)
          .put("location", x.location)
          .put("notes", x.notes)
          .put("start", x.start)
          .put("end", x.end)
          .put("zone", x.zone)
          .put("rule", x.rule)
          .put("allDay", x.allDay)
          .put("reminder", x.reminder)
          .put("completed", x.completed)
          .put("editable", x.editable)
          .put("color", x.color)
          .put("alert", x.alert)
          .put("priority", x.priority)
          .put("localId", x.localId)
          .put("calendarName", x.calendarName)
          .toString();
    } catch (JSONException e) {
      throw new IllegalArgumentException("Dados inválidos");
    }
  }

  static CalendarStore.Item deserialize(String text) throws JSONException {
    JSONObject j = new JSONObject(text);
    CalendarStore.Item x = new CalendarStore.Item();
    x.id = j.optLong("id");
    x.calendarId = j.optLong("calendarId");
    x.title = j.optString("title");
    x.location = j.optString("location");
    x.notes = j.optString("notes");
    x.start = j.getLong("start");
    x.end = j.getLong("end");
    x.zone = j.optString("zone", ZoneId.systemDefault().getId());
    x.rule = j.optString("rule");
    x.allDay = j.optBoolean("allDay");
    x.reminder = j.optBoolean("reminder");
    x.completed = j.optBoolean("completed");
    x.editable = j.optBoolean("editable");
    x.color = j.optInt("color", 0xff007aff);
    x.alert = j.optInt("alert", -1);
    x.priority = j.optInt("priority");
    x.localId = j.optString("localId");
    x.calendarName = j.optString("calendarName");
    return x;
  }

  void capture() {
    if (title != null) {
      item.title = title.getText().toString();
      item.notes = notes.getText().toString();
      if (location != null) item.location = location.getText().toString();
    }
  }

  void loadAgendas() {
    io.execute(
        () -> {
          try {
            List<CalendarStore.Agenda> loaded = store.calendars();
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  agendas = loaded;
                  if (item.calendarId == 0)
                    for (CalendarStore.Agenda a : loaded)
                      if (a.editable()) {
                        item.calendarId = a.id;
                        item.calendarName = a.name;
                        break;
                      }
                  if (calendarValue != null)
                    calendarValue.setText(
                        (item.calendarName.isEmpty() ? "Escolher agenda local" : item.calendarName)
                            + "  ›");
                });
          } catch (Exception e) {
            main.post(() -> ui.error(e));
          }
        });
  }

  void render() {
    root = ui.column();
    root.setBackgroundColor(ui.bg);
    root.setFitsSystemWindows(true);
    setContentView(root);
    LinearLayout bar = ui.row();
    bar.setPadding(ui.dp(16), ui.dp(10), ui.dp(16), ui.dp(4));
    bar.addView(ui.icon("close", "Cancelar edição", this::cancel));
    LinearLayout segment = ui.row();
    segment.setPadding(ui.dp(3), ui.dp(3), ui.dp(3), ui.dp(3));
    segment.setBackground(ui.round(ui.soft, 25));
    for (int i = 0; i < 2; i++) {
      final boolean reminder = i == 1;
      TextView t = ui.text(reminder ? "Lembrete" : "Evento", 15, ui.ink);
      t.setGravity(Gravity.CENTER);
      if (reminder == item.reminder) t.setBackground(ui.round(ui.card, 22));
      segment.addView(t, new LinearLayout.LayoutParams(0, ui.dp(40), 1));
      t.setOnClickListener(
          v -> {
            if (item.id > 0 || !item.localId.isEmpty() || saving) return;
            capture();
            item.reminder = reminder;
            item.rule = "";
            item.alert = -1;
            dirty = true;
            render();
          });
    }
    LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(0, ui.dp(46), 1);
    slp.setMargins(ui.dp(8), 0, ui.dp(8), 0);
    bar.addView(segment, slp);
    View save = ui.icon("check", "Salvar", this::save);
    save.setEnabled(!saving);
    bar.addView(save);
    root.addView(bar);
    ScrollView scroll = new ScrollView(this);
    form = ui.column();
    scroll.addView(form);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    LinearLayout first = ui.group(form);
    title = edit(first, "Título", item.title, 25);
    title.setTypeface(null, android.graphics.Typeface.BOLD);
    title.setMinLines(2);
    title.setMaxLines(4);
    LinearLayout dates = ui.group(form);
    if (item.reminder) {
      ui.fieldRow(dates, "Data", dateText(item.start), () -> date(false));
      Switch timed = new Switch(this);
      timed.setText("Hora");
      timed.setTextColor(ui.ink);
      timed.setChecked(!item.allDay);
      timed.setPadding(0, ui.dp(12), 0, ui.dp(12));
      dates.addView(timed);
      timed.setOnCheckedChangeListener(
          (b, c) -> {
            capture();
            item.allDay = !c;
            if (item.allDay)
              item.start =
                  localDate(item.start)
                      .atStartOfDay(ZoneId.systemDefault())
                      .toInstant()
                      .toEpochMilli();
            item.end = item.start + 60000;
            dirty = true;
            render();
          });
      if (!item.allDay) ui.fieldRow(dates, "Horário", timeText(item.start), () -> time(false));
    } else {
      ui.fieldRow(
          dates,
          "Início",
          dateText(item.start) + (item.allDay ? "" : "  " + timeText(item.start)),
          () -> date(false));
      if (!item.allDay)
        ui.fieldRow(dates, "Hora de início", timeText(item.start), () -> time(false));
      ui.hairline(dates);
      ui.fieldRow(
          dates,
          "Término",
          dateText(item.allDay ? item.end - 1 : item.end)
              + (item.allDay ? "" : "  " + timeText(item.end)),
          () -> date(true));
      if (!item.allDay) ui.fieldRow(dates, "Hora de término", timeText(item.end), () -> time(true));
      Switch allDay = new Switch(this);
      allDay.setText("Dia inteiro");
      allDay.setTextColor(ui.ink);
      allDay.setChecked(item.allDay);
      allDay.setPadding(0, ui.dp(12), 0, ui.dp(12));
      dates.addView(allDay);
      allDay.setOnCheckedChangeListener(
          (b, c) -> {
            capture();
            LocalDate startDate = localDate(item.start), endDate = localDate(item.end);
            LocalTime endTime = Instant.ofEpochMilli(item.end).atZone(zone()).toLocalTime();
            item.allDay = c;
            if (c) {
              if (!endTime.equals(LocalTime.MIDNIGHT)) endDate = endDate.plusDays(1);
              if (!endDate.isAfter(startDate)) endDate = startDate.plusDays(1);
              item.start =
                  startDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
              item.end = endDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
            }
            dirty = true;
            render();
          });
    }
    ui.hairline(dates);
    ui.fieldRow(dates, "Repetir", repeatLabel(), this::repeat);
    if (!item.allDay) ui.fieldRow(dates, "Fuso horário", item.zone, this::timezone);
    LinearLayout options = ui.group(form);
    calendarValue = null;
    if (!item.reminder) {
      calendarValue =
          ui.fieldRow(
              options,
              "Calendário",
              item.calendarName.isEmpty() ? "Escolher agenda local" : item.calendarName,
              this::chooseCalendar);
      ui.hairline(options);
    }
    ui.fieldRow(options, "Alerta", alertLabel(item.alert), this::alert);
    if (item.reminder) {
      ui.note(
          form,
          "Lembrete salvo neste aparelho. Alertas podem atrasar com a economia de bateria do"
              + " Android.");
      if (!ReminderAlerts.allowed(this) && item.alert >= 0)
        form.addView(ui.action("Permitir notificações", this::notifications));
      if (!item.rule.isEmpty())
        ui.note(form, "Ao concluir, a próxima data será criada. Os concluídos ficam no histórico.");
    } else
      ui.note(
          form,
          "Agendas de contas são exibidas em leitura. Alertas de eventos são entregues pelo"
              + " aplicativo de agenda do Android.");
    LinearLayout fields = ui.group(form);
    if (!item.reminder) {
      location = edit(fields, "Localização", item.location, 17);
      ui.hairline(fields);
    } else location = null;
    notes = edit(fields, "Notas", item.notes, 17);
    notes.setMinLines(3);
    notes.setInputType(
        InputType.TYPE_CLASS_TEXT
            | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
    if (item.id > 0 && !item.rule.isEmpty())
      ui.note(
          form,
          "Você está editando a série inteira. As datas acima são as da primeira ocorrência.");
    if (saving) ui.note(form, "Salvando…");
  }

  EditText edit(LinearLayout group, String hint, String value, int size) {
    EditText e = new EditText(this);
    e.setHint(hint);
    e.setContentDescription(hint);
    e.setTextColor(ui.ink);
    e.setHintTextColor(ui.muted);
    e.setTextSize(size);
    e.setText(value);
    e.setBackgroundColor(android.graphics.Color.TRANSPARENT);
    e.setPadding(0, ui.dp(14), 0, ui.dp(14));
    group.addView(e, new LinearLayout.LayoutParams(-1, -2));
    return e;
  }

  ZoneId zone() {
    return item.allDay ? ZoneId.systemDefault() : ZoneId.of(item.zone);
  }

  LocalDate localDate(long ms) {
    return Instant.ofEpochMilli(ms).atZone(zone()).toLocalDate();
  }

  String dateText(long ms) {
    return Instant.ofEpochMilli(ms)
        .atZone(zone())
        .format(DateTimeFormatter.ofPattern("d MMM uuuu", CalendarActivity.PT));
  }

  String timeText(long ms) {
    return Instant.ofEpochMilli(ms).atZone(zone()).format(DateTimeFormatter.ofPattern("HH:mm"));
  }

  void date(boolean end) {
    capture();
    long millis = end && item.allDay ? item.end - 1 : end ? item.end : item.start;
    LocalDate d = localDate(millis);
    DatePickerDialog dialog =
        new DatePickerDialog(
            this,
            (v, y, m, day) -> {
              LocalDate date = LocalDate.of(y, m + 1, day);
              ZonedDateTime old = Instant.ofEpochMilli(millis).atZone(zone());
              long next =
                  (item.allDay
                          ? (end ? date.plusDays(1) : date).atStartOfDay(zone())
                          : date.atTime(old.toLocalTime()).atZone(zone()))
                      .toInstant()
                      .toEpochMilli();
              if (end) item.end = next;
              else {
                long delta = next - item.start;
                item.start = next;
                item.end += delta;
              }
              dirty = true;
              render();
            },
            d.getYear(),
            d.getMonthValue() - 1,
            d.getDayOfMonth());
    dialog.show();
  }

  void time(boolean end) {
    capture();
    ZonedDateTime d = Instant.ofEpochMilli(end ? item.end : item.start).atZone(zone());
    new TimePickerDialog(
            this,
            (v, h, m) -> {
              LocalDateTime local = d.toLocalDate().atTime(h, m);
              if (zone().getRules().getValidOffsets(local).isEmpty()) {
                new AlertDialog.Builder(this)
                    .setMessage(
                        "Este horário não existe neste fuso devido à mudança de horário. Escolha"
                            + " outro horário.")
                    .setPositiveButton("OK", null)
                    .show();
                return;
              }
              long next = local.atZone(zone()).toInstant().toEpochMilli();
              if (end) item.end = next;
              else {
                long delta = next - item.start;
                item.start = next;
                item.end += delta;
              }
              dirty = true;
              render();
            },
            d.getHour(),
            d.getMinute(),
            true)
        .show();
  }

  String repeatLabel() {
    return repeatLabelFor(item);
  }

  static String repeatLabelFor(CalendarStore.Item item) {
    String rule =
        item.reminder
            ? item.rule
            : item.rule.startsWith("FREQ=") ? item.rule.substring(5) : item.rule;
    for (int i = 0; i < RULES.length; i++) if (rule.equals(RULES[i])) return REPEATS[i];
    return "Personalizada · preservada";
  }

  void repeat() {
    capture();
    new AlertDialog.Builder(this)
        .setTitle("Repetir")
        .setItems(
            REPEATS,
            (d, w) -> {
              item.rule = RULES[w].isEmpty() ? "" : (item.reminder ? "" : "FREQ=") + RULES[w];
              dirty = true;
              render();
            })
        .show();
  }

  static String alertLabel(int n) {
    for (int i = 0; i < ALERTS.length; i++) if (ALERTS[i] == n) return ALERT_LABELS[i];
    return n + " minutos antes";
  }

  void alert() {
    capture();
    new AlertDialog.Builder(this)
        .setTitle("Alerta")
        .setItems(
            ALERT_LABELS,
            (d, w) -> {
              item.alert = ALERTS[w];
              dirty = true;
              render();
              if (item.reminder && item.alert >= 0 && !ReminderAlerts.allowed(this))
                new AlertDialog.Builder(this)
                    .setTitle("Notificações de lembretes")
                    .setMessage(
                        "Permita notificações para receber o alerta. O Android pode atrasar avisos"
                            + " durante a economia de bateria; não pedimos acesso a alarmes"
                            + " exatos.")
                    .setNegativeButton("Agora não", null)
                    .setPositiveButton("Continuar", (v, z) -> notifications())
                    .show();
            })
        .show();
  }

  void notifications() {
    if (Build.VERSION.SDK_INT >= 33
        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 13);
    else {
      Intent i =
          new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
              .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
      startActivity(i);
    }
  }

  void timezone() {
    capture();
    EditText value = new EditText(this);
    value.setSingleLine();
    value.setText(item.zone);
    new AlertDialog.Builder(this)
        .setTitle("Fuso horário")
        .setMessage(
            "Identificador, por exemplo America/Sao_Paulo. O instante é preservado ao trocar o"
                + " fuso.")
        .setView(value)
        .setNegativeButton("Cancelar", null)
        .setPositiveButton(
            "OK",
            (d, w) -> {
              try {
                item.zone = ZoneId.of(value.getText().toString().trim()).getId();
                dirty = true;
                render();
              } catch (Exception e) {
                ui.error(new IllegalArgumentException("Fuso horário inválido"));
              }
            })
        .show();
  }

  void chooseCalendar() {
    capture();
    if (!store.writable()) {
      new AlertDialog.Builder(this)
          .setTitle("Permissão de agenda")
          .setMessage(
              "Permita ler e editar para salvar eventos em agendas locais. Lembretes não precisam"
                  + " dessa permissão.")
          .setNegativeButton("Agora não", null)
          .setPositiveButton(
              "Continuar",
              (d, w) ->
                  requestPermissions(
                      new String[] {
                        Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR
                      },
                      12))
          .show();
      return;
    }
    List<CalendarStore.Agenda> local = new ArrayList<>();
    for (CalendarStore.Agenda a : agendas) if (a.editable()) local.add(a);
    String[] names = new String[local.size() + 1];
    for (int i = 0; i < local.size(); i++) names[i] = local.get(i).name;
    names[local.size()] = "+ Criar agenda neste aparelho";
    new AlertDialog.Builder(this)
        .setTitle("Calendário")
        .setItems(
            names,
            (d, w) -> {
              if (w == local.size()) createCalendar();
              else {
                item.calendarId = local.get(w).id;
                item.calendarName = local.get(w).name;
                dirty = true;
                render();
              }
            })
        .show();
  }

  void createCalendar() {
    EditText name = new EditText(this);
    name.setText("Calendar Timeline");
    new AlertDialog.Builder(this)
        .setTitle("Agenda local")
        .setMessage(
            "Sem conta ou sincronização. Eventos da agenda não são incluídos no backup de"
                + " lembretes.")
        .setView(name)
        .setNegativeButton("Cancelar", null)
        .setPositiveButton(
            "Criar",
            (d, w) ->
                io.execute(
                    () -> {
                      try {
                        long id = store.createLocal(name.getText().toString());
                        main.post(
                            () -> {
                              item.calendarId = id;
                              item.calendarName = name.getText().toString();
                              dirty = true;
                              loadAgendas();
                            });
                      } catch (Exception e) {
                        main.post(() -> ui.error(e));
                      }
                    }))
        .show();
  }

  @Override
  public void onRequestPermissionsResult(int r, String[] p, int[] g) {
    super.onRequestPermissionsResult(r, p, g);
    if (r == 12) {
      if (!store.writable())
        Toast.makeText(
                this, "Use lembretes locais ou permita a edição em Ajustes", Toast.LENGTH_LONG)
            .show();
      loadAgendas();
    }
    if (r == 13) {
      io.execute(() -> ReminderAlerts.schedule(this));
      capture();
      render();
    }
  }

  void save() {
    if (saving) return;
    capture();
    if (item.reminder) item.end = item.start + 60000;
    try {
      CalendarStore.validate(item);
    } catch (Exception e) {
      ui.error(e);
      return;
    }
    if (!item.reminder && (!store.writable() || item.calendarId == 0)) {
      chooseCalendar();
      return;
    }
    if (item.id > 0 && !item.rule.isEmpty()) {
      new AlertDialog.Builder(this)
          .setTitle("Salvar a série inteira?")
          .setMessage("A alteração será aplicada a todas as ocorrências deste evento.")
          .setNegativeButton("Cancelar", null)
          .setPositiveButton("Salvar série", (d, w) -> persist())
          .show();
    } else persist();
  }

  void persist() {
    saving = true;
    render();
    CalendarStore.Item draft = item.copy();
    io.execute(
        () -> {
          try {
            if (draft.reminder) new ReminderStore(this).save(draft);
            else store.save(draft);
            main.post(
                () -> {
                  RefreshCoordinator.refresh(this, null);
                  Toast.makeText(this, "Salvo", Toast.LENGTH_SHORT).show();
                  finish();
                });
          } catch (Exception e) {
            main.post(
                () -> {
                  saving = false;
                  render();
                  ui.error(e);
                });
          }
        });
  }

  void cancel() {
    if (saving) return;
    capture();
    if (dirty || !serialize(item).equals(initial))
      new AlertDialog.Builder(this)
          .setTitle("Descartar alterações?")
          .setNegativeButton("Continuar editando", null)
          .setPositiveButton("Descartar", (d, w) -> finish())
          .show();
    else finish();
  }

  @Override
  public void onBackPressed() {
    cancel();
  }
}
