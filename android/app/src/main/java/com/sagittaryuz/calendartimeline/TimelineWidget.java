package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

public final class TimelineWidget extends AppWidgetProvider {
  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    String a = intent.getAction();
    if (Intent.ACTION_BOOT_COMPLETED.equals(a)
        || Intent.ACTION_TIME_CHANGED.equals(a)
        || Intent.ACTION_TIMEZONE_CHANGED.equals(a)
        || Intent.ACTION_DATE_CHANGED.equals(a)) {
      if (AppWidgetManager.getInstance(context)
              .getAppWidgetIds(new ComponentName(context, TimelineWidget.class))
              .length
          > 0) RefreshJob.schedule(context, true);
    }
  }

  @Override
  public void onEnabled(Context c) {
    RefreshJob.schedule(c, true);
  }

  @Override
  public void onUpdate(Context c, AppWidgetManager manager, int[] ids) {
    publishAll(c);
    RefreshJob.schedule(c, true);
  }

  @Override
  public void onAppWidgetOptionsChanged(
      Context c, AppWidgetManager manager, int id, Bundle options) {
    publish(c, manager, id);
    RefreshJob.schedule(c, true);
  }

  @Override
  public void onDisabled(Context c) {
    RefreshJob.cancel(c);
  }

  static void publishAll(Context c) {
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    for (int id : m.getAppWidgetIds(new ComponentName(c, TimelineWidget.class))) publish(c, m, id);
  }

  static void publish(Context c, AppWidgetManager manager, int id) {
    RemoteViews views = new RemoteViews(c.getPackageName(), R.layout.timeline_widget);
    Bitmap image = RefreshCoordinator.cached(c);
    if (image != null) {
      Bundle options = manager.getAppWidgetOptions(id);
      int dp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 360);
      float density = c.getResources().getDisplayMetrics().density;
      int width = Math.min(1092, Math.max(360, (int) (dp * density)));
      Bitmap scaled =
          Bitmap.createScaledBitmap(image, width, Math.round(width * 510f / 1092), true);
      views.setImageViewBitmap(R.id.timeline, scaled);
      views.setViewVisibility(R.id.empty, View.GONE);
    }
    Intent tap = new Intent(c, image == null ? MainActivity.class : CalendarActivity.class);
    PendingIntent pending =
        PendingIntent.getActivity(
            c, id, tap, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.timeline, pending);
    views.setOnClickPendingIntent(R.id.empty, pending);
    manager.updateAppWidget(id, views);
  }
}
