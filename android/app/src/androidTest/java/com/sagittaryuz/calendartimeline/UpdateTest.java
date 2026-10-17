package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.test.InstrumentationTestCase;
import java.io.*;
import java.util.*;
import org.json.*;

/** Release fixtures are synthetic. No test publishes or installs a GitHub release. */
public final class UpdateTest extends InstrumentationTestCase {
  static final String CERT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      HASH = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      TAG = "android-v0.3.0-debug",
      APK = "Calendar-Timeline-test.apk";
  Context context;
  SharedPreferences preferences;
  Map<String, ?> before;
  JSONObject manifest;
  JSONArray assets;
  JSONObject release;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    context = getInstrumentation().getTargetContext();
    preferences = context.getSharedPreferences("updates", 0);
    before = new HashMap<>(preferences.getAll());
    preferences.edit().clear().commit();
    manifest =
        new JSONObject()
            .put("format", "calendar-timeline-android-release")
            .put("schemaVersion", 1)
            .put("tested", true)
            .put("applicationId", BackupStore.APP_ID)
            .put("versionCode", 5)
            .put("versionName", "0.3.0-debug")
            .put("minSdk", 26)
            .put("signingCertificateSha256", CERT)
            .put("sha256", HASH)
            .put("buildType", "debug")
            .put("channel", "test")
            .put("apk", APK);
    assets = new JSONArray().put(asset(UpdateRepository.MANIFEST)).put(asset(APK));
    release =
        new JSONObject()
            .put("draft", false)
            .put("prerelease", false)
            .put("tag_name", TAG)
            .put("assets", assets);
  }

  @Override
  protected void tearDown() throws Exception {
    SharedPreferences.Editor e = preferences.edit().clear();
    for (Map.Entry<String, ?> v : before.entrySet()) {
      Object o = v.getValue();
      if (o instanceof String) e.putString(v.getKey(), (String) o);
      else if (o instanceof Long) e.putLong(v.getKey(), (Long) o);
    }
    e.commit();
    super.tearDown();
  }

  JSONObject asset(String name) throws Exception {
    return new JSONObject()
        .put("name", name)
        .put("browser_download_url", UpdateRepository.RELEASES + "/download/" + TAG + "/" + name);
  }

  UpdateRepository repo(long installed, UpdateRepository.Client client) {
    return new UpdateRepository(
        context,
        new UpdateRepository.Installed(BackupStore.APP_ID, "test", installed, CERT, true, 30),
        client);
  }

  UpdateRepository.Client client() {
    return url ->
        new UpdateRepository.Response(
            200,
            url.equals(UpdateRepository.API)
                ? new JSONArray().put(release).toString()
                : manifest.toString());
  }

  public void testVersionComparisonUsesIntegerCodeAndCompatibleIdentity() throws Exception {
    assertEquals(UpdateRepository.State.AVAILABLE, repo(4, client()).check(true, 1000000).state);
    assertEquals(UpdateRepository.State.CURRENT, repo(5, client()).check(true, 1000001).state);
    assertEquals(UpdateRepository.State.CURRENT, repo(100, client()).check(true, 1000002).state);
    manifest.put("signingCertificateSha256", HASH);
    assertEquals(UpdateRepository.State.MIGRATION, repo(4, client()).check(true, 1000003).state);
    manifest.put("signingCertificateSha256", CERT).put("minSdk", 35);
    assertEquals(UpdateRepository.State.UNSUPPORTED, repo(4, client()).check(true, 1000004).state);
  }

  public void testNoReleaseEmptyListAnd404Handled() throws Exception {
    assertEquals(
        UpdateRepository.State.NONE,
        repo(4, url -> new UpdateRepository.Response(200, "[]")).check(true, 1000).state);
    assertEquals(
        UpdateRepository.State.NONE,
        repo(4, url -> new UpdateRepository.Response(404, "")).check(true, 2000).state);
  }

  public void testDraftPrereleaseAndScriptableTagsIgnored() throws Exception {
    release.put("draft", true);
    assertEquals(UpdateRepository.State.NONE, repo(4, client()).check(true, 1).state);
    release.put("draft", false).put("prerelease", true);
    assertEquals(UpdateRepository.State.NONE, repo(4, client()).check(true, 2).state);
    release.put("prerelease", false).put("tag_name", "scriptable-v1");
    assertEquals(UpdateRepository.State.NONE, repo(4, client()).check(true, 3).state);
  }

  public void testUnsafeDownloadLinksRejected() throws Exception {
    String safe = UpdateRepository.RELEASES + "/download/" + TAG + "/" + APK;
    assertTrue(UpdateRepository.safeDownload(safe));
    for (String bad :
        new String[] {
          safe.replace("https:", "http:"),
          safe.replace("github.com", "github.com.evil.example"),
          safe + "?token=secret",
          safe + "#fragment",
          safe.replace("github.com", "user@github.com"),
          safe.replace("github.com", "github.com:443"),
          safe.replace(APK, "%2e%2e%2fother.apk"),
          safe.replace("Calendar-Timeline/releases", "Other/releases"),
          "javascript:alert(1)",
          "file:///data/local/tmp/test.apk"
        }) assertFalse(bad, UpdateRepository.safeDownload(bad));
    assets.getJSONObject(1).put("browser_download_url", "https://evil.example/test.apk");
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 123).state);
  }

  public void testUntestedWrongPackageAndMalformedManifestRejected() throws Exception {
    manifest.put("tested", false);
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 1).state);
    manifest.put("tested", true).put("applicationId", "another.app");
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 2).state);
    manifest.put("applicationId", BackupStore.APP_ID).put("versionCode", 5.5);
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 3).state);
    manifest.put("versionCode", 5).put("sha256", "not-a-hash");
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 4).state);
    manifest.put("sha256", HASH).put("channel", "stable");
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 5).state);
  }

  public void testOfflinePreservesValidatedCandidateAndOriginalTimestamp() throws Exception {
    long now = 100000000L;
    UpdateRepository.Result fresh = repo(4, client()).check(true, now);
    assertEquals(UpdateRepository.State.AVAILABLE, fresh.state);
    UpdateRepository.Result cached =
        repo(
                4,
                url -> {
                  throw new IOException();
                })
            .check(true, now + 1000);
    assertEquals(UpdateRepository.State.AVAILABLE, cached.state);
    assertTrue(cached.cached);
    assertTrue(cached.offline);
    assertEquals(now, cached.checkedAt);
    assertEquals(fresh.candidate.url, cached.candidate.url);
    preferences.edit().clear().commit();
    assertEquals(
        UpdateRepository.State.OFFLINE,
        repo(
                4,
                url -> {
                  throw new IOException();
                })
            .check(true, now)
            .state);
  }

  public void testAutomaticChecksThrottledAndManualCheckRetries() throws Exception {
    final int[] calls = {0};
    UpdateRepository.Client client =
        url -> {
          calls[0]++;
          return new UpdateRepository.Response(200, "[]");
        };
    repo(4, client).check(false, 100000000L);
    repo(4, client).check(false, 100000001L);
    assertEquals(1, calls[0]);
    repo(4, client).check(true, 100000002L);
    assertEquals(2, calls[0]);
  }

  public void testMalformedAndExpiredCacheCannotOfferAnUpdate() throws Exception {
    long now = 1000000000L;
    preferences
        .edit()
        .putLong("checkedAt", now)
        .putLong("attemptedAt", now)
        .putString("state", "AVAILABLE")
        .remove("candidate")
        .commit();
    UpdateRepository.Client noNetwork =
        url -> {
          fail("Unexpected network for a cached check");
          return null;
        };
    assertEquals(UpdateRepository.State.NONE, repo(4, noNetwork).check(false, now + 1).state);
    JSONObject bad =
        new JSONObject()
            .put("versionCode", 5)
            .put("minSdk", 26)
            .put("versionName", "0.3.0")
            .put("certificate", CERT)
            .put("sha256", HASH)
            .put("buildType", "debug")
            .put("url", UpdateRepository.RELEASES + "/download/" + TAG + "/manifest.json");
    preferences.edit().putString("candidate", bad.toString()).commit();
    assertEquals(UpdateRepository.State.NONE, repo(4, noNetwork).check(false, now + 1).state);
    repo(4, client()).check(true, now);
    preferences.edit().putLong("checkedAt", now - 8 * 86400000L).commit();
    assertEquals(UpdateRepository.State.NONE, repo(4, noNetwork).check(false, now + 1).state);
  }

  public void testMissingApkAndHttpErrorsDoNotBecomeDownloadOffers() throws Exception {
    assets.remove(1);
    assertEquals(UpdateRepository.State.INVALID, repo(4, client()).check(true, 1000).state);
    preferences.edit().clear().commit();
    assertEquals(
        UpdateRepository.State.OFFLINE,
        repo(4, url -> new UpdateRepository.Response(403, "")).check(true, 2000).state);
    assertEquals(
        UpdateRepository.State.INVALID,
        repo(4, url -> new UpdateRepository.Response(200, "not json")).check(true, 3000).state);
  }

  public void testInstalledPublicSignatureReadableWithoutKeys() throws Exception {
    UpdateRepository.Installed current = UpdateRepository.Installed.read(context);
    assertEquals(BackupStore.APP_ID, current.packageName);
    assertEquals(64, current.certificate.length());
    assertTrue(current.debug);
    assertTrue(current.code > 0);
  }
}
