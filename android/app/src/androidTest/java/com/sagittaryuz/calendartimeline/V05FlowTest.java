package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.provider.CalendarContract;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** Opt-in, disposable AVD only: refresh paths and persisted local sources through native UI. */
public final class V05FlowTest extends CalendarUiTest {
  void denyPrompt(String captureName) throws Exception {
    for (int i = 0; i < 120; i++) {
      for (String label : new String[] {"DENY", "Don't allow", "Don’t allow"})
        if (find(label) != null) {
          capture(captureName);
          click(label);
          return;
        }
      Thread.sleep(250);
    }
    fail("System denial choice absent");
  }

  public void testDeniedSystemPromptsKeepLocalTasksUsable() throws Exception {
    if (!enabled()) return;
    context = getInstrumentation().getTargetContext();
    assertFalse(
        "Revoke only on disposable AVD before this opt-in test",
        new CalendarStore(context).readable());
    assertFalse(ForegroundLocation.allowed(context));
    SharedPreferences p = context.getSharedPreferences("settings", 0);
    String old = p.getString("reminders", "[]");
    p.edit()
        .putBoolean("onboardingV5", false)
        .putBoolean("demo", false)
        .putBoolean("weather", false)
        .putBoolean("weatherAuto", false)
        .putBoolean("weatherPendingLocation", false)
        .putBoolean("showReminders", true)
        .putString("reminders", "[]")
        .commit();
    CalendarStore.Item task = new CalendarStore.Item();
    task.reminder = true;
    task.localId = "qa-denied-local";
    task.title = "Lembrete local sem acesso à agenda";
    task.start =
        LocalDate.now()
            .minusDays(2)
            .atTime(12, 0)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli();
    task.end = task.start + 60000;
    new ReminderStore(context).save(task);
    try {
      getInstrumentation()
          .startActivitySync(
              new Intent(context, CalendarActivity.class)
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
      waitFor("Seu calendário");
      capture("qa-v05-onboarding-first.png");
      if (android.os.Build.VERSION.SDK_INT >= 33 && !ReminderAlerts.allowed(context)) {
        reveal("Alertas de lembretes locais");
        click("Alertas de lembretes locais");
      }
      reveal("Continuar");
      click("Continuar");
      denyPrompt("qa-v05-calendar-denied.png");
      denyPrompt("qa-v05-location-denied.png");
      if (android.os.Build.VERSION.SDK_INT >= 33) denyPrompt("qa-v05-notifications-denied.png");
      waitFor("Calendários");
      waitFor("Lembretes pendentes · 1");
      assertFalse(new CalendarStore(context).readable());
      assertFalse(ForegroundLocation.allowed(context));
      org.json.JSONObject input = new DataRepository(context).input();
      assertEquals(0, input.getJSONArray("events").length());
      assertEquals(1, input.getJSONArray("reminders").length());
      capture("qa-v05-local-without-permissions.png");
    } finally {
      p.edit().putString("reminders", old).commit();
      ReminderAlerts.schedule(context);
    }
  }

  void reveal(String label) throws Exception {
    for (int attempt = 0; attempt < 12; attempt++) {
      if (find(label) != null) return;
      android.view.accessibility.AccessibilityNodeInfo root =
          getInstrumentation().getUiAutomation().getRootInActiveWindow();
      java.util.ArrayDeque<android.view.accessibility.AccessibilityNodeInfo> nodes =
          new java.util.ArrayDeque<>();
      if (root != null) nodes.add(root);
      while (!nodes.isEmpty()) {
        android.view.accessibility.AccessibilityNodeInfo n = nodes.remove();
        if (n.isScrollable()
            && n.performAction(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)) break;
        for (int i = 0; i < n.getChildCount(); i++)
          if (n.getChild(i) != null) nodes.add(n.getChild(i));
      }
      Thread.sleep(400);
    }
    waitFor(label);
  }

  public void testPermissionRecoveryThroughSettingsAndActualSystemPrompts() throws Exception {
    if (!enabled()) return;
    context = getInstrumentation().getTargetContext();
    java.util.concurrent.CountDownLatch warm = new java.util.concurrent.CountDownLatch(1);
    RefreshCoordinator.refresh(context, (image, message) -> warm.countDown());
    assertTrue(
        "Warm local renderer before navigation in the software-only AVD",
        warm.await(240, java.util.concurrent.TimeUnit.SECONDS));
    boolean read = new CalendarStore(context).readable(),
        coarse = ForegroundLocation.allowed(context);
    getInstrumentation()
        .startActivitySync(
            new Intent(context, CalendarActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
    waitFor("Calendários");
    click("Configurações");
    waitFor("Configurações");
    click("Permissões e primeiros passos");
    waitFor("Seu calendário");
    capture("qa-v05-onboarding.png");
    if (android.os.Build.VERSION.SDK_INT >= 33 && !ReminderAlerts.allowed(context)) {
      reveal("Alertas de lembretes locais");
      click("Alertas de lembretes locais");
    }
    reveal("Continuar");
    click("Continuar");
    boolean readPermanent =
        "true"
            .equals(
                ((android.test.InstrumentationTestRunner) getInstrumentation())
                    .getArguments()
                    .getString("readPermanent"));
    if (!read && !readPermanent) {
      waitFor("ALLOW");
      capture("qa-v05-calendar-grant.png");
      click("ALLOW");
    }
    if (!coarse) {
      waitFor("WHILE USING THE APP");
      capture("qa-v05-location-grant.png");
      click("WHILE USING THE APP");
    }
    if (android.os.Build.VERSION.SDK_INT >= 33 && !ReminderAlerts.allowed(context)) {
      waitFor("Allow");
      capture("qa-v05-notification-grant.png");
      click("Allow");
    }
    waitFor("Configurações");
    click("‹ Calendário");
    if (!new CalendarStore(context).readable()) {
      click("Configurações");
      click("Permissões no Android");
      waitFor("Permissions");
      click("Permissions");
      waitFor("Calendar");
      click("Calendar");
      waitFor("Allow");
      capture("qa-v05-system-calendar-access.png");
      click("Allow");
      for (int i = 0; i < 3; i++) {
        try (java.io.InputStream in =
            new android.os.ParcelFileDescriptor.AutoCloseInputStream(
                getInstrumentation().getUiAutomation().executeShellCommand("input keyevent 4"))) {
          byte[] buffer = new byte[256];
          while (in.read(buffer) != -1) {}
        }
        Thread.sleep(500);
      }
      waitFor("Configurações");
      click("‹ Calendário");
    }
    waitFor("Calendários");
    assertTrue(new CalendarStore(context).readable());
    assertTrue(ForegroundLocation.allowed(context));
    assertFalse(context.getSharedPreferences("settings", 0).getBoolean("demo", true));
    capture("qa-v05-permissions-granted.png");
  }

  boolean enabled() {
    return "true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("v05Qa"));
  }

  void awaitRender(long before) throws Exception {
    for (int i = 0; i < 300; i++) {
      if (context.getSharedPreferences("settings", 0).getLong("renderedAt", 0) > before) return;
      Thread.sleep(500);
    }
    fail("Widget was not refreshed by calendar lifecycle");
  }

  public void testCalendarRefreshesSourcesWidgetTapReturnAndProviderChanges() throws Exception {
    if (!enabled()) return;
    context = getInstrumentation().getTargetContext();
    store = new CalendarStore(context);
    for (CalendarStore.Agenda a : store.calendars()) assertEquals(BackupStore.APP_ID, a.account);
    SharedPreferences p = context.getSharedPreferences("settings", 0);
    Map<String, ?> original = new HashMap<>(p.getAll());
    calendar = store.createLocal("Agenda sintética 0.5");
    Set<String> onlyFixture = new HashSet<>();
    for (CalendarStore.Agenda agenda : store.calendars())
      if (agenda.id != calendar) onlyFixture.add(Long.toString(agenda.id));
    CalendarActivity home = null;
    try {
      p.edit()
          .putBoolean("onboardingV5", true)
          .putBoolean("demo", false)
          .putBoolean("weather", false)
          .putBoolean("weatherAuto", false)
          .putBoolean("weatherPendingLocation", false)
          .putBoolean("showReminders", true)
          .putStringSet("hiddenCalendars", onlyFixture)
          .putString("reminders", "[]")
          .commit();
      CalendarStore.Item event = fixture("Evento sintético 0.5", 14);
      event.start = System.currentTimeMillis() + 10 * 60000L;
      event.end = event.start + 3600000L;
      event.id = store.save(event);
      CalendarStore.Item reminder = fixture("Lembrete local sintético", 15);
      reminder.reminder = true;
      reminder.localId = "qa-v05-local";
      new ReminderStore(context).save(reminder);
      CalendarStore.Item overdue = reminder.copy();
      overdue.localId = "qa-v05-overdue";
      overdue.title = "Pendência local sintética";
      overdue.start -= 60L * 86400000;
      overdue.end = overdue.start + 60000;
      new ReminderStore(context).save(overdue);
      CountDownLatch warmed = new CountDownLatch(1);
      RefreshCoordinator.refresh(context, (image, message) -> warmed.countDown());
      assertTrue(warmed.await(240, TimeUnit.SECONDS));
      long previous = p.getLong("renderedAt", 0);
      home =
          (CalendarActivity)
              getInstrumentation()
                  .startActivitySync(
                      new Intent(context, CalendarActivity.class)
                          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK)
                          .putExtra("widgetTap", true));
      waitFor("Calendários");
      waitFor("Lembretes pendentes · 1");
      awaitRender(previous);
      org.json.JSONObject diagnostics =
          new org.json.JSONObject(p.getString("renderDiagnostics", "{}"));
      assertTrue(diagnostics.toString(), diagnostics.optInt("eventItems") >= 1);
      assertTrue(diagnostics.toString(), diagnostics.optInt("reminderItems") >= 2);
      assertFalse(
          p.getString("renderDiagnostics", "{}"),
          p.getString("renderDiagnostics", "{}").equals("{}"));
      capture("qa-v05-month.png");
      click("Alterar visualização");
      click("Lembretes locais");
      waitFor("Lembrete local sintético");
      waitFor("Pendência local sintética");
      capture("qa-v05-reminders.png");
      previous = p.getLong("renderedAt", 0);
      click("Configurações");
      waitFor("Preferências do calendário");
      capture("qa-v05-settings.png");
      click("‹ Calendário");
      awaitRender(previous);
      click("Alterar visualização");
      click("Mês");
      previous = p.getLong("renderedAt", 0);
      event.title = "Evento alterado pelo provedor";
      store.save(event);
      awaitRender(previous);
      waitFor("Evento alterado pelo provedor");
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_90);
      waitFor("Calendários");
      Thread.sleep(1500);
      capture("qa-v05-week.png");
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_FREEZE_0);
      Thread.sleep(1500);
    } finally {
      getInstrumentation().getUiAutomation().setRotation(UiAutomation.ROTATION_UNFREEZE);
      if (home != null) {
        CalendarActivity finish = home;
        getInstrumentation().runOnMainSync(finish::finish);
      }
      Uri uri =
          ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendar)
              .buildUpon()
              .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
              .appendQueryParameter("account_name", BackupStore.APP_ID)
              .appendQueryParameter("account_type", CalendarStore.LOCAL)
              .build();
      context.getContentResolver().delete(uri, null, null);
      SharedPreferences.Editor e = p.edit().clear();
      for (Map.Entry<String, ?> entry : original.entrySet()) {
        Object v = entry.getValue();
        String k = entry.getKey();
        if (v instanceof Boolean) e.putBoolean(k, (Boolean) v);
        else if (v instanceof Integer) e.putInt(k, (Integer) v);
        else if (v instanceof Long) e.putLong(k, (Long) v);
        else if (v instanceof Float) e.putFloat(k, (Float) v);
        else if (v instanceof Set) e.putStringSet(k, (Set<String>) v);
        else e.putString(k, (String) v);
      }
      e.commit();
      ReminderAlerts.schedule(context);
    }
  }
}
