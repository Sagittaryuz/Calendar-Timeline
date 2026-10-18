package com.sagittaryuz.calendartimeline;

import android.content.Context;
import android.graphics.*;
import android.view.View;
import java.time.*;

/** A whole miniature month is one accessible month button, avoiding 500 year-grid controls. */
final class MiniMonthView extends View {
  final YearMonth month;
  final CalendarUi ui;
  final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

  MiniMonthView(Context context, YearMonth month, CalendarUi ui, Runnable open) {
    super(context);
    this.month = month;
    this.ui = ui;
    setContentDescription(
        month
            .atDay(1)
            .format(
                java.time.format.DateTimeFormatter.ofPattern(
                    "MMMM 'de' uuuu", CalendarActivity.PT)));
    setFocusable(true);
    setOnClickListener(v -> open.run());
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    float width = getWidth() / 7f, height = getHeight() / 7f;
    paint.setTextAlign(Paint.Align.CENTER);
    paint.setTypeface(Typeface.DEFAULT);
    paint.setTextSize(9 * getResources().getDisplayMetrics().scaledDensity);
    Paint.FontMetrics metrics = paint.getFontMetrics();
    paint.setColor(ui.muted);
    String[] weekdays = {"D", "S", "T", "Q", "Q", "S", "S"};
    for (int i = 0; i < 7; i++)
      canvas.drawText(
          weekdays[i],
          (i + .5f) * width,
          height * .5f - (metrics.ascent + metrics.descent) / 2,
          paint);
    int offset = month.atDay(1).getDayOfWeek().getValue() % 7;
    LocalDate today = LocalDate.now();
    for (int day = 1; day <= month.lengthOfMonth(); day++) {
      int slot = offset + day - 1, column = slot % 7, row = slot / 7 + 1;
      float x = (column + .5f) * width, y = (row + .5f) * height;
      boolean current = month.atDay(day).equals(today);
      if (current) {
        paint.setColor(ui.red);
        canvas.drawCircle(x, y, Math.min(width, height) * .47f, paint);
      }
      paint.setColor(current ? Color.WHITE : (column == 0 || column == 6) ? ui.muted : ui.ink);
      canvas.drawText(Integer.toString(day), x, y - (metrics.ascent + metrics.descent) / 2, paint);
    }
  }
}
