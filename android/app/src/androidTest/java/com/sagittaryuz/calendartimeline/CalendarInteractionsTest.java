package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.graphics.Rect;
import android.os.*;
import android.provider.CalendarContract;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;
import java.time.*;
import java.util.*;

/** Pointer injection uses accessibility-derived bounds. No physical device or account access. */
public final class CalendarInteractionsTest extends CalendarUiTest {
  boolean enabled() {
    return "true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("calendarUiQa"));
  }

  void shell(String command) throws Exception {
    try (java.io.InputStream in =
        new android.os.ParcelFileDescriptor.AutoCloseInputStream(
            getInstrumentation().getUiAutomation().executeShellCommand(command))) {
      byte[] bytes = new byte[1024];
      while (in.read(bytes) != -1) {}
    }
  }

  void pointer(int action, float x, float y, long down) {
    MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
    event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    assertTrue(getInstrumentation().getUiAutomation().injectInputEvent(event, true));
    event.recycle();
  }

  AccessibilityNodeInfo eventNode(String title) throws Exception {
    for (int attempt = 0; attempt < 80; attempt++) {
      ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
      AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
      if (root != null) queue.add(root);
      while (!queue.isEmpty()) {
        AccessibilityNodeInfo n = queue.remove();
        if (n.isVisibleToUser()
            && n.getContentDescription() != null
            && n.getContentDescription().toString().startsWith(title + ", ")) return n;
        for (int i = 0; i < n.getChildCount(); i++) {
          AccessibilityNodeInfo child = n.getChild(i);
          if (child != null) queue.add(child);
        }
      }
      Thread.sleep(250);
    }
    fail("Grid event absent: " + title);
    return null;
  }

  void drag(String title, boolean end, boolean cancel) throws Exception {
    Rect r = new Rect();
    eventNode(title).getBoundsInScreen(r);
    float x = r.exactCenterX(), y = end ? r.bottom - 4 : r.exactCenterY();
    long down = SystemClock.uptimeMillis();
    pointer(MotionEvent.ACTION_DOWN, x, y, down);
    Thread.sleep(ViewConfiguration.getLongPressTimeout() + 250);
    float shift = context.getResources().getDisplayMetrics().density * 32;
    for (int i = 1; i <= 6; i++) {
      pointer(MotionEvent.ACTION_MOVE, x, y + shift * i / 6, down);
      Thread.sleep(70);
    }
    capture(end ? "qa-v04-resize-preview.png" : "qa-v04-drag-preview.png");
    pointer(cancel ? MotionEvent.ACTION_CANCEL : MotionEvent.ACTION_UP, x, y + shift, down);
    Thread.sleep(400);
  }

  void scrollTo(String label) throws Exception {
    for (int attempt = 0; attempt < 8; attempt++) {
      if (find(label) != null) return;
      ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
      queue.add(getInstrumentation().getUiAutomation().getRootInActiveWindow());
      while (!queue.isEmpty()) {
        AccessibilityNodeInfo n = queue.remove();
        if (n.isScrollable() && n.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) break;
        for (int i = 0; i < n.getChildCount(); i++) {
          AccessibilityNodeInfo child = n.getChild(i);
          if (child != null) queue.add(child);
        }
      }
      Thread.sleep(350);
    }
    waitFor(label);
  }

  void day() {
    getInstrumentation()
        .startActivitySync(
            new Intent(context, CalendarActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra(
                    "date",
                    qaDay.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()));
  }

  void saved(long id, long expectedStart, long expectedLength) throws Exception {
    for (int i = 0; i < 100; i++) {
      CalendarStore.Item x = store.event(id);
      if (x.start == expectedStart && x.end - x.start == expectedLength) return;
      Thread.sleep(300);
    }
    assertEquals(expectedStart, store.event(id).start);
    assertEquals(expectedLength, store.event(id).end - store.event(id).start);
  }

  public void testWeekDragResizeCancelAccessibilityScopeAndPreferences() throws Exception {
    if (!enabled()) return;
    context = getInstrumentation().getTargetContext();
    store = new CalendarStore(context);
    assertTrue(store.writable());
    for (CalendarStore.Agenda a : store.calendars()) assertEquals(BackupStore.APP_ID, a.account);
    calendar = store.createLocal("Semana sintética QA");
    SharedPreferences p = context.getSharedPreferences("settings", 0);
    Map<String, ?> original = new HashMap<>(p.getAll());
    float originalFont =
        android.provider.Settings.System.getFloat(context.getContentResolver(), "font_scale", 1f);
    boolean originalNight =
        (context.getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
    Set<String> hidden = new HashSet<>();
    for (CalendarStore.Agenda agenda : store.calendars())
      if (agenda.id != calendar) hidden.add(Long.toString(agenda.id));
    p.edit().putBoolean("onboardingV5", true).putString("reminders", "[]").putStringSet("hiddenCalendars", hidden).commit();
    try {
      CalendarStore.Item x = fixture("Reunião sintética", 9);
      x.id = store.save(x);
      CalendarStore.Item overlap = fixture("Revisão sintética", 9);
      overlap.start += 30 * 60000L;
      overlap.end += 30 * 60000L;
      store.save(overlap);
      for (int d = 1; d <= 5; d++) {
        CalendarStore.Item task = fixture("Projeto " + d, 9 + d % 2);
        task.start += d * 86400000L;
        task.end += d * 86400000L;
        store.save(task);
      }
      RefreshJob.cancel(context);
      java.util.concurrent.CountDownLatch rendered = new java.util.concurrent.CountDownLatch(1);
      java.util.concurrent.atomic.AtomicReference<android.graphics.Bitmap> bitmap =
          new java.util.concurrent.atomic.AtomicReference<>();
      RefreshCoordinator.refresh(
          context,
          (image, message) -> {
            bitmap.set(image);
            rendered.countDown();
          });
      assertTrue(
          "Pre-navigation widget render",
          rendered.await(240, java.util.concurrent.TimeUnit.SECONDS));
      assertNotNull(bitmap.get());
      day();
      waitFor("Calendários");
      eventNode(x.title);
      capture("qa-v04-day.png");
      drag(x.title, false, false);
      waitFor("Confirmar novo horário?");
      capture("qa-v04-drag-confirm.png");
      click("Salvar");
      saved(x.id, x.start + 30 * 60000L, 3600000L);
      day();
      eventNode(x.title);
      drag(x.title, true, false);
      click("Salvar");
      saved(x.id, x.start + 30 * 60000L, 90 * 60000L);
      day();
      eventNode(x.title);
      drag(x.title, false, true);
      saved(x.id, x.start + 30 * 60000L, 90 * 60000L);
      assertNull(find("Confirmar novo horário?"));
      assertTrue(eventNode(x.title).performAction(0x01020002));
      click("Salvar");
      saved(x.id, x.start + 45 * 60000L, 90 * 60000L);
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_90);
      Thread.sleep(3500);
      waitFor("Calendários");
      eventNode(x.title);
      Rect visible = new Rect();
      eventNode(x.title).getBoundsInScreen(visible);
      assertTrue(
          "Weekly event must have a readable visible area",
          visible.height() >= 48 * context.getResources().getDisplayMetrics().density);
      capture("qa-v04-week-landscape.png");
      click("Próximo período");
      click("Próximo período");
      waitFor("Novembro");
      click("Período anterior");
      click("Período anterior");
      waitFor("Outubro");
      eventNode(x.title);
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_0);
      Thread.sleep(2500);
      waitFor("Calendários");
      click("Alterar visualização");
      click("Mês");
      waitFor("Calendários");
      capture("qa-v04-month-details.png");
      click("Configurações");
      click("Preferências do calendário");
      waitFor("Preferências");
      capture("qa-v04-preferences.png");
      click("Início da semana: Domingo");
      click("Segunda-feira");
      click("Duração de novos eventos: 60 min");
      click("30 min");
      assertEquals(1, p.getInt("weekStart", -1));
      assertEquals(30, p.getInt("eventMinutes", -1));
      click("Visualização mensal: Detalhes");
      click("Compacto");
      click("‹ Configurações");
      click("‹ Calendário");
      waitFor("Calendários");
      for (int n = 0; n < 80 && find("Projeto 1") != null; n++) Thread.sleep(250);
      assertNull("Compact month must replace event titles with indicators", find("Projeto 1"));
      capture("qa-v04-month-compact.png");
      CalendarStore.Item reminder = fixture("Prioridade sintética", 12);
      reminder.reminder = true;
      reminder.localId = "qa-v04-priority";
      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventEditorActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                  .putExtra("draft", EventEditorActivity.serialize(reminder)));
      waitFor("Título");
      scrollTo("Prioridade: Nenhuma");
      click("Prioridade: Nenhuma");
      click("Alta");
      scrollTo("Prioridade: Alta");
      capture("qa-v04-reminder-priority.png");
      click("Salvar");
      waitFor("Calendários");
      assertEquals(
          1,
          new ReminderStore(context)
              .all().stream()
                  .filter(r -> r.localId.equals(reminder.localId))
                  .findFirst()
                  .get()
                  .priority);
      CalendarStore.Item series = fixture("Série sintética", 14);
      series.rule = "FREQ=DAILY;COUNT=5";
      series.id = store.save(series);
      CalendarStore.Item target =
          store.occurrence(series.id, series.start + 86400000L, series.end + 86400000L);
      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventEditorActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                  .putExtra("draft", EventEditorActivity.serialize(target)));
      type("Título", "Ocorrência pela interface");
      click("Salvar");
      waitFor("Aplicar alteração");
      capture("qa-v04-scope.png");
      click("Somente esta ocorrência");
      waitFor("Calendários");
      assertEquals(series.title, store.event(series.id).title);
      List<CalendarStore.Item> occurrences =
          store.instances(
              series.start - 1, series.start + 7 * 86400000L, Collections.emptySet(), calendar);
      boolean found = false;
      for (CalendarStore.Item at : occurrences)
        if (at.title.equals("Ocorrência pela interface")) found = true;
      assertTrue("UI single occurrence save", found);
      target =
          store.occurrence(series.id, series.start + 3 * 86400000L, series.end + 3 * 86400000L);
      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventEditorActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                  .putExtra("draft", EventEditorActivity.serialize(target)));
      type("Título", "Futuras pela interface");
      click("Salvar");
      click("Esta e as futuras");
      waitFor("Calendários");
      occurrences =
          store.instances(
              series.start - 1, series.start + 7 * 86400000L, Collections.emptySet(), calendar);
      int futures = 0;
      for (CalendarStore.Item at : occurrences)
        if (at.title.equals("Futuras pela interface")) futures++;
      assertEquals(2, futures);
      click("Buscar eventos e lembretes");
      type("Campo de busca", "Futuras pela interface");
      waitFor("Futuras pela interface");
      capture("qa-v04-recurring-result.png");
      p.edit().putInt("weekStart", 0).commit();
      day();
      waitFor("Calendários");
      shell("cmd uimode night yes");
      shell("settings put system font_scale 1.3");
      Thread.sleep(3000);
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_90);
      Thread.sleep(2500);
      waitFor("Calendários");
      eventNode(x.title);
      capture("qa-v04-week-dark-large-font.png");
    } finally {
      shell("settings put system font_scale " + originalFont);
      shell("cmd uimode night " + (originalNight ? "yes" : "no"));
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_0);
      context
          .getContentResolver()
          .delete(
              ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendar)
                  .buildUpon()
                  .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                  .appendQueryParameter("account_name", BackupStore.APP_ID)
                  .appendQueryParameter("account_type", CalendarStore.LOCAL)
                  .build(),
              null,
              null);
      SharedPreferences.Editor restore = p.edit().clear();
      for (Map.Entry<String, ?> entry : original.entrySet()) {
        Object v = entry.getValue();
        String key = entry.getKey();
        if (v instanceof String) restore.putString(key, (String) v);
        else if (v instanceof Integer) restore.putInt(key, (Integer) v);
        else if (v instanceof Long) restore.putLong(key, (Long) v);
        else if (v instanceof Boolean) restore.putBoolean(key, (Boolean) v);
        else if (v instanceof Set) restore.putStringSet(key, (Set<String>) v);
      }
      restore.commit();
      ReminderAlerts.schedule(context);
    }
  }
}
