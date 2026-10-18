package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.test.InstrumentationTestCase;
import android.view.accessibility.AccessibilityNodeInfo;
import java.lang.reflect.*;
import java.util.*;

/** Browser launches are intercepted; synthetic release URLs are never downloaded. */
public final class MaintenanceUiTest extends InstrumentationTestCase {
  MaintenanceActivity activity;
  final List<Intent> opened = new ArrayList<>();
  Instrumentation.ActivityMonitor monitor;

  @Override
  protected void setUp() throws Exception {
    super.setUp();
    monitor =
        new Instrumentation.ActivityMonitor() {
          @Override
          public Instrumentation.ActivityResult onStartActivity(Intent intent) {
            if (Intent.ACTION_VIEW.equals(intent.getAction())) {
              opened.add(new Intent(intent));
              return new Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null);
            }
            return null;
          }
        };
    getInstrumentation().addMonitor(monitor);
    activity =
        (MaintenanceActivity)
            getInstrumentation()
                .startActivitySync(
                    new Intent(getInstrumentation().getTargetContext(), MaintenanceActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  }

  @Override
  protected void tearDown() throws Exception {
    getInstrumentation().runOnMainSync(() -> activity.finish());
    getInstrumentation().removeMonitor(monitor);
    super.tearDown();
  }

  void offer(String url) throws Exception {
    Field field = MaintenanceActivity.class.getDeclaredField("candidate");
    field.setAccessible(true);
    UpdateRepository.Candidate offered =
        new UpdateRepository.Candidate(
            100,
            26,
            "teste automatizado",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            url,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "debug");
    Method method = MaintenanceActivity.class.getDeclaredMethod("download");
    method.setAccessible(true);
    getInstrumentation()
        .runOnMainSync(
            () -> {
              try {
                field.set(activity, offered);
                method.invoke(activity);
              } catch (Exception ex) {
                throw new RuntimeException(ex);
              }
            });
    getInstrumentation().waitForIdleSync();
  }

  public void testDownloadWaitsForConfirmationAndUsesOnlySafeBrowserIntent() throws Exception {
    String url =
        UpdateRepository.RELEASES + "/download/android-v9.0-test/Calendar-Timeline-test.apk";
    offer(url);
    assertEquals(0, opened.size());
    boolean clicked = false;
    for (int attempt = 0; attempt < 100 && !clicked; attempt++) {
      AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
      if (root != null)
        for (AccessibilityNodeInfo node : root.findAccessibilityNodeInfosByText("Abrir download")) {
          if (node.isVisibleToUser() && node.isClickable()) {
            clicked = node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            if (clicked) break;
          }
        }
      if (!clicked) Thread.sleep(400);
    }
    assertTrue("Confirmation button not found", clicked);
    getInstrumentation().waitForIdleSync();
    assertEquals(1, opened.size());
    assertEquals(url, opened.get(0).getDataString());
    assertTrue(opened.get(0).hasCategory(Intent.CATEGORY_BROWSABLE));
    assertEquals(Intent.ACTION_VIEW, opened.get(0).getAction());
  }

  public void testInvalidDownloadCannotOpenBrowserOrConfirmation() throws Exception {
    offer("https://evil.example/test.apk");
    assertEquals(0, opened.size());
    AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
    assertNotNull(root);
    assertTrue(root.findAccessibilityNodeInfosByText("Abrir download").isEmpty());
  }
}
