package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.content.pm.*;
import android.os.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.json.*;

/** Public GitHub metadata only; APK download/install is handed to the user's browser. */
final class UpdateRepository {
  static final String REPO = "Sagittaryuz/Calendar-Timeline";
  static final String RELEASES = "https://github.com/" + REPO + "/releases";
  static final String API = "https://api.github.com/repos/" + REPO + "/releases?per_page=100";
  static final String MANIFEST = "calendar-timeline-update.json";
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();

  interface Client {
    Response get(String url) throws Exception;
  }

  static final class Response {
    final int code;
    final String body;

    Response(int code, String body) {
      this.code = code;
      this.body = body;
    }
  }

  static final class Installed {
    final String packageName, versionName, certificate;
    final long code;
    final boolean debug;
    final int sdk;

    Installed(String p, String v, long c, String cert, boolean d, int sdk) {
      packageName = p;
      versionName = v;
      code = c;
      certificate = cert;
      debug = d;
      this.sdk = sdk;
    }

    static Installed read(Context c) throws Exception {
      PackageInfo p =
          c.getPackageManager()
              .getPackageInfo(
                  c.getPackageName(),
                  Build.VERSION.SDK_INT >= 28
                      ? PackageManager.GET_SIGNING_CERTIFICATES
                      : PackageManager.GET_SIGNATURES);
      android.content.pm.Signature[] signatures =
          Build.VERSION.SDK_INT >= 28 ? p.signingInfo.getApkContentsSigners() : p.signatures;
      if (signatures == null || signatures.length != 1)
        throw new IOException("Assinatura não reconhecida");
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
      StringBuilder hash = new StringBuilder();
      for (byte b : digest) hash.append(String.format(Locale.ROOT, "%02x", b & 255));
      return new Installed(
          c.getPackageName(),
          p.versionName,
          Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode,
          hash.toString(),
          (p.applicationInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0,
          Build.VERSION.SDK_INT);
    }
  }

  static final class Candidate {
    final long code;
    final int minSdk;
    final String name, certificate, url, sha256, buildType;

    Candidate(long c, int sdk, String n, String cert, String url, String hash, String type) {
      code = c;
      minSdk = sdk;
      name = n;
      certificate = cert;
      this.url = url;
      sha256 = hash;
      buildType = type;
    }

    JSONObject json() throws JSONException {
      return new JSONObject()
          .put("versionCode", code)
          .put("minSdk", minSdk)
          .put("versionName", name)
          .put("certificate", certificate)
          .put("url", url)
          .put("sha256", sha256)
          .put("buildType", buildType);
    }
  }

  enum State {
    AVAILABLE,
    CURRENT,
    NONE,
    OFFLINE,
    INVALID,
    MIGRATION,
    UNSUPPORTED
  }

  static final class Result {
    final State state;
    final Candidate candidate;
    final long checkedAt;
    final boolean cached, offline;

    Result(State s, Candidate c, long at, boolean cache) {
      this(s, c, at, cache, false);
    }

    Result(State s, Candidate c, long at, boolean cache, boolean offline) {
      this.offline = offline;
      state = s;
      candidate = c;
      checkedAt = at;
      cached = cache;
    }

    String message() {
      switch (state) {
        case AVAILABLE:
          return ("debug".equals(candidate.buildType) ? "Nova versão de teste: " : "Nova versão: ")
              + candidate.name
              + (cached
                  ? (offline ? " · sem conexão; consulta de " : " · última consulta ")
                      + DataRepository.stamp(checkedAt)
                  : "");
        case CURRENT:
          return "Nenhuma versão mais recente disponível.";
        case NONE:
          return "Ainda não há versão Android publicada para atualização.";
        case OFFLINE:
          return "Não foi possível consultar o GitHub. Verifique a conexão e tente novamente.";
        case MIGRATION:
          return "A versão "
              + candidate.name
              + " usa outra assinatura. Exporte seus dados antes de planejar a migração.";
        case UNSUPPORTED:
          return "A nova versão exige um Android mais recente.";
        default:
          return "A publicação não tem metadados válidos para atualizar este app.";
      }
    }
  }

  final SharedPreferences preferences;
  final Installed installed;
  final Client client;

  UpdateRepository(Context context, Installed installed, Client client) {
    preferences = context.getSharedPreferences("updates", 0);
    this.installed = installed;
    this.client = client;
  }

  static void checkAsync(Context c, boolean force, Consumer<Result> callback) {
    Context app = c.getApplicationContext();
    IO.execute(
        () -> {
          Result result;
          try {
            result =
                new UpdateRepository(app, Installed.read(app), UpdateRepository::request)
                    .check(force, System.currentTimeMillis());
          } catch (Exception ex) {
            result = new Result(State.INVALID, null, 0, false);
          }
          Result finalResult = result;
          new Handler(Looper.getMainLooper()).post(() -> callback.accept(finalResult));
        });
  }

  static void cachedAsync(Context c, Consumer<Result> callback) {
    Context app = c.getApplicationContext();
    IO.execute(
        () -> {
          Result result;
          try {
            result =
                new UpdateRepository(app, Installed.read(app), UpdateRepository::request)
                    .cached(System.currentTimeMillis());
          } catch (Exception ex) {
            result = new Result(State.NONE, null, 0, false);
          }
          Result value = result;
          new Handler(Looper.getMainLooper()).post(() -> callback.accept(value));
        });
  }

  Result check(boolean force, long now) {
    Result cache = cached(now);
    if (!force
        && now >= preferences.getLong("attemptedAt", 0)
        && now - preferences.getLong("attemptedAt", 0) < 24 * 3600000L
        && preferences.contains("attemptedAt")) return cache;
    preferences.edit().putLong("attemptedAt", now).apply();
    try {
      Response list = client.get(API);
      if (list.code == 404) return remember(new Result(State.NONE, null, now, false));
      if (list.code != 200) throw new IOException();
      JSONArray releases = new JSONArray(list.body);
      for (int i = 0; i < releases.length(); i++) {
        JSONObject release = releases.getJSONObject(i);
        if (release.optBoolean("draft", true) || release.optBoolean("prerelease", true)) continue;
        String tag = release.optString("tag_name");
        if (!tag.matches("android-v[0-9][A-Za-z0-9._-]{0,80}")) continue;
        JSONArray assets = release.getJSONArray("assets");
        JSONObject metadata = null;
        for (int j = 0; j < assets.length(); j++) {
          JSONObject asset = assets.getJSONObject(j);
          if (MANIFEST.equals(asset.optString("name"))) {
            metadata = asset;
            break;
          }
        }
        if (metadata == null) continue;
        String manifestUrl = assetUrl(tag, MANIFEST, metadata);
        Response manifest = client.get(manifestUrl);
        if (manifest.code != 200) throw new IOException();
        Candidate candidate =
            parseManifest(new JSONObject(manifest.body), tag, assets, installed.packageName);
        return remember(evaluate(candidate, now, false));
      }
      return remember(new Result(State.NONE, null, now, false));
    } catch (JSONException | IllegalArgumentException ex) {
      return new Result(State.INVALID, null, 0, false);
    } catch (Exception ex) {
      if (cache.candidate != null && cache.state == State.AVAILABLE)
        return new Result(State.AVAILABLE, cache.candidate, cache.checkedAt, true, true);
      return new Result(State.OFFLINE, null, 0, false);
    }
  }

  private Result evaluate(Candidate candidate, long at, boolean cached) {
    if (candidate.code <= installed.code) return new Result(State.CURRENT, null, at, cached);
    if (candidate.minSdk > installed.sdk)
      return new Result(State.UNSUPPORTED, candidate, at, cached);
    if (!candidate.certificate.equals(installed.certificate)
        || ("debug".equals(candidate.buildType) && !installed.debug))
      return new Result(State.MIGRATION, candidate, at, cached);
    return new Result(State.AVAILABLE, candidate, at, cached);
  }

  private Result remember(Result result) throws JSONException {
    SharedPreferences.Editor e =
        preferences
            .edit()
            .putLong("checkedAt", result.checkedAt)
            .putString("state", result.state.name());
    if (result.candidate != null) e.putString("candidate", result.candidate.json().toString());
    else e.remove("candidate");
    e.apply();
    return result;
  }

  private Result cached(long now) {
    long at = preferences.getLong("checkedAt", 0);
    if (at <= 0 || now < at || now - at > 7 * 86400000L)
      return new Result(State.NONE, null, 0, false);
    try {
      String raw = preferences.getString("candidate", null);
      if (raw == null) {
        State state = State.valueOf(preferences.getString("state", "NONE"));
        if (state != State.NONE && state != State.CURRENT)
          return new Result(State.NONE, null, 0, false);
        return new Result(state, null, at, true);
      }
      JSONObject o = new JSONObject(raw);
      String url = o.getString("url");
      if (!safeDownload(url)) throw new JSONException("URL");
      Candidate c =
          new Candidate(
              o.getLong("versionCode"),
              o.getInt("minSdk"),
              o.getString("versionName"),
              o.getString("certificate"),
              url,
              o.getString("sha256"),
              o.getString("buildType"));
      if (!url.endsWith(".apk")
          || c.code < 1
          || c.code > 2100000000L
          || c.minSdk < 26
          || !c.name.matches("[0-9][A-Za-z0-9._+-]{0,79}")
          || !c.certificate.matches("[0-9a-f]{64}")
          || !c.sha256.matches("[0-9a-f]{64}")
          || !("debug".equals(c.buildType) || "release".equals(c.buildType)))
        throw new JSONException("Cache inválido");
      return evaluate(c, at, true);
    } catch (Exception ex) {
      return new Result(State.NONE, null, 0, false);
    }
  }

  static Candidate parseManifest(JSONObject o, String tag, JSONArray assets, String applicationId)
      throws JSONException {
    if (!"calendar-timeline-android-release".equals(o.optString("format"))
        || BackupStore.number(o, "schemaVersion", 1, 1) != 1
        || !BackupStore.bool(o, "tested")
        || !applicationId.equals(o.optString("applicationId")))
      throw new JSONException("Manifesto incompatível");
    long code = BackupStore.number(o, "versionCode", 1, 2100000000L);
    int sdk = (int) BackupStore.number(o, "minSdk", 26, 10000);
    String name = BackupStore.string(o, "versionName", 80),
        cert = BackupStore.string(o, "signingCertificateSha256", 64).toLowerCase(Locale.ROOT),
        hash = BackupStore.string(o, "sha256", 64).toLowerCase(Locale.ROOT),
        type = BackupStore.string(o, "buildType", 10),
        channel = BackupStore.string(o, "channel", 10),
        apk = BackupStore.string(o, "apk", 180);
    if (!name.matches("[0-9][A-Za-z0-9._+-]{0,79}")
        || !cert.matches("[0-9a-f]{64}")
        || !hash.matches("[0-9a-f]{64}")
        || !apk.matches("[A-Za-z0-9][A-Za-z0-9._-]*\\.apk")
        || !("debug".equals(type) && "test".equals(channel)
            || "release".equals(type) && "stable".equals(channel)))
      throw new JSONException("Manifesto inválido");
    for (int i = 0; i < assets.length(); i++) {
      JSONObject asset = assets.getJSONObject(i);
      if (apk.equals(asset.optString("name")))
        return new Candidate(code, sdk, name, cert, assetUrl(tag, apk, asset), hash, type);
    }
    throw new JSONException("APK ausente");
  }

  private static String assetUrl(String tag, String name, JSONObject asset) throws JSONException {
    String expected = RELEASES + "/download/" + tag + "/" + name;
    if (!expected.equals(asset.optString("browser_download_url")) || !safeDownload(expected))
      throw new JSONException("Link inválido");
    return expected;
  }

  static boolean safeDownload(String raw) {
    try {
      URI uri = new URI(raw);
      if (!"https".equals(uri.getScheme())
          || !"github.com".equals(uri.getHost())
          || uri.getPort() != -1
          || uri.getUserInfo() != null
          || uri.getQuery() != null
          || uri.getFragment() != null) return false;
      String prefix = "/" + REPO + "/releases/download/";
      if (!uri.getRawPath().startsWith(prefix)) return false;
      String[] parts = uri.getRawPath().substring(prefix.length()).split("/", -1);
      return parts.length == 2
          && parts[0].matches("android-v[0-9][A-Za-z0-9._-]{0,80}")
          && parts[1].matches("[A-Za-z0-9][A-Za-z0-9._-]*\\.(apk|json)");
    } catch (Exception ex) {
      return false;
    }
  }

  static Response request(String initial) throws Exception {
    if (!API.equals(initial) && !safeDownload(initial)) throw new IOException("URL bloqueada");
    URL url = new URL(initial);
    for (int redirects = 0; redirects <= 3; redirects++) {
      HttpURLConnection c = (HttpURLConnection) url.openConnection();
      c.setConnectTimeout(10000);
      c.setReadTimeout(10000);
      c.setInstanceFollowRedirects(false);
      c.setRequestProperty(
          "Accept", API.equals(initial) ? "application/vnd.github+json" : "application/json");
      c.setRequestProperty("User-Agent", "Calendar-Timeline-Android");
      try {
        int status = c.getResponseCode();
        if (status >= 300 && status < 400) {
          if (API.equals(initial)) throw new IOException("Redirecionamento inesperado");
          URL target = new URL(url, c.getHeaderField("Location"));
          String host = target.getHost();
          if (!"https".equals(target.getProtocol())
              || target.getPort() != -1
              || target.getUserInfo() != null
              || target.getRef() != null
              || !("release-assets.githubusercontent.com".equals(host)
                  || "objects.githubusercontent.com".equals(host)))
            throw new IOException("Redirecionamento bloqueado");
          url = target;
          continue;
        }
        if (status != 200) return new Response(status, "");
        try (InputStream in = c.getInputStream()) {
          return new Response(
              status, DataRepository.readLimited(in, API.equals(initial) ? 2000000 : 64000));
        }
      } finally {
        c.disconnect();
      }
    }
    throw new IOException("Muitos redirecionamentos");
  }
}
