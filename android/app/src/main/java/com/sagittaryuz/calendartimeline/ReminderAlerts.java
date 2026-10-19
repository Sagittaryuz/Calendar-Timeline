package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.*;

/** Inexact offline reminders: no exact-alarm privilege and no background network. */
public final class ReminderAlerts extends BroadcastReceiver {
  static final String CHANNEL = "local-reminders";

  static PendingIntent alarm(Context c) {
    return PendingIntent.getBroadcast(
        c,
        70,
        new Intent(c, ReminderAlerts.class).setAction("local-reminders"),
        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
  }

  static boolean allowed(Context c) {
    return (Build.VERSION.SDK_INT < 33
            || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED)
        && c.getSystemService(NotificationManager.class).areNotificationsEnabled();
  }

  static long trigger(CalendarStore.Item x) {
    return x.start - x.alert * 60000L;
  }

  static long signature(CalendarStore.Item x) {
    return x.allDay ? x.date().toEpochDay() * 86400000L - x.alert * 60000L : trigger(x);
  }

  static void schedule(Context c) {
    AlarmManager alarms = c.getSystemService(AlarmManager.class);
    alarms.cancel(alarm(c));
    if (!allowed(c)) return;
    try {
      long next = Long.MAX_VALUE, now = System.currentTimeMillis();
      SharedPreferences p = c.getSharedPreferences("reminder-alerts", 0);
      for (CalendarStore.Item x : new ReminderStore(c).all())
        if (!x.completed
            && x.alert >= 0
            && trigger(x) >= now - 86400000L
            && p.getLong(x.localId, Long.MIN_VALUE) != signature(x))
          next = Math.min(next, Math.max(now + 1000, trigger(x)));
      if (next < Long.MAX_VALUE)
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm(c));
    } catch (Exception ignored) {
      /* No personal data in logs. */
    }
  }

  @Override
  public void onReceive(Context c, Intent intent) {
    if (!"local-reminders".equals(intent.getAction())) {
      schedule(c);
      return;
    }
    if (!allowed(c)) return;
    NotificationManager manager = c.getSystemService(NotificationManager.class);
    manager.createNotificationChannel(
        new NotificationChannel(
            CHANNEL, "Lembretes locais", NotificationManager.IMPORTANCE_DEFAULT));
    try {
      long now = System.currentTimeMillis();
      SharedPreferences p = c.getSharedPreferences("reminder-alerts", 0);
      for (CalendarStore.Item x : new ReminderStore(c).all())
        if (!x.completed
            && x.alert >= 0
            && trigger(x) <= now
            && trigger(x) >= now - 86400000L
            && p.getLong(x.localId, Long.MIN_VALUE) != signature(x)) {
          PendingIntent tap =
              PendingIntent.getActivity(
                  c,
                  x.localId.hashCode(),
                  new Intent(c, CalendarActivity.class).putExtra("date", x.start),
                  PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
          manager.notify(
              x.localId,
              1,
              new Notification.Builder(c, CHANNEL)
                  .setSmallIcon(R.drawable.ic_calendar)
                  .setContentTitle(x.title)
                  .setContentText("Lembrete · Calendar Timeline")
                  .setContentIntent(tap)
                  .setAutoCancel(true)
                  .setVisibility(Notification.VISIBILITY_PRIVATE)
                  .build());
          p.edit().putLong(x.localId, signature(x)).apply();
        }
    } catch (Exception ignored) {
    }
    schedule(c);
  }
}
