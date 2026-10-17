package com.sagittaryuz.calendartimeline;

import android.content.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Explicit, user-chosen JSON backups. Never includes calendar data, caches or permissions. */
final class BackupStore {
  static final int MAX_BYTES = 1024 * 1024;
  static final String APP_ID = "com.sagittaryuz.calendartimeline";
  private final SharedPreferences preferences;

  BackupStore(Context context) {
    preferences = context.getSharedPreferences("settings", 0);
  }

  static final class Payload {
    final JSONObject settings;
    final JSONArray reminders;

    Payload(JSONObject settings, JSONArray reminders) {
      this.settings = settings;
      this.reminders = reminders;
    }

    boolean activatesWeather() {
      return settings.optBoolean("weather");
    }
  }

  byte[] export(String appVersion) throws Exception {
    JSONObject settings =
        new JSONObject()
            .put("hours", preferences.getInt("hours", 24))
            .put("theme", preferences.getString("theme", "black"))
            .put("demo", preferences.getBoolean("demo", false))
            .put("weather", preferences.getBoolean("weather", false))
            .put("checkUpdates", preferences.getBoolean("checkUpdates", true));
    if (preferences.contains("latitude"))
      settings.put("latitude", preferences.getString("latitude", ""));
    if (preferences.contains("longitude"))
      settings.put("longitude", preferences.getString("longitude", ""));
    JSONObject document =
        new JSONObject()
            .put("format", "calendar-timeline-backup")
            .put("schemaVersion", 1)
            .put("applicationId", APP_ID)
            .put("appVersion", appVersion)
            .put("exportedAt", System.currentTimeMillis())
            .put("settings", settings)
            .put("reminders", new JSONArray(preferences.getString("reminders", "[]")));
    Payload validated = parse(document.toString());
    document.put("settings", validated.settings).put("reminders", validated.reminders);
    byte[] bytes = document.toString(2).getBytes(StandardCharsets.UTF_8);
    if (bytes.length > MAX_BYTES) throw new IOException("Backup muito grande");
    return bytes;
  }

  static Payload read(InputStream stream) throws Exception {
    return parse(DataRepository.readLimited(stream, MAX_BYTES));
  }

  static Payload parse(String text) throws Exception {
    if (text.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES)
      throw new IOException("Backup muito grande");
    if (text.startsWith("\ufeff")) text = text.substring(1);
    JSONTokener tokener = new JSONTokener(text);
    Object value = tokener.nextValue();
    if (!(value instanceof JSONObject) || tokener.nextClean() != 0)
      throw new JSONException("JSON inválido");
    JSONObject root = (JSONObject) value;
    if (!"calendar-timeline-backup".equals(root.optString("format"))
        || number(root, "schemaVersion", 1, 1) != 1
        || !APP_ID.equals(root.optString("applicationId")))
      throw new JSONException("Formato de backup incompatível");
    JSONObject raw = root.getJSONObject("settings"), clean = new JSONObject();
    clean.put("hours", (int) number(raw, "hours", 1, 96));
    String theme = string(raw, "theme", 20);
    if (!"black".equals(theme) && !"dark".equals(theme)) throw new JSONException("Tema inválido");
    clean
        .put("theme", theme)
        .put("demo", bool(raw, "demo"))
        .put("weather", bool(raw, "weather"))
        .put("checkUpdates", bool(raw, "checkUpdates"));
    boolean lat = raw.has("latitude"), lon = raw.has("longitude");
    if (lat != lon || (clean.getBoolean("weather") && !lat))
      throw new JSONException("Coordenadas ausentes");
    if (lat) {
      clean.put(
          "latitude",
          String.valueOf(WeatherRepository.coordinate(string(raw, "latitude", 80), 90)));
      clean.put(
          "longitude",
          String.valueOf(WeatherRepository.coordinate(string(raw, "longitude", 80), 180)));
    }
    JSONArray rawItems = root.getJSONArray("reminders"), items = new JSONArray();
    if (rawItems.length() > 2000) throw new JSONException("Muitos lembretes");
    Set<String> ids = new HashSet<>();
    for (int i = 0; i < rawItems.length(); i++) {
      JSONObject item = rawItems.getJSONObject(i);
      String id = string(item, "identifier", 100), title = string(item, "title", 4096);
      if (!id.matches("[A-Za-z0-9._:-]+") || !ids.add(id) || title.trim().isEmpty())
        throw new JSONException("Lembrete inválido");
      long due = number(item, "dueDate", -62135596800000L, 253402300799999L);
      boolean timed = bool(item, "dueDateIncludesTime");
      int priority = item.has("priority") ? (int) number(item, "priority", 0, 9) : 0;
      items.put(
          new JSONObject()
              .put("identifier", id)
              .put("title", title)
              .put("dueDate", due)
              .put("dueDateIncludesTime", timed)
              .put("priority", priority)
              .put(
                  "calendar",
                  new JSONObject()
                      .put("title", "Lembretes locais")
                      .put("identifier", "local")
                      .put("color", new JSONObject().put("hex", "FF9F0A"))));
    }
    return new Payload(clean, items);
  }

  void restore(Payload payload) throws Exception {
    // Validate a fresh copy again before a single atomic SharedPreferences transaction.
    Payload clean =
        parse(
            new JSONObject()
                .put("format", "calendar-timeline-backup")
                .put("schemaVersion", 1)
                .put("applicationId", APP_ID)
                .put("settings", payload.settings)
                .put("reminders", payload.reminders)
                .toString());
    JSONObject s = clean.settings;
    SharedPreferences.Editor editor =
        preferences
            .edit()
            .putInt("hours", s.getInt("hours"))
            .putString("theme", s.getString("theme"))
            .putBoolean("demo", s.getBoolean("demo"))
            .putBoolean("weather", s.getBoolean("weather"))
            .putBoolean("checkUpdates", s.getBoolean("checkUpdates"))
            .putString("reminders", clean.reminders.toString())
            .remove("weatherStatus")
            .putLong(
                "restoredAt",
                Math.max(System.currentTimeMillis(), preferences.getLong("restoredAt", 0) + 1));
    if (s.has("latitude"))
      editor
          .putString("latitude", s.getString("latitude"))
          .putString("longitude", s.getString("longitude"));
    else editor.remove("latitude").remove("longitude");
    if (!editor.commit()) throw new IOException("Não foi possível salvar a importação");
  }

  static String string(JSONObject o, String key, int max) throws JSONException {
    Object value = o.get(key);
    if (!(value instanceof String) || ((String) value).length() > max)
      throw new JSONException("Texto inválido: " + key);
    return (String) value;
  }

  static boolean bool(JSONObject o, String key) throws JSONException {
    Object value = o.get(key);
    if (!(value instanceof Boolean)) throw new JSONException("Opção inválida: " + key);
    return (Boolean) value;
  }

  static long number(JSONObject o, String key, long min, long max) throws JSONException {
    Object value = o.get(key);
    if (!(value instanceof Number)) throw new JSONException("Número inválido: " + key);
    double n = ((Number) value).doubleValue();
    if (!Double.isFinite(n) || n != Math.rint(n) || n < min || n > max)
      throw new JSONException("Número fora do intervalo: " + key);
    return ((Number) value).longValue();
  }
}
