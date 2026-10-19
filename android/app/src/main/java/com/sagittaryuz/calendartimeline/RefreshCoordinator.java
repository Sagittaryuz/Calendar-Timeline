package com.sagittaryuz.calendartimeline;

import android.content.*;
import android.graphics.*;
import android.os.*;
import android.util.AtomicFile;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

final class RefreshCoordinator {
  interface Listener {
    void done(Bitmap image, String status);
  }

  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final ExecutorService IO = Executors.newSingleThreadExecutor();
  private static final List<Listener> listeners = new ArrayList<>();
  private static final List<Listener> pendingListeners = new ArrayList<>();
  private static boolean busy, pendingRefresh, pendingForceWeather;

  static void refresh(Context c, Listener listener) {
    refresh(c, listener, false);
  }

  static void refresh(Context c, Listener listener, boolean forceWeather) {
    MAIN.post(
        () -> {
          if (busy) {
            if (listener != null) pendingListeners.add(listener);
            pendingRefresh = true;
            pendingForceWeather |= forceWeather;
            return;
          }
          if (listener != null) listeners.add(listener);
          busy = true;
          Context context = c.getApplicationContext();
          IO.execute(
              () -> {
                DataRepository repository = new DataRepository(context);
                try {
                  JSONObject input = repository.input(forceWeather);
                  String status =
                      input.optBoolean("demo")
                          ? "Demonstração · eventos e clima fictícios · 17/10/2026 12:10"
                          : repository.status;
                  MAIN.post(
                      () ->
                          RenderEngine.render(
                              context,
                              input,
                              (image, error) -> {
                                IO.execute(
                                    () -> {
                                      String message = error == null ? status : error;
                                      if (image != null) {
                                        try {
                                          AtomicFile f =
                                              new AtomicFile(
                                                  new File(context.getFilesDir(), "widget.png"));
                                          FileOutputStream out = f.startWrite();
                                          try {
                                            if (!image.compress(
                                                Bitmap.CompressFormat.PNG, 100, out))
                                              throw new IOException();
                                            f.finishWrite(out);
                                          } catch (Exception ex) {
                                            f.failWrite(out);
                                            throw ex;
                                          }
                                          context
                                              .getSharedPreferences("settings", 0)
                                              .edit()
                                              .putLong("renderedAt", System.currentTimeMillis())
                                              .putString(
                                                  "renderDiagnostics",
                                                  RenderEngine.lastDiagnostics == null
                                                      ? "{}"
                                                      : RenderEngine.lastDiagnostics.toString())
                                              .apply();
                                        } catch (Exception ex) {
                                          message = "Não foi possível salvar o widget";
                                        }
                                      }
                                      String result = message;
                                      MAIN.post(
                                          () -> {
                                            TimelineWidget.publishAll(context);
                                            complete(context, image, result);
                                          });
                                    });
                              }));
                } catch (Exception ex) {
                  MAIN.post(
                      () ->
                          complete(
                              context,
                              null,
                              "Não foi possível ler as fontes. Confira a configuração."));
                }
              });
        });
  }

  private static void complete(Context context, Bitmap image, String status) {
    busy = false;
    List<Listener> callbacks = new ArrayList<>(listeners);
    listeners.clear();
    for (Listener l : callbacks) l.done(image, status);
    if (pendingRefresh) {
      pendingRefresh = false;
      listeners.addAll(pendingListeners);
      pendingListeners.clear();
      boolean force = pendingForceWeather;
      pendingForceWeather = false;
      refresh(context, null, force);
    }
  }

  static Bitmap cached(Context c) {
    try (FileInputStream in = new AtomicFile(new File(c.getFilesDir(), "widget.png")).openRead()) {
      return BitmapFactory.decodeStream(in);
    } catch (IOException ex) {
      return null;
    }
  }
}
