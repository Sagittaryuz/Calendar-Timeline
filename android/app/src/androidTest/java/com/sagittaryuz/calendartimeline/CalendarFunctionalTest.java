package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.CalendarContract;
import android.test.InstrumentationTestCase;
import java.time.*;
import java.util.*;
import org.json.*;

/** Opt-in on a clean isolated AVD only. No connected account or user calendar is queried. */
public final class CalendarFunctionalTest extends InstrumentationTestCase {
  Context c;
  CalendarStore store;
  long calendar;
  boolean run, readBefore, writeBefore;
  String oldReminders;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    run =
        "true"
            .equals(
                ((android.test.InstrumentationTestRunner) getInstrumentation())
                    .getArguments()
                    .getString("calendarQa"));
    if (!run) return;
    c = getInstrumentation().getTargetContext();
    readBefore =
        c.checkSelfPermission(Manifest.permission.READ_CALENDAR)
            == PackageManager.PERMISSION_GRANTED;
    writeBefore =
        c.checkSelfPermission(Manifest.permission.WRITE_CALENDAR)
            == PackageManager.PERMISSION_GRANTED;
    assertTrue(
        "Grant calendar access only in the disposable QA emulator", readBefore && writeBefore);
    store = new CalendarStore(c);
    for (CalendarStore.Agenda a : store.calendars())
      assertEquals("Run only on the isolated Calendar Timeline AVD", BackupStore.APP_ID, a.account);
    calendar = store.createLocal("CALENDÁRIO SINTÉTICO QA");
    oldReminders = c.getSharedPreferences("settings", 0).getString("reminders", "[]");
    c.getSharedPreferences("settings", 0).edit().putString("reminders", "[]").commit();
  }

  @Override
  protected void tearDown() throws Exception {
    if (run) {
      Uri u =
          ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, calendar)
              .buildUpon()
              .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
              .appendQueryParameter("account_name", BackupStore.APP_ID)
              .appendQueryParameter("account_type", CalendarStore.LOCAL)
              .build();
      c.getContentResolver().delete(u, null, null);
      c.getSharedPreferences("settings", 0).edit().putString("reminders", oldReminders).commit();
      ReminderAlerts.schedule(c);
    }
    super.tearDown();
  }

  CalendarStore.Item fixture() {
    CalendarStore.Item x = new CalendarStore.Item();
    x.calendarId = calendar;
    x.title = "REUNIÃO SINTÉTICA";
    x.zone = "America/Sao_Paulo";
    x.start =
        ZonedDateTime.of(2026, 10, 20, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    return x;
  }

  public void testProviderCreateReadUpdateDeleteAndReminderAtomicBatch() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.alert = 15;
    long id = store.save(x);
    CalendarStore.Item saved = store.event(id);
    assertEquals(x.title, saved.title);
    assertEquals(x.start, saved.start);
    assertEquals(15, saved.alert);
    assertTrue(saved.editable);
    saved.title = "REUNIÃO EDITADA";
    saved.location = "SALA SINTÉTICA";
    saved.notes = "NOTAS DE TESTE";
    saved.alert = -1;
    store.save(saved);
    CalendarStore.Item updated = store.event(id);
    assertEquals(saved.title, updated.title);
    assertEquals(-1, updated.alert);
    assertEquals(saved.location, updated.location);
    store.delete(id);
    try {
      store.event(id);
      fail("Event still exists");
    } catch (IllegalArgumentException expected) {
    }
  }

  public void testRecurringInstancesAndSeriesUpdate() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.rule = "FREQ=WEEKLY;COUNT=3";
    long id = store.save(x);
    List<CalendarStore.Item> list =
        store.instances(x.start - 1, x.start + 30 * 86400000L, Collections.emptySet(), calendar);
    assertEquals(3, list.size());
    assertEquals(7 * 86400000L, list.get(1).start - list.get(0).start);
    CalendarStore.Item series = store.event(id);
    assertEquals(3600000L, series.end - series.start);
    series.title = "SÉRIE EDITADA";
    store.save(series);
    list = store.instances(x.start - 1, x.start + 30 * 86400000L, Collections.emptySet(), calendar);
    assertEquals(3, list.size());
    for (CalendarStore.Item y : list) assertEquals(series.title, y.title);
    store.delete(id);
    assertEquals(
        0,
        store
            .instances(x.start - 1, x.start + 30 * 86400000L, Collections.emptySet(), calendar)
            .size());
  }

  public void testAllDayCivilDatesAndHiddenCalendar() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.allDay = true;
    x.start =
        LocalDate.of(2026, 10, 20).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    x.end =
        LocalDate.of(2026, 10, 22).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    long id = store.save(x);
    CalendarStore.Item y = store.event(id);
    assertEquals(x.start, y.start);
    assertEquals(x.end, y.end);
    assertTrue(y.allDay);
    assertEquals(
        1, store.instances(x.start - 1, x.end + 1, Collections.emptySet(), calendar).size());
    assertEquals(
        0,
        store
            .instances(
                x.start - 1, x.end + 1, Collections.singleton(Long.toString(calendar)), calendar)
            .size());
  }

  public void testInvalidEventDoesNotMutateProvider() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    long id = store.save(x);
    x.id = id;
    x.end = x.start;
    try {
      store.save(x);
      fail();
    } catch (IllegalArgumentException expected) {
    }
    assertEquals(3600000L, store.event(id).end - store.event(id).start);
  }

  public void testLocalReminderCrudRepeatCompletionAndBackupV2() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.reminder = true;
    x.localId = "qa-local";
    x.rule = "MONTHLY";
    x.start =
        ZonedDateTime.of(2026, 1, 31, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 60000;
    x.notes = "LEMBRETE SINTÉTICO";
    x.alert = 15;
    ReminderStore reminders = new ReminderStore(c);
    reminders.save(x);
    assertEquals(1, reminders.all().size());
    reminders.toggle(x);
    List<CalendarStore.Item> all = reminders.all();
    assertEquals(2, all.size());
    CalendarStore.Item next = all.get(0);
    assertEquals(
        LocalDate.of(2026, 2, 28),
        Instant.ofEpochMilli(next.start).atZone(ZoneId.of(x.zone)).toLocalDate());
    assertTrue(all.get(1).completed);
    assertEquals(1, reminders.forWidget().length());
    byte[] backup = new BackupStore(c).export("0.3.0-debug");
    BackupStore.Payload copy = BackupStore.read(new java.io.ByteArrayInputStream(backup));
    assertEquals("MONTHLY", copy.reminders.getJSONObject(0).getString("repeat"));
    assertEquals("LEMBRETE SINTÉTICO", copy.reminders.getJSONObject(0).getString("notes"));
    assertEquals(15, copy.reminders.getJSONObject(0).getInt("alertMinutes"));
    assertTrue(copy.reminders.getJSONObject(1).getBoolean("completed"));
    next.title = "LEMBRETE EDITADO";
    reminders.save(next);
    assertEquals(next.title, reminders.all().get(0).title);
    reminders.delete(next.localId);
    assertEquals(1, reminders.all().size());
  }

  public void testReminderRecurrencePreservesCivilHourAcrossDst() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.reminder = true;
    x.rule = "DAILY";
    x.zone = "America/New_York";
    x.start =
        ZonedDateTime.of(2026, 3, 7, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 60000;
    new ReminderStore(c).save(x);
    new ReminderStore(c).toggle(x);
    CalendarStore.Item next = new ReminderStore(c).all().get(0);
    assertEquals(23 * 3600000L, next.start - x.start);
    assertEquals(9, Instant.ofEpochMilli(next.start).atZone(ZoneId.of(x.zone)).getHour());
  }

  public void testDateOnlyReminderPreservesCivilDateWhenDeviceZoneChanges() throws Exception {
    if (!run) return;
    TimeZone before = TimeZone.getDefault();
    try {
      TimeZone.setDefault(TimeZone.getTimeZone("America/Sao_Paulo"));
      CalendarStore.Item reminder = fixture();
      reminder.reminder = true;
      reminder.allDay = true;
      reminder.localId = "qa-civil-date";
      reminder.alert = 0;
      reminder.start =
          LocalDate.of(2026, 10, 17)
              .atStartOfDay(ZoneId.systemDefault())
              .toInstant()
              .toEpochMilli();
      reminder.end = reminder.start + 60000;
      JSONObject stored = ReminderStore.encode(reminder);
      long originalSignature = ReminderAlerts.signature(reminder);
      TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
      CalendarStore.Item copy = ReminderStore.decode(stored);
      assertEquals(LocalDate.of(2026, 10, 17), copy.date());
      assertEquals(0, Instant.ofEpochMilli(copy.start).atZone(ZoneId.systemDefault()).getHour());
      assertEquals(originalSignature, ReminderAlerts.signature(copy));
      assertEquals("America/New_York", copy.zone);
      assertEquals(copy.date(), ReminderStore.decode(ReminderStore.encode(copy)).date());
    } finally {
      TimeZone.setDefault(before);
    }
  }

  public void testTitleEditPreservesAdditionalEventAlerts() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.alert = 15;
    long id = store.save(x);
    ContentValues extra = new ContentValues();
    extra.put("event_id", id);
    extra.put("minutes", 60);
    extra.put("method", CalendarContract.Reminders.METHOD_ALERT);
    assertNotNull(c.getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, extra));
    CalendarStore.Item edit = store.event(id);
    edit.title = "TÍTULO EDITADO SEM MUDAR ALERTAS";
    store.save(edit);
    try (android.database.Cursor reminders =
        c.getContentResolver()
            .query(
                CalendarContract.Reminders.CONTENT_URI,
                new String[] {"minutes"},
                "event_id=?",
                new String[] {Long.toString(id)},
                null)) {
      assertNotNull(reminders);
      assertEquals(2, reminders.getCount());
    }
    edit.alert = -1;
    store.save(edit);
    try (android.database.Cursor reminders =
        c.getContentResolver()
            .query(
                CalendarContract.Reminders.CONTENT_URI,
                new String[] {"minutes"},
                "event_id=?",
                new String[] {Long.toString(id)},
                null)) {
      assertNotNull(reminders);
      assertEquals(0, reminders.getCount());
    }
  }

  public void testNewEventDefaultCrossesMidnightAndRespectsSelectedDay() {
    if (!run) return;
    ZoneId zone = ZoneId.of("America/Sao_Paulo");
    ZonedDateTime now = ZonedDateTime.of(2026, 10, 17, 23, 45, 0, 0, zone);
    assertEquals(
        ZonedDateTime.of(2026, 10, 18, 0, 0, 0, 0, zone),
        CalendarActivity.defaultStart(now.toLocalDate(), now));
    assertEquals(
        ZonedDateTime.of(2026, 10, 20, 9, 0, 0, 0, zone),
        CalendarActivity.defaultStart(LocalDate.of(2026, 10, 20), now));
  }

  public void testDeniedCalendarPermissionLeavesLocalRemindersUsable() throws Exception {
    if (!run) return;
    CalendarStore denied =
        new CalendarStore(
            new ContextWrapper(c) {
              @Override
              public int checkSelfPermission(String permission) {
                return PackageManager.PERMISSION_DENIED;
              }
            });
    assertFalse(denied.readable());
    assertEquals(
        0, denied.instances(0, System.currentTimeMillis(), Collections.emptySet(), null).size());
    try {
      denied.save(fixture());
      fail("Write without permission");
    } catch (SecurityException expected) {
    }
    CalendarStore.Item local = fixture();
    local.reminder = true;
    local.localId = "qa-denied";
    local.rule = "";
    new ReminderStore(c).save(local);
    assertEquals(1, new ReminderStore(c).all().size());
  }

  public void testOfflineLocalAlertPostsOnce() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture();
    x.reminder = true;
    x.localId = "qa-alert";
    x.rule = "";
    x.start = System.currentTimeMillis() - 1000;
    x.end = x.start + 60000;
    x.alert = 0;
    new ReminderStore(c).save(x);
    NotificationManager manager = c.getSystemService(NotificationManager.class);
    manager.cancel("qa-alert", 1);
    ReminderAlerts receiver = new ReminderAlerts();
    receiver.onReceive(c, new Intent().setAction("local-reminders"));
    Thread.sleep(500);
    boolean present = false;
    for (android.service.notification.StatusBarNotification n : manager.getActiveNotifications())
      if ("qa-alert".equals(n.getTag())) present = true;
    assertTrue("Local notification missing", present);
    long delivered = c.getSharedPreferences("reminder-alerts", 0).getLong(x.localId, 0);
    assertEquals(x.start, delivered);
    receiver.onReceive(c, new Intent().setAction("local-reminders"));
    assertEquals(delivered, c.getSharedPreferences("reminder-alerts", 0).getLong(x.localId, 0));
    manager.cancel("qa-alert", 1);
    c.getSharedPreferences("reminder-alerts", 0).edit().remove(x.localId).commit();
  }
}
