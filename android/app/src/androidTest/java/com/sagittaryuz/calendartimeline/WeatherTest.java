package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.test.InstrumentationTestCase;
import java.io.IOException;
import java.time.*;
import org.json.*;

/** Forecast/cache regressions with synthetic temperatures and public city coordinates only. */
public final class WeatherTest extends InstrumentationTestCase {
  DataRepository store;
  String savedPreferences;
  JSONObject savedCache;
  long now;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    store = new DataRepository(getInstrumentation().getTargetContext());
    savedPreferences = new JSONObject(store.preferences.getAll()).toString();
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
    JSONObject p = new JSONObject(savedPreferences);
    for (java.util.Iterator<String> keys = p.keys(); keys.hasNext(); ) {
      String k = keys.next();
      Object v = p.get(k);
      if (v instanceof Boolean) e.putBoolean(k, (Boolean) v);
      else if (v instanceof Integer) e.putInt(k, (Integer) v);
      else if (v instanceof Number) e.putLong(k, ((Number) v).longValue());
      else e.putString(k, String.valueOf(v));
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

  WeatherRepository service(WeatherRepository.Client c) {
    return new WeatherRepository(store, now, c);
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
