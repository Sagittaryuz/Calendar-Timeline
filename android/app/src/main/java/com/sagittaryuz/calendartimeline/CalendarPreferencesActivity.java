package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.widget.*;

/** Local calendar preferences; no account, permission or network changes. */
public final class CalendarPreferencesActivity extends Activity {
  SharedPreferences p;
  CalendarUi ui;

  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    p = getSharedPreferences("settings", 0);
    ui = new CalendarUi(this);
    render();
  }

  void choose(String title, String key, String[] labels, int[] values) {
    new AlertDialog.Builder(this)
        .setTitle(title)
        .setItems(
            labels,
            (d, n) -> {
              p.edit().putInt(key, values[n]).apply();
              render();
            })
        .setNegativeButton("Cancelar", null)
        .show();
  }

  void render() {
    LinearLayout root = ui.column();
    root.setBackground(ui.backdrop());
    root.setFitsSystemWindows(true);
    setContentView(root);
    root.addView(ui.action("‹ Configurações", this::finish));
    ScrollView scroll = new ScrollView(this);
    root.addView(scroll);
    LinearLayout body = ui.column();
    scroll.addView(body);
    ui.title(body, "Preferências");
    LinearLayout group = ui.group(body);
    ui.fieldRow(
        group,
        "Início da semana",
        p.getInt("weekStart", 0) == 1 ? "Segunda-feira" : "Domingo",
        () ->
            choose(
                "Início da semana",
                "weekStart",
                new String[] {"Domingo", "Segunda-feira"},
                new int[] {0, 1}));
    ui.hairline(group);
    ui.fieldRow(
        group,
        "Visualização mensal",
        new String[] {"Compacto", "Empilhado", "Detalhes"}[p.getInt("monthStyle", 2)],
        () ->
            choose(
                "Visualização mensal",
                "monthStyle",
                new String[] {"Compacto", "Empilhado", "Detalhes"},
                new int[] {0, 1, 2}));
    ui.hairline(group);
    ui.fieldRow(
        group,
        "Duração de novos eventos",
        p.getInt("eventMinutes", 60) + " min",
        () ->
            choose(
                "Duração de novos eventos",
                "eventMinutes",
                new String[] {"15 min", "30 min", "60 min", "90 min", "120 min"},
                new int[] {15, 30, 60, 90, 120}));
    ui.hairline(group);
    ui.fieldRow(
        group,
        "Alerta padrão",
        EventEditorActivity.alertLabel(p.getInt("defaultAlert", -1)),
        () ->
            choose(
                "Alerta padrão",
                "defaultAlert",
                EventEditorActivity.ALERT_LABELS,
                EventEditorActivity.ALERTS));
    ui.note(
        body,
        "As preferências se aplicam a novos eventos locais. Eventos existentes mantêm seus horários"
            + " e alertas.");
  }
}
