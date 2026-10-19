package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import android.widget.*;
import java.util.*;

/** Transparent first-open choices followed by actual Android permission dialogs. */
public final class OnboardingActivity extends Activity {
  CalendarUi ui;
  android.content.SharedPreferences prefs;
  ForegroundLocation location;
  CheckBox calendar, weather, notifications;
  TextView action, status;
  int step;
  boolean started, waiting;

  @Override
  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ui = new CalendarUi(this);
    prefs = getSharedPreferences("settings", 0);
    location = new ForegroundLocation(this);
    LinearLayout root = ui.column();
    root.setFitsSystemWindows(true);
    root.setBackground(ui.backdrop());
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setFocusableInTouchMode(true);
    LinearLayout body = ui.column();
    body.setPadding(0, ui.dp(20), 0, ui.dp(20));
    scroll.addView(body);
    root.addView(scroll);
    setContentView(root);
    scroll.requestFocus();
    if (saved == null) scroll.post(() -> scroll.fullScroll(android.view.View.FOCUS_UP));
    ui.title(body, "Seu calendário");
    ui.note(
        body,
        "Escolha o que deseja usar. O Android pedirá cada acesso; você pode recusar e continuar.");
    LinearLayout group = ui.group(body);
    calendar =
        choice(
            group,
            "Eventos do Android",
            "Ler agendas já disponíveis no aparelho. Editar eventos pede acesso adicional somente"
                + " ao salvar.",
            true);
    weather =
        choice(
            group,
            "Clima na sua região",
            "Open-Meteo, a fonte já usada no projeto. Usa localização aproximada enquanto o app"
                + " está aberto; envia apenas coordenadas e fuso para a previsão.",
            true);
    notifications =
        choice(
            group,
            "Alertas de lembretes locais",
            "Opcional. Ative se quiser notificações para lembretes com alerta. Não altera a"
                + " exibição no calendário ou widget.",
            false);
    if (Build.VERSION.SDK_INT < 33)
      ui.note(
          body,
          "Nesta versão do Android, notificações são controladas nas configurações do sistema.");
    if (Build.VERSION.SDK_INT < 33 || ReminderAlerts.allowed(this)) notifications.setEnabled(false);
    ui.note(
        body,
        "Lembretes locais ficam neste app, inclusive offline. Lembretes do iCloud, Google Tasks e"
            + " outros apps não são sincronizados nesta versão.");
    status = ui.text("Nenhuma permissão será concedida silenciosamente.", 14, ui.muted);
    status.setPadding(ui.dp(22), ui.dp(12), ui.dp(22), ui.dp(12));
    body.addView(status);
    action =
        ui.action(
            "Continuar",
            () -> {
              if (waiting) {
                location.cancel();
                complete();
              } else if (!started) {
                started = true;
                advance();
              }
            });
    body.addView(action);
    body.addView(ui.action("Usar sem novos acessos", this::complete));
    if (saved != null) {
      calendar.setChecked(saved.getBoolean("calendar"));
      weather.setChecked(saved.getBoolean("weather"));
      notifications.setChecked(saved.getBoolean("notifications"));
      step = saved.getInt("step");
      started = saved.getBoolean("started");
      if (started) {
        lock();
        if (saved.getBoolean("locating")) {
          started = false;
          action.setEnabled(true);
          action.setText("Continuar");
        }
      }
    }
  }

  CheckBox choice(LinearLayout group, String title, String explanation, boolean checked) {
    CheckBox c = new CheckBox(this);
    c.setText(title);
    c.setTextColor(ui.ink);
    c.setTextSize(17);
    c.setMinHeight(ui.dp(52));
    c.setChecked(checked);
    group.addView(c);
    ui.note(group, explanation);
    return c;
  }

  void lock() {
    calendar.setEnabled(false);
    weather.setEnabled(false);
    notifications.setEnabled(false);
    action.setEnabled(false);
  }

  void advance() {
    lock();
    if (step == 0 && (calendar.isChecked() || weather.isChecked()))
      prefs.edit().putBoolean("demo", false).apply();
    while (step < 3) {
      int current = step++;
      boolean selected =
          current == 0
              ? calendar.isChecked()
              : current == 1
                  ? weather.isChecked()
                  : notifications.isChecked() && Build.VERSION.SDK_INT >= 33;
      if (!selected) continue;
      String permission =
          current == 0
              ? Manifest.permission.READ_CALENDAR
              : current == 1
                  ? Manifest.permission.ACCESS_COARSE_LOCATION
                  : Build.VERSION.SDK_INT >= 33 ? Manifest.permission.POST_NOTIFICATIONS : "";
      if (selected && checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(new String[] {permission}, 50);
        return;
      }
    }
    if (weather.isChecked() && ForegroundLocation.allowed(this)) {
      prefs
          .edit()
          .putBoolean("weatherAuto", true)
          .putBoolean("weatherPendingLocation", true)
          .apply();
      waiting = true;
      status.setText("Buscando localização aproximada…");
      action.setText("Continuar sem aguardar");
      action.setEnabled(true);
      location.start(true, this::complete);
    } else complete();
  }

  @Override
  public void onRequestPermissionsResult(int r, String[] p, int[] grants) {
    super.onRequestPermissionsResult(r, p, grants);
    if (r == 50) {
      if (grants.length == 0 || grants[0] != PackageManager.PERMISSION_GRANTED)
        status.setText("Acesso recusado. Você pode continuar e rever em Configurações.");
      advance();
    }
  }

  void complete() {
    location.cancel();
    waiting = false;
    prefs.edit().putBoolean("onboardingV5", true).apply();
    ReminderAlerts.schedule(this);
    finish();
  }

  @Override
  protected void onSaveInstanceState(Bundle b) {
    super.onSaveInstanceState(b);
    b.putBoolean("calendar", calendar.isChecked());
    b.putBoolean("weather", weather.isChecked());
    b.putBoolean("notifications", notifications.isChecked());
    b.putInt("step", step);
    b.putBoolean("started", started);
    b.putBoolean("locating", waiting);
  }

  @Override
  protected void onStop() {
    location.cancel();
    super.onStop();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (waiting && !location.active) location.start(true, this::complete);
  }

  @Override
  public void onBackPressed() {
    complete();
  }
}
