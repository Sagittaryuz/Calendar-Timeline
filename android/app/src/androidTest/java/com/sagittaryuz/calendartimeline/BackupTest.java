package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.test.InstrumentationTestCase;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Synthetic local reminders only. Invalid input must not mutate existing app state. */
public final class BackupTest extends InstrumentationTestCase {
  Context context;
  SharedPreferences preferences;
  Map<String, ?> before;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    context = getInstrumentation().getTargetContext();
    preferences = context.getSharedPreferences("settings", 0);
    before = new HashMap<>(preferences.getAll());
  }

  @Override
  protected void tearDown() throws Exception {
    SharedPreferences.Editor e = preferences.edit().clear();
    for (Map.Entry<String, ?> v : before.entrySet()) {
      Object o = v.getValue();
      if (o instanceof Boolean) e.putBoolean(v.getKey(), (Boolean) o);
      else if (o instanceof Integer) e.putInt(v.getKey(), (Integer) o);
      else if (o instanceof Long) e.putLong(v.getKey(), (Long) o);
      else if (o instanceof String) e.putString(v.getKey(), (String) o);
    }
    e.commit();
    super.tearDown();
  }

  JSONObject fixture() throws Exception {
    return new JSONObject()
        .put("format", "calendar-timeline-backup")
        .put("schemaVersion", 1)
        .put("applicationId", BackupStore.APP_ID)
        .put(
            "settings",
            new JSONObject()
                .put("hours", 48)
                .put("theme", "dark")
                .put("demo", false)
                .put("weather", true)
                .put("checkUpdates", false)
                .put("latitude", "−17,88")
                .put("longitude", "−51,71"))
        .put(
            "reminders",
            new JSONArray()
                .put(
                    new JSONObject()
                        .put("identifier", "synthetic-1")
                        .put("title", "LEMBRETE DE TESTE")
                        .put("dueDate", 1792300000000L)
                        .put("dueDateIncludesTime", true)
                        .put("priority", 1)));
  }

  public void testRoundTripRestoresSavedSettingsAndLocalReminders() throws Exception {
    BackupStore store = new BackupStore(context);
    BackupStore.Payload expected = BackupStore.parse(fixture().toString());
    store.restore(expected);
    byte[] bytes = store.export("0.2.0-debug");
    BackupStore.Payload copy = BackupStore.read(new ByteArrayInputStream(bytes));
    preferences.edit().putInt("hours", 1).putString("reminders", "[]").commit();
    store.restore(copy);
    assertEquals(48, preferences.getInt("hours", 0));
    assertEquals("dark", preferences.getString("theme", ""));
    assertFalse(preferences.getBoolean("demo", true));
    assertTrue(preferences.getBoolean("weather", false));
    assertEquals("-17.88", preferences.getString("latitude", ""));
    assertEquals("-51.71", preferences.getString("longitude", ""));
    assertFalse(preferences.getBoolean("checkUpdates", true));
    JSONObject reminder = new JSONArray(preferences.getString("reminders", "[]")).getJSONObject(0);
    assertEquals("LEMBRETE DE TESTE", reminder.getString("title"));
    assertEquals(1792300000000L, reminder.getLong("dueDate"));
    assertEquals("local", reminder.getJSONObject("calendar").getString("identifier"));
    assertTrue(copy.activatesWeather());
  }

  public void testExportExcludesCachesPermissionsAndOtherPreferenceKeys() throws Exception {
    new BackupStore(context).restore(BackupStore.parse(fixture().toString()));
    preferences
        .edit()
        .putString("privateUnrelated", "DO_NOT_EXPORT")
        .putString("weatherStatus", "CACHE_NOT_EXPORTED")
        .putLong("renderedAt", 123)
        .putString("calendar", "NOT_EXPORTED")
        .commit();
    String text = new String(new BackupStore(context).export("test"), StandardCharsets.UTF_8);
    assertFalse(text.contains("DO_NOT_EXPORT"));
    assertFalse(text.contains("CACHE_NOT_EXPORTED"));
    assertFalse(text.contains("renderedAt"));
    assertFalse(text.contains("READ_CALENDAR"));
    assertFalse(text.contains("NOT_EXPORTED"));
  }

  public void testInvalidDocumentsCannotChangeExistingData() throws Exception {
    preferences.edit().putString("reminders", "[]").putInt("hours", 24).commit();
    Map<String, ?> original = new HashMap<>(preferences.getAll());
    for (int i = 0; i < 9; i++) {
      JSONObject f = fixture(), s = f.getJSONObject("settings");
      switch (i) {
        case 0:
          f.put("schemaVersion", 2);
          break;
        case 1:
          s.put("hours", 97);
          break;
        case 2:
          s.put("hours", 24.5);
          break;
        case 3:
          s.put("weather", "true");
          break;
        case 4:
          s.put("latitude", "NaN");
          break;
        case 5:
          s.remove("longitude");
          break;
        case 6:
          f.getJSONArray("reminders").getJSONObject(0).put("dueDate", "tomorrow");
          break;
        case 7:
          f.getJSONArray("reminders").getJSONObject(0).put("title", "");
          break;
        default:
          f.put("applicationId", "another.app");
      }
      try {
        BackupStore.Payload p = BackupStore.parse(f.toString());
        new BackupStore(context).restore(p);
        fail("Accepted invalid backup " + i);
      } catch (JSONException | IllegalArgumentException expected) {
      }
      assertEquals(original, preferences.getAll());
    }
  }

  public void testDuplicateRemindersOversizeAndTrailingContentRejected() throws Exception {
    JSONObject f = fixture();
    f.getJSONArray("reminders").put(f.getJSONArray("reminders").getJSONObject(0));
    try {
      BackupStore.parse(f.toString());
      fail();
    } catch (JSONException expected) {
    }
    try {
      BackupStore.parse(fixture() + " trailing");
      fail();
    } catch (JSONException expected) {
    }
    InputStream huge = new ByteArrayInputStream(new byte[BackupStore.MAX_BYTES + 1]);
    try {
      BackupStore.read(huge);
      fail();
    } catch (IOException expected) {
    }
  }

  public void testUnknownKeysCannotRestorePermissionsOrUpdateMetadata() throws Exception {
    JSONObject f = fixture();
    f.getJSONObject("settings")
        .put("READ_CALENDAR", true)
        .put("updateUrl", "https://invalid.example");
    f.put("calendarEvents", new JSONArray());
    preferences.edit().putString("untouched", "keep").commit();
    new BackupStore(context).restore(BackupStore.parse(f.toString()));
    assertFalse(preferences.contains("READ_CALENDAR"));
    assertFalse(preferences.contains("updateUrl"));
    assertEquals("keep", preferences.getString("untouched", ""));
  }

  public void testWeatherOffWithoutCoordinatesAndEmptyRemindersSupported() throws Exception {
    JSONObject f = fixture();
    JSONObject s = f.getJSONObject("settings");
    s.put("weather", false).remove("latitude");
    s.remove("longitude");
    f.put("reminders", new JSONArray());
    new BackupStore(context).restore(BackupStore.parse(f.toString()));
    assertFalse(preferences.getBoolean("weather", true));
    assertFalse(preferences.contains("latitude"));
    assertEquals(0, new JSONArray(preferences.getString("reminders", "[]")).length());
  }
}
