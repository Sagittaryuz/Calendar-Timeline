package com.sagittaryuz.calendartimeline;

import java.io.*;
import java.net.*;
import java.time.*;
import org.json.*;

/** Optional forecast data. Coordinates are never inferred or requested without opt-in. */
final class WeatherRepository {
  interface Client {
    JSONObject get(String url) throws Exception;
  }

  final DataRepository store;
  final Client client;
  final long now;
  String status;

  WeatherRepository(DataRepository store, long now) {
    this(store, now, WeatherRepository::request);
  }

  WeatherRepository(DataRepository store, long now, Client client) {
    this.store = store;
    this.now = now;
    this.client = client;
  }

  void addTo(JSONObject input, boolean force) throws JSONException {
    if (!store.preferences.getBoolean("weather", false)) {
      finish("Clima desativado · toque em Configurar clima");
      return;
    }
    double lat, lon;
    try {
      lat = coordinate(store.preferences.getString("latitude", ""), 90);
      lon = coordinate(store.preferences.getString("longitude", ""), 180);
    } catch (IllegalArgumentException ex) {
      finish("Clima sem localização · configure latitude e longitude");
      return;
    }
    input.put("latitude", lat).put("longitude", lon);
    String scope = lat + "," + lon + "," + ZoneId.systemDefault();
    JSONObject cache = store.read("weather.json");
    if (cache != null
        && (!scope.equals(cache.optString("scope"))
            || !valid(cache.optJSONObject("response"), now)
            || now < cache.optLong("fetchedAt"))) cache = null;
    boolean failed = false;
    String reason = "";
    if (force || cache == null || now - cache.optLong("fetchedAt") >= 30 * 60000L) {
      try {
        JSONObject response =
            client.get(
                "https://api.open-meteo.com/v1/forecast?latitude="
                    + lat
                    + "&longitude="
                    + lon
                    + "&hourly=temperature_2m,precipitation_probability,precipitation,cloud_cover,weather_code,is_day"
                    + "&daily=temperature_2m_min,temperature_2m_max,weather_code&forecast_days=8&past_days=6&timezone="
                    + URLEncoder.encode(ZoneId.systemDefault().toString(), "UTF-8"));
        if (!valid(response, now)) throw new InvalidForecast();
        JSONObject fresh =
            new JSONObject().put("response", response).put("scope", scope).put("fetchedAt", now);
        store.save("weather.json", fresh);
        cache = fresh;
      } catch (Exception ex) {
        failed = true;
        reason =
            ex instanceof InvalidForecast || ex instanceof JSONException
                ? "previsão inválida"
                : ex instanceof HttpFailure
                    ? "serviço indisponível (HTTP " + ((HttpFailure) ex).code + ")"
                    : ex instanceof javax.net.ssl.SSLException
                        ? "falha na conexão segura"
                        : "sem conexão com Open-Meteo";
      }
    }
    if (cache != null && now - cache.optLong("fetchedAt") < 24 * 3600000L) {
      input.put("weatherResponse", cache.getJSONObject("response"));
      finish(
          "Open-Meteo · "
              + DataRepository.stamp(cache.optLong("fetchedAt"))
              + (failed ? " · cache, " + reason : ""));
    } else finish("Clima indisponível · " + reason + ". Toque em Atualizar agora.");
  }

  private void finish(String message) {
    status = message;
    store.preferences.edit().putString("weatherStatus", message).apply();
  }

  static double coordinate(String text, int limit) {
    try {
      double n = Double.parseDouble(text.trim().replace(',', '.'));
      if (!Double.isFinite(n) || Math.abs(n) > limit) throw new IllegalArgumentException();
      return n;
    } catch (Exception ex) {
      throw new IllegalArgumentException("Coordenada inválida");
    }
  }

  /** Require usable hourly and daily data, including the current forecast window. */
  static boolean valid(JSONObject response, long now) {
    try {
      JSONObject hourly = response.getJSONObject("hourly"), daily = response.getJSONObject("daily");
      JSONArray times = hourly.getJSONArray("time"),
          temperatures = hourly.getJSONArray("temperature_2m");
      boolean current = false;
      for (int i = 0; i < times.length(); i++) {
        long time =
            LocalDateTime.parse(times.getString(i))
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
        if (!temperatures.isNull(i)
            && Double.isFinite(temperatures.optDouble(i))
            && Math.abs(time - now) <= 2 * 3600000L) current = true;
      }
      JSONArray days = daily.getJSONArray("time"),
          min = daily.getJSONArray("temperature_2m_min"),
          max = daily.getJSONArray("temperature_2m_max");
      boolean usableDay = false;
      for (int i = 0; i < days.length(); i++) {
        LocalDate.parse(days.getString(i));
        if (!min.isNull(i)
            && !max.isNull(i)
            && Double.isFinite(min.optDouble(i))
            && Double.isFinite(max.optDouble(i))) usableDay = true;
      }
      return current && usableDay;
    } catch (Exception ex) {
      return false;
    }
  }

  static JSONObject request(String url) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
    connection.setConnectTimeout(12000);
    connection.setReadTimeout(12000);
    connection.setInstanceFollowRedirects(false);
    try {
      int code = connection.getResponseCode();
      if (code != 200) throw new HttpFailure(code);
      try (InputStream in = connection.getInputStream()) {
        return new JSONObject(DataRepository.readLimited(in, 2000000));
      }
    } finally {
      connection.disconnect();
    }
  }

  private static final class InvalidForecast extends IOException {}

  private static final class HttpFailure extends IOException {
    final int code;

    HttpFailure(int code) {
      this.code = code;
    }
  }
}
