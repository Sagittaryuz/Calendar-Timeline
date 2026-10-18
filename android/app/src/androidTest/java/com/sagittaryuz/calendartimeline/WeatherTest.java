package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.test.InstrumentationTestCase;
import java.io.IOException;
import java.time.*;
import org.json.*;

/** Forecast/cache regressions with synthetic temperatures and public city coordinates only. */
public final class WeatherTest extends InstrumentationTestCase {
  DataRepository store;
  java.util.Map<String, ?> savedPreferences;
  JSONObject savedCache;
  long now;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    store = new DataRepository(getInstrumentation().getTargetContext());
    savedPreferences = new java.util.HashMap<>(store.preferences.getAll());
    savedCache = store.read("weather.json");
    now = System.currentTimeMillis();
    store.delete("weather.json");
    store
        .preferences
        .edit()
        .clear()
        .putBoolean("weather", true)
        .putString("latitude", "-17.8814")
        .putString("longitude", "-51.7144")
        .commit();
  }

  @Override
  protected void tearDown() throws Exception {
    store.delete("weather.json");
    if (savedCache != null) store.save("weather.json", savedCache);
    SharedPreferences.Editor e = store.preferences.edit().clear();
    for (java.util.Map.Entry<String, ?> entry : savedPreferences.entrySet()) {
      String k = entry.getKey();
      Object v = entry.getValue();
      if (v instanceof Boolean) e.putBoolean(k, (Boolean) v);
      else if (v instanceof Integer) e.putInt(k, (Integer) v);
      else if (v instanceof Long) e.putLong(k, (Long) v);
      else if (v instanceof Float) e.putFloat(k, (Float) v);
      else if (v instanceof java.util.Set) e.putStringSet(k, (java.util.Set<String>) v);
      else e.putString(k, (String) v);
    }
    e.commit();
    super.tearDown();
  }

  JSONObject forecast() throws Exception {
    LocalDateTime date =
        Instant.ofEpochMilli(now)
            .atZone(ZoneId.systemDefault())
            .toLocalDateTime()
            .withMinute(0)
            .withSecond(0)
            .withNano(0);
    JSONArray times = new JSONArray(), temps = new JSONArray();
    for (int i = -24; i <= 96; i++) {
      times.put(date.plusHours(i).toString());
      temps.put(20 + (i % 7));
    }
    return new JSONObject()
        .put("hourly", new JSONObject().put("time", times).put("temperature_2m", temps))
        .put(
            "daily",
            new JSONObject()
                .put("time", new JSONArray().put(date.toLocalDate().toString()))
                .put("temperature_2m_min", new JSONArray().put(17))
                .put("temperature_2m_max", new JSONArray().put(29)));
  }

  public void testCalendarSummaryUsesSameFreshCacheAndRejectsWrongLocation() throws Exception {
    JSONObject input = new JSONObject();
    new WeatherRepository(store, now, url -> forecast()).addTo(input, true);
    assertTrue(WeatherRepository.summary(store), WeatherRepository.summary(store).contains("°"));
    store.preferences.edit().putString("longitude", "-40.0").commit();
    assertFalse(WeatherRepository.summary(store).contains("°"));
    store.preferences.edit().putBoolean("weather", false).commit();
    assertTrue(WeatherRepository.summary(store).contains("desativado"));
  }

  WeatherRepository service(WeatherRepository.Client c) {
    return new WeatherRepository(store, now, c);
  }

  public void testPendingLocationReportsProviderReasonWithoutNetwork() throws Exception {
    store
        .preferences
        .edit()
        .putBoolean("weather", false)
        .putBoolean("weatherPendingLocation", true)
        .putString("locationStatus", "Sem localização recente")
        .commit();
    WeatherRepository weather =
        service(
            url -> {
              fail("No forecast request before a location fix");
              return null;
            });
    JSONObject input = new JSONObject();
    weather.addTo(input, true);
    assertTrue(weather.status, weather.status.contains("Sem localização recente"));
    assertFalse(input.has("weatherResponse"));
    assertEquals("Sem localização recente", WeatherRepository.summary(store));
  }

  public void testMissingLocationDoesNotFetchOrBreakCalendar() throws Exception {
    store.preferences.edit().remove("latitude").commit();
    JSONObject input = new JSONObject().put("events", new JSONArray());
    WeatherRepository w =
        service(
            url -> {
              fail("No request before location is configured");
              return null;
            });
    w.addTo(input, true);
    assertTrue(w.status.contains("sem localização"));
    assertFalse(input.has("latitude"));
    assertTrue(input.has("events"));
    assertEquals(-17.8814, WeatherRepository.coordinate("-17,8814", 90), 0.00001);
  }

  public void testCoordinateDecimalCommaAndBothNegativeSigns() {
    for (String raw : new String[] {"-17,88", "-17.88", "−17,88", "  −17.88  "})
      assertEquals(raw, -17.88, WeatherRepository.coordinate(raw, 90), 0.000001);
    for (String raw : new String[] {"-51,71", "-51.71", "−51,71", "−51.71"})
      assertEquals(raw, -51.71, WeatherRepository.coordinate(raw, 180), 0.000001);
    for (String invalid :
        new String[] {
          "-17,88.0", "--17,88", "−-17,88", "17e1", "NaN", "Infinity", "-91", "- 17,88", ""
        }) {
      try {
        WeatherRepository.coordinate(invalid, 90);
        fail("Accepted invalid coordinate: " + invalid);
      } catch (IllegalArgumentException expected) {
      }
    }
    assertEquals(90.0, WeatherRepository.coordinate("90", 90), 0.0);
    assertEquals(-180.0, WeatherRepository.coordinate("−180", 180), 0.0);
  }

  public void testCoordinatePastePreservesCommaAndMinusInPtBrAndEnglish() {
    java.util.List<String> results = new java.util.ArrayList<>();
    String[] values = {"-17,88", "−17,88", "-51.71", "−51,71", "-17,88.0"};
    getInstrumentation()
        .runOnMainSync(
            () -> {
              for (java.util.Locale locale :
                  new java.util.Locale[] {
                    java.util.Locale.forLanguageTag("pt-BR"), java.util.Locale.US
                  }) {
                android.content.res.Configuration config =
                    new android.content.res.Configuration(
                        store.context.getResources().getConfiguration());
                config.setLocale(locale);
                android.widget.EditText field =
                    new android.widget.EditText(store.context.createConfigurationContext(config));
                field.setInputType(
                    android.text.InputType.TYPE_CLASS_NUMBER
                        | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
                        | android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);
                MainActivity.configureCoordinateField(field);
                for (String value : values) {
                  field.getText().replace(0, field.length(), value);
                  results.add(field.getText().toString());
                }
              }
            });
    for (int i = 0; i < results.size(); i++)
      assertEquals(
          "Paste must reach validation unchanged", values[i % values.length], results.get(i));
    assertEquals(-17.88, WeatherRepository.coordinate(results.get(1), 90), 0.000001);
    assertEquals(-51.71, WeatherRepository.coordinate(results.get(3), 180), 0.000001);
  }

  public void testOptOutNeverFetches() throws Exception {
    store.preferences.edit().putBoolean("weather", false).commit();
    WeatherRepository w =
        service(
            url -> {
              fail("No request without opt-in");
              return null;
            });
    w.addTo(new JSONObject(), true);
    assertTrue(w.status.contains("desativado"));
  }

  public void testManualRefreshBypassesFreshCacheAndOfflineRetainsIt() throws Exception {
    final int[] calls = {0};
    JSONObject forecast = forecast();
    WeatherRepository w =
        service(
            url -> {
              calls[0]++;
              return forecast;
            });
    w.addTo(new JSONObject(), false);
    assertEquals(1, calls[0]);
    w.addTo(new JSONObject(), false);
    assertEquals(1, calls[0]);
    w.addTo(new JSONObject(), true);
    assertEquals(2, calls[0]);
    JSONObject input = new JSONObject();
    w =
        service(
            url -> {
              throw new IOException();
            });
    w.addTo(input, true);
    assertTrue(input.has("weatherResponse"));
    assertTrue(w.status.contains("cache"));
    assertTrue(w.status.contains("sem conexão"));
    assertEquals(now, store.read("weather.json").getLong("fetchedAt"));
  }

  public void testInvalidResponseCannotReplaceSnapshot() throws Exception {
    service(url -> forecast()).addTo(new JSONObject(), true);
    JSONObject input = new JSONObject();
    WeatherRepository w = service(url -> new JSONObject());
    w.addTo(input, true);
    assertTrue(input.has("weatherResponse"));
    assertTrue(w.status.contains("previsão inválida"));
    assertTrue(WeatherRepository.valid(store.read("weather.json").getJSONObject("response"), now));
  }

  public void testChangedLocationAndExpiredCacheCannotLeakOldForecast() throws Exception {
    service(url -> forecast()).addTo(new JSONObject(), true);
    store.preferences.edit().putString("latitude", "-18").commit();
    JSONObject input = new JSONObject();
    service(
            url -> {
              throw new IOException();
            })
        .addTo(input, false);
    assertFalse(input.has("weatherResponse"));
    store.preferences.edit().putString("latitude", "-17.8814").commit();
    JSONObject cache = store.read("weather.json");
    cache.put("fetchedAt", now - 25 * 3600000L);
    store.save("weather.json", cache);
    input = new JSONObject();
    service(
            url -> {
              throw new IOException();
            })
        .addTo(input, false);
    assertFalse(input.has("weatherResponse"));
  }
}
