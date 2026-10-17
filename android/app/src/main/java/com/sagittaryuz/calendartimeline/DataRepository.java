package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CalendarContract;
import android.util.AtomicFile;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.json.*;

/**
 * Calendar contents remain in app-private storage. Only opt-in weather coordinates leave the
 * device.
 */
final class DataRepository {
  final Context context;
  final SharedPreferences preferences;
  String status = "";

  DataRepository(Context c) {
    context = c.getApplicationContext();
    preferences = context.getSharedPreferences("settings", 0);
  }

  JSONObject input() throws Exception {
    JSONObject input = new JSONObject();
    long now = System.currentTimeMillis();
    input
        .put("now", now)
        .put("hours", preferences.getInt("hours", 24))
        .put("theme", preferences.getString("theme", "black"));
    if (preferences.getBoolean("demo", false)) return input.put("demo", true);
    JSONArray events = new JSONArray();
    if (context.checkSelfPermission(Manifest.permission.READ_CALENDAR)
        == PackageManager.PERMISSION_GRANTED) {
      ZoneId zone = ZoneId.systemDefault();
      LocalDate today = LocalDate.now(zone);
      long from = today.minusDays(7).atStartOfDay(zone).toInstant().toEpochMilli(),
          until = today.plusDays(9).atStartOfDay(zone).toInstant().toEpochMilli();
      try {
        android.net.Uri.Builder uri = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(uri, from);
        ContentUris.appendId(uri, until);
        String[] projection = {
          CalendarContract.Instances.EVENT_ID,
          CalendarContract.Instances.TITLE,
          CalendarContract.Instances.BEGIN,
          CalendarContract.Instances.END,
          CalendarContract.Instances.ALL_DAY,
          CalendarContract.Instances.CALENDAR_ID,
          CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
          CalendarContract.Instances.DISPLAY_COLOR,
          CalendarContract.Instances.EVENT_LOCATION,
          CalendarContract.Instances.DESCRIPTION,
          CalendarContract.Instances.AVAILABILITY
        };
        try (Cursor cursor =
            context
                .getContentResolver()
                .query(
                    uri.build(),
                    projection,
                    CalendarContract.Instances.VISIBLE + "=1",
                    null,
                    CalendarContract.Instances.BEGIN + " ASC")) {
          if (cursor == null) throw new IOException("Calendar query unavailable");
          while (cursor.moveToNext()) {
            long begin = cursor.getLong(2), end = cursor.getLong(3);
            boolean allDay = cursor.getInt(4) != 0;
            // CalendarContract represents all-day civil dates as UTC midnight.
            if (allDay) {
              begin =
                  Instant.ofEpochMilli(begin)
                      .atZone(ZoneOffset.UTC)
                      .toLocalDate()
                      .atStartOfDay(zone)
                      .toInstant()
                      .toEpochMilli();
              end =
                  Instant.ofEpochMilli(end)
                      .atZone(ZoneOffset.UTC)
                      .toLocalDate()
                      .atStartOfDay(zone)
                      .toInstant()
                      .toEpochMilli();
            }
            if (end <= begin) continue;
            JSONObject calendar =
                new JSONObject()
                    .put("identifier", cursor.getString(5))
                    .put("title", cursor.getString(6))
                    .put(
                        "color",
                        new JSONObject()
                            .put(
                                "hex",
                                String.format(Locale.ROOT, "%06X", cursor.getInt(7) & 0xffffff)));
            events.put(
                new JSONObject()
                    .put("identifier", cursor.getString(0))
                    .put("title", cursor.getString(1))
                    .put("startDate", begin)
                    .put("endDate", end)
                    .put("isAllDay", allDay)
                    .put("location", cursor.getString(8))
                    .put("notes", cursor.getString(9))
                    .put(
                        "availability",
                        cursor.getInt(10) == CalendarContract.Events.AVAILABILITY_FREE
                            ? "free"
                            : cursor.getInt(10) == CalendarContract.Events.AVAILABILITY_TENTATIVE
                                ? "tentative"
                                : "busy")
                    .put("calendar", calendar));
          }
        }
        save(
            "calendar.json",
            new JSONObject()
                .put("events", events)
                .put("fetchedAt", now)
                .put("from", from)
                .put("until", until)
                .put("timezone", zone.toString()));
        status = "Agenda local atualizada";
      } catch (Exception ex) {
        JSONObject cache = read("calendar.json");
        if (cache != null
            && zone.toString().equals(cache.optString("timezone"))
            && cache.optLong("from") <= now
            && cache.optLong("until") >= until - 86400000L) {
          events = cache.getJSONArray("events");
          status = "Agenda em cache · " + stamp(cache.optLong("fetchedAt"));
        } else status = "Agenda indisponível; tente atualizar";
      }
    } else {
      delete("calendar.json");
      status = "Agenda sem acesso · permita a leitura para exibir eventos";
    }
    input
        .put("events", events)
        .put("reminders", new JSONArray(preferences.getString("reminders", "[]")));
    if (preferences.getBoolean("weather", false)) {
      double lat = Double.parseDouble(preferences.getString("latitude", "0")),
          lon = Double.parseDouble(preferences.getString("longitude", "0"));
      if (!Double.isFinite(lat)
          || !Double.isFinite(lon)
          || Math.abs(lat) > 90
          || Math.abs(lon) > 180) throw new IllegalArgumentException("Coordenadas inválidas");
      input.put("latitude", lat).put("longitude", lon);
      String scope = lat + "," + lon + "," + ZoneId.systemDefault();
      JSONObject cache = read("weather.json");
      if (cache == null || !scope.equals(cache.optString("scope"))) cache = null;
      if (cache == null || now - cache.optLong("fetchedAt") > 30 * 60000L) {
        try {
          String query =
              "latitude="
                  + lat
                  + "&longitude="
                  + lon
                  + "&hourly=temperature_2m,precipitation_probability,precipitation,cloud_cover,weather_code,is_day&daily=temperature_2m_min,temperature_2m_max,weather_code&forecast_days=8&past_days=6&timezone="
                  + URLEncoder.encode(ZoneId.systemDefault().toString(), "UTF-8");
          HttpURLConnection connection =
              (HttpURLConnection)
                  new URL("https://api.open-meteo.com/v1/forecast?" + query).openConnection();
          connection.setConnectTimeout(6000);
          connection.setReadTimeout(6000);
          connection.setInstanceFollowRedirects(false);
          JSONObject response;
          try {
            if (connection.getResponseCode() != 200) throw new IOException("Weather HTTP error");
            try (InputStream in = connection.getInputStream()) {
              response = new JSONObject(readLimited(in, 2000000));
            }
          } finally {
            connection.disconnect();
          }
          if (response.optJSONObject("hourly") == null
              || response.getJSONObject("hourly").getJSONArray("time").length() == 0
              || response.optJSONObject("daily") == null) throw new IOException("Invalid forecast");
          // Validate before replacing a valid offline snapshot.
          JSONArray temperatures = response.getJSONObject("hourly").getJSONArray("temperature_2m");
          boolean valid = false;
          for (int i = 0; i < temperatures.length(); i++)
            if (!temperatures.isNull(i) && Double.isFinite(temperatures.optDouble(i))) {
              valid = true;
              break;
            }
          if (!valid) throw new IOException("No temperatures");
          cache =
              new JSONObject().put("response", response).put("scope", scope).put("fetchedAt", now);
          save("weather.json", cache);
        } catch (Exception ex) {
          status += " · clima offline";
        }
      }
      if (cache != null && now - cache.optLong("fetchedAt") < 24 * 3600000L) {
        input.put("weatherResponse", cache.getJSONObject("response"));
        status += " · clima " + stamp(cache.optLong("fetchedAt"));
      } else status += " · clima indisponível";
    } else status += " · clima desativado";
    return input;
  }

  static String stamp(long timestamp) {
    return java.time.format.DateTimeFormatter.ofPattern("dd/MM HH:mm")
        .withZone(ZoneId.systemDefault())
        .format(Instant.ofEpochMilli(timestamp));
  }

  JSONObject read(String name) {
    try (FileInputStream in = new AtomicFile(new File(context.getFilesDir(), name)).openRead()) {
      return new JSONObject(readLimited(in, 4000000));
    } catch (Exception ex) {
      return null;
    }
  }

  void save(String name, JSONObject data) throws IOException {
    AtomicFile file = new AtomicFile(new File(context.getFilesDir(), name));
    FileOutputStream out = null;
    try {
      out = file.startWrite();
      out.write(data.toString().getBytes(StandardCharsets.UTF_8));
      file.finishWrite(out);
    } catch (IOException ex) {
      file.failWrite(out);
      throw ex;
    }
  }

  void delete(String name) {
    new AtomicFile(new File(context.getFilesDir(), name)).delete();
  }

  static String readLimited(InputStream in, int maximum) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] bytes = new byte[8192];
    int count;
    while ((count = in.read(bytes)) != -1) {
      if (out.size() + count > maximum) throw new IOException("Response too large");
      out.write(bytes, 0, count);
    }
    return out.toString("UTF-8");
  }
}
