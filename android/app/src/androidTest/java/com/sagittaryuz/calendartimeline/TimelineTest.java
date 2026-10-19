package com.sagittaryuz.calendartimeline;

import android.appwidget.*;
import android.content.*;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.test.InstrumentationTestCase;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/**
 * Device tests run the real WebView renderer and Android RemoteViews, with synthetic fixtures only.
 */
public final class TimelineTest extends InstrumentationTestCase {
  public void testRealCanvasRenderer() throws Exception {
    Context context = getInstrumentation().getTargetContext();
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<Bitmap> image = new AtomicReference<>();
    AtomicReference<String> error = new AtomicReference<>();
    getInstrumentation()
        .runOnMainSync(
            () ->
                new RenderEngine(context)
                    .render(
                        new JSONObject(),
                        (bitmap, message) -> {
                          image.set(bitmap);
                          error.set(message);
                          latch.countDown();
                        }));
    assertTrue("Renderer timeout", latch.await(240, TimeUnit.SECONDS));
    assertNull(error.get());
    assertNotNull(image.get());
    assertEquals(1092, image.get().getWidth());
    assertEquals(510, image.get().getHeight());
    assertEquals(0, android.graphics.Color.alpha(image.get().getPixel(0, 0)));
    assertTrue(android.graphics.Color.alpha(image.get().getPixel(546, 255)) > 0);
  }

  public void testDemoAndWidgetResize() throws Exception {
    Context context = getInstrumentation().getTargetContext();
    context
        .getSharedPreferences("settings", 0)
        .edit()
        .putBoolean("demo", true)
        .putBoolean("weather", false)
        .putInt("hours", 24)
        .commit();
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<Bitmap> bitmap = new AtomicReference<>();
    RefreshCoordinator.refresh(
        context,
        (image, status) -> {
          bitmap.set(image);
          latch.countDown();
        });
    assertTrue(latch.await(240, TimeUnit.SECONDS));
    assertNotNull(bitmap.get());
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    int[] ids = manager.getAppWidgetIds(new ComponentName(context, TimelineWidget.class));
    for (int id : ids) {
      for (int width : new int[] {240, 360, 480}) {
        Bundle options = new Bundle();
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width);
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, width);
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 220);
        manager.updateAppWidgetOptions(id, options);
        TimelineWidget.publish(context, manager, id);
      }
    }
  }

  public void testPrivateCacheRecovery() throws Exception {
    Context context = getInstrumentation().getTargetContext();
    DataRepository repository = new DataRepository(context);
    JSONObject data = new JSONObject().put("fixture", true).put("fetchedAt", 123);
    repository.save("test-cache.json", data);
    assertEquals(123, repository.read("test-cache.json").getLong("fetchedAt"));
    repository.delete("test-cache.json");
    assertNull(repository.read("test-cache.json"));
  }
}
