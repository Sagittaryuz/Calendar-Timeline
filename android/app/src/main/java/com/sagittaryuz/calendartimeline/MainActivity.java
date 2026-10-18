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
  private CalendarUi ui;
  private ForegroundLocation location;
  private TextView locationState;
  private Switch automatic;
  private LinearLayout content;
  private ImageView preview;
  private TextView status, updateNotice;
  private boolean bindingSettings;
  private long restoredAt, locatedAt;
  private ScrollView scroll;
  private TextView weatherHeading;
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
    ui = new CalendarUi(this);
    location = new ForegroundLocation(this);
    restoredAt = preferences.getLong("restoredAt", 0);
    locatedAt = preferences.getLong("locatedAt", 0);
    scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setFocusableInTouchMode(true);
    scroll.requestFocus();
    content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(dp(20), dp(12), dp(20), dp(28));
    scroll.addView(content);
    content.setBackground(ui.backdrop());
    setContentView(scroll);
    scroll.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
          return insets;
        });
    button("‹ Calendário", this::finish);
    label("Configurações", 28, true);
    button(
        "Preferências do calendário",
        () -> startActivity(new Intent(this, CalendarPreferencesActivity.class)));
    button(
        "Permissões e primeiros passos",
        () -> startActivity(new Intent(this, OnboardingActivity.class)));
    button(
        "Permissões no Android",
        () ->
            startActivity(
                new Intent(
                    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.parse("package:" + getPackageName()))));
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
    String initialStatus = WeatherRepository.summary(new DataRepository(this));
    status = label(initialStatus, 12, false);
    updateNotice = label("", 13, false);
    updateNotice.setVisibility(View.GONE);
    updateNotice.setOnClickListener(
        v -> startActivity(new Intent(this, MaintenanceActivity.class)));
    button("Adicionar widget à tela inicial", () -> pinWidget());
    button(
        "Atualizar agora",
        () -> {
          if (saveSettings()) {
            ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(content.getWindowToken(), 0);
            scroll.smoothScrollTo(0, 0);
            refresh(true);
          }
        });
    demo = new Switch(this);
    demo.setText("Demonstração · agenda e clima fictícios");
    demo.setTextColor(ui.ink);
    demo.setChecked(preferences.getBoolean("demo", false));
    content.addView(demo);
    demo.setOnCheckedChangeListener(
        (v, checked) -> {
          if (bindingSettings) return;
          preferences.edit().putBoolean("demo", checked).apply();
          refresh();
        });
    button(
        "Configurar clima",
        () -> {
          ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
              .hideSoftInputFromWindow(content.getWindowToken(), 0);
          weatherHeading.requestFocus();
          scroll.smoothScrollTo(0, weatherHeading.getTop());
        });
    button(
        "Backup e atualizações", () -> startActivity(new Intent(this, MaintenanceActivity.class)));
    label("Fontes", 19, true);
    button(
        "Permitir leitura da agenda",
        () -> requestPermissions(new String[] {Manifest.permission.READ_CALENDAR}, 10));
    label(
        "Eventos: agendas disponíveis no Android. Lembretes locais e fontes externas em Fontes de"
            + " lembretes. Contas externas dependem de configuração e consentimento próprios.",
        12,
        false);
    label(reminderStatus(), 13, false);
    button("Lembretes locais", () -> showReminders());
    button("Fontes de lembretes", () -> startActivity(new Intent(this, TaskSourcesActivity.class)));
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
    weatherHeading = label("Clima · Open-Meteo", 19, true);
    automatic = new Switch(this);
    automatic.setText("Atualizar localização ao abrir o calendário");
    automatic.setTextColor(ui.ink);
    automatic.setChecked(preferences.getBoolean("weatherAuto", false));
    automatic.setOnCheckedChangeListener(
        (v, checked) -> {
          if (bindingSettings) return;
          android.content.SharedPreferences.Editor edit =
              preferences.edit().putBoolean("weatherAuto", checked);
          if (!checked) edit.putBoolean("weatherPendingLocation", false);
          edit.apply();
        });
    content.addView(automatic);
    button("Usar localização automática", this::useLocation);
    locationState =
        label(
            preferences.getString(
                "locationStatus", "Localização aproximada somente com o app aberto"),
            13,
            false);
    weather = new Switch(this);
    weather.setText("Ativar previsão real do Open-Meteo");
    weather.setTextColor(ui.ink);
    weather.setChecked(preferences.getBoolean("weather", false));
    content.addView(weather);
    label(
        "Ao ativar e salvar, envia somente as coordenadas abaixo ao Open-Meteo para buscar a"
            + " previsão. Nenhum evento ou lembrete é enviado. Localização aproximada é opcional;"
            + " as coordenadas manuais também funcionam. Salvar com clima real desliga a"
            + " demonstração.",
        12,
        false);
    label("Latitude · de -90 a 90", 14, false);
    latitude =
        field(
            "Latitude",
            preferences.getString("latitude", ""),
            InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL
                | InputType.TYPE_NUMBER_FLAG_SIGNED);
    label("Longitude · de -180 a 180", 14, false);
    longitude =
        field(
            "Longitude",
            preferences.getString("longitude", ""),
            InputType.TYPE_CLASS_NUMBER
                | InputType.TYPE_NUMBER_FLAG_DECIMAL
                | InputType.TYPE_NUMBER_FLAG_SIGNED);
    configureCoordinateField(latitude);
    configureCoordinateField(longitude);
    weather.setOnCheckedChangeListener(
        (v, checked) -> {
          latitude.setEnabled(checked);
          longitude.setEnabled(checked);
        });
    latitude.setEnabled(weather.isChecked());
    longitude.setEnabled(weather.isChecked());
    button(
        "Salvar configuração",
        () -> {
          if (saveSettings()) {
            ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(content.getWindowToken(), 0);
            scroll.smoothScrollTo(0, 0);
            refresh(true);
          }
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
    view.setTextColor(bold ? ui.ink : ui.muted);
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
    view.setTextColor(ui.ink);
    view.setHintTextColor(ui.muted);
    view.setText(text);
    content.addView(view, new LinearLayout.LayoutParams(-1, dp(50)));
    return view;
  }

  // Preserve pasted decimal separators and Unicode minus for validation on Save.
  // A locale-specific DigitsKeyListener can silently remove these characters.
  static void configureCoordinateField(EditText field) {
    field.setKeyListener(android.text.method.TextKeyListener.getInstance());
    field.setRawInputType(
        InputType.TYPE_CLASS_NUMBER
            | InputType.TYPE_NUMBER_FLAG_DECIMAL
            | InputType.TYPE_NUMBER_FLAG_SIGNED);
  }

  private void button(String title, Runnable action) {
    TextView b = ui.action(title, action);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
    params.setMargins(0, dp(5), 0, dp(5));
    content.addView(b, params);
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
      editor.putBoolean("weatherPendingLocation", false);
      if (weather.isChecked()) {
        double lat = WeatherRepository.coordinate(latitude.getText().toString(), 90),
            lon = WeatherRepository.coordinate(longitude.getText().toString(), 180);
        if (!Double.isFinite(lat)
            || !Double.isFinite(lon)
            || Math.abs(lat) > 90
            || Math.abs(lon) > 180) throw new IllegalArgumentException();
        editor
            .putString("latitude", String.valueOf(lat))
            .putString("longitude", String.valueOf(lon));
        // Manual edits select a fixed location; do not silently replace them on resume.
        if (!String.valueOf(lat).equals(preferences.getString("latitude", ""))
            || !String.valueOf(lon).equals(preferences.getString("longitude", ""))) {
          editor.putBoolean("weatherAuto", false);
          automatic.setChecked(false);
        }
      }
      if (weather.isChecked() && demo.isChecked()) {
        demo.setChecked(false);
        editor.putBoolean("demo", false);
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
    refresh(false);
  }

  private void refresh(boolean forceWeather) {
    if (forceWeather || RefreshCoordinator.cached(this) == null) status.setText("Atualizando…");
    RefreshCoordinator.refresh(
        this,
        (image, message) -> {
          if (isDestroyed()) return;
          if (image != null) preview.setImageBitmap(image);
          status.setText(message);
        },
        forceWeather);
  }

  private void showReminders() {
    startActivity(
        new Intent(this, CalendarActivity.class)
            .putExtra("remindersView", true)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(request, permissions, grants);
    if (request == 12) {
      if (ForegroundLocation.allowed(this)) acquireLocation();
      else locationState.setText("Localização recusada · informe coordenadas manualmente");
    }
    refresh();
  }

  String reminderStatus() {
    try {
      long count = new ReminderStore(this).all().stream().filter(x -> !x.completed).count();
      return "Lembretes locais pendentes: "
          + count
          + (preferences.getBoolean("showReminders", true)
              ? " · visíveis"
              : " · ocultos em Calendários");
    } catch (Exception e) {
      return "Não foi possível ler os lembretes locais; os dados foram preservados.";
    }
  }

  void useLocation() {
    if (ForegroundLocation.allowed(this)) acquireLocation();
    else
      new AlertDialog.Builder(this)
          .setTitle("Clima na sua região")
          .setMessage(
              "Permita localização aproximada para consultar a previsão Open-Meteo. Usa somente com"
                  + " o app aberto, sem rastrear em segundo plano. Você pode recusar e informar"
                  + " coordenadas.")
          .setNegativeButton("Agora não", null)
          .setPositiveButton(
              "Continuar",
              (d, w) ->
                  requestPermissions(new String[] {Manifest.permission.ACCESS_COARSE_LOCATION}, 12))
          .show();
  }

  void acquireLocation() {
    preferences
        .edit()
        .putBoolean("weatherAuto", true)
        .putBoolean("weatherPendingLocation", true)
        .apply();
    automatic.setChecked(true);
    locationState.setText("Buscando localização aproximada…");
    location.start(
        true,
        () -> {
          if (isDestroyed()) return;
          bindingSettings = true;
          latitude.setText(preferences.getString("latitude", ""));
          longitude.setText(preferences.getString("longitude", ""));
          weather.setChecked(preferences.getBoolean("weather", false));
          demo.setChecked(preferences.getBoolean("demo", false));
          bindingSettings = false;
          locationState.setText(preferences.getString("locationStatus", ""));
          refresh(true);
        });
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (locationState != null)
      locationState.setText(
          preferences.getString(
              "locationStatus", "Localização aproximada somente com o app aberto"));
    if (hours != null
        && (restoredAt != preferences.getLong("restoredAt", 0)
            || locatedAt != preferences.getLong("locatedAt", 0))) {
      bindingSettings = true;
      hours.setText(String.valueOf(preferences.getInt("hours", 24)));
      theme.setSelection("dark".equals(preferences.getString("theme", "black")) ? 1 : 0);
      demo.setChecked(preferences.getBoolean("demo", false));
      weather.setChecked(preferences.getBoolean("weather", false));
      latitude.setText(preferences.getString("latitude", ""));
      longitude.setText(preferences.getString("longitude", ""));
      bindingSettings = false;
      restoredAt = preferences.getLong("restoredAt", 0);
      locatedAt = preferences.getLong("locatedAt", 0);
      automatic.setChecked(preferences.getBoolean("weatherAuto", false));
      refresh();
    }
    if (preferences.getBoolean("checkUpdates", true)) {
      UpdateRepository.checkAsync(
          this,
          false,
          result -> {
            if (isDestroyed()) return;
            if (result.state == UpdateRepository.State.AVAILABLE) {
              updateNotice.setText(result.message() + " · toque para abrir");
              updateNotice.setVisibility(View.VISIBLE);
            } else updateNotice.setVisibility(View.GONE);
          });
    } else updateNotice.setVisibility(View.GONE);
    // Onboarding can change these choices even when no location fix was obtained.
    bindingSettings = true;
    demo.setChecked(preferences.getBoolean("demo", false));
    automatic.setChecked(preferences.getBoolean("weatherAuto", false));
    bindingSettings = false;
    refresh();
    handler.postDelayed(tick, 60000);
  }

  @Override
  protected void onPause() {
    handler.removeCallbacks(tick);
    location.cancel();
    super.onPause();
  }

  int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
