package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.*;
import android.provider.CalendarContract;
import android.test.InstrumentationTestCase;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** Native UI end-to-end + real screenshots. Explicitly opt in on the isolated AVD. */
public class CalendarUiTest extends InstrumentationTestCase {
  Context context;
  CalendarStore store;
  long calendar;
  String reminders;
  final LocalDate qaDay = LocalDate.now();

  AccessibilityNodeInfo find(String value) {
    AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
    if (root == null) return null;
    ArrayDeque<AccessibilityNodeInfo> nodes = new ArrayDeque<>();
    nodes.add(root);
    while (!nodes.isEmpty()) {
      AccessibilityNodeInfo n = nodes.remove();
      if (n.isVisibleToUser()
          && (value.equalsIgnoreCase(n.getText() == null ? "" : n.getText().toString())
              || value.contentEquals(
                  n.getContentDescription() == null ? "" : n.getContentDescription()))) return n;
      for (int i = 0; i < n.getChildCount(); i++) {
        AccessibilityNodeInfo child = n.getChild(i);
        if (child != null) nodes.add(child);
      }
    }
    return null;
  }

  AccessibilityNodeInfo waitFor(String value) throws Exception {
    for (int i = 0; i < 100; i++) {
      AccessibilityNodeInfo n = find(value);
      if (n != null) return n;
      if (i == 8) {
        AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
        ArrayDeque<AccessibilityNodeInfo> nodes = new ArrayDeque<>();
        if (root != null) nodes.add(root);
        while (!nodes.isEmpty()) {
          AccessibilityNodeInfo candidate = nodes.remove();
          if (candidate.isVisibleToUser()
              && candidate.isScrollable()
              && candidate.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) break;
          for (int c = 0; c < candidate.getChildCount(); c++)
            if (candidate.getChild(c) != null) nodes.add(candidate.getChild(c));
        }
      }
      Thread.sleep(400);
    }
    fail("UI absent: " + value);
    return null;
  }

  void click(String value) throws Exception {
    waitFor(value);
    for (int attempt = 0; attempt < 8; attempt++) {
      AccessibilityNodeInfo target = find(value), n = target;
      while (n != null) {
        if (n.isVisibleToUser()
            && n.isEnabled()
            && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
          Thread.sleep(300);
          return;
        }
        n = n.getParent();
      }
      Thread.sleep(250);
    }
    AccessibilityNodeInfo fresh = find(value);
    assertNotNull("Click target disappeared: " + value, fresh);
    android.graphics.Rect bounds = new android.graphics.Rect();
    fresh.getBoundsInScreen(bounds);
    assertTrue("Empty click target", bounds.width() > 0 && bounds.height() > 0);
    long time = SystemClock.uptimeMillis();
    android.view.MotionEvent down =
        android.view.MotionEvent.obtain(
            time,
            time,
            android.view.MotionEvent.ACTION_DOWN,
            bounds.exactCenterX(),
            bounds.exactCenterY(),
            0);
    android.view.MotionEvent up =
        android.view.MotionEvent.obtain(
            time,
            time + 90,
            android.view.MotionEvent.ACTION_UP,
            bounds.exactCenterX(),
            bounds.exactCenterY(),
            0);
    down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
    up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);
    assertTrue(getInstrumentation().getUiAutomation().injectInputEvent(down, true));
    assertTrue(getInstrumentation().getUiAutomation().injectInputEvent(up, true));
    down.recycle();
    up.recycle();
    Thread.sleep(300);
  }

  void type(String desc, String value) throws Exception {
    AccessibilityNodeInfo n = waitFor(desc);
    Bundle args = new Bundle();
    args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
    assertTrue(n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args));
  }

  void capture(String name) throws Exception {
    android.util.Log.i("TimelineCalendarQa", "Capture: " + name);
    getInstrumentation().waitForIdleSync();
    Thread.sleep(1200);
    Bitmap b = getInstrumentation().getUiAutomation().takeScreenshot();
    assertNotNull(b);
    try (OutputStream out = context.openFileOutput(name, 0)) {
      assertTrue(b.compress(Bitmap.CompressFormat.PNG, 100, out));
    }
  }

  CalendarStore.Item fixture(String title, int hour) {
    CalendarStore.Item x = new CalendarStore.Item();
    x.calendarId = calendar;
    x.calendarName = "Agenda de teste";
    x.title = title;
    x.start = qaDay.atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    x.editable = true;
    return x;
  }

  void launchHome() throws Exception {
    context.getSharedPreferences("settings", 0).edit().putBoolean("onboardingV5", true).commit();
    CalendarActivity home =
        (CalendarActivity)
            getInstrumentation()
                .startActivitySync(
                    new Intent(context, CalendarActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
    getInstrumentation()
        .runOnMainSync(
            () -> {
              home.selected = qaDay;
              home.mode = "MONTH";
              home.load();
            });
  }

  public void testPersistedReminderDetailsUseLocalCalendar() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("calendarUiQa"))) return;
    context = getInstrumentation().getTargetContext();
    SharedPreferences prefs = context.getSharedPreferences("settings", 0);
    String before = prefs.getString("reminders", "[]");
    try {
      CalendarStore.Item reminder = new CalendarStore.Item();
      reminder.reminder = true;
      reminder.title = "Revisar planejamento";
      reminder.localId = "ui-qa-persisted-details";
      reminder.start =
          LocalDate.now().atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
      reminder.end = reminder.start + 60000;
      new ReminderStore(context).save(reminder);
      CalendarStore.Item persisted =
          new ReminderStore(context)
              .all().stream().filter(r -> r.localId.equals(reminder.localId)).findFirst().get();
      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventDetailsActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                  .putExtra("draft", EventEditorActivity.serialize(persisted)));
      waitFor("Lembretes locais");
      waitFor("Concluir lembrete");
      capture("qa-calendar-reminder-details.png");
    } finally {
      prefs.edit().putString("reminders", before).commit();
      ReminderAlerts.schedule(context);
    }
  }

  public void testNativeNavigationCrudRotationAndScreenshots() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("calendarUiQa"))) return;
    context = getInstrumentation().getTargetContext();
    store = new CalendarStore(context);
    assertTrue("Use only disposable emulator with granted calendar permissions", store.writable());
    for (CalendarStore.Agenda a : store.calendars()) assertEquals(BackupStore.APP_ID, a.account);
    SharedPreferences prefs = context.getSharedPreferences("settings", 0);
    reminders = prefs.getString("reminders", "[]");
    Set<String> hidden =
        new HashSet<>(prefs.getStringSet("hiddenCalendars", Collections.emptySet()));
    boolean show = prefs.getBoolean("showReminders", true);
    prefs
        .edit()
        .putString("reminders", "[]")
        .putStringSet("hiddenCalendars", Collections.emptySet())
        .putBoolean("showReminders", true)
        .commit();
    calendar = store.createLocal("Agenda de teste");
    try {
      CalendarStore.Item event = fixture("Reunião do projeto", 9);
      event.location = "Sala de criação";
      event.notes = "Dados sintéticos para validação.";
      long id = store.save(event);
      event.id = id;
      CalendarStore.Item second = fixture("Caminhada", 17);
      store.save(second);
      CalendarStore.Item reminder = fixture("Revisar planejamento", 12);
      reminder.reminder = true;
      reminder.localId = "ui-qa-reminder";
      new ReminderStore(context).save(reminder);
      // On a software-only AVD, finish widget rendering before testing focus/navigation.
      // Otherwise package replacement can start a 1092px WebView render during the first frame.
      RefreshJob.cancel(context);
      java.util.concurrent.CountDownLatch rendered = new java.util.concurrent.CountDownLatch(1);
      java.util.concurrent.atomic.AtomicReference<Bitmap> image =
          new java.util.concurrent.atomic.AtomicReference<>();
      RefreshCoordinator.refresh(
          context,
          (bitmap, message) -> {
            image.set(bitmap);
            rendered.countDown();
          });
      assertTrue(
          "Pre-navigation widget refresh",
          rendered.await(240, java.util.concurrent.TimeUnit.SECONDS));
      assertNotNull("Widget bitmap before navigation", image.get());
      launchHome();
      waitFor("Calendários");
      waitFor("Reunião do projeto");
      capture("qa-calendar-month.png");
      click("Alterar visualização");
      click("Ano");
      waitFor("Janeiro");
      capture("qa-calendar-year.png");
      click("Alterar visualização");
      click("Dia");
      waitFor("Abrir " + qaDay);
      capture("qa-calendar-day.png");
      click("Alterar visualização");
      click("Lista · próximos 90 dias");
      waitFor("Reunião do projeto");
      capture("qa-calendar-list.png");
      click("Buscar eventos e lembretes");
      type("Campo de busca", "Reunião");
      waitFor("Reunião do projeto");
      capture("qa-calendar-search.png");
      click("Buscar eventos e lembretes");
      click("Novo evento ou lembrete");
      type("Título", "Evento criado pela interface");
      click("Salvar");
      waitFor("Calendários");
      boolean eventCreated = false;
      for (CalendarStore.Item created :
          store.instances(
              qaDay.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
              qaDay.plusDays(2).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
              Collections.emptySet(),
              calendar))
        if (created.title.equals("Evento criado pela interface")) eventCreated = true;
      assertTrue("UI event creation", eventCreated);

      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventDetailsActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                  .putExtra("draft", EventEditorActivity.serialize(store.event(id))));
      waitFor("Editar");
      capture("qa-calendar-details.png");
      click("Editar");
      waitFor("Título");
      type("Título", "Reunião atualizada");
      capture("qa-calendar-editor.png");
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_90);
      Thread.sleep(3500);
      waitFor("Reunião atualizada");
      capture("qa-calendar-editor-landscape.png");
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_0);
      Thread.sleep(3000);
      waitFor("Reunião atualizada");
      click("Salvar");
      waitFor("Editar");
      waitFor("Reunião atualizada");
      assertEquals("Reunião atualizada", store.event(id).title);
      click("Apagar evento");
      waitFor("Apagar evento?");
      capture("qa-calendar-delete-confirm.png");
      click("Cancelar");
      assertEquals("Reunião atualizada", store.event(id).title);
      click("Apagar evento");
      click("Apagar");
      waitFor("Calendários");
      try {
        store.event(id);
        fail("UI delete did not remove event");
      } catch (IllegalArgumentException expected) {
      }
      launchHome();
      click("Novo evento ou lembrete");
      click("Lembrete");
      type("Título", "Lembrete criado pela interface");
      capture("qa-calendar-reminder-editor.png");
      click("Salvar");
      waitFor("Calendários");
      boolean found = false;
      for (CalendarStore.Item r : new ReminderStore(context).all())
        if (r.title.equals("Lembrete criado pela interface")) found = true;
      assertTrue("UI reminder create", found);
      getInstrumentation()
          .startActivitySync(
              new Intent(context, EventDetailsActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                  .putExtra(
                      "draft",
                      EventEditorActivity.serialize(
                          new ReminderStore(context)
                              .all().stream()
                                  .filter(r -> r.localId.equals(reminder.localId))
                                  .findFirst()
                                  .get())));
      waitFor("Concluir lembrete");
      capture("qa-calendar-reminder-details.png");
      click("Concluir lembrete");
      waitFor("Calendários");
      boolean complete = false;
      for (CalendarStore.Item r : new ReminderStore(context).all())
        if (r.localId.equals(reminder.localId)) complete = r.completed;
      assertTrue(complete);
      launchHome();
      click("Calendários");
      waitFor("Lembretes locais");
      capture("qa-calendar-calendars.png");
      click("Cancelar");
    } finally {
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_0);
      Uri u =
          ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendar)
              .buildUpon()
              .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
              .appendQueryParameter("account_name", BackupStore.APP_ID)
              .appendQueryParameter("account_type", CalendarStore.LOCAL)
              .build();
      context.getContentResolver().delete(u, null, null);
      prefs
          .edit()
          .putString("reminders", reminders)
          .putStringSet("hiddenCalendars", hidden)
          .putBoolean("showReminders", show)
          .commit();
      ReminderAlerts.schedule(context);
      RefreshJob.schedule(context, true);
    }
  }
}
