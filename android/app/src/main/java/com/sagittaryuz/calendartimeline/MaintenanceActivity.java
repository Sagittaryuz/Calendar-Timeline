package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.*;
import android.widget.*;
import java.io.*;
import java.time.LocalDate;
import java.util.concurrent.*;

/** Backup files are read/written only after the system document picker returns a user choice. */
public final class MaintenanceActivity extends Activity {
  private static final int EXPORT = 51, IMPORT = 52;
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();
  private LinearLayout content;
  private TextView updateStatus, backupStatus;
  private Button check, download, export, restore;
  private UpdateRepository.Candidate candidate;
  private String version = "";
  private boolean checking;
  private Switch autoUpdates;

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    ScrollView scroll = new ScrollView(this);
    content = new LinearLayout(this);
    content.setOrientation(LinearLayout.VERTICAL);
    content.setPadding(dp(20), dp(20), dp(20), dp(32));
    scroll.addView(content);
    setContentView(scroll);
    scroll.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
          return insets;
        });
    text("Backup e atualizações", 25, true);
    try {
      UpdateRepository.Installed app = UpdateRepository.Installed.read(this);
      version = app.versionName;
      text("Calendar Timeline · " + version + (app.debug ? " · versão de teste" : ""), 13, false);
    } catch (Exception ex) {
      text("Calendar Timeline", 13, false);
    }
    text("Atualizações", 19, true);
    text(
        "Versões testadas publicadas no GitHub Releases. O download abre no navegador; a instalação"
            + " depende da confirmação do Android.",
        13,
        false);
    Switch auto = new Switch(this);
    autoUpdates = auto;
    auto.setText("Verificar ao abrir · até uma vez por dia");
    auto.setChecked(getSharedPreferences("settings", 0).getBoolean("checkUpdates", true));
    content.addView(auto);
    auto.setOnCheckedChangeListener(
        (v, enabled) ->
            getSharedPreferences("settings", 0).edit().putBoolean("checkUpdates", enabled).apply());
    updateStatus = text("Toque em Verificar nova versão para consultar o GitHub.", 13, false);
    check = button("Verificar nova versão", this::checkUpdate);
    download = button("Abrir download no GitHub", this::download);
    download.setVisibility(android.view.View.GONE);
    button("Ver versões no GitHub", () -> openBrowser(UpdateRepository.RELEASES));
    text("Backup", 19, true);
    text(
        "Arquivo JSON com configurações salvas, coordenadas e lembretes locais. Você escolhe onde"
            + " guardar. Não inclui a agenda do Android nem suas permissões.",
        13,
        false);
    backupStatus =
        text(
            "A importação substitui as configurações e os lembretes locais após sua confirmação.",
            13,
            false);
    export = button("Exportar backup", () -> chooseExport());
    restore = button("Importar backup", () -> chooseImport());
    button("Voltar à timeline", this::finish);
    UpdateRepository.cachedAsync(
        this,
        result -> {
          if (isDestroyed() || checking || result.checkedAt == 0) return;
          showUpdate(result);
        });
  }

  private void checkUpdate() {
    checking = true;
    check.setEnabled(false);
    download.setVisibility(android.view.View.GONE);
    candidate = null;
    updateStatus.setText("Consultando GitHub…");
    UpdateRepository.checkAsync(
        this,
        true,
        result -> {
          if (isDestroyed()) return;
          checking = false;
          check.setEnabled(true);
          showUpdate(result);
        });
  }

  private void showUpdate(UpdateRepository.Result result) {
    updateStatus.setText(result.message());
    candidate = result.state == UpdateRepository.State.AVAILABLE ? result.candidate : null;
    download.setVisibility(candidate == null ? android.view.View.GONE : android.view.View.VISIBLE);
  }

  private void download() {
    if (candidate == null
        || !candidate.url.endsWith(".apk")
        || !UpdateRepository.safeDownload(candidate.url)) return;
    String url = candidate.url;
    new AlertDialog.Builder(this)
        .setTitle(
            "debug".equals(candidate.buildType) ? "Baixar versão de teste" : "Baixar atualização")
        .setMessage(
            "Versão "
                + candidate.name
                + ". O navegador abrirá o APK publicado no GitHub. Confirme a instalação no Android"
                + " para atualizar o app.")
        .setNegativeButton("Cancelar", null)
        .setPositiveButton("Abrir download", (d, w) -> openBrowser(url))
        .show();
  }

  private void openBrowser(String url) {
    try {
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      intent.addCategory(Intent.CATEGORY_BROWSABLE);
      startActivity(intent);
    } catch (ActivityNotFoundException ex) {
      updateStatus.setText("Nenhum navegador disponível para abrir o GitHub.");
    }
  }

  private void chooseExport() {
    Intent intent =
        new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, "Calendar-Timeline-backup-" + LocalDate.now() + ".json");
    try {
      startActivityForResult(intent, EXPORT);
    } catch (ActivityNotFoundException ex) {
      backupStatus.setText("Nenhum seletor de arquivos disponível.");
    }
  }

  private void chooseImport() {
    Intent intent =
        new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .putExtra(
                Intent.EXTRA_MIME_TYPES,
                new String[] {"application/json", "text/plain", "application/octet-stream"});
    try {
      startActivityForResult(intent, IMPORT);
    } catch (ActivityNotFoundException ex) {
      backupStatus.setText("Nenhum seletor de arquivos disponível.");
    }
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request != EXPORT && request != IMPORT) return;
    if (result != RESULT_OK) {
      backupStatus.setText("Operação cancelada. Seus dados foram mantidos.");
      return;
    }
    Uri uri = data == null ? null : data.getData();
    if (uri == null || !"content".equals(uri.getScheme())) {
      backupStatus.setText("Arquivo não disponível. Seus dados foram mantidos.");
      return;
    }
    busy(true);
    backupStatus.setText(request == EXPORT ? "Salvando backup…" : "Validando backup…");
    if (request == EXPORT)
      IO.execute(
          () -> {
            try {
              byte[] bytes = new BackupStore(this).export(version);
              try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException();
                out.write(bytes);
                out.flush();
              }
              done("Backup salvo no arquivo escolhido.");
            } catch (Exception ex) {
              done(
                  "Não foi possível salvar o backup. O arquivo pode estar incompleto; tente"
                      + " novamente.");
            }
          });
    else
      IO.execute(
          () -> {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
              if (in == null) throw new IOException();
              BackupStore.Payload payload = BackupStore.read(in);
              runOnUiThread(
                  () -> {
                    if (isDestroyed()) return;
                    busy(false);
                    confirmImport(payload);
                  });
            } catch (Exception ex) {
              done("Backup inválido, incompatível ou inacessível. Nenhum dado foi importado.");
            }
          });
  }

  private void confirmImport(BackupStore.Payload payload) {
    String message =
        payload.reminders.length()
            + " lembrete(s) · janela de "
            + payload.settings.optInt("hours")
            + " horas.\n\n"
            + "Substituir as configurações e os lembretes locais atuais? A agenda do Android não"
            + " será alterada.";
    if (payload.activatesWeather())
      message +=
          "\n\n"
              + "O clima está habilitado no backup. Quando a demonstração estiver desligada,"
              + " importar autoriza consultar o Open-Meteo com as coordenadas desse arquivo.";
    backupStatus.setText("Backup válido. Aguardando sua confirmação.");
    new AlertDialog.Builder(this)
        .setTitle("Importar backup?")
        .setMessage(message)
        .setNegativeButton(
            "Cancelar",
            (d, w) -> backupStatus.setText("Importação cancelada. Seus dados foram mantidos."))
        .setOnCancelListener(
            d -> backupStatus.setText("Importação cancelada. Seus dados foram mantidos."))
        .setPositiveButton(
            payload.activatesWeather() ? "Importar com clima" : "Importar",
            (d, w) -> {
              busy(true);
              backupStatus.setText("Importando…");
              IO.execute(
                  () -> {
                    try {
                      new BackupStore(this).restore(payload);
                      runOnUiThread(
                          () -> {
                            RefreshCoordinator.refresh(getApplicationContext(), null);
                            if (!isDestroyed()) {
                              busy(false);
                              autoUpdates.setChecked(
                                  getSharedPreferences("settings", 0)
                                      .getBoolean("checkUpdates", true));
                              backupStatus.setText("Backup importado. Atualizando o widget…");
                            }
                          });
                    } catch (Exception ex) {
                      done("Não foi possível salvar a importação. Tente novamente.");
                    }
                  });
            })
        .show();
  }

  private void done(String message) {
    runOnUiThread(
        () -> {
          if (!isDestroyed()) {
            busy(false);
            backupStatus.setText(message);
          }
        });
  }

  private void busy(boolean value) {
    export.setEnabled(!value);
    restore.setEnabled(!value);
  }

  private TextView text(String value, int size, boolean bold) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(bold ? Color.WHITE : Color.rgb(172, 180, 194));
    if (bold) t.setTypeface(null, Typeface.BOLD);
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.topMargin = dp(bold ? 18 : 8);
    p.bottomMargin = dp(8);
    content.addView(t, p);
    return t;
  }

  private Button button(String title, Runnable action) {
    Button b = new Button(this);
    b.setText(title);
    b.setAllCaps(false);
    b.setOnClickListener(v -> action.run());
    content.addView(b, new LinearLayout.LayoutParams(-1, dp(52)));
    return b;
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
