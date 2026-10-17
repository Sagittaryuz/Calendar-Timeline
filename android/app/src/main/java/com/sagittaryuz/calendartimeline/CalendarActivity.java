package com.sagittaryuz.calendartimeline;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

public final class CalendarActivity extends Activity {
  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    try {
      Intent calendar =
          new Intent(
              Intent.ACTION_VIEW,
              Uri.parse("content://com.android.calendar/time/" + System.currentTimeMillis()));
      calendar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(calendar);
    } catch (ActivityNotFoundException ex) {
      try {
        startActivity(
            Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALENDAR));
      } catch (ActivityNotFoundException missing) {
        Toast.makeText(this, "Nenhum aplicativo de Calendário instalado", Toast.LENGTH_LONG).show();
        startActivity(new Intent(this, MainActivity.class));
      }
    }
    finish();
  }
}
