package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.graphics.Typeface;
import android.os.*;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Native, accessible day/week grid. A long press starts a reversible 15-minute preview. */
final class CalendarTimeline {
  final CalendarActivity host;
  final CalendarUi ui;
  final int days, width, gutter, column, hour;
  final LocalDate first;
  final ZoneId zone = ZoneId.systemDefault();
  final FrameLayout grid;

  static final class EventBlock extends TextView {
    final android.graphics.Paint selectionPaint = new android.graphics.Paint(3);

    EventBlock(android.content.Context context) {
      super(context);
    }

    @Override
    protected void onDraw(android.graphics.Canvas canvas) {
      super.onDraw(canvas);
      if (isSelected()) {
        android.graphics.Paint paint = selectionPaint;
        float radius = 5 * getResources().getDisplayMetrics().density;
        paint.setColor(0xff007aff);
        paint.setStyle(android.graphics.Paint.Style.STROKE);
        paint.setStrokeWidth(2 * getResources().getDisplayMetrics().density);
        canvas.drawRect(1, 1, getWidth() - 1, getHeight() - 1, paint);
        paint.setStyle(android.graphics.Paint.Style.FILL);
        canvas.drawCircle(getWidth() / 2f, radius + 1, radius, paint);
        canvas.drawCircle(getWidth() / 2f, getHeight() - radius - 1, radius, paint);
      }
    }

    @Override
    public boolean performClick() {
      return super.performClick();
    }
  }

  CalendarTimeline(CalendarActivity host, int days, LocalDate first) {
    this.host = host;
    this.ui = host.ui;
    this.days = days;
    this.first = first;
    gutter = ui.dp(48);
    hour = ui.dp(64);
    width =
        Math.max(
            host.getResources().getDisplayMetrics().widthPixels - ui.dp(8),
            gutter + days * ui.dp(days == 1 ? 120 : 84));
    column = (width - gutter) / days;
    LinearLayout contents = ui.column();
    LinearLayout header = ui.column();
    HorizontalScrollView headerScroll = new HorizontalScrollView(host);
    headerScroll.setHorizontalScrollBarEnabled(false);
    headerScroll.addView(header, new android.view.ViewGroup.LayoutParams(width, -2));
    host.pinnedDay.addView(headerScroll);
    HorizontalScrollView horizontal = new HorizontalScrollView(host);
    horizontal.setHorizontalScrollBarEnabled(days > 1);
    horizontal.addView(contents, new android.view.ViewGroup.LayoutParams(width, -2));
    host.body.addView(horizontal);
    horizontal.setOnScrollChangeListener((v, x, y, oldX, oldY) -> headerScroll.scrollTo(x, 0));
    headerScroll.setOnScrollChangeListener((v, x, y, oldX, oldY) -> horizontal.scrollTo(x, 0));
    LinearLayout dates = ui.row();
    dates.setPadding(days == 1 ? 0 : gutter, 0, 0, 0);
    int headerDays = days == 1 ? 7 : days;
    LocalDate headerFirst = days == 1 ? host.weekFirst() : first;
    for (int d = 0; d < headerDays; d++) {
      LocalDate date = headerFirst.plusDays(d);
      TextView t =
          ui.text(
              CalendarActivity.cap(
                  date.format(DateTimeFormatter.ofPattern("EEE d", CalendarActivity.PT))),
              13,
              date.equals(LocalDate.now()) ? ui.red : ui.ink);
      t.setTypeface(null, Typeface.BOLD);
      t.setGravity(Gravity.CENTER);
      if (days == 1 && date.equals(host.selected)) {
        t.setTextColor(ui.dark ? ui.ink : android.graphics.Color.WHITE);
        t.setBackground(ui.round(ui.red, 24));
      }
      dates.addView(
          t,
          new LinearLayout.LayoutParams(
              days == 1 ? width / 7 : column, ui.dp(days == 1 ? 48 : 38)));
      t.setContentDescription("Abrir " + date);
      t.setOnClickListener(
          v -> {
            host.selected = date;
            host.change("DAY");
          });
    }
    header.addView(dates);
    LinearLayout all = ui.row();
    TextView caption = ui.text("dia\ninteiro", 10, ui.muted);
    all.addView(caption, new LinearLayout.LayoutParams(gutter, ui.dp(42)));
    for (int d = 0; d < days; d++) {
      LinearLayout events = ui.column();
      List<CalendarStore.Item> allDayItems = new ArrayList<>();
      for (CalendarStore.Item x : host.on(first.plusDays(d))) if (x.allDay) allDayItems.add(x);
      int shown = 0, allDayLimit = days > 1 ? 1 : 3;
      for (CalendarStore.Item x : allDayItems)
        if (shown++ < allDayLimit) {
          TextView chip = ui.text((x.reminder ? "○ " : "") + x.title, 12, ui.ink);
          chip.setSingleLine();
          chip.setEllipsize(android.text.TextUtils.TruncateAt.END);
          chip.setBackground(ui.round((x.color & 0xffffff) | 0x40000000, 5));
          chip.setPadding(ui.dp(3), 0, ui.dp(3), 0);
          chip.setContentDescription(x.title + ", dia inteiro");
          chip.setMinHeight(ui.dp(32));
          chip.setOnClickListener(v -> host.details(x));
          events.addView(chip);
        }
      if (allDayItems.size() > allDayLimit) {
        TextView more =
            ui.text("+" + (allDayItems.size() - allDayLimit) + " · ver todos", 11, ui.muted);
        more.setMinHeight(ui.dp(32));
        more.setContentDescription("Ver todos os eventos de dia inteiro");
        more.setOnClickListener(
            v -> {
              String[] labels = new String[allDayItems.size()];
              for (int n = 0; n < labels.length; n++) labels[n] = allDayItems.get(n).title;
              new AlertDialog.Builder(host)
                  .setTitle("Dia inteiro")
                  .setItems(labels, (dialog, which) -> host.details(allDayItems.get(which)))
                  .setNegativeButton("Fechar", null)
                  .show();
            });
        events.addView(more);
      }
      all.addView(events, new LinearLayout.LayoutParams(column, -2));
    }
    boolean hasAllDay = false;
    for (int d = 0; d < days; d++)
      for (CalendarStore.Item item : host.on(first.plusDays(d))) if (item.allDay) hasAllDay = true;
    if (hasAllDay) header.addView(all);
    grid =
        new FrameLayout(host) {
          final android.graphics.Paint paint = new android.graphics.Paint(3);

          @Override
          protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas);
            paint.setTextSize(10 * getResources().getDisplayMetrics().scaledDensity);
            paint.setStrokeWidth(Math.max(1, ui.dp(.5f)));
            for (int h = 0; h < 24; h++) {
              paint.setColor(ui.muted);
              canvas.drawText(
                  String.format(CalendarActivity.PT, "%02d:00", h),
                  ui.dp(3),
                  h * hour + ui.dp(9),
                  paint);
              paint.setColor(ui.line);
              canvas.drawLine(gutter, h * hour + ui.dp(7), width, h * hour + ui.dp(7), paint);
            }
            paint.setColor(ui.line);
            for (int d = 0; d <= days; d++)
              canvas.drawLine(gutter + d * column, 0, gutter + d * column, 24 * hour, paint);
          }
        };
    grid.setWillNotDraw(false);
    contents.addView(grid, new LinearLayout.LayoutParams(width, 24 * hour + ui.dp(14)));
    for (int d = 0; d < days; d++) {
      final LocalDate date = first.plusDays(d);
      EventBlock slot = new EventBlock(host);
      slot.setContentDescription("Adicionar evento em " + date);
      final int[] minute = {9 * 60};
      final boolean[] touched = {false};
      slot.setOnTouchListener(
          (v, e) -> {
            if (e.getActionMasked() == MotionEvent.ACTION_UP) {
              minute[0] = Math.max(0, Math.min(1425, Math.round(e.getY() * 4 / hour) * 15));
              touched[0] = true;
            } else if (e.getActionMasked() == MotionEvent.ACTION_CANCEL) touched[0] = false;
            return false;
          });
      slot.setOnClickListener(
          v -> {
            if (touched[0]) {
              touched[0] = false;
              addAt(date, minute[0]);
            } else
              new TimePickerDialog(host, (picker, h, m) -> addAt(date, h * 60 + m), 9, 0, true)
                  .show();
          });
      slot.setAccessibilityDelegate(
          new View.AccessibilityDelegate() {
            @Override
            public void onInitializeAccessibilityNodeInfo(View v, AccessibilityNodeInfo info) {
              super.onInitializeAccessibilityNodeInfo(v, info);
              for (int h = 0; h < 24; h++)
                info.addAction(
                    new AccessibilityNodeInfo.AccessibilityAction(
                        0x01030000 + h, "Adicionar às " + h + " horas"));
            }

            @Override
            public boolean performAccessibilityAction(View v, int action, Bundle args) {
              if (action >= 0x01030000 && action < 0x01030018) {
                addAt(date, (action - 0x01030000) * 60);
                return true;
              }
              return super.performAccessibilityAction(v, action, args);
            }
          });
      FrameLayout.LayoutParams dayBounds = new FrameLayout.LayoutParams(column, 24 * hour);
      dayBounds.leftMargin = gutter + d * column;
      grid.addView(slot, dayBounds);
      List<CalendarStore.Item> items = new ArrayList<>();
      for (CalendarStore.Item x : host.on(date)) if (!x.allDay) items.add(x);
      items.sort(Comparator.comparingLong(x -> x.start));
      for (int from = 0; from < items.size(); ) {
        int to = from + 1;
        long end = items.get(from).end;
        while (to < items.size() && items.get(to).start < end) {
          end = Math.max(end, items.get(to).end);
          to++;
        }
        List<Long> lanes = new ArrayList<>();
        List<Integer> positions = new ArrayList<>();
        for (int i = from; i < to; i++) {
          CalendarStore.Item x = items.get(i);
          int lane = 0;
          while (lane < lanes.size() && lanes.get(lane) > x.start) lane++;
          if (lane == lanes.size()) lanes.add(x.end);
          else lanes.set(lane, x.end);
          positions.add(lane);
        }
        for (int i = from; i < to; i++)
          block(items.get(i), d, positions.get(i - from), lanes.size());
        from = to;
      }
    }
  }

  void addAt(LocalDate date, int minutes) {
    CalendarStore.Item x = host.newItem(false);
    LocalDateTime local = date.atStartOfDay().plusMinutes(minutes);
    if (zone.getRules().getValidOffsets(local).isEmpty()) {
      ui.error(new IllegalArgumentException("Horário inexistente neste fuso."));
      return;
    }
    x.start = local.atZone(zone).toInstant().toEpochMilli();
    x.end = x.start + host.prefs.getInt("eventMinutes", 60) * 60000L;
    host.openEditor(x);
  }

  int minute(long millis, LocalDate date, boolean end) {
    ZonedDateTime t = Instant.ofEpochMilli(millis).atZone(zone);
    if (t.toLocalDate().isBefore(date)) return 0;
    if (t.toLocalDate().isAfter(date)) return 1440;
    return t.getHour() * 60 + t.getMinute();
  }

  void block(CalendarStore.Item x, int day, int lane, int lanes) {
    LocalDate date = first.plusDays(day);
    int top = minute(x.start, date, false) * hour / 60;
    int height =
        Math.max(ui.dp(30), (minute(x.end, date, true) - minute(x.start, date, false)) * hour / 60);
    EventBlock block = new EventBlock(host);
    block.setText(
        (x.reminder ? (x.completed ? "✓ " : "○ ") : "")
            + x.title
            + "\n"
            + Instant.ofEpochMilli(x.start)
                .atZone(zone)
                .format(DateTimeFormatter.ofPattern("HH:mm")));
    block.setTextSize(12);
    block.setTextColor(ui.ink);
    block.setGravity(Gravity.TOP);
    block.setPadding(ui.dp(5), ui.dp(3), ui.dp(3), ui.dp(3));
    block.setMaxLines(Math.max(1, height / ui.dp(15)));
    block.setBackground(ui.round((x.color & 0xffffff) | 0x50000000, 5));
    block.setContentDescription(
        x.title
            + ", "
            + date
            + ", "
            + Instant.ofEpochMilli(x.start).atZone(zone).toLocalTime()
            + ". Toque para detalhes; mantenha para mover.");
    FrameLayout.LayoutParams lp =
        new FrameLayout.LayoutParams(Math.max(ui.dp(22), column / lanes - ui.dp(3)), height);
    lp.leftMargin = gutter + day * column + lane * column / lanes + ui.dp(2);
    lp.topMargin = top;
    grid.addView(block, lp);
    block.setOnClickListener(v -> host.details(x));
    if (!x.editable || x.completed) return;
    block.setAccessibilityDelegate(
        new View.AccessibilityDelegate() {
          @Override
          public void onInitializeAccessibilityNodeInfo(View v, AccessibilityNodeInfo info) {
            super.onInitializeAccessibilityNodeInfo(v, info);
            info.addAction(
                new AccessibilityNodeInfo.AccessibilityAction(
                    0x01020001, "Editar horário e duração"));
            info.addAction(
                new AccessibilityNodeInfo.AccessibilityAction(
                    0x01020002, "Mover 15 minutos depois"));
            info.addAction(
                new AccessibilityNodeInfo.AccessibilityAction(
                    0x01020003, "Aumentar duração em 15 minutos"));
          }

          @Override
          public boolean performAccessibilityAction(View v, int action, Bundle args) {
            if (action == 0x01020001) {
              host.details(x);
              return true;
            }
            if (action == 0x01020002 || action == 0x01020003) {
              CalendarStore.Item edit = x.copy();
              edit.end += 15 * 60000L;
              if (action == 0x01020002) edit.start += 15 * 60000L;
              host.confirmTimeChange(x, edit);
              return true;
            }
            return super.performAccessibilityAction(v, action, args);
          }
        });
    block.setOnTouchListener(
        new View.OnTouchListener() {
          float downX, downY, localY;
          boolean active, abandoned;
          CalendarStore.Item edit;
          int edge;
          final Handler timer = new Handler(Looper.getMainLooper());
          final Runnable activate =
              () -> {
                if (abandoned || !block.isAttachedToWindow() || block.getParent() == null) return;
                active = true;
                block.getParent().requestDisallowInterceptTouchEvent(true);
                block.setAlpha(.65f);
                block.setSelected(true);
                block.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                edge =
                    x.reminder
                        ? 0
                        : localY >= height - ui.dp(14) ? 1 : localY <= ui.dp(10) ? -1 : 0;
                block.announceForAccessibility(edge == 0 ? "Mover evento" : "Alterar duração");
              };

          public boolean onTouch(View v, android.view.MotionEvent e) {
            switch (e.getActionMasked()) {
              case MotionEvent.ACTION_DOWN:
                downX = e.getRawX();
                downY = e.getRawY();
                localY = e.getY();
                active = false;
                abandoned = false;
                edit = null;
                timer.postDelayed(activate, ViewConfiguration.getLongPressTimeout());
                return true;
              case MotionEvent.ACTION_MOVE:
                if (!active) {
                  if (Math.hypot(e.getRawX() - downX, e.getRawY() - downY)
                      > ViewConfiguration.get(host).getScaledTouchSlop()) {
                    abandoned = true;
                    timer.removeCallbacks(activate);
                  }
                  return true;
                }
                int delta = Math.round((e.getRawY() - downY) / hour * 4) * 15;
                int dayDelta =
                    edge == 0
                        ? Math.max(
                            -day,
                            Math.min(days - day - 1, Math.round((e.getRawX() - downX) / column)))
                        : 0;
                edit = x.copy();
                try {
                  if (edge <= 0) edit.start = moved(x.start, dayDelta, delta);
                  if (edge >= 0) edit.end = moved(x.end, dayDelta, delta);
                  if (edit.end <= edit.start) {
                    edit = null;
                    return true;
                  }
                  FrameLayout.LayoutParams preview = new FrameLayout.LayoutParams(lp);
                  preview.topMargin = Math.max(0, top + (edge <= 0 ? delta * hour / 60 : 0));
                  preview.leftMargin =
                      Math.max(gutter, Math.min(width - column, lp.leftMargin + dayDelta * column));
                  preview.height =
                      Math.max(
                          ui.dp(30),
                          height
                              + (edge == 1
                                  ? delta * hour / 60
                                  : edge == -1 ? -delta * hour / 60 : 0));
                  block.setLayoutParams(preview);
                } catch (IllegalArgumentException invalid) {
                  edit = null;
                }
                return true;
              case MotionEvent.ACTION_UP:
                timer.removeCallbacks(activate);
                block.setAlpha(1);
                block.setSelected(false);
                block.setLayoutParams(lp);
                if (block.getParent() != null)
                  block.getParent().requestDisallowInterceptTouchEvent(false);
                if (active && edit != null && (edit.start != x.start || edit.end != x.end))
                  host.confirmTimeChange(x, edit);
                else if (!active && !abandoned) block.performClick();
                abandoned = true;
                return true;
              case MotionEvent.ACTION_CANCEL:
                timer.removeCallbacks(activate);
                active = false;
                abandoned = true;
                edit = null;
                block.setAlpha(1);
                block.setSelected(false);
                block.setLayoutParams(lp);
                if (block.getParent() != null)
                  block.getParent().requestDisallowInterceptTouchEvent(false);
                return true;
              default:
                return true;
            }
          }
        });
  }

  long moved(long millis, int days, int minutes) {
    LocalDateTime target =
        Instant.ofEpochMilli(millis)
            .atZone(zone)
            .toLocalDateTime()
            .plusDays(days)
            .plusMinutes(minutes);
    if (zone.getRules().getValidOffsets(target).isEmpty())
      throw new IllegalArgumentException("Horário inexistente");
    return target.atZone(zone).toInstant().toEpochMilli();
  }
}
