package com.sagittaryuz.calendartimeline;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.test.InstrumentationTestCase;
import android.view.*;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.*;
import java.util.*;
import org.json.*;

/** Opt-in disposable-emulator QA. Requires the explicitly prepared synthetic files in Downloads. */
public final class DocumentUiTest extends InstrumentationTestCase {
  AccessibilityNodeInfo find(String text) {
    AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
    if (root == null) return null;
    List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
    for (AccessibilityNodeInfo n : nodes)
      if (n.getText() != null && n.getText().toString().equalsIgnoreCase(text)) return n;
    return null;
  }

  AccessibilityNodeInfo waitText(String text) throws Exception {
    for (int i = 0; i < 120; i++) {
      AccessibilityNodeInfo n = find(text);
      if (n != null) return n;
      Thread.sleep(500);
    }
    fail("UI text absent: " + text);
    return null;
  }

  void click(String text) throws Exception {
    waitText(text);
    AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
    List<AccessibilityNodeInfo> matches = root.findAccessibilityNodeInfosByText(text);
    for (int i = matches.size() - 1; i >= 0; i--) {
      AccessibilityNodeInfo n = matches.get(i);
      if (n.getText() == null
          || !n.getText().toString().equalsIgnoreCase(text)
          || !n.isVisibleToUser()) continue;
      while (n != null) {
        if (n.isVisibleToUser() && n.isEnabled()) {
          for (AccessibilityNodeInfo.AccessibilityAction action : n.getActionList())
            if (action.getId() == AccessibilityNodeInfo.ACTION_CLICK
                && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return;
        }
        n = n.getParent();
      }
    }
    fail("No clickable control for " + text);
  }

  void choose(String filename) throws Exception {
    // Wait for the external picker transition before inspecting its drawer.
    AccessibilityNodeInfo drawer = null;
    for (int attempt = 0; attempt < 80 && drawer == null; attempt++) {
      AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
      ArrayDeque<AccessibilityNodeInfo> pending = new ArrayDeque<>();
      if (root != null) pending.add(root);
      while (!pending.isEmpty()) {
        AccessibilityNodeInfo node = pending.remove();
        if ("Show roots"
            .contentEquals(
                node.getContentDescription() == null ? "" : node.getContentDescription())) {
          drawer = node;
          break;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
          AccessibilityNodeInfo child = node.getChild(i);
          if (child != null) pending.add(child);
        }
      }
      if (drawer == null) Thread.sleep(500);
    }
    assertNotNull("Document picker not ready", drawer);
    AccessibilityNodeInfo n = find(filename);
    if (n == null) {
      AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
      ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
      if (root != null) queue.add(root);
      while (!queue.isEmpty()) {
        AccessibilityNodeInfo node = queue.remove();
        if ("Show roots"
            .contentEquals(
                node.getContentDescription() == null ? "" : node.getContentDescription())) {
          node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
          break;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
          AccessibilityNodeInfo child = node.getChild(i);
          if (child != null) queue.add(child);
        }
      }
      waitText("Open from");
      click("Downloads");
    }
    n = waitText(filename);
    AccessibilityNodeInfo item = n;
    while (item.getParent() != null
        && !"com.android.documentsui:id/item_root".equals(item.getViewIdResourceName()))
      item = item.getParent();
    android.util.Log.i("TimelineDocumentQa", "File actions: " + item.getActionList());
    if (!item.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
      assertTrue("Focus file", item.performAction(AccessibilityNodeInfo.ACTION_FOCUS));
      long now = SystemClock.uptimeMillis();
      getInstrumentation()
          .getUiAutomation()
          .injectInputEvent(
              new KeyEvent(now, now, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER, 0), true);
      getInstrumentation()
          .getUiAutomation()
          .injectInputEvent(
              new KeyEvent(
                  now,
                  SystemClock.uptimeMillis(),
                  KeyEvent.ACTION_UP,
                  KeyEvent.KEYCODE_DPAD_CENTER,
                  0),
              true);
    }
  }

  void screenshot(String name) throws Exception {
    Bitmap b = getInstrumentation().getUiAutomation().takeScreenshot();
    assertNotNull(b);
    try (OutputStream out = getInstrumentation().getTargetContext().openFileOutput(name, 0)) {
      assertTrue(b.compress(Bitmap.CompressFormat.PNG, 100, out));
    }
  }

  public void testRealDocumentPickerOfflineRoundTrip() throws Exception {
    if (!"true"
        .equals(
            ((android.test.InstrumentationTestRunner) getInstrumentation())
                .getArguments()
                .getString("documentQa"))) return;
    android.accessibilityservice.AccessibilityServiceInfo info =
        getInstrumentation().getUiAutomation().getServiceInfo();
    info.flags |= android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
    getInstrumentation().getUiAutomation().setServiceInfo(info);
    Context context = getInstrumentation().getTargetContext();
    getInstrumentation()
        .startActivitySync(
            new Intent(context, MaintenanceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    click("Importar backup");
    choose("Calendar-Timeline-teste-backup.json");
    waitText("Importar com clima");
    screenshot("qa-backup-confirm.png");
    click("Importar com clima");
    waitText("Backup importado. Atualizando o widget…");
    SharedPreferences prefs = context.getSharedPreferences("settings", 0);
    assertEquals(1, new JSONArray(prefs.getString("reminders", "[]")).length());
    assertEquals("-17.8814", prefs.getString("latitude", ""));
    assertFalse(prefs.getBoolean("checkUpdates", true));
    long marker = prefs.getLong("restoredAt", 0);
    for (int i = 0; i < 120 && prefs.getLong("renderedAt", 0) < marker; i++) Thread.sleep(500);
    assertTrue("Imported widget refresh", prefs.getLong("renderedAt", 0) >= marker);
    click("Exportar backup");
    click("SAVE");
    waitText("Backup salvo no arquivo escolhido.");
    screenshot("qa-backup-export.png");
    String reminders = prefs.getString("reminders", "");
    long restored = prefs.getLong("restoredAt", 0);
    click("Importar backup");
    choose("Calendar-Timeline-invalido.json");
    waitText("Backup inválido, incompatível ou inacessível. Nenhum dado foi importado.");
    assertEquals(reminders, prefs.getString("reminders", ""));
    assertEquals(restored, prefs.getLong("restoredAt", 0));
    screenshot("qa-backup-invalid.png");
    android.util.Log.i(
        "TimelineDocumentQa",
        "Real document import/export + invalid-file protection passed; synthetic reminder count=1");
  }
}
