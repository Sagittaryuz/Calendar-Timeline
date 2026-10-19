package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.net.Uri;
import android.provider.CalendarContract;
import android.test.InstrumentationTestCase;
import java.time.*;
import java.util.*;

/** Real provider integration, opt-in only on the isolated AVD. */
public final class RecurrenceTest extends InstrumentationTestCase {
  Context c;
  CalendarStore store;
  long calendar;
  boolean run;

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
    store = new CalendarStore(c);
    assertTrue(store.writable());
    for (CalendarStore.Agenda a : store.calendars()) assertEquals(BackupStore.APP_ID, a.account);
    calendar = store.createLocal("RECORRÊNCIA SINTÉTICA QA");
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
    }
    super.tearDown();
  }

  CalendarStore.Item fixture(String rule) throws Exception {
    CalendarStore.Item x = new CalendarStore.Item();
    x.calendarId = calendar;
    x.title = "SÉRIE SINTÉTICA";
    x.zone = "America/Sao_Paulo";
    x.rule = rule;
    x.alert = 15;
    x.start =
        ZonedDateTime.of(2026, 10, 20, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    x.id = store.save(x);
    return x;
  }

  List<CalendarStore.Item> all(CalendarStore.Item x) {
    return store.instances(
        x.start - 10 * 86400000L, x.start + 370 * 86400000L, Collections.emptySet(), calendar);
  }

  CalendarStore.Item occurrence(CalendarStore.Item x, int index) {
    CalendarStore.Item at = all(x).get(index);
    return store.occurrence(at.id, at.start, at.end);
  }

  public void testSingleEditKeepsOtherDatesAndAllAlerts() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=WEEKLY;COUNT=5");
    ContentValues extra = new ContentValues();
    extra.put("event_id", x.id);
    extra.put("minutes", 60);
    extra.put("method", 1);
    c.getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, extra);
    CalendarStore.Item one = occurrence(x, 2);
    long pivot = one.start;
    one.title = "EXCEÇÃO EDITADA";
    one.start += 1800000;
    one.end += 1800000;
    long id = store.saveScoped(one, CalendarStore.Scope.SINGLE);
    assertTrue(id != x.id);
    assertEquals(x.id, store.event(id).originalId);
    assertTrue(store.event(id).editable);
    assertEquals(2, store.alerts(id).size());
    assertEquals(5, all(x).size());
    assertEquals(pivot + 1800000, all(x).get(2).start);
    assertEquals(x.title, all(x).get(1).title);
    assertEquals("EXCEÇÃO EDITADA", all(x).get(2).title);
    assertEquals(x.title, all(x).get(3).title);
    assertEquals(x.start, store.event(x.id).start);
  }

  public void testSingleDeleteAndDeletingEditedExceptionNeverRestoresOriginal() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=DAILY;COUNT=5");
    store.deleteScoped(occurrence(x, 1), CalendarStore.Scope.SINGLE);
    assertEquals(4, all(x).size());
    CalendarStore.Item one = occurrence(x, 1);
    one.title = "EDITADA";
    long id = store.saveScoped(one, CalendarStore.Scope.SINGLE);
    store.deleteScoped(store.event(id), CalendarStore.Scope.SINGLE);
    assertEquals(3, all(x).size());
    assertEquals(x.start + 3 * 86400000L, all(x).get(1).start);
  }

  public void testFutureSplitCountKeepsHistoryAndMovesOnlyRemaining() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=WEEKLY;COUNT=5");
    CalendarStore.Item future = occurrence(x, 2);
    long pivot = future.start;
    future.title = "NOVAS FUTURAS";
    future.start += 1800000;
    future.end += 1800000;
    long id = store.saveScoped(future, CalendarStore.Scope.FUTURE);
    assertTrue(id != x.id);
    assertEquals("FREQ=WEEKLY;COUNT=3", store.event(id).rule);
    List<CalendarStore.Item> list = all(x);
    assertEquals(5, list.size());
    assertEquals(x.title, list.get(1).title);
    assertEquals(pivot + 1800000, list.get(2).start);
    assertEquals("NOVAS FUTURAS", list.get(4).title);
  }

  public void testFutureDeletePreservesPastOccurrencesAndExceptions() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=DAILY;COUNT=5");
    CalendarStore.Item past = occurrence(x, 0);
    past.title = "PASSADA EDITADA";
    store.saveScoped(past, CalendarStore.Scope.SINGLE);
    store.deleteScoped(occurrence(x, 3), CalendarStore.Scope.FUTURE);
    assertEquals(3, all(x).size());
    assertEquals("PASSADA EDITADA", all(x).get(0).title);
  }

  public void testFutureSplitPreservesExistingEditedAndCancelledExceptions() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=DAILY;COUNT=6");
    CalendarStore.Item cancel = occurrence(x, 5);
    store.deleteScoped(cancel, CalendarStore.Scope.SINGLE);
    CalendarStore.Item exception = occurrence(x, 4);
    exception.title = "PERSONALIZAÇÃO SINTÉTICA";
    exception.start += 3600000;
    exception.end += 3600000;
    long exceptionId = store.saveScoped(exception, CalendarStore.Scope.SINGLE);
    CalendarStore.Item future = occurrence(x, 2);
    future.title = "FUTURAS";
    long id = store.saveScoped(future, CalendarStore.Scope.FUTURE);
    assertEquals(5, all(x).size());
    assertEquals(id, store.event(exceptionId).originalId);
    assertEquals(exception.start, store.event(exceptionId).start);
    assertEquals("PERSONALIZAÇÃO SINTÉTICA", all(x).get(4).title);
  }

  public void testUnsafeFutureRebaseLeavesEveryRecordUnchanged() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=DAILY;COUNT=5");
    CalendarStore.Item one = occurrence(x, 4);
    one.title = "EXCEÇÃO";
    store.saveScoped(one, CalendarStore.Scope.SINGLE);
    CalendarStore.Item future = occurrence(x, 2);
    future.start += 3600000;
    future.end += 3600000;
    try {
      store.saveScoped(future, CalendarStore.Scope.FUTURE);
      fail();
    } catch (IllegalArgumentException expected) {
    }
    assertEquals(x.rule, store.event(x.id).rule);
    assertEquals(5, all(x).size());
    assertEquals("EXCEÇÃO", all(x).get(4).title);
  }

  public void testSeriesTitleEditFromLaterOccurrenceKeepsOriginalAnchor() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=WEEKLY;COUNT=5");
    CalendarStore.Item later = occurrence(x, 3);
    later.title = "TODA A SÉRIE";
    store.saveScoped(later, CalendarStore.Scope.SERIES);
    assertEquals(x.start, store.event(x.id).start);
    assertEquals(5, all(x).size());
    for (CalendarStore.Item at : all(x)) assertEquals(later.title, at.title);
  }

  public void testMonthlySplitSkipsInvalidDatesAndPreservesCount() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("");
    x.start =
        ZonedDateTime.of(2026, 1, 31, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    x.rule = "FREQ=MONTHLY;COUNT=4";
    store.save(x);
    assertEquals(4, all(x).size());
    CalendarStore.Item future = occurrence(x, 1);
    future.title = "MENSAL FUTURA";
    long id = store.saveScoped(future, CalendarStore.Scope.FUTURE);
    assertEquals("FREQ=MONTHLY;COUNT=3", store.event(id).rule);
    assertEquals(4, all(x).size());
  }

  public void testDailyDstSplitKeepsCivilHourAndCount() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("");
    x.zone = "America/New_York";
    x.start =
        ZonedDateTime.of(2026, 10, 31, 9, 0, 0, 0, ZoneId.of(x.zone)).toInstant().toEpochMilli();
    x.end = x.start + 3600000;
    x.rule = "FREQ=DAILY;COUNT=4";
    store.save(x);
    assertEquals(25 * 3600000L, all(x).get(1).start - x.start);
    CalendarStore.Item next = occurrence(x, 1);
    next.title = "DEPOIS DO DST";
    store.saveScoped(next, CalendarStore.Scope.FUTURE);
    assertEquals(4, all(x).size());
    for (CalendarStore.Item at : all(x))
      assertEquals(9, Instant.ofEpochMilli(at.start).atZone(ZoneId.of(x.zone)).getHour());
  }

  public void testAllDaySingleAndFutureUseUtcCivilSlots() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("");
    x.allDay = true;
    x.start =
        LocalDate.of(2026, 10, 20).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    x.end =
        LocalDate.of(2026, 10, 21).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    x.rule = "FREQ=DAILY;COUNT=5";
    store.save(x);
    CalendarStore.Item one = occurrence(x, 1);
    one.title = "DIA INTEIRO EDITADO";
    store.saveScoped(one, CalendarStore.Scope.SINGLE);
    assertEquals(5, all(x).size());
    CalendarStore.Item next = occurrence(x, 3);
    next.title = "DIAS FUTUROS";
    store.saveScoped(next, CalendarStore.Scope.FUTURE);
    assertEquals(5, all(x).size());
    assertEquals(next.title, all(x).get(4).title);
  }

  public void testComplexRuleSingleSupportedFutureRejectedWithoutFlattening() throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=WEEKLY;BYDAY=TU,TH;COUNT=6");
    CalendarStore.Item next = occurrence(x, 2);
    next.title = "COMPLEXA";
    try {
      store.saveScoped(next, CalendarStore.Scope.FUTURE);
      fail();
    } catch (IllegalArgumentException expected) {
    }
    assertEquals(x.rule, store.event(x.id).rule);
    assertEquals(6, all(x).size());
    store.saveScoped(next, CalendarStore.Scope.SINGLE);
    assertEquals(6, all(x).size());
  }

  public void testDraftRetainsScopeOnRotation() throws Exception {
    if (!run) return;
    CalendarStore.Item x = occurrence(fixture("FREQ=WEEKLY;COUNT=5"), 3);
    CalendarStore.Item restored = EventEditorActivity.deserialize(EventEditorActivity.serialize(x));
    assertEquals(x.occurrenceStart, restored.occurrenceStart);
    assertEquals(x.seriesRule, restored.seriesRule);
    assertEquals(x.start, restored.start);
  }

  public void testMovingExceptionToAnotherCalendarIsRejectedWithoutLosingOccurrence()
      throws Exception {
    if (!run) return;
    CalendarStore.Item x = fixture("FREQ=DAILY;COUNT=5");
    CalendarStore.Item single = occurrence(x, 2);
    single.title = "EXCEÇÃO PRESERVADA";
    long id = store.saveScoped(single, CalendarStore.Scope.SINGLE);
    long other = store.createLocal("DESTINO LOCAL SINTÉTICO QA");
    try {
      CalendarStore.Item edit = store.event(id);
      edit.calendarId = other;
      edit.title = "NÃO APLICAR";
      try {
        store.save(edit);
        fail("Moved an exception away from its parent calendar");
      } catch (IllegalArgumentException expected) {
      }
      assertEquals(calendar, store.event(id).calendarId);
      assertEquals("EXCEÇÃO PRESERVADA", store.event(id).title);
      assertEquals(5, all(x).size());
      assertEquals(
          0,
          store
              .instances(x.start - 1, x.start + 10 * 86400000L, Collections.emptySet(), other)
              .size());
    } finally {
      c.getContentResolver()
          .delete(
              ContentUris.withAppendedId(CalendarContract.Calendars.CONTENT_URI, other)
                  .buildUpon()
                  .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                  .appendQueryParameter("account_name", BackupStore.APP_ID)
                  .appendQueryParameter("account_type", CalendarStore.LOCAL)
                  .build(),
              null,
              null);
    }
  }
}
