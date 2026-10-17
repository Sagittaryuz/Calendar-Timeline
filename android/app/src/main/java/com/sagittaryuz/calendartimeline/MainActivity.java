package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.format.*;
import org.json.*;

public final class MainActivity extends Activity {
  private LinearLayout content;
  private ImageView preview;
  private TextView status;
  private EditText hours, latitude, longitude;
  private Switch demo, weather;
  private Spinner theme;
  private android.content.SharedPreferences preferences;
  private final Handler handler = new Handler();
  private final Runnable tick =
      new Runnable() {
        public void run() {
          refresh();
          handler.postDelayed(this, 60000);
        }
      };

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    preferences = getSharedPreferences("settings", 0);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(dp(20), dp(12), dp(20), dp(28));
    scroll.addView(content);
    setContentView(scroll);
    scroll.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
          return insets;
        });
    label("Calendar Timeline", 28, true);
    label("Sua agenda, ao longo do dia.", 15, false);
    preview = new ImageView(this);
    preview.setContentDescription("Prévia do Calendar Timeline");
    preview.setAdjustViewBounds(true);
    preview.setScaleType(ImageView.ScaleType.FIT_CENTER);
    LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(-1, -2);
    imageParams.topMargin = dp(24);
    imageParams.bottomMargin = dp(10);
    content.addView(preview, imageParams);
    android.graphics.Bitmap cached = RefreshCoordinator.cached(this);
    if (cached != null) preview.setImageBitmap(cached);
    status = label("Preparando timeline…", 12, false);
    button("Adicionar widget à tela inicial", () -> pinWidget());
    button(
        "Atualizar agora",
        () -> {
          if (saveSettings()) refresh();
        });
    demo = new Switch(this);
    demo.setText("Demonstração com dados fictícios");
    demo.setChecked(preferences.getBoolean("demo", false));
    content.addView(demo);
    demo.setOnCheckedChangeListener(
        (v, checked) -> {
          preferences.edit().putBoolean("demo", checked).apply();
          refresh();
        });
    label("Fontes", 19, true);
    button(
        "Permitir leitura da agenda",
        () -> requestPermissions(new String[] {Manifest.permission.READ_CALENDAR}, 10));
    label("Somente leitura. A agenda e os lembretes ficam neste aparelho.", 12, false);
    button("Lembretes locais", () -> showReminders());
    label("Janela da timeline · 1 a 96 horas", 14, false);
    hours =
        field(
            "Horas", String.valueOf(preferences.getInt("hours", 24)), InputType.TYPE_CLASS_NUMBER);
    label("Tema", 14, false);
    theme = new Spinner(this);
    ArrayAdapter<String> adapter =
        new ArrayAdapter<>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            new String[] {"Preto original", "Escuro"});
    theme.setAdapter(adapter);
    theme.setSelection("dark".equals(preferences.getString("theme", "black")) ? 1 : 0);
    content.addView(theme);
    label("Fuso: " + ZoneId.systemDefault().toString() + " · segue o aparelho", 12, false);
    weather = new Switch(this);
    weather.setText("Clima do Open-Meteo");
    weather.setChecked(preferences.getBoolean("weather", false));
    content.addView(weather);
    label(
        "Ao ativar e salvar, envia somente as coordenadas abaixo ao Open-Meteo para buscar a"
            + " previsão. Nenhum evento é enviado. Não solicita GPS.",
        12,
        false);
    latitude =
        field(
            "Latitude",
            preferences.getString("latitude", ""),
            InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL
                | InputType.TYPE_NUMBER_FLAG_SIGNED);
    longitude =
        field(
            "Longitude",
            preferences.getString("longitude", ""),
            InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL
                | InputType.TYPE_NUMBER_FLAG_SIGNED);
    button(
        "Salvar configuração",
        () -> {
          if (saveSettings()) refresh();
        });
    label(
        "Clima: Open-Meteo · CC BY 4.0. Fonte: sans-serif do Android. Atualizações em segundo plano"
            + " dependem da bateria e do sistema. O formato 4 × 2 preserva melhor as proporções da"
            + " referência.",
        12,
        false);
    refresh();
  }

  private TextView label(String text, int size, boolean bold) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(size);
    view.setTextColor(bold ? Color.WHITE : Color.rgb(172, 180, 194));
    if (bold) view.setTypeface(null, Typeface.BOLD);
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.topMargin = dp(bold ? 18 : 6);
    p.bottomMargin = dp(6);
    content.addView(view, p);
    return view;
  }

  private EditText field(String hint, String text, int input) {
    EditText view = new EditText(this);
    view.setHint(hint);
    view.setContentDescription(hint);
    view.setSingleLine(true);
    view.setInputType(input);
    view.setText(text);
    content.addView(view, new LinearLayout.LayoutParams(-1, dp(50)));
    return view;
  }

  private void button(String title, Runnable action) {
    Button b = new Button(this);
    b.setText(title);
    b.setAllCaps(false);
    b.setOnClickListener(v -> action.run());
    content.addView(b, new LinearLayout.LayoutParams(-1, dp(52)));
  }

  private boolean saveSettings() {
    try {
      int h = Integer.parseInt(hours.getText().toString());
      if (h < 1 || h > 96) throw new IllegalArgumentException();
      android.content.SharedPreferences.Editor editor =
          preferences
              .edit()
              .putInt("hours", h)
              .putString("theme", theme.getSelectedItemPosition() == 0 ? "black" : "dark")
              .putBoolean("weather", weather.isChecked());
      if (weather.isChecked()) {
        double lat = Double.parseDouble(latitude.getText().toString().replace(',', '.')),
            lon = Double.parseDouble(longitude.getText().toString().replace(',', '.'));
        if (!Double.isFinite(lat)
            || !Double.isFinite(lon)
            || Math.abs(lat) > 90
            || Math.abs(lon) > 180) throw new IllegalArgumentException();
        editor
            .putString("latitude", String.valueOf(lat))
            .putString("longitude", String.valueOf(lon));
      }
      editor.apply();
      return true;
    } catch (Exception ex) {
      Toast.makeText(this, "Confira as horas (1–96) e as coordenadas do clima.", Toast.LENGTH_LONG)
          .show();
      return false;
    }
  }

  private void pinWidget() {
    if (saveSettings()) {
      refresh();
      AppWidgetManager manager = AppWidgetManager.getInstance(this);
      if (manager.isRequestPinAppWidgetSupported())
        manager.requestPinAppWidget(new ComponentName(this, TimelineWidget.class), null, null);
      else
        new AlertDialog.Builder(this)
            .setMessage(
                "Na tela inicial, mantenha uma área vazia pressionada, abra Widgets e escolha"
                    + " Calendar Timeline.")
            .setPositiveButton("Entendi", null)
            .show();
    }
  }

  private void refresh() {
    status.setText("Atualizando…");
    RefreshCoordinator.refresh(
        this,
        (image, message) -> {
          if (isDestroyed()) return;
          if (image != null) preview.setImageBitmap(image);
          status.setText(message);
        });
  }

  private void showReminders() {
    try {
      JSONArray items = new JSONArray(preferences.getString("reminders", "[]"));
      String[] titles = new String[items.length() + 1];
      titles[0] = "+ Novo lembrete";
      for (int i = 0; i < items.length(); i++)
        titles[i + 1] = items.getJSONObject(i).optString("title");
      new AlertDialog.Builder(this)
          .setTitle("Lembretes locais")
          .setItems(
              titles,
              (dialog, index) -> {
                if (index == 0) addReminder();
                else {
                  new AlertDialog.Builder(this)
                      .setMessage("Concluir este lembrete?")
                      .setNegativeButton("Cancelar", null)
                      .setPositiveButton(
                          "Concluir",
                          (d, w) -> {
                            items.remove(index - 1);
                            preferences.edit().putString("reminders", items.toString()).apply();
                            refresh();
                          })
                      .show();
                }
              })
          .setNegativeButton("Fechar", null)
          .show();
    } catch (JSONException ex) {
      Toast.makeText(this, "Lista indisponível", Toast.LENGTH_SHORT).show();
    }
  }

  private void addReminder() {
    LinearLayout form = new LinearLayout(this);
    form.setPadding(dp(20), 0, dp(20), 0);
    form.setOrientation(LinearLayout.VERTICAL);
    EditText title = new EditText(this);
    title.setHint("Título");
    form.addView(title);
    EditText date = new EditText(this);
    date.setHint("Data e hora · aaaa-MM-dd HH:mm");
    date.setText(
        LocalDateTime.now().plusHours(1).format(DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm")));
    form.addView(date);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle("Novo lembrete local")
            .setView(form)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Salvar", null)
            .create();
    dialog.setOnShowListener(
        d ->
            dialog
                .getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(
                    v -> {
                      try {
                        String text = title.getText().toString().trim();
                        if (text.isEmpty()) throw new IllegalArgumentException();
                        long due =
                            LocalDateTime.parse(
                                    date.getText().toString(),
                                    DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm")
                                        .withResolverStyle(ResolverStyle.STRICT))
                                .atZone(ZoneId.systemDefault())
                                .toInstant()
                                .toEpochMilli();
                        JSONArray items = new JSONArray(preferences.getString("reminders", "[]"));
                        items.put(
                            new JSONObject()
                                .put("identifier", java.util.UUID.randomUUID().toString())
                                .put("title", text)
                                .put("dueDate", due)
                                .put("dueDateIncludesTime", true)
                                .put(
                                    "calendar",
                                    new JSONObject()
                                        .put("title", "Lembretes locais")
                                        .put("identifier", "local")
                                        .put("color", new JSONObject().put("hex", "FF9F0A"))));
                        preferences.edit().putString("reminders", items.toString()).apply();
                        dialog.dismiss();
                        refresh();
                      } catch (Exception ex) {
                        Toast.makeText(this, "Informe título e data válidos.", Toast.LENGTH_LONG)
                            .show();
                      }
                    }));
    dialog.show();
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(request, permissions, grants);
    refresh();
  }

  @Override
  protected void onResume() {
    super.onResume();
    handler.postDelayed(tick, 60000);
  }

  @Override
  protected void onPause() {
    handler.removeCallbacks(tick);
    super.onPause();
  }

  int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
