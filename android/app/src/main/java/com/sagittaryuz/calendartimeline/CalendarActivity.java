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
  TextView yearLink, landscapeMonth;
  LocalDate selected = LocalDate.now();
  String mode = "MONTH", query = "";
  boolean search = false, completed = false;
  int generation;
  List<CalendarStore.Item> items = new ArrayList<>();
  String loadError = "";
  String updateMessage = "";
  Runnable permissionAction;
  boolean requesting;
  ForegroundLocation location;
  TextView weatherSummary;
  String syncStatus = "";
  boolean resumed, widgetRenderPending, forceWidgetWeather;
  final Runnable widgetRender =
      () -> {
        if (!resumed || root == null || !root.hasWindowFocus() || !widgetRenderPending) return;
        widgetRenderPending = false;
        boolean force = forceWidgetWeather;
        forceWidgetWeather = false;
        RefreshCoordinator.refresh(
            this,
            (image, message) -> {
              if (isDestroyed()) return;
              syncStatus = message;
              if (weatherSummary != null)
                weatherSummary.setText(WeatherRepository.summary(new DataRepository(this)));
            },
            force);
      };
  final Runnable widgetTick =
      new Runnable() {
        public void run() {
          refreshWidget(false);
          main.postDelayed(this, 60000);
        }
      };
  final android.database.ContentObserver providerChanges =
      new android.database.ContentObserver(main) {
        @Override
        public void onChange(boolean selfChange) {
          main.removeCallbacks(providerReload);
          main.postDelayed(providerReload, 400);
        }
      };
  final Runnable providerReload =
      () -> {
        load();
        refreshWidget(false);
      };
  int visiblePreferences = -1;

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ui = new CalendarUi(this);
    store = new CalendarStore(this);
    prefs = getSharedPreferences("settings", 0);
    location = new ForegroundLocation(this);
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
    if (getIntent().getBooleanExtra("remindersView", false)) mode = "REMINDERS";
    render();
    if (saved == null && !prefs.getBoolean("onboardingV5", false))
      startActivity(new Intent(this, OnboardingActivity.class));
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
    resumed = true;
    // Keep the first permission flow responsive; collect/render after its choices are complete.
    if (!prefs.getBoolean("onboardingV5", false)) return;
    if (visiblePreferences != visualPreferences()) {
      renderBody();
      scrollToDay();
    }
    load();
    TaskSync.refresh(
        this,
        () ->
            main.post(
                () -> {
                  if (!isDestroyed() && resumed) {
                    load();
                    refreshWidget(false);
                  }
                }));
    if (store.readable())
      getContentResolver()
          .registerContentObserver(
              android.provider.CalendarContract.CONTENT_URI, true, providerChanges);
    refreshWidget(getIntent().getBooleanExtra("widgetTap", false));
    getIntent().removeExtra("widgetTap");
    if (prefs.getBoolean("onboardingV5", false)
        && prefs.getBoolean("weatherAuto", false)
        && (prefs.getBoolean("weather", false) || prefs.getBoolean("weatherPendingLocation", false))
        && ForegroundLocation.allowed(this)
        && System.currentTimeMillis() - prefs.getLong("locatedAt", 0) >= 30 * 60000L)
      location.start(prefs.getBoolean("weatherPendingLocation", false), () -> refreshWidget(false));
    main.removeCallbacks(widgetTick);
    main.postDelayed(widgetTick, 60000);
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
  protected void onPause() {
    resumed = false;
    main.removeCallbacks(widgetRender);
    main.removeCallbacks(widgetTick);
    main.removeCallbacks(providerReload);
    getContentResolver().unregisterContentObserver(providerChanges);
    location.cancel();
    super.onPause();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    if (intent.getBooleanExtra("remindersView", false)) {
      mode = "REMINDERS";
      render();
    }
    if (intent.hasExtra("date")) {
      selected =
          Instant.ofEpochMilli(intent.getLongExtra("date", System.currentTimeMillis()))
              .atZone(ZoneId.systemDefault())
              .toLocalDate();
      mode = "DAY";
      render();
    }
    load();
    refreshWidget(intent.getBooleanExtra("widgetTap", false));
    intent.removeExtra("widgetTap");
  }

  void refreshWidget(boolean forceWeather) {
    widgetRenderPending = true;
    forceWidgetWeather |= forceWeather;
    main.removeCallbacks(widgetRender);
    if (resumed && root != null && root.hasWindowFocus()) main.postDelayed(widgetRender, 600);
  }

  @Override
  public void onWindowFocusChanged(boolean focused) {
    super.onWindowFocusChanged(focused);
    if (focused && resumed && widgetRenderPending) {
      main.removeCallbacks(widgetRender);
      main.postDelayed(widgetRender, 600);
    }
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

  int visualPreferences() {
    return prefs.getInt("monthStyle", 2) * 2 + prefs.getInt("weekStart", 0);
  }

  boolean compactLandscape() {
    return timelineView()
        && getResources().getConfiguration().orientation
            == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
  }

  boolean weekView() {
    return mode.equals("WEEK")
        || (!search
            && (mode.equals("MONTH") || mode.equals("DAY"))
            && getResources().getConfiguration().orientation
                == android.content.res.Configuration.ORIENTATION_LANDSCAPE);
  }

  boolean timelineView() {
    return weekView() || mode.equals("DAY");
  }

  LocalDate weekFirst() {
    int start = prefs.getInt("weekStart", 0);
    return selected.minusDays(Math.floorMod(selected.getDayOfWeek().getValue() % 7 - start, 7));
  }

  void load() {
    final int g = ++generation;
    final boolean remindersOnly = mode.equals("REMINDERS");
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
    if (mode.equals("REMINDERS")) {
      first = LocalDate.of(1, 1, 1);
      end = LocalDate.of(9999, 12, 31);
    }
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
            if (!remindersOnly) loaded.addAll(store.instances(from, to, hidden, null));
          } catch (Exception ex) {
            error = "Agenda indisponível. Toque para tentar novamente.";
          }
          try {
            if (prefs.getBoolean("showReminders", true)) {
              loaded.addAll(new ReminderStore(this).visible(from, to, completed));
              loaded.addAll(new ExternalTaskStore(this).visible(from, to, completed));
            }
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
                yearLink.setText(backLabel());
                if (landscapeMonth != null)
                  landscapeMonth.setText(
                      cap(selected.format(DateTimeFormatter.ofPattern("MMMM", PT))));
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
            : timelineView()
                ? selected.plusDays(direction * (weekView() ? 7 : 1))
                : mode.equals("LIST")
                    ? selected.plusDays(direction * 30)
                    : selected.plusMonths(direction);
    load();
  }

  String backLabel() {
    return "‹ "
        + (timelineView() && !compactLandscape()
            ? cap(selected.format(DateTimeFormatter.ofPattern("MMMM", PT)))
            : selected.getYear());
  }

  void render() {
    root = ui.column();
    root.setBackground(ui.backdrop());
    root.setFitsSystemWindows(true);
    setContentView(root);
    LinearLayout toolbar = ui.row();
    toolbar.setPadding(ui.dp(14), ui.dp(6), ui.dp(14), ui.dp(4));
    yearLink =
        ui.action(
            backLabel(),
            () -> change(compactLandscape() ? "YEAR" : timelineView() ? "MONTH" : "YEAR"));
    toolbar.addView(yearLink);
    landscapeMonth = null;
    if (compactLandscape()) {
      TextView month =
          landscapeMonth =
              ui.text(cap(selected.format(DateTimeFormatter.ofPattern("MMMM", PT))), 20, ui.ink);
      month.setPadding(ui.dp(12), 0, ui.dp(12), 0);
      toolbar.addView(month);
      toolbar.addView(ui.icon("back", "Período anterior", () -> shift(-1)));
      toolbar.addView(ui.icon("next", "Próximo período", () -> shift(1)));
    }
    View spacer = new View(this);
    toolbar.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
    toolbar.addView(ui.icon("list", "Alterar visualização", this::viewMenu));
    LinearLayout quick = ui.row();
    ui.frost(quick, 25);
    quick.addView(
        ui.icon(
            "search",
            "Buscar eventos e lembretes",
            () -> {
              search = !search;
              query = "";
              render();
              load();
            }));
    quick.addView(ui.icon("plus", "Novo evento ou lembrete", () -> openEditor(null)));
    for (int n = 0; n < quick.getChildCount(); n++)
      quick.getChildAt(n).setBackgroundColor(android.graphics.Color.TRANSPARENT);
    toolbar.addView(quick);
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
            "Configurações",
            () -> startActivity(new Intent(this, MainActivity.class))));
    ui.frost(bottom, 26);
    root.addView(bottom);
    scrollToDay();
  }

  void scrollToDay() {
    if (!search && timelineView())
      agendaScroll.post(
          () -> {
            int hour = 9;
            for (CalendarStore.Item x : on(selected))
              if (!x.allDay) {
                hour =
                    Math.max(
                        0,
                        Instant.ofEpochMilli(x.start).atZone(ZoneId.systemDefault()).getHour()
                            - (weekView() ? 0 : 1));
                break;
              }
            agendaScroll.scrollTo(0, ui.dp(hour * 64));
          });
  }

  void renderBody() {
    visiblePreferences = visualPreferences();
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
            mode.equals("REMINDERS")
                ? "Lembretes"
                : mode.equals("YEAR")
                    ? Integer.toString(selected.getYear())
                    : cap(
                        selected.format(
                            DateTimeFormatter.ofPattern(
                                timelineView() ? "MMMM uuuu" : "MMMM", PT))),
            timelineView() ? 23 : 30,
            ui.ink);
    title.setTypeface(null, Typeface.BOLD);
    heading.setPadding(ui.dp(20), ui.dp(12), ui.dp(12), ui.dp(10));
    heading.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
    heading.addView(ui.icon("back", "Período anterior", () -> shift(-1)));
    heading.addView(ui.icon("next", "Próximo período", () -> shift(1)));
    if (!compactLandscape()) {
      if (timelineView()) pinnedDay.addView(heading);
      else body.addView(heading);
    }
    if (!loadError.isEmpty()) {
      TextView error = ui.action(loadError, this::load);
      body.addView(error);
    }
    if (!store.readable() && !mode.equals("REMINDERS")) {
      LinearLayout card = ui.group(body);
      ui.fieldRow(
          card, "Agendas do Android", "Permitir acesso", () -> permission(false, this::load));
      ui.note(body, "Seus lembretes locais funcionam sem acesso à agenda.");
    }
    if (!compactLandscape()) {
      LinearLayout weatherCard = ui.group(body);
      weatherSummary = ui.text(WeatherRepository.summary(new DataRepository(this)), 13, ui.muted);
      weatherSummary.setPadding(ui.dp(2), ui.dp(8), ui.dp(2), ui.dp(8));
      weatherSummary.setContentDescription("Estado do clima");
      weatherCard.addView(weatherSummary);
      weatherCard.setOnClickListener(v -> startActivity(new Intent(this, MainActivity.class)));
      showOverdue(body);
    } else weatherSummary = null;
    if (weekView()) {
      new CalendarTimeline(this, 7, weekFirst());
      return;
    }
    switch (mode) {
      case "YEAR":
        year();
        break;
      case "DAY":
        new CalendarTimeline(this, 1, selected);
        break;
      case "REMINDERS":
        ui.note(
            body,
            "Lembretes locais e fontes conectadas. Tarefas sem data ficam em Fontes de lembretes.");
        body.addView(
            ui.action(
                "Fontes de lembretes",
                () -> startActivity(new Intent(this, TaskSourcesActivity.class))));
        agenda(body, null, false);
        break;
      case "LIST":
        ui.note(body, "Próximos 90 dias · " + ZoneId.systemDefault().getId());
        agenda(body, null, false);
        break;
      default:
        month(body, YearMonth.from(selected), false);
        TextView dateHeading =
            ui.text(
                cap(selected.format(DateTimeFormatter.ofPattern("EEEE, d MMMM", PT))), 18, ui.ink);
        dateHeading.setPadding(ui.dp(20), ui.dp(16), ui.dp(20), ui.dp(4));
        body.addView(dateHeading);
        agenda(body, selected, false);
    }
  }

  void showOverdue(LinearLayout parent) {
    List<CalendarStore.Item> overdue = new ArrayList<>();
    long today = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    for (CalendarStore.Item x : items)
      if (x.reminder && !x.completed && x.start < today) overdue.add(x);
    if (overdue.isEmpty() || mode.equals("REMINDERS")) return;
    LinearLayout card = ui.group(parent);
    TextView title = ui.text("Lembretes pendentes · " + overdue.size(), 16, ui.ink);
    title.setPadding(0, ui.dp(6), 0, ui.dp(6));
    card.addView(title);
    title.setMinHeight(ui.dp(40));
    title.setContentDescription("Lembretes pendentes · " + overdue.size());
    card.setOnClickListener(v -> change("REMINDERS"));
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
    int weekStart = prefs.getInt("weekStart", 0);
    String[] names = {"D", "S", "T", "Q", "Q", "S", "S"};
    for (int i = 0; i < 7; i++) {
      String name = names[(i + weekStart) % 7];
      TextView t = ui.text(name, small ? 9 : 11, ui.muted);
      t.setGravity(Gravity.CENTER);
      weekdays.addView(t, new LinearLayout.LayoutParams(0, ui.dp(small ? 18 : 24), 1));
    }
    wrap.addView(weekdays);
    int offset = Math.floorMod(month.atDay(1).getDayOfWeek().getValue() % 7 - weekStart, 7);
    int count = month.lengthOfMonth();
    int rows = (offset + count + 6) / 7;
    for (int row = 0; row < (small ? 6 : rows); row++) {
      LinearLayout week = ui.row();
      week.setGravity(Gravity.TOP);
      for (int col = 0; col < 7; col++) {
        int day = row * 7 + col - offset + 1;
        LinearLayout cell = ui.column();
        cell.setGravity(Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams clp =
            new LinearLayout.LayoutParams(
                0,
                ui.dp(
                    small
                        ? 22
                        : prefs.getInt("monthStyle", 2) == 0
                            ? 56
                            : Math.max(
                                76,
                                Math.min(
                                    110,
                                    (getResources().getDisplayMetrics().heightPixels
                                                / getResources().getDisplayMetrics().density
                                            - 280)
                                        / rows))),
                1);
        week.addView(cell, clp);
        if (day < 1 || day > count) continue;
        LocalDate date = month.atDay(day);
        TextView number =
            ui.text(
                Integer.toString(day),
                small ? 11 : 21,
                (date.getDayOfWeek().getValue() >= 6) ? ui.muted : ui.ink);
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
              mode = small ? "MONTH" : "DAY";
              render();
              load();
            });
        if (!small) {
          List<CalendarStore.Item> dayItems = on(date);
          int style = prefs.getInt("monthStyle", 2);
          int limit = style == 0 ? 1 : style == 1 ? 3 : 2;
          for (int i = 0; i < Math.min(limit, dayItems.size()); i++) {
            CalendarStore.Item x = dayItems.get(i);
            TextView chip =
                ui.text(
                    (style == 2 ? (x.reminder ? "○ " : "") + x.title : ""),
                    9,
                    ui.dark ? x.color : (x.color & 0xff7f7f7f) | 0xff000000);
            chip.setSingleLine();
            chip.setEllipsize(TextUtils.TruncateAt.END);
            chip.setPadding(ui.dp(2), 0, ui.dp(1), 0);
            chip.setBackground(ui.round((x.color & 0xffffff) | 0x28000000, 3));
            LinearLayout.LayoutParams elp =
                new LinearLayout.LayoutParams(-1, ui.dp(style == 2 ? 16 : 5));
            elp.setMargins(ui.dp(1), ui.dp(1), ui.dp(1), 0);
            cell.addView(chip, elp);
          }
          if (style == 2 && dayItems.size() > limit) {
            TextView more = ui.text("+" + (dayItems.size() - limit), 9, ui.muted);
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
      if (mode.equals("REMINDERS") && !x.reminder) continue;
      if (date == null
          && !search
          && !mode.equals("REMINDERS")
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
                      if (x.localId.startsWith("external:"))
                        TaskSync.complete(
                            this, new ExternalTaskStore(this).task(x.localId), !x.completed);
                      else new ReminderStore(this).toggle(x);
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

  CalendarStore.Item newItem(boolean reminder) {
    CalendarStore.Item x = new CalendarStore.Item();
    x.reminder = reminder;
    x.start = defaultStart(selected, ZonedDateTime.now()).toInstant().toEpochMilli();
    x.end = x.start + prefs.getInt("eventMinutes", 60) * 60000L;
    x.alert = prefs.getInt("defaultAlert", -1);
    return x;
  }

  static ZonedDateTime defaultStart(LocalDate selected, ZonedDateTime now) {
    return selected.equals(now.toLocalDate())
        ? now.withMinute(0).withSecond(0).withNano(0).plusHours(1)
        : selected.atTime(9, 0).atZone(now.getZone());
  }

  void openEditor(CalendarStore.Item x) {
    if (x != null && x.localId.startsWith("external:")) {
      details(x);
      return;
    }
    Intent i = new Intent(this, EventEditorActivity.class);
    if (x == null) x = newItem(mode.equals("REMINDERS"));
    i.putExtra("draft", EventEditorActivity.serialize(x));
    startActivity(i);
  }

  void details(CalendarStore.Item instance) {
    if (instance.localId.startsWith("external:")) {
      startActivity(
          new Intent(this, TaskSourcesActivity.class).putExtra("taskKey", instance.localId));
      return;
    }
    io.execute(
        () -> {
          try {
            CalendarStore.Item x =
                instance.reminder
                    ? instance
                    : store.occurrence(instance.id, instance.start, instance.end);
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
      "Semana",
      "Lista · próximos 90 dias",
      "Lembretes locais",
      completed ? "Ocultar lembretes concluídos" : "Mostrar lembretes concluídos"
    };
    new AlertDialog.Builder(this)
        .setTitle("Visualização")
        .setItems(
            labels,
            (d, w) -> {
              if (w == 5) change("REMINDERS");
              else if (w == 6) {
                completed = !completed;
                load();
              } else change(new String[] {"YEAR", "MONTH", "DAY", "WEEK", "LIST"}[w]);
            })
        .show();
  }

  void confirmTimeChange(CalendarStore.Item before, CalendarStore.Item changed) {
    if (before.localId.startsWith("external:")) {
      ui.error(new IllegalArgumentException("Altere a data desta tarefa no aplicativo de origem"));
      return;
    }
    io.execute(
        () -> {
          try {
            CalendarStore.Item draft =
                before.reminder
                    ? changed.copy()
                    : store.occurrence(before.id, before.start, before.end);
            draft.start = changed.start;
            draft.end = changed.end;
            main.post(
                () -> {
                  if (isDestroyed()) return;
                  String when =
                      java.time.format.DateTimeFormatter.ofPattern("EEE d MMM · HH:mm", PT)
                          .withZone(ZoneId.systemDefault())
                          .format(Instant.ofEpochMilli(draft.start));
                  java.util.function.Consumer<CalendarStore.Scope> save =
                      scope ->
                          io.execute(
                              () -> {
                                try {
                                  if (draft.reminder) new ReminderStore(this).save(draft);
                                  else store.saveScoped(draft, scope);
                                  main.post(
                                      () -> {
                                        load();
                                        RefreshCoordinator.refresh(this, null);
                                      });
                                } catch (Exception e) {
                                  main.post(
                                      () -> {
                                        load();
                                        ui.error(e);
                                      });
                                }
                              });
                  new AlertDialog.Builder(this)
                      .setTitle("Confirmar novo horário?")
                      .setMessage(
                          draft.title
                              + "\n"
                              + when
                              + "\nDuração: "
                              + ((draft.end - draft.start) / 60000)
                              + " min")
                      .setNegativeButton("Cancelar", null)
                      .setPositiveButton(
                          "Salvar",
                          (d, w) -> {
                            if (!draft.seriesRule.isEmpty())
                              OccurrenceScope.choose(this, "Aplicar alteração", save);
                            else save.accept(CalendarStore.Scope.SINGLE);
                          })
                      .show();
                });
          } catch (Exception e) {
            main.post(() -> ui.error(e));
          }
        });
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
