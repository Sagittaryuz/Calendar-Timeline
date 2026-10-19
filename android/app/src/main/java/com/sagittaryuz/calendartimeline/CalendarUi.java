package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.*;
import android.widget.*;

/** Own native controls, system fonts and drawn icons; no Apple assets. */
final class CalendarUi {
  final Activity a;
  final boolean dark;
  final int bg, card, ink, muted, line, soft, red;

  CalendarUi(Activity a) {
    this.a = a;
    dark =
        (a.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
    bg = dark ? 0xff101012 : 0xfff9f9fb;
    card = dark ? 0xff202023 : 0xffffffff;
    ink = dark ? 0xfff5f5f7 : 0xff151517;
    muted = dark ? 0xffa2a2a9 : 0xff666670;
    line = dark ? 0xff343437 : 0xffe4e4e8;
    soft = dark ? 0xff303034 : 0xffeeeef0;
    red = dark ? 0xffff6961 : 0xffc52e26;
    a.getWindow().setStatusBarColor(bg);
    a.getWindow().setNavigationBarColor(bg);
    a.getWindow()
        .getDecorView()
        .setSystemUiVisibility(
            dark
                ? 0
                : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  }

  int dp(float n) {
    return Math.round(n * a.getResources().getDisplayMetrics().density);
  }

  LinearLayout column() {
    LinearLayout v = new LinearLayout(a);
    v.setOrientation(LinearLayout.VERTICAL);
    return v;
  }

  LinearLayout row() {
    LinearLayout v = new LinearLayout(a);
    v.setOrientation(LinearLayout.HORIZONTAL);
    v.setGravity(Gravity.CENTER_VERTICAL);
    return v;
  }

  GradientDrawable round(int color, float radius) {
    GradientDrawable g = new GradientDrawable();
    g.setColor(color);
    g.setCornerRadius(dp(radius));
    return g;
  }

  GradientDrawable backdrop() {
    return new GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        dark ? new int[] {0xff151b26, bg, 0xff20191c} : new int[] {0xffeef4ff, bg, 0xfffff2ee});
  }

  /** Layered frosted surfaces; opaque enough for text even without platform blur. */
  android.graphics.drawable.Drawable glass(float radius) {
    GradientDrawable g =
        new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            dark
                ? new int[] {0xf2414652, 0xf2222630, 0xf2343038}
                : new int[] {0xfaffffff, 0xf2eef2fa, 0xfafaf3f1});
    g.setCornerRadius(dp(radius));
    g.setStroke(dp(1), dark ? 0xff626774 : 0xffffffff);
    return new RippleDrawable(ColorStateList.valueOf(dark ? 0x334f91ff : 0x224979bb), g, null);
  }

  void frost(View view, float radius) {
    view.setBackground(glass(radius));
    view.setElevation(dp(3));
    view.setClipToOutline(true);
  }

  TextView text(String s, float size, int color) {
    TextView v = new TextView(a);
    v.setText(s);
    v.setTextSize(size);
    v.setTextColor(color);
    v.setGravity(Gravity.CENTER_VERTICAL);
    return v;
  }

  TextView action(String s, Runnable run) {
    TextView v = text(s, 16, red);
    v.setPadding(dp(14), dp(10), dp(14), dp(10));
    v.setMinHeight(dp(48));
    v.setGravity(Gravity.CENTER);
    frost(v, 24);
    v.setOnClickListener(w -> run.run());
    return v;
  }

  View icon(String type, String description, Runnable run) {
    View v =
        new View(a) {
          final Paint p = new Paint(3);

          @Override
          protected void onDraw(Canvas original) {
            super.onDraw(original);
            Canvas c = original;
            c.save();
            c.translate(getWidth() / 2f, getHeight() / 2f);
            c.scale(dp(1), dp(1));
            p.setColor(ink);
            p.setStrokeWidth(2);
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeCap(Paint.Cap.ROUND);
            if (type.equals("search")) {
              c.drawCircle(-2, -2, 7, p);
              c.drawLine(3, 3, 10, 10, p);
            } else if (type.equals("plus")) {
              c.drawLine(-9, 0, 9, 0, p);
              c.drawLine(0, -9, 0, 9, p);
            } else if (type.equals("close")) {
              c.drawLine(-7, -7, 7, 7, p);
              c.drawLine(-7, 7, 7, -7, p);
            } else if (type.equals("check")) {
              p.setColor(red);
              c.drawLine(-8, 0, -2, 7, p);
              c.drawLine(-2, 7, 9, -8, p);
            } else if (type.equals("list")) {
              for (int y = -7; y <= 7; y += 7) c.drawLine(-9, y, 9, y, p);
            } else if (type.equals("back")) {
              c.drawLine(4, -8, -4, 0, p);
              c.drawLine(-4, 0, 4, 8, p);
            } else if (type.equals("next")) {
              c.drawLine(-4, -8, 4, 0, p);
              c.drawLine(4, 0, -4, 8, p);
            } else if (type.equals("settings")) {
              c.drawCircle(0, 0, 7, p);
              c.drawCircle(0, 0, 2.5f, p);
              for (int i = 0; i < 8; i++) {
                double angle = i * Math.PI / 4;
                c.drawLine(
                    (float) Math.cos(angle) * 7,
                    (float) Math.sin(angle) * 7,
                    (float) Math.cos(angle) * 10,
                    (float) Math.sin(angle) * 10,
                    p);
              }
            } else {
              c.drawCircle(0, 0, 8, p);
              c.drawCircle(0, 0, 2, p);
            }
            c.restore();
          }
        };
    v.setContentDescription(description);
    frost(v, 25);
    v.setLayoutParams(new LinearLayout.LayoutParams(dp(48), dp(48)));
    v.setOnClickListener(w -> run.run());
    return v;
  }

  void hairline(LinearLayout into) {
    View lineView = new View(a);
    lineView.setBackgroundColor(line);
    into.addView(lineView, new LinearLayout.LayoutParams(-1, dp(0.5f)));
  }

  LinearLayout group(LinearLayout parent) {
    LinearLayout g = column();
    g.setPadding(dp(16), dp(4), dp(16), dp(4));
    frost(g, 22);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.setMargins(dp(16), dp(10), dp(16), dp(6));
    parent.addView(g, lp);
    return g;
  }

  TextView fieldRow(LinearLayout group, String label, String value, Runnable run) {
    LinearLayout r = row();
    TextView l = text(label, 16, ink);
    r.addView(l, new LinearLayout.LayoutParams(0, dp(52), 1));
    TextView v = text(value + (run == null ? "" : "  ›"), 15, muted);
    v.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
    v.setMaxLines(2);
    r.addView(v, new LinearLayout.LayoutParams(0, -2, 1.4f));
    if (run != null) {
      r.setContentDescription(label + ": " + value);
      r.setOnClickListener(w -> run.run());
    }
    group.addView(r);
    return v;
  }

  void note(LinearLayout parent, String message) {
    TextView t = text(message, 13, muted);
    t.setPadding(dp(22), dp(10), dp(22), dp(12));
    parent.addView(t);
  }

  void title(LinearLayout parent, String s) {
    TextView t = text(s, 32, ink);
    t.setTypeface(null, Typeface.BOLD);
    t.setPadding(dp(20), dp(12), dp(20), dp(10));
    parent.addView(t);
  }

  void error(Exception e) {
    new AlertDialog.Builder(a)
        .setTitle("Não foi possível concluir")
        .setMessage(
            e instanceof SecurityException
                ? "A permissão de agenda não está disponível. Você pode continuar com lembretes"
                    + " locais."
                : e instanceof IllegalArgumentException
                    ? e.getMessage()
                    : "Os dados foram preservados. Tente novamente.")
        .setPositiveButton("OK", null)
        .show();
  }
}
