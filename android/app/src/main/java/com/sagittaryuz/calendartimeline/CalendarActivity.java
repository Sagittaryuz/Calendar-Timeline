package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.graphics.Typeface;
import android.os.*;
import android.text.*;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.*;

/** Full offline calendar front end. The bitmap widget renderer remains independent. */
public final class CalendarActivity extends Activity {
  static final Locale PT = Locale.forLanguageTag("pt-BR");
  final ExecutorService io = Executors.newSingleThreadExecutor();
  final Handler main = new Handler(Looper.getMainLooper());
  CalendarUi ui;
  CalendarStore store;
  android.content.SharedPreferences prefs;
  LinearLayout root, body, pinnedDay;
  ScrollView agendaScroll;
  TextView yearLink;
  LocalDate selected = LocalDate.now();
  String mode = "MONTH", query = "";
  boolean search = false, completed = false;
  int generation;
  List<CalendarStore.Item> items = new ArrayList<>();
  String loadError = "";
  String updateMessage = "";
  Runnable permissionAction;
  boolean requesting;

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ui = new CalendarUi(this);
    store = new CalendarStore(this);
    prefs = getSharedPreferences("settings", 0);
    if (saved != null) {
      selected = LocalDate.parse(saved.getString("date", selected.toString()));
      mode = saved.getString("mode", "MONTH");
      query = saved.getString("query", "");
      search = saved.getBoolean("search");
      completed = saved.getBoolean("completed");
    } else if (getIntent().hasExtra("date")) {
      selected =
          Instant.ofEpochMilli(getIntent().getLongExtra("date", System.currentTimeMillis()))
              .atZone(ZoneId.systemDefault())
              .toLocalDate();
      mode = "DAY";
    }
    render();
  }

  @Override
  protected void onSaveInstanceState(Bundle b) {
    super.onSaveInstanceState(b);
    b.putString("date", selected.toString());
    b.putString("mode", mode);
    b.putString("query", query);
    b.putBoolean("search", search);
    b.putBoolean("completed", completed);
  }

  @Override
  protected void onResume() {
    super.onResume();
    load();
    io.execute(() -> ReminderAlerts.schedule(this));
    if (prefs.getBoolean("checkUpdates", true))
      UpdateRepository.checkAsync(
          this,
          false,
          result -> {
            if (isDestroyed()) return;
            String message =
                result.state == UpdateRepository.State.AVAILABLE ? result.message() : "";
            if (!message.equals(updateMessage)) {
              updateMessage = message;
              render();
            }
          });
  }

  @Override
  protected void onDestroy() {
    generation++;
    main.removeCallbacksAndMessages(null);
    io.shutdown();
    super.onDestroy();
  }

  Set<String> hidden() {
    return new HashSet<>(prefs.getStringSet("hiddenCalendars", Collections.emptySet()));
  }

  void load() {
    final int g = ++generation;
    LocalDate first =
        mode.equals("YEAR")
            ? LocalDate.of(selected.getYear(), 1, 1)
            : selected.withDayOfMonth(1).minusDays(7);
    LocalDate end =
        mode.equals("YEAR")
            ? first.plusYears(1)
            : mode.equals("LIST")
                ? selected.plusDays(91)
                : selected.withDayOfMonth(1).plusMonths(1).plusDays(7);
    if (search) {
      first = selected.minusYears(1);
      end = selected.plusYears(1);
    }
    long from = first.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        to = end.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    Set<String> hidden = hidden();
    io.execute(
        () -> {
          List<CalendarStore.Item> loaded = new ArrayList<>();
          String error = "";
          try {
            loaded.addAll(store.instances(from, to, hidden, null));
          } catch (Exception ex) {
            error = "Agenda indisponível. Toque para tentar novamente.";
          }
          try {
            if (prefs.getBoolean("showReminders", true))
              for (CalendarStore.Item r : new ReminderStore(this).all())
                if ((completed || !r.completed) && r.start >= from && r.start < to) loaded.add(r);
          } catch (Exception ex) {
            error = "Não foi possível ler os lembretes locais.";
          }
          loaded.sort(Comparator.comparingLong(x -> x.start));
          final String msg = error;
          main.post(
              () -> {
                if (isDestroyed() || g != generation) return;
                items = loaded;
                loadError = msg;
                yearLink.setText("‹ " + selected.getYear());
                renderBody();
                scrollToDay();
              });
        });
  }

  void change(String m) {
    mode = m;
    query = "";
    search = false;
    render();
    load();
  }

  void shift(int direction) {
    selected =
        mode.equals("YEAR")
            ? selected.plusYears(direction)
            : mode.equals("DAY")
                ? selected.plusDays(direction)
                : mode.equals("LIST")
                    ? selected.plusDays(direction * 30)
                    : selected.plusMonths(direction);
    load();
  }

  void render() {
    root = ui.column();
    root.setBackgroundColor(ui.bg);
    root.setFitsSystemWindows(true);
    setContentView(root);
    LinearLayout toolbar = ui.row();
    toolbar.setPadding(ui.dp(14), ui.dp(6), ui.dp(14), ui.dp(4));
    yearLink = ui.action("‹ " + selected.getYear(), () -> change("YEAR"));
    toolbar.addView(yearLink);
    View spacer = new View(this);
    toolbar.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
    toolbar.addView(ui.icon("list", "Alterar visualização", this::viewMenu));
    toolbar.addView(
        ui.icon(
            "search",
            "Buscar eventos e lembretes",
            () -> {
              search = !search;
              query = "";
              render();
              load();
            }));
    toolbar.addView(ui.icon("plus", "Novo evento ou lembrete", () -> openEditor(null)));
    root.addView(toolbar);
    if (!updateMessage.isEmpty())
      root.addView(
          ui.action(
              updateMessage + " · abrir",
              () -> startActivity(new Intent(this, MaintenanceActivity.class))));
    if (search) {
      EditText field = new EditText(this);
      field.setSingleLine();
      field.setHint("Buscar eventos e lembretes");
      field.setContentDescription("Campo de busca");
      field.setTextColor(ui.ink);
      field.setHintTextColor(ui.muted);
      field.setTextSize(17);
      field.setPadding(ui.dp(18), 0, ui.dp(18), 0);
      field.setBackground(ui.round(ui.soft, 14));
      field.setText(query);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, ui.dp(48));
      lp.setMargins(ui.dp(16), ui.dp(8), ui.dp(16), ui.dp(4));
      root.addView(field, lp);
      field.addTextChangedListener(
          new TextWatcher() {
            Runnable pending;

            public void beforeTextChanged(CharSequence s, int st, int count, int after) {}

            public void onTextChanged(CharSequence s, int st, int before, int count) {
              query = s.toString();
              if (pending != null) main.removeCallbacks(pending);
              pending = () -> renderBody();
              main.postDelayed(pending, 200);
            }

            public void afterTextChanged(Editable s) {}
          });
    }
    pinnedDay = ui.column();
    root.addView(pinnedDay);
    ScrollView scroll = agendaScroll = new ScrollView(this);
    scroll.setFillViewport(true);
    body = ui.column();
    scroll.addView(body);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    renderBody();
    LinearLayout bottom = ui.row();
    bottom.setPadding(ui.dp(16), ui.dp(8), ui.dp(16), ui.dp(8));
    bottom.addView(
        ui.action(
            "Hoje",
            () -> {
              selected = LocalDate.now();
              if (mode.equals("YEAR")) mode = "MONTH";
              load();
            }));
    bottom.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1));
    bottom.addView(ui.action("Calendários", this::calendars));
    bottom.addView(
        ui.icon(
            "settings",
            "Ajustes do widget, clima e backup",
            () -> startActivity(new Intent(this, MainActivity.class))));
    root.addView(bottom);
    scrollToDay();
  }

  void scrollToDay() {
    if (!search && mode.equals("DAY"))
      agendaScroll.post(
          () -> {
            int hour = 9;
            for (CalendarStore.Item x : on(selected))
              if (!x.allDay) {
                hour =
                    Math.max(
                        0,
                        Instant.ofEpochMilli(x.start).atZone(ZoneId.systemDefault()).getHour() - 1);
                break;
              }
            agendaScroll.scrollTo(0, ui.dp(hour * 64 + 100));
          });
  }

  void renderBody() {
    body.removeAllViews();
    pinnedDay.removeAllViews();
    if (search) {
      ui.title(body, "Buscar");
      ui.note(
          body,
          "De "
              + selected.minusYears(1).format(DateTimeFormatter.ofPattern("dd/MM/uuuu"))
              + " a "
              + selected.plusYears(1).format(DateTimeFormatter.ofPattern("dd/MM/uuuu")));
      agenda(body, null, true);
      return;
    }
    LinearLayout heading = ui.row();
    TextView title =
        ui.text(
            mode.equals("YEAR")
                ? Integer.toString(selected.getYear())
                : cap(
                    selected.format(
                        DateTimeFormatter.ofPattern(
                            mode.equals("DAY") ? "EEEE, d MMM" : "MMMM", PT))),
            mode.equals("DAY") ? 25 : 34,
            ui.ink);
    title.setTypeface(null, Typeface.BOLD);
    heading.setPadding(ui.dp(20), ui.dp(12), ui.dp(12), ui.dp(10));
    heading.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
    heading.addView(ui.icon("back", "Período anterior", () -> shift(-1)));
    heading.addView(ui.icon("next", "Próximo período", () -> shift(1)));
    if (mode.equals("DAY")) pinnedDay.addView(heading);
    else body.addView(heading);
    if (!loadError.isEmpty()) {
      TextView error = ui.action(loadError, this::load);
      body.addView(error);
    }
    if (!store.readable()) {
      LinearLayout card = ui.group(body);
      ui.fieldRow(
          card, "Agendas do Android", "Permitir acesso", () -> permission(false, this::load));
      ui.note(body, "Seus lembretes locais funcionam sem acesso à agenda.");
    }
    switch (mode) {
      case "YEAR":
        year();
        break;
      case "DAY":
        day();
        break;
      case "LIST":
        ui.note(body, "Próximos 90 dias · " + ZoneId.systemDefault().getId());
        agenda(body, null, false);
        break;
      default:
        month(body, YearMonth.from(selected), false);
        ui.hairline(body);
        TextView date =
            ui.text(
                cap(selected.format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", PT))),
                17,
                selected.equals(LocalDate.now()) ? ui.red : ui.ink);
        date.setPadding(ui.dp(20), ui.dp(16), ui.dp(20), ui.dp(8));
        body.addView(date);
        agenda(body, selected, false);
    }
  }

  static String cap(String s) {
    return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(PT) + s.substring(1);
  }

  List<CalendarStore.Item> on(LocalDate date) {
    List<CalendarStore.Item> out = new ArrayList<>();
    long begin = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        end = date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    for (CalendarStore.Item x : items)
      if (x.start < end && (x.reminder ? x.date().equals(date) : x.end > begin)) out.add(x);
    return out;
  }

  void month(LinearLayout parent, YearMonth month, boolean small) {
    if (small) {
      parent.addView(
          new MiniMonthView(
              this,
              month,
              ui,
              () -> {
                selected = month.atDay(1);
                change("MONTH");
              }),
          new LinearLayout.LayoutParams(-1, ui.dp(86)));
      return;
    }
    LinearLayout wrap = ui.column();
    wrap.setPadding(ui.dp(small ? 2 : 10), 0, ui.dp(small ? 2 : 10), 0);
    parent.addView(wrap);
    LinearLayout weekdays = ui.row();
    for (String name : new String[] {"D", "S", "T", "Q", "Q", "S", "S"}) {
      TextView t = ui.text(name, small ? 9 : 11, ui.muted);
      t.setGravity(Gravity.CENTER);
      weekdays.addView(t, new LinearLayout.LayoutParams(0, ui.dp(small ? 18 : 24), 1));
    }
    wrap.addView(weekdays);
    int offset = month.atDay(1).getDayOfWeek().getValue() % 7;
    int count = month.lengthOfMonth();
    int rows = (offset + count + 6) / 7;
    for (int row = 0; row < (small ? 6 : rows); row++) {
      LinearLayout week = ui.row();
      week.setGravity(Gravity.TOP);
      for (int col = 0; col < 7; col++) {
        int day = row * 7 + col - offset + 1;
        LinearLayout cell = ui.column();
        cell.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(0, ui.dp(small ? 22 : 80), 1);
        week.addView(cell, clp);
        if (day < 1 || day > count) continue;
        LocalDate date = month.atDay(day);
        TextView number =
            ui.text(
                Integer.toString(day), small ? 11 : 21, (col == 0 || col == 6) ? ui.muted : ui.ink);
        number.setGravity(Gravity.CENTER);
        if (date.equals(LocalDate.now())) {
          number.setTextColor(0xffffffff);
          number.setBackground(ui.round(ui.red, 30));
        } else if (!small && date.equals(selected)) {
          number.setBackground(ui.round(ui.soft, 30));
          number.setTypeface(null, Typeface.BOLD);
        }
        cell.addView(
            number, new LinearLayout.LayoutParams(ui.dp(small ? 20 : 34), ui.dp(small ? 21 : 34)));
        cell.setContentDescription(
            date.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' uuuu", PT)));
        cell.setOnClickListener(
            v -> {
              selected = date;
              if (small) mode = "MONTH";
              render();
              load();
            });
        if (!small) {
          List<CalendarStore.Item> dayItems = on(date);
          for (int i = 0; i < Math.min(2, dayItems.size()); i++) {
            CalendarStore.Item x = dayItems.get(i);
            TextView chip =
                ui.text(
                    (x.reminder ? "○ " : "") + x.title,
                    9,
                    ui.dark ? x.color : (x.color & 0xff7f7f7f) | 0xff000000);
            chip.setSingleLine();
            chip.setEllipsize(TextUtils.TruncateAt.END);
            chip.setPadding(ui.dp(2), 0, ui.dp(1), 0);
            chip.setBackground(ui.round((x.color & 0xffffff) | 0x28000000, 3));
            LinearLayout.LayoutParams elp = new LinearLayout.LayoutParams(-1, ui.dp(16));
            elp.setMargins(ui.dp(1), ui.dp(1), ui.dp(1), 0);
            cell.addView(chip, elp);
          }
          if (dayItems.size() > 2) {
            TextView more = ui.text("+" + (dayItems.size() - 2), 9, ui.muted);
            more.setGravity(Gravity.CENTER);
            cell.addView(more);
          }
        }
      }
      wrap.addView(week);
      if (!small) ui.hairline(wrap);
    }
  }

  void year() {
    for (int r = 0; r < 4; r++) {
      LinearLayout row = ui.row();
      row.setGravity(Gravity.TOP);
      row.setPadding(ui.dp(12), ui.dp(4), ui.dp(12), ui.dp(4));
      for (int c = 0; c < 3; c++) {
        YearMonth ym = YearMonth.of(selected.getYear(), r * 3 + c + 1);
        LinearLayout col = ui.column();
        TextView name =
            ui.text(cap(ym.atDay(1).format(DateTimeFormatter.ofPattern("MMMM", PT))), 17, ui.red);
        name.setPadding(ui.dp(6), 0, 0, ui.dp(4));
        col.addView(name);
        month(col, ym, true);
        col.setOnClickListener(
            v -> {
              selected = ym.atDay(1);
              change("MONTH");
            });
        row.addView(col, new LinearLayout.LayoutParams(0, -2, 1));
      }
      body.addView(row);
    }
  }

  void agenda(LinearLayout parent, LocalDate date, boolean filtering) {
    int count = 0;
    LocalDate previous = null;
    for (CalendarStore.Item x : items) {
      if (date != null && !on(date).contains(x)) continue;
      if (date == null
          && !search
          && x.start < selected.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli())
        continue;
      String needle = query.toLowerCase(PT);
      if (filtering
          && !((x.title + " " + x.location + " " + x.notes).toLowerCase(PT).contains(needle)))
        continue;
      if (date == null && !x.date().equals(previous)) {
        TextView h =
            ui.text(
                cap(x.date().format(DateTimeFormatter.ofPattern("EEEE, d MMM", PT))), 15, ui.muted);
        h.setPadding(ui.dp(20), ui.dp(18), ui.dp(20), ui.dp(5));
        parent.addView(h);
        previous = x.date();
      }
      eventRow(parent, x);
      if (++count >= 400) {
        ui.note(parent, "Mais de 400 ocorrências. Refine a busca ou escolha um dia.");
        break;
      }
    }
    if (count == 0) {
      ui.note(parent, filtering ? "Nenhum resultado neste período." : "Nenhum evento ou lembrete.");
      if (date != null) parent.addView(ui.action("Adicionar neste dia", () -> openEditor(null)));
    }
  }

  void eventRow(LinearLayout parent, CalendarStore.Item x) {
    LinearLayout r = ui.row();
    r.setPadding(ui.dp(20), ui.dp(11), ui.dp(20), ui.dp(11));
    if (x.reminder) {
      TextView check = ui.text(x.completed ? "●" : "○", 30, x.color);
      check.setGravity(Gravity.CENTER);
      r.addView(check, new LinearLayout.LayoutParams(ui.dp(38), ui.dp(44)));
      check.setContentDescription(x.completed ? "Reabrir lembrete" : "Concluir lembrete");
      check.setOnClickListener(
          v ->
              io.execute(
                  () -> {
                    try {
                      new ReminderStore(this).toggle(x);
                      main.post(
                          () -> {
                            load();
                            RefreshCoordinator.refresh(this, null);
                          });
                    } catch (Exception ex) {
                      main.post(() -> ui.error(ex));
                    }
                  }));
    } else {
      View color = new View(this);
      color.setBackground(ui.round(x.color, 2));
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ui.dp(4), ui.dp(42));
      lp.setMargins(0, 0, ui.dp(12), 0);
      r.addView(color, lp);
    }
    LinearLayout words = ui.column();
    TextView title = ui.text(x.title, 17, x.completed ? ui.muted : ui.ink);
    title.setMaxLines(2);
    words.addView(title);
    String subtitle =
        (x.allDay
                ? "Dia inteiro"
                : Instant.ofEpochMilli(x.start)
                        .atZone(ZoneId.systemDefault())
                        .format(DateTimeFormatter.ofPattern("HH:mm"))
                    + (x.reminder
                        ? ""
                        : " – "
                            + Instant.ofEpochMilli(x.end)
                                .atZone(ZoneId.systemDefault())
                                .format(DateTimeFormatter.ofPattern("HH:mm"))))
            + " · "
            + x.calendarName;
    TextView sub = ui.text(subtitle, 12, ui.muted);
    sub.setSingleLine();
    sub.setEllipsize(TextUtils.TruncateAt.END);
    words.addView(sub);
    r.addView(words, new LinearLayout.LayoutParams(0, -2, 1));
    r.setOnClickListener(v -> details(x));
    parent.addView(r);
    ui.hairline(parent);
  }

  void day() {
    LinearLayout week = ui.row();
    week.setPadding(ui.dp(12), 0, ui.dp(12), ui.dp(8));
    LocalDate sunday = selected.minusDays(selected.getDayOfWeek().getValue() % 7);
    for (int i = 0; i < 7; i++) {
      LocalDate d = sunday.plusDays(i);
      TextView t =
          ui.text(
              d.format(DateTimeFormatter.ofPattern("EE", PT)).substring(0, 1).toUpperCase(PT)
                  + "\n"
                  + d.getDayOfMonth(),
              16,
              d.equals(selected) ? 0xffffffff : ui.ink);
      t.setGravity(Gravity.CENTER);
      if (d.equals(selected)) t.setBackground(ui.round(ui.red, 24));
      week.addView(t, new LinearLayout.LayoutParams(0, ui.dp(54), 1));
      t.setOnClickListener(
          v -> {
            selected = d;
            load();
          });
    }
    pinnedDay.addView(week);
    List<CalendarStore.Item> day = on(selected);
    LinearLayout all = ui.group(body);
    ui.fieldRow(all, "Dia inteiro", "", null);
    boolean any = false;
    for (CalendarStore.Item x : day)
      if (x.allDay) {
        eventRow(all, x);
        any = true;
      }
    if (!any) ui.note(all, "Nenhum compromisso de dia inteiro");
    FrameLayout timeline = new FrameLayout(this);
    timeline.setMinimumHeight(ui.dp(24 * 64));
    body.addView(timeline, new LinearLayout.LayoutParams(-1, ui.dp(24 * 64)));
    for (int h = 0; h < 24; h++) {
      final int hour = h;
      LinearLayout slot = ui.row();
      slot.setGravity(Gravity.TOP);
      TextView label = ui.text(String.format(PT, "%02d:00", h), 11, ui.muted);
      label.setPadding(ui.dp(12), 0, ui.dp(8), 0);
      slot.addView(label, new LinearLayout.LayoutParams(ui.dp(62), ui.dp(22)));
      View line = new View(this);
      line.setBackgroundColor(ui.line);
      slot.addView(line, new LinearLayout.LayoutParams(-1, ui.dp(0.5f)));
      FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, ui.dp(64));
      lp.topMargin = ui.dp(h * 64);
      timeline.addView(slot, lp);
      slot.setContentDescription("Adicionar às " + h + " horas");
      slot.setOnClickListener(
          v -> {
            CalendarStore.Item fresh = newItem(false);
            fresh.start =
                selected.atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            fresh.end = fresh.start + 3600000;
            openEditor(fresh);
          });
    }
    List<CalendarStore.Item> timed = new ArrayList<>();
    for (CalendarStore.Item x : day) if (!x.allDay) timed.add(x);
    long dayStart = selected.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        dayEnd =
            selected.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    List<Long> laneEnds = new ArrayList<>();
    List<View> blocks = new ArrayList<>();
    List<Integer> lanes = new ArrayList<>();
    for (CalendarStore.Item x : timed) {
      int lane = 0;
      while (lane < laneEnds.size() && laneEnds.get(lane) > x.start) lane++;
      if (lane == laneEnds.size()) laneEnds.add(x.end);
      else laneEnds.set(lane, x.end);
      int from =
          x.start < dayStart
              ? 0
              : Instant.ofEpochMilli(x.start).atZone(ZoneId.systemDefault()).getHour() * 60
                  + Instant.ofEpochMilli(x.start).atZone(ZoneId.systemDefault()).getMinute();
      int until =
          x.end >= dayEnd
              ? 1440
              : Instant.ofEpochMilli(x.end).atZone(ZoneId.systemDefault()).getHour() * 60
                  + Instant.ofEpochMilli(x.end).atZone(ZoneId.systemDefault()).getMinute();
      String label = (x.reminder ? (x.completed ? "● " : "○ ") : "") + x.title;
      if (!x.reminder)
        label +=
            "\n"
                + Instant.ofEpochMilli(x.start)
                    .atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("HH:mm"));
      TextView block = ui.text(label, 13, ui.dark ? ui.ink : (x.color & 0xff6f6f6f) | 0xff000000);
      block.setGravity(Gravity.TOP);
      block.setPadding(ui.dp(7), ui.dp(3), ui.dp(4), ui.dp(2));
      block.setMaxLines(x.reminder ? 1 : 3);
      block.setEllipsize(TextUtils.TruncateAt.END);
      block.setBackground(ui.round((x.color & 0xffffff) | 0x40000000, 7));
      block.setOnClickListener(v -> details(x));
      block.setContentDescription(x.title);
      FrameLayout.LayoutParams lp =
          new FrameLayout.LayoutParams(
              -1, ui.dp(Math.max(x.reminder ? 30 : 44, (until - from) * 64f / 60 - 2)));
      lp.topMargin = ui.dp(from * 64f / 60);
      lp.leftMargin = ui.dp(64);
      lp.rightMargin = ui.dp(12);
      timeline.addView(block, lp);
      blocks.add(block);
      lanes.add(lane);
    }
    timeline.post(
        () -> {
          int count = Math.max(1, laneEnds.size());
          int width = (timeline.getWidth() - ui.dp(78)) / count;
          for (int i = 0; i < blocks.size(); i++) {
            FrameLayout.LayoutParams lp =
                (FrameLayout.LayoutParams) blocks.get(i).getLayoutParams();
            lp.width = width - ui.dp(3);
            lp.leftMargin = ui.dp(64) + lanes.get(i) * width;
            blocks.get(i).setLayoutParams(lp);
          }
        });
    ui.note(body, "Horários em " + ZoneId.systemDefault().getId());
  }

  CalendarStore.Item newItem(boolean reminder) {
    CalendarStore.Item x = new CalendarStore.Item();
    x.reminder = reminder;
    x.start = defaultStart(selected, ZonedDateTime.now()).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    return x;
  }

  static ZonedDateTime defaultStart(LocalDate selected, ZonedDateTime now) {
    return selected.equals(now.toLocalDate())
        ? now.withMinute(0).withSecond(0).withNano(0).plusHours(1)
        : selected.atTime(9, 0).atZone(now.getZone());
  }

  void openEditor(CalendarStore.Item x) {
    Intent i = new Intent(this, EventEditorActivity.class);
    if (x == null) x = newItem(false);
    i.putExtra("draft", EventEditorActivity.serialize(x));
    startActivity(i);
  }

  void details(CalendarStore.Item instance) {
    io.execute(
        () -> {
          try {
            CalendarStore.Item x = instance.reminder ? instance : store.event(instance.id);
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  Intent i =
                      new Intent(this, EventDetailsActivity.class)
                          .putExtra("draft", EventEditorActivity.serialize(x))
                          .putExtra("instanceStart", instance.start)
                          .putExtra("instanceEnd", instance.end);
                  startActivity(i);
                });
          } catch (Exception e) {
            main.post(() -> ui.error(e));
          }
        });
  }

  void viewMenu() {
    String[] labels = {
      "Ano",
      "Mês",
      "Dia",
      "Lista · próximos 90 dias",
      completed ? "Ocultar lembretes concluídos" : "Mostrar lembretes concluídos"
    };
    new AlertDialog.Builder(this)
        .setTitle("Visualização")
        .setItems(
            labels,
            (d, w) -> {
              if (w == 4) {
                completed = !completed;
                load();
              } else change(new String[] {"YEAR", "MONTH", "DAY", "LIST"}[w]);
            })
        .show();
  }

  void permission(boolean write, Runnable after) {
    if ((write ? store.writable() : store.readable())) {
      after.run();
      return;
    }
    permissionAction = after;
    new AlertDialog.Builder(this)
        .setTitle(write ? "Editar agendas locais" : "Mostrar agendas do Android")
        .setMessage(
            write
                ? "Permita ler e editar eventos. O Calendar Timeline modifica apenas agendas locais"
                    + " nesta versão. Você pode negar e usar lembretes locais."
                : "Permita a leitura para ver os eventos já salvos no Android e no widget. Você"
                    + " pode negar e usar lembretes locais.")
        .setNegativeButton("Agora não", null)
        .setPositiveButton(
            "Continuar",
            (d, w) -> {
              requesting = true;
              requestPermissions(
                  write
                      ? new String[] {
                        Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR
                      }
                      : new String[] {Manifest.permission.READ_CALENDAR},
                  11);
            })
        .show();
  }

  @Override
  public void onRequestPermissionsResult(int r, String[] p, int[] g) {
    super.onRequestPermissionsResult(r, p, g);
    if (r == 11) {
      requesting = false;
      if (store.readable() && permissionAction != null) permissionAction.run();
      else Toast.makeText(this, "Lembretes locais continuam disponíveis", Toast.LENGTH_LONG).show();
      permissionAction = null;
      load();
    }
  }

  void calendars() {
    io.execute(
        () -> {
          try {
            List<CalendarStore.Agenda> agendas = store.calendars();
            main.post(() -> calendarDialog(agendas));
          } catch (Exception e) {
            main.post(() -> ui.error(e));
          }
        });
  }

  void calendarDialog(List<CalendarStore.Agenda> agendas) {
    if (isDestroyed()) return;
    String[] names = new String[agendas.size() + 1];
    boolean[] checked = new boolean[names.length];
    Set<String> hidden = hidden();
    for (int i = 0; i < agendas.size(); i++) {
      names[i] = agendas.get(i).toString();
      checked[i] = !hidden.contains(Long.toString(agendas.get(i).id));
    }
    names[agendas.size()] = "Lembretes locais";
    checked[agendas.size()] = prefs.getBoolean("showReminders", true);
    new AlertDialog.Builder(this)
        .setTitle("Calendários")
        .setMultiChoiceItems(names, checked, (d, w, c) -> checked[w] = c)
        .setPositiveButton(
            "OK",
            (d, w) -> {
              Set<String> next = new HashSet<>();
              for (int i = 0; i < agendas.size(); i++)
                if (!checked[i]) next.add(Long.toString(agendas.get(i).id));
              prefs
                  .edit()
                  .putStringSet("hiddenCalendars", next)
                  .putBoolean("showReminders", checked[agendas.size()])
                  .apply();
              load();
              RefreshCoordinator.refresh(this, null);
            })
        .setNeutralButton(
            store.readable() ? "Criar agenda local" : "Permitir acesso",
            (d, w) -> {
              if (!store.readable()) permission(false, this::calendars);
              else permission(true, this::createCalendar);
            })
        .setNegativeButton("Cancelar", null)
        .show();
  }

  void createCalendar() {
    if (!store.writable()) {
      Toast.makeText(this, "A edição de agenda não foi permitida", Toast.LENGTH_LONG).show();
      return;
    }
    EditText name = new EditText(this);
    name.setHint("Nome da agenda");
    name.setText("Calendar Timeline");
    new AlertDialog.Builder(this)
        .setTitle("Agenda neste aparelho")
        .setMessage(
            "Eventos salvos aqui não serão sincronizados. As agendas do Android não entram no"
                + " backup do app.")
        .setView(name)
        .setNegativeButton("Cancelar", null)
        .setPositiveButton(
            "Criar",
            (d, w) ->
                io.execute(
                    () -> {
                      try {
                        store.createLocal(name.getText().toString());
                        main.post(
                            () -> {
                              load();
                              calendars();
                            });
                      } catch (Exception e) {
                        main.post(() -> ui.error(e));
                      }
                    }))
        .show();
  }
}
