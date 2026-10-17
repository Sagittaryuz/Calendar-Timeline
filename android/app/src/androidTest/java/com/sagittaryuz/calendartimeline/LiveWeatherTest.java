package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.graphics.Bitmap;
import android.test.InstrumentationTestCase;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** Explicit opt-in integration run: public fixed Jataí city coordinates, never device location. */
public final class LiveWeatherTest extends InstrumentationTestCase {
  public void testOfflineCachedForecastAndWidget() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("offlineWeather"))) return;
    Context context = getInstrumentation().getTargetContext();
    DataRepository repository = new DataRepository(context);
    assertFalse(repository.preferences.getBoolean("demo", true));
    JSONObject cache = repository.read("weather.json");
    assertNotNull("Run the live check first", cache);
    long fetchedAt = cache.getLong("fetchedAt"),
        before = repository.preferences.getLong("renderedAt", 0);
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<Bitmap> image = new AtomicReference<>();
    AtomicReference<String> status = new AtomicReference<>();
    RefreshCoordinator.refresh(
        context,
        (bitmap, message) -> {
          image.set(bitmap);
          status.set(message);
          latch.countDown();
        },
        true);
    assertTrue(latch.await(240, TimeUnit.SECONDS));
    assertNotNull(image.get());
    assertTrue(status.get(), status.get().contains("cache, sem conexão"));
    assertEquals(fetchedAt, repository.read("weather.json").getLong("fetchedAt"));
    assertTrue(repository.preferences.getLong("renderedAt", 0) > before);
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("temperatureLabels") > 10);
    android.util.Log.i(
        "TimelineLiveWeather",
        "Offline native widget: " + RenderEngine.lastDiagnostics + " · " + status.get());
  }

  public void testLiveForecastAndWidget() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("liveWeather"))) return;

    Context context = getInstrumentation().getTargetContext();
    context
        .getSharedPreferences("settings", 0)
        .edit()
        .putBoolean("demo", false)
        .putBoolean("weather", true)
        .putString("latitude", "-17.8814")
        .putString("longitude", "-51.7144")
        .putInt("hours", 24)
        .commit();
    DataRepository repository = new DataRepository(context);
    repository.delete("weather.json");
    JSONObject input = repository.input(true);
    assertTrue(repository.status, input.has("weatherResponse"));
    assertTrue(
        input.getJSONObject("weatherResponse").getJSONObject("hourly").getJSONArray("time").length()
            >= 168);
    assertFalse(input.optBoolean("demo"));
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<Bitmap> image = new AtomicReference<>();
    AtomicReference<String> status = new AtomicReference<>();
    RefreshCoordinator.refresh(
        context,
        (bitmap, message) -> {
          image.set(bitmap);
          status.set(message);
          latch.countDown();
        });
    assertTrue("Live renderer timeout", latch.await(240, TimeUnit.SECONDS));
    assertNotNull(status.get(), image.get());
    assertTrue(status.get(), status.get().contains("Open-Meteo"));
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("weatherHours") >= 168);
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("weatherDays") >= 7);
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("temperatureLabels") > 10);
    assertNotNull(RefreshCoordinator.cached(context));
    android.util.Log.i(
        "TimelineLiveWeather",
        "Live Open-Meteo + native widget: " + RenderEngine.lastDiagnostics + " · " + status.get());
  }
}
