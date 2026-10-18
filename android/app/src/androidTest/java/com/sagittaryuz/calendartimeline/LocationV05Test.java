package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import android.test.InstrumentationTestCase;
import java.util.*;
import java.util.concurrent.*;

/** Requires explicit opt-in, coarse grant and mock-location app-op on a disposable AVD. */
public final class LocationV05Test extends InstrumentationTestCase {
  public void testApproximateSystemProviderEnablesWeatherAndCancelStopsWrites() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("locationQa"))) return;
    Context c = getInstrumentation().getTargetContext();
    assertTrue(ForegroundLocation.allowed(c));
    SharedPreferences p = c.getSharedPreferences("settings", 0);
    Map<String, ?> original = new HashMap<>(p.getAll());
    LocationManager manager = c.getSystemService(LocationManager.class);
    MainActivity activity = null;
    try {
      p.edit()
          .putBoolean("weather", false)
          .putBoolean("demo", false)
          .putBoolean("weatherAuto", false)
          .commit();
      manager.addTestProvider(
          "network",
          false,
          false,
          true,
          false,
          false,
          false,
          false,
          Criteria.POWER_LOW,
          Criteria.ACCURACY_COARSE);
      manager.setTestProviderEnabled("network", true);
      CountDownLatch warmed = new CountDownLatch(1);
      RefreshCoordinator.refresh(c, (image, message) -> warmed.countDown());
      assertTrue(warmed.await(240, TimeUnit.SECONDS));
      activity =
          (MainActivity)
              getInstrumentation()
                  .startActivitySync(
                      new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      ForegroundLocation fix = new ForegroundLocation(activity);
      CountDownLatch done = new CountDownLatch(1);
      getInstrumentation().runOnMainSync(() -> fix.start(true, done::countDown));
      Location location = new Location("network");
      location.setLatitude(-17.8814);
      location.setLongitude(-51.7144);
      location.setTime(System.currentTimeMillis());
      location.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
      location.setAccuracy(1000);
      manager.setTestProviderLocation("network", location);
      assertTrue("Approximate provider fix timeout", done.await(25, TimeUnit.SECONDS));
      assertTrue(
          p.getString("locationStatus", ""),
          p.getString("locationStatus", "").contains("aproximada"));
      assertTrue(p.getBoolean("weather", false));
      assertFalse(p.getBoolean("weatherPendingLocation", true));
      assertFalse(p.getBoolean("demo", true));
      assertEquals(-17.88, Double.parseDouble(p.getString("latitude", "0")), .06);
      String before = p.getString("latitude", "");
      getInstrumentation()
          .runOnMainSync(
              () -> {
                fix.active = true;
                fix.cancel();
                fix.onLocationChanged(location);
              });
      assertEquals(before, p.getString("latitude", ""));
      assertFalse(fix.active);
    } finally {
      manager.removeTestProvider("network");
      if (activity != null) {
        Activity close = activity;
        getInstrumentation().runOnMainSync(close::finish);
      }
      SharedPreferences.Editor e = p.edit().clear();
      for (Map.Entry<String, ?> entry : original.entrySet()) {
        Object v = entry.getValue();
        String k = entry.getKey();
        if (v instanceof Boolean) e.putBoolean(k, (Boolean) v);
        else if (v instanceof Integer) e.putInt(k, (Integer) v);
        else if (v instanceof Long) e.putLong(k, (Long) v);
        else if (v instanceof Float) e.putFloat(k, (Float) v);
        else if (v instanceof Set) e.putStringSet(k, (Set<String>) v);
        else e.putString(k, (String) v);
      }
      e.commit();
    }
  }
}
