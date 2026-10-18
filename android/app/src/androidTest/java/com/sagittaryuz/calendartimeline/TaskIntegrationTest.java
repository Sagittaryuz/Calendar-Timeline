package com.sagittaryuz.calendartimeline;

import android.content.*;
import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.json.*;

/** Opt-in synthetic tasks on a disposable AVD; never signs in or uses a real account/token. */
public final class TaskIntegrationTest extends CalendarUiTest {
  ExternalTaskStore store;
  byte[] before;
  String oldReminders;
  boolean oldDemo, oldWeather;
  File file;

  boolean enabled() {
    return "true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("providersQa"));
  }

  @Override
  protected void setUp() throws Exception {
    if (!enabled()) return;
    context = getInstrumentation().getTargetContext();
    store = new ExternalTaskStore(context);
    assertTrue("Use a disposable AVD without external accounts", store.accounts().isEmpty());
    file = new File(context.getFilesDir(), ExternalTaskStore.FILE);
    before = file.exists() ? Files.readAllBytes(file.toPath()) : null;
    android.content.SharedPreferences p = context.getSharedPreferences("settings", 0);
    oldReminders = p.getString("reminders", "[]");
    oldDemo = p.getBoolean("demo", false);
    oldWeather = p.getBoolean("weather", false);
    p.edit()
        .putString("reminders", "[]")
        .putBoolean("demo", false)
        .putBoolean("weather", false)
        .commit();
  }

  @Override
  protected void tearDown() throws Exception {
    if (!enabled()) return;
    if (before == null) new DataRepository(context).delete(ExternalTaskStore.FILE);
    else Files.write(file.toPath(), before);
    context
        .getSharedPreferences("settings", 0)
        .edit()
        .putString("reminders", oldReminders)
        .putBoolean("demo", oldDemo)
        .putBoolean("weather", oldWeather)
        .commit();
    TaskAuth.MEMORY.clear();
  }

  JSONObject google(String id) throws Exception {
    return new JSONObject()
        .put("id", id)
        .put("title", "TAREFA SINTÉTICA " + id)
        .put("etag", "\"v1\"")
        .put("updated", "2026-10-18T10:00:00Z")
        .put("status", "needsAction");
  }

  TaskRecord record(JSONObject raw) throws Exception {
    return new TaskRecord("google", "synthetic-account", "list", "Lista sintética", raw);
  }

  Map<String, String> selected() {
    return Collections.singletonMap("list", "Lista sintética");
  }

  String authorize() throws Exception {
    store.authorize("google", "synthetic-account", "Conta sintética", true);
    store.select("google", "synthetic-account", selected());
    return store.account("google", "synthetic-account").getString("generation");
  }

  void snapshot(List<TaskRecord> rows, String generation) throws Exception {
    store.snapshot("google", "synthetic-account", selected(), rows, generation);
  }

  public void testIdentityIncludesProviderAccountListAndTask() throws Exception {
    if (!enabled()) return;
    Set<String> keys = new HashSet<>();
    for (String provider : new String[] {"google", "microsoft"})
      for (String account : new String[] {"a", "b"})
        for (String list : new String[] {"x", "y"})
          keys.add(TaskRecord.identity(provider, account, list, "same"));
    assertEquals(8, keys.size());
    assertEquals(
        TaskRecord.identity("microsoft", "a", "x", "same"),
        TaskRecord.identity("microsoft", "a", "x", "same"));
  }

  public void testGoogleDateDoesNotInventTimeOrShiftCivilDay() throws Exception {
    if (!enabled()) return;
    TimeZone before = TimeZone.getDefault();
    try {
      for (String zone : new String[] {"America/Sao_Paulo", "Pacific/Auckland"}) {
        TimeZone.setDefault(TimeZone.getTimeZone(zone));
        TaskRecord r = record(google("date").put("due", "2026-10-18T23:00:00Z"));
        assertEquals(
            LocalDate.of(2026, 10, 18),
            Instant.ofEpochMilli(r.scheduledAt()).atZone(ZoneId.systemDefault()).toLocalDate());
        assertTrue(r.item().allDay);
        assertFalse(r.widget().getBoolean("dueDateIncludesTime"));
      }
    } finally {
      TimeZone.setDefault(before);
    }
  }

  public void testUndatedAndCompletedAreNotFabricatedInWidget() throws Exception {
    if (!enabled()) return;
    TaskRecord r = record(google("none"));
    assertNull(r.item());
    assertNull(r.widget());
    assertEquals("Sem data", TaskSourcesActivity.date(r));
    TaskRecord done =
        record(
            google("done")
                .put("due", "2026-10-18T00:00:00Z")
                .put("status", "completed")
                .put("hidden", true));
    assertNull(done.widget());
    assertTrue(done.completed());
    assertTrue(done.raw.getBoolean("hidden"));
  }

  public void testSourceHierarchyNotesAndUnknownFieldsPreserved() throws Exception {
    if (!enabled()) return;
    JSONObject raw =
        google("child")
            .put("parent", "parent-id")
            .put("position", "001")
            .put("notes", "NOTA SINTÉTICA")
            .put("futureField", new JSONObject().put("value", 2));
    TaskRecord r = TaskRecord.decode(record(raw).encode());
    assertEquals(raw.toString(), r.raw.toString());
    assertEquals("parent-id", r.raw.getString("parent"));
  }

  public void testGraphTimeZoneAndRawRecurrencePreserved() throws Exception {
    if (!enabled()) return;
    JSONObject recurrence =
        new JSONObject().put("pattern", new JSONObject().put("type", "weekly").put("interval", 2));
    JSONObject raw =
        new JSONObject()
            .put("id", "graph")
            .put("title", "SÉRIE SINTÉTICA")
            .put("status", "notStarted")
            .put("recurrence", recurrence)
            .put(
                "dueDateTime",
                new JSONObject()
                    .put("dateTime", "2026-10-18T10:30:00")
                    .put("timeZone", "E. South America Standard Time"));
    TaskRecord r =
        new TaskRecord("microsoft", "synthetic-account", "list", "Samsung via To Do", raw);
    assertTrue(r.recurring());
    assertNotNull(r.scheduledAt());
    assertEquals(recurrence.toString(), r.raw.getJSONObject("recurrence").toString());
    assertFalse(r.item().editable);
    assertEquals("", r.item().rule);
  }

  public void testUnknownZoneDoesNotBecomeUtcOrEpoch() throws Exception {
    if (!enabled()) return;
    assertNull(
        TaskRecord.graphTime(
            new JSONObject()
                .put("dateTime", "2026-10-18T10:30:00")
                .put("timeZone", "Unknown/Unsupported")));
  }

  public void testGooglePaginatesHiddenDeletedAndAssigned() throws Exception {
    if (!enabled()) return;
    List<String> urls = new ArrayList<>();
    TaskApi api =
        new TaskApi(
            "google",
            "synthetic-account",
            "synthetic-token",
            (method, url, token, body, etag) -> {
              urls.add(url);
              return new JSONObject()
                  .put("kind", "tasks#tasks")
                  .put(
                      "items",
                      new JSONArray().put(google(url.contains("pageToken=") ? "second" : "first")))
                  .put("nextPageToken", url.contains("pageToken=") ? "" : "cursor +/");
            });
    List<TaskRecord> rows = api.snapshot(selected());
    assertEquals(2, rows.size());
    assertEquals(2, urls.size());
    assertTrue(urls.get(0).contains("showHidden=true"));
    assertTrue(urls.get(0).contains("showDeleted=true"));
    assertTrue(urls.get(0).contains("showAssigned=true"));
    assertTrue(urls.get(1).contains("cursor%20%2B%2F"));
  }

  public void testMaliciousContinuationNeverReceivesToken() throws Exception {
    if (!enabled()) return;
    int[] calls = {0};
    TaskApi api =
        new TaskApi(
            "microsoft",
            "a",
            "synthetic-token",
            (m, u, t, b, e) -> {
              calls[0]++;
              return new JSONObject()
                  .put("value", new JSONArray())
                  .put("@odata.nextLink", "https://other.invalid/steal");
            });
    try {
      api.lists();
      fail();
    } catch (IOException expected) {
    }
    assertEquals(1, calls[0]);
    for (String url :
        new String[] {
          "http://graph.microsoft.com/v1.0/me/todo/lists",
          "https://user@tasks.googleapis.com/tasks/v1/users/@me/lists",
          "https://tasks.googleapis.com:443/tasks/v1/lists",
          "https://graph.microsoft.com/v1.0/me/todo/lists#x"
        })
      try {
        TaskApi.safe(url);
        fail(url);
      } catch (IOException | java.net.URISyntaxException expected) {
      }
  }

  public void testPaginationCycleRejected() throws Exception {
    if (!enabled()) return;
    int[] calls = {0};
    TaskApi api =
        new TaskApi(
            "google",
            "a",
            "synthetic-token",
            (m, u, t, b, e) -> {
              calls[0]++;
              return new JSONObject()
                  .put("kind", "tasks#taskLists")
                  .put("items", new JSONArray())
                  .put("nextPageToken", "same");
            });
    try {
      api.lists();
      fail();
    } catch (IOException expected) {
    }
    assertEquals(2, calls[0]);
  }

  public void testPartialFetchFailureKeepsSnapshotAndTimestamp() throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    snapshot(Collections.singletonList(record(google("old"))), generation);
    String before = store.read().toString();
    TaskApi api =
        new TaskApi(
            "google",
            "synthetic-account",
            "synthetic-token",
            (m, u, t, b, e) -> {
              if (u.contains("pageToken")) throw new TaskApi.Failure(503);
              return new JSONObject()
                  .put("kind", "tasks#tasks")
                  .put("items", new JSONArray().put(google("new")))
                  .put("nextPageToken", "next");
            });
    try {
      snapshot(api.snapshot(selected()), generation);
      fail();
    } catch (TaskApi.Failure expected) {
    }
    assertEquals(before, store.read().toString());
  }

  public void testFullSnapshotDeletesMissingAndDeduplicatesIdentity() throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    TaskRecord r = record(google("old"));
    snapshot(Arrays.asList(r, r), generation);
    assertEquals(1, store.all().size());
    snapshot(Collections.singletonList(record(google("new"))), generation);
    assertEquals("new", store.all().get(0).id);
    snapshot(Collections.emptyList(), generation);
    assertEquals(0, store.all().size());
  }

  public void testDisconnectAndReauthorizationRejectStaleSnapshot() throws Exception {
    if (!enabled()) return;
    String old = authorize();
    store.disconnect("google", "synthetic-account");
    authorize();
    try {
      snapshot(Collections.singletonList(record(google("late"))), old);
      fail();
    } catch (IOException expected) {
    }
    assertTrue(store.all().isEmpty());
  }

  public void testCompletionUsesEtagAndOnlyStatusPatch() throws Exception {
    if (!enabled()) return;
    TaskRecord r = record(google("task").put("notes", "SYNTHETIC").put("parent", "parent"));
    int[] patches = {0};
    new TaskApi(
            "google",
            r.account,
            "synthetic-token",
            (m, u, t, b, e) -> {
              if (m.equals("GET")) return r.raw;
              patches[0]++;
              assertEquals("\"v1\"", e);
              assertEquals(1, b.length());
              assertEquals("completed", b.getString("status"));
              return r.raw;
            })
        .complete(r, true);
    assertEquals(1, patches[0]);
  }

  public void testConflictAndRecurrenceNeverWrite() throws Exception {
    if (!enabled()) return;
    TaskRecord r = record(google("task"));
    TaskApi api =
        new TaskApi(
            "google",
            r.account,
            "synthetic-token",
            (m, u, t, b, e) -> {
              assertEquals("GET", m);
              return google("task").put("etag", "\"v2\"");
            });
    try {
      api.complete(r, true);
      fail();
    } catch (TaskApi.Failure expected) {
      assertEquals(412, expected.code);
    }
    TaskRecord graph =
        new TaskRecord(
            "microsoft",
            "a",
            "l",
            "L",
            new JSONObject()
                .put("id", "series")
                .put("@odata.etag", "v1")
                .put(
                    "recurrence",
                    new JSONObject().put("pattern", new JSONObject().put("type", "daily"))));
    try {
      new TaskApi(
              "microsoft",
              "a",
              "synthetic-token",
              (m, u, t, b, e) -> {
                assertEquals("GET", m);
                return graph.raw;
              })
          .complete(graph, true);
      fail();
    } catch (IOException expected) {
      assertTrue(expected.getMessage().contains("série"));
    }
  }

  public void testHttp412NeverRetriesOrClaimsSuccess() throws Exception {
    if (!enabled()) return;
    TaskRecord r = record(google("task"));
    int[] patches = {0};
    try {
      new TaskApi(
              "google",
              r.account,
              "synthetic-token",
              (m, u, t, b, e) -> {
                if (m.equals("GET")) return r.raw;
                patches[0]++;
                throw new TaskApi.Failure(412);
              })
          .complete(r, true);
      fail();
    } catch (TaskApi.Failure expected) {
      assertEquals(412, expected.code);
    }
    assertEquals(1, patches[0]);
  }

  public void testExternalSourcesFeedCalendarAndWidgetWithoutTouchingLocalTasks() throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    TaskRecord dated = record(google("dated").put("due", LocalDate.now() + "T00:00:00Z"));
    TaskRecord undated = record(google("undated"));
    snapshot(Arrays.asList(dated, undated), generation);
    assertEquals(2, store.all().size());
    assertEquals(1, store.widget().length());
    assertEquals(1, store.visible(0, Long.MAX_VALUE, false).size());
    assertEquals(1, new DataRepository(context).input().getJSONArray("reminders").length());
    assertTrue(new ReminderStore(context).all().isEmpty());
    store.disconnect("google", "synthetic-account");
    assertEquals(0, new DataRepository(context).input().getJSONArray("reminders").length());
  }

  public void testUnconfiguredConnectHasNoAccountOrNetworkSideEffect() throws Exception {
    if (!enabled()) return;
    assertFalse(BuildConfig.GOOGLE_TASKS_CONFIGURED);
    assertEquals("", BuildConfig.MICROSOFT_CLIENT_ID);
    TaskAuth auth = new TaskAuth(null);
    int[] failed = {0};
    for (String provider : new String[] {"google", "microsoft"})
      auth.connect(
          provider,
          false,
          new TaskAuth.Result() {
            public void success(TaskAuth.Session s) {
              fail("Unconfigured login");
            }

            public void failure(String m) {
              failed[0]++;
            }
          });
    assertEquals(2, failed[0]);
    assertTrue(store.accounts().isEmpty());
    assertTrue(TaskAuth.MEMORY.isEmpty());
  }

  public void testManifestDoesNotRequestAccountsPreciseLocationOrNfc() throws Exception {
    if (!enabled()) return;
    List<String> permissions =
        Arrays.asList(
            context
                .getPackageManager()
                .getPackageInfo(
                    context.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS)
                .requestedPermissions);
    for (String name :
        new String[] {
          "GET_ACCOUNTS",
          "READ_CONTACTS",
          "MANAGE_ACCOUNTS",
          "ACCESS_FINE_LOCATION",
          "ACCESS_BACKGROUND_LOCATION",
          "NFC",
          "READ_EXTERNAL_STORAGE"
        }) assertFalse(name, permissions.contains("android.permission." + name));
  }

  public void testNativeConnectionScreenShowsPendingConfigurationAndSyntheticTasks()
      throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    snapshot(
        Arrays.asList(
            record(google("dated").put("due", LocalDate.now() + "T00:00:00Z")),
            record(google("undated"))),
        generation);
    TaskSourcesActivity activity =
        (TaskSourcesActivity)
            getInstrumentation()
                .startActivitySync(
                    new Intent(context, TaskSourcesActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    try {
      waitFor("Fontes de lembretes");
      assertFalse(
          activity.state.getText().toString(),
          activity.state.getText().toString().contains("Não foi possível"));
      capture("qa-providers-pending.png");
      click("Conectar Google Tasks");
      waitFor("Configuração pendente");
      click("Entendi");
      waitFor("Samsung Reminder via Microsoft To Do");
      capture("qa-providers-samsung-bridge.png");
      getInstrumentation()
          .runOnMainSync(
              () ->
                  ((android.widget.ScrollView) activity.body.getParent())
                      .fullScroll(android.view.View.FOCUS_DOWN));
      capture("qa-providers-selected-lists.png");
      getInstrumentation()
          .runOnMainSync(
              () -> {
                activity.getIntent().putExtra("taskKey", storeKey());
                activity.render();
              });
      waitFor("TAREFA SINTÉTICA undated");
      capture("qa-providers-undated.png");
    } finally {
      getInstrumentation().runOnMainSync(activity::finish);
    }
  }

  String storeKey() {
    try {
      return TaskRecord.identity("google", "synthetic-account", "list", "undated");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }

  public void testUtf8ByteLimitPreservesPreviousCache() throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    snapshot(Collections.singletonList(record(google("old"))), generation);
    String old = store.read().toString();
    char[] chars = new char[1200000];
    Arrays.fill(chars, '\u754c');
    try {
      snapshot(
          Collections.singletonList(record(google("large").put("notes", new String(chars)))),
          generation);
      fail();
    } catch (IOException expected) {
    }
    assertEquals(old, store.read().toString());
  }

  public void testDisconnectPreventsFurtherNetworkPages() throws Exception {
    if (!enabled()) return;
    authorize();
    TaskAuth.Session session =
        new TaskAuth.Session(
            "google",
            "synthetic-account",
            "Synthetic",
            "synthetic-token",
            false,
            System.currentTimeMillis() + 3600000);
    TaskAuth.remember(session);
    int[] calls = {0};
    TaskApi.Transport guarded =
        TaskSync.guarded(
            store,
            session,
            (m, u, t, b, e) -> {
              calls[0]++;
              return new JSONObject();
            });
    guarded.request("GET", TaskApi.GOOGLE + "users/@me/lists", session.token, null, null);
    store.disconnect("google", "synthetic-account");
    try {
      guarded.request(
          "GET", TaskApi.GOOGLE + "users/@me/lists?pageToken=next", session.token, null, null);
      fail();
    } catch (IOException expected) {
    }
    assertEquals(1, calls[0]);
  }

  public void testMicrosoftScopeCannotPromoteReadOnlyConsent() throws Exception {
    if (!enabled()) return;
    String[] read = {"openid", "profile", "https://graph.microsoft.com/Tasks.Read"};
    assertTrue(TaskAuth.graphScope(read, "Tasks.Read"));
    assertFalse(TaskAuth.graphScope(read, "Tasks.ReadWrite"));
    assertFalse(TaskAuth.graphScope(new String[] {"Tasks.ReadWrite.All"}, "Tasks.ReadWrite"));
    assertTrue(TaskAuth.graphScope(new String[] {"Tasks.ReadWrite"}, "Tasks.ReadWrite"));
  }

  public void testExternalSnapshotIsActuallySelectedByWidgetCanvas() throws Exception {
    if (!enabled()) return;
    String generation = authorize();
    snapshot(
        Collections.singletonList(
            record(google("canvas").put("due", LocalDate.now() + "T00:00:00Z"))),
        generation);
    org.json.JSONObject input =
        new JSONObject()
            .put("now", System.currentTimeMillis())
            .put("hours", 24)
            .put("events", new JSONArray())
            .put("reminders", store.widget());
    java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
    java.util.concurrent.atomic.AtomicReference<String> error =
        new java.util.concurrent.atomic.AtomicReference<>();
    java.util.concurrent.atomic.AtomicReference<android.graphics.Bitmap> bitmap =
        new java.util.concurrent.atomic.AtomicReference<>();
    getInstrumentation()
        .runOnMainSync(
            () ->
                RenderEngine.render(
                    context,
                    input,
                    (image, message) -> {
                      bitmap.set(image);
                      error.set(message);
                      done.countDown();
                    }));
    assertTrue(done.await(180, java.util.concurrent.TimeUnit.SECONDS));
    assertNull(error.get());
    assertNotNull(bitmap.get());
    assertTrue(
        RenderEngine.lastDiagnostics.toString(),
        RenderEngine.lastDiagnostics.optInt("reminderItems") >= 1);
  }
}
