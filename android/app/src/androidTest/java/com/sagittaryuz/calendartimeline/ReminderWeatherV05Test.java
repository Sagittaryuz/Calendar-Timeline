package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.graphics.Bitmap;
import android.location.Location;
import android.os.SystemClock;
import android.test.InstrumentationTestCase;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** Synthetic local tasks, original renderer, approximate-location and privacy regressions. */
public final class ReminderWeatherV05Test extends InstrumentationTestCase {
  Context c;
  SharedPreferences prefs;
  String before;

  @Override
  protected void setUp() throws Exception {
    c = getInstrumentation().getTargetContext();
    prefs = c.getSharedPreferences("settings", 0);
    before = prefs.getString("reminders", "[]");
    prefs.edit().putString("reminders", "[]").commit();
  }

  @Override
  protected void tearDown() throws Exception {
    prefs.edit().putString("reminders", before).commit();
    ReminderAlerts.schedule(c);
  }

  CalendarStore.Item task(String id, int days, boolean complete) {
    CalendarStore.Item x = new CalendarStore.Item();
    x.reminder = true;
    x.localId = id;
    x.title = "TAREFA SINTÉTICA " + id;
    x.completed = complete;
    x.start =
        LocalDate.now()
            .plusDays(days)
            .atTime(12, 0)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli();
    x.end = x.start + 60000;
    return x;
  }

  public void testOverdueSurvivesVisibleMonthAndCompletedStaysHidden() throws Exception {
    ReminderStore store = new ReminderStore(c);
    store.save(task("overdue", -60, false));
    store.save(task("today", 0, false));
    store.save(task("future", 60, false));
    store.save(task("done", 0, true));
    long from = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    List<CalendarStore.Item> visible = store.visible(from, from + 86400000, false);
    assertEquals(2, visible.size());
    assertEquals(3, store.visible(from, from + 86400000, true).size());
    assertEquals(3, store.forWidget().length());
    assertEquals(4, store.all().size());
  }

  public void testRendererActuallySelectsLocalRemindersAlongsideEvents() throws Exception {
    ReminderStore store = new ReminderStore(c);
    store.save(task("overdue", -60, false));
    CalendarStore.Item timed = task("timed", 0, false);
    timed.start = System.currentTimeMillis() + 3600000;
    timed.end = timed.start + 60000;
    store.save(timed);
    long now = System.currentTimeMillis();
    JSONObject calendar =
        new JSONObject()
            .put("title", "Agenda sintética")
            .put("identifier", "qa")
            .put("color", new JSONObject().put("hex", "0A84FF"));
    JSONObject input =
        new JSONObject()
            .put("now", now)
            .put("hours", 24)
            .put("reminders", store.forWidget())
            .put(
                "events",
                new JSONArray()
                    .put(
                        new JSONObject()
                            .put("identifier", "qa-event")
                            .put("title", "EVENTO SINTÉTICO")
                            .put("startDate", now + 1800000)
                            .put("endDate", now + 5400000)
                            .put("isAllDay", false)
                            .put("calendar", calendar)));
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<Bitmap> bitmap = new AtomicReference<>();
    AtomicReference<String> error = new AtomicReference<>();
    getInstrumentation()
        .runOnMainSync(
            () ->
                RenderEngine.render(
                    c,
                    input,
                    (b, e) -> {
                      bitmap.set(b);
                      error.set(e);
                      latch.countDown();
                    }));
    assertTrue(latch.await(240, TimeUnit.SECONDS));
    assertNull(error.get());
    assertNotNull(bitmap.get());
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("reminderItems") >= 2);
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("eventItems") >= 1);
  }

  public void testApproximateLocationRejectsOldFutureAndInvalidFixes() {
    long now = SystemClock.elapsedRealtimeNanos();
    Location l = new Location("network");
    l.setLatitude(-17.88);
    l.setLongitude(-51.71);
    l.setElapsedRealtimeNanos(now);
    assertTrue(ForegroundLocation.usable(l, now));
    assertFalse(ForegroundLocation.usable(l, now - 1));
    assertFalse(ForegroundLocation.usable(l, now + 7 * 3600_000_000_000L));
    l.setLatitude(Double.NaN);
    assertFalse(ForegroundLocation.usable(l, now));
  }

  public void testManifestRequestsOnlyApproximateForegroundLocation() throws Exception {
    String[] permissions =
        c.getPackageManager()
            .getPackageInfo(c.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS)
            .requestedPermissions;
    List<String> list = Arrays.asList(permissions);
    assertTrue(list.contains("android.permission.ACCESS_COARSE_LOCATION"));
    assertFalse(list.contains("android.permission.ACCESS_FINE_LOCATION"));
    assertFalse(list.contains("android.permission.ACCESS_BACKGROUND_LOCATION"));
    assertFalse(list.contains("android.permission.SCHEDULE_EXACT_ALARM"));
  }
}
