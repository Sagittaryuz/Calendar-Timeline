package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.os.*;
import java.util.*;

/** A bounded approximate fix while an activity is visible. No background tracking. */
final class ForegroundLocation implements LocationListener {
  final Activity activity;
  final LocationManager manager;
  final Handler handler = new Handler(Looper.getMainLooper());
  final SharedPreferences prefs;
  Runnable done;
  boolean active, enableWeather, subscribed;

  ForegroundLocation(Activity activity) {
    this.activity = activity;
    manager = activity.getSystemService(LocationManager.class);
    prefs = activity.getSharedPreferences("settings", 0);
  }

  static boolean allowed(Context c) {
    return c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
        == PackageManager.PERMISSION_GRANTED;
  }

  static boolean usable(Location l, long elapsedNanos) {
    return l != null
        && Double.isFinite(l.getLatitude())
        && Double.isFinite(l.getLongitude())
        && Math.abs(l.getLatitude()) <= 90
        && Math.abs(l.getLongitude()) <= 180
        && l.getElapsedRealtimeNanos() > 0
        && elapsedNanos >= l.getElapsedRealtimeNanos()
        && elapsedNanos - l.getElapsedRealtimeNanos() <= 6 * 3600_000_000_000L;
  }

  void start(boolean enable, Runnable callback) {
    cancel();
    done = callback;
    enableWeather = enable;
    active = true;
    if (!allowed(activity)) {
      finish("Localização não permitida · coordenadas manuais disponíveis");
      return;
    }
    try {
      List<String> providers = manager.getProviders(true);
      Location latest = null;
      for (String provider : providers) {
        // GPS requires precise access. Network/passive estimates suffice for weather.
        if (LocationManager.GPS_PROVIDER.equals(provider)) continue;
        try {
          Location l = manager.getLastKnownLocation(provider);
          if (usable(l, SystemClock.elapsedRealtimeNanos())
              && (latest == null || l.getElapsedRealtimeNanos() > latest.getElapsedRealtimeNanos()))
            latest = l;
        } catch (SecurityException ignored) {
        }
      }
      if (latest != null) {
        onLocationChanged(latest);
        return;
      }
      boolean listening = false;
      for (String provider : providers) {
        if (LocationManager.GPS_PROVIDER.equals(provider)) continue;
        try {
          manager.requestLocationUpdates(provider, 0, 0, this, Looper.getMainLooper());
          subscribed = true;
          listening = true;
        } catch (SecurityException | IllegalArgumentException ignored) {
        }
      }
      if (!listening) {
        finish("Localização do sistema indisponível · informe coordenadas em Configurações");
        return;
      }
      prefs.edit().putString("locationStatus", "Buscando localização aproximada…").apply();
      handler.postDelayed(
          () ->
              finish(
                  "Sem localização recente · ative a localização do sistema ou informe"
                      + " coordenadas"),
          15000);
    } catch (Exception e) {
      finish("Localização indisponível · coordenadas anteriores preservadas");
    }
  }

  @Override
  public void onLocationChanged(Location l) {
    if (!active || !usable(l, SystemClock.elapsedRealtimeNanos())) return;
    SharedPreferences.Editor edit =
        prefs
            .edit()
            .putString("latitude", String.format(Locale.ROOT, "%.2f", l.getLatitude()))
            .putString("longitude", String.format(Locale.ROOT, "%.2f", l.getLongitude()))
            .putLong("locatedAt", System.currentTimeMillis());
    if (enableWeather)
      edit.putBoolean("weather", true)
          .putBoolean("demo", false)
          .putBoolean("weatherPendingLocation", false);
    edit.apply();
    finish("Localização aproximada · " + DataRepository.stamp(System.currentTimeMillis()));
  }

  void finish(String message) {
    if (!active) return;
    prefs.edit().putString("locationStatus", message).apply();
    Runnable callback = done;
    cancel();
    if (callback != null) callback.run();
  }

  void cancel() {
    if (active && prefs.getString("locationStatus", "").startsWith("Buscando"))
      prefs
          .edit()
          .putString("locationStatus", "Localização pausada · tente novamente ao abrir")
          .apply();
    active = false;
    done = null;
    handler.removeCallbacksAndMessages(null);
    if (subscribed) {
      subscribed = false;
      try {
        manager.removeUpdates(this);
      } catch (Exception ignored) {
      }
    }
  }

  @Override
  public void onProviderDisabled(String p) {}

  @Override
  public void onProviderEnabled(String p) {}

  @Override
  public void onStatusChanged(String p, int status, Bundle extras) {}
}
