package com.sagittaryuz.calendartimeline;

import android.content.Context;
import android.graphics.*;
import android.os.*;
import android.util.Base64;
import android.webkit.*;
import java.io.*;
import org.json.JSONObject;

/** An offscreen local Canvas produces the bitmap; the home widget itself is RemoteViews. */
final class RenderEngine {
  interface Callback {
    void done(Bitmap bitmap, String error);
  }

  private final WebView web;
  private final Handler main = new Handler(Looper.getMainLooper());
  private Callback callback;
  private final Runnable timeout = () -> finish(null, "O desenho demorou demais. Tente novamente.");

  RenderEngine(Context context) {
    web = new WebView(context);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setBlockNetworkLoads(true);
    settings.setDomStorageEnabled(false);
    web.setBackgroundColor(Color.TRANSPARENT);
    web.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);
    web.measure(
        android.view.View.MeasureSpec.makeMeasureSpec(1092, android.view.View.MeasureSpec.EXACTLY),
        android.view.View.MeasureSpec.makeMeasureSpec(510, android.view.View.MeasureSpec.EXACTLY));
    web.layout(0, 0, 1092, 510);
    web.onResume();
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onConsoleMessage(ConsoleMessage message) {
            android.util.Log.d("TimelineRenderer", message.message());
            return true;
          }
        });
    web.addJavascriptInterface(
        new Object() {
          @JavascriptInterface
          public void rendered(String png, String count) {
            main.post(
                () -> {
                  try {
                    byte[] bytes = Base64.decode(png, Base64.DEFAULT);
                    Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (image == null) throw new IOException();
                    finish(image, null);
                  } catch (Exception e) {
                    finish(null, "Imagem inválida");
                  }
                });
          }

          @JavascriptInterface
          public void failed(String error) {
            main.post(() -> finish(null, "Falha ao desenhar a timeline"));
          }
        },
        "Android");
  }

  static void render(Context context, JSONObject input, Callback callback) {
    try {
      new RenderEngine(context).render(input, callback);
    } catch (RuntimeException ex) {
      callback.done(null, "Ative ou atualize o Android System WebView para desenhar a timeline.");
    }
  }

  void render(JSONObject input, Callback cb) {
    callback = cb;
    android.util.Log.d("TimelineRenderer", "Rendering local assets");
    main.postDelayed(timeout, 180000);
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            android.net.Uri uri = request.getUrl();
            if ("data".equals(uri.getScheme()) || "about".equals(uri.getScheme())) return null;
            String asset = uri.getPath();
            android.util.Log.d("TimelineRenderer", "Asset: " + asset);
            if ("https".equals(uri.getScheme())
                && "timeline.local".equals(uri.getHost())
                && asset != null
                && asset.matches("/[a-zA-Z0-9.-]+")) {
              try {
                return new WebResourceResponse(
                    asset.endsWith(".js") ? "text/javascript" : "text/html",
                    "UTF-8",
                    web.getContext().getAssets().open(asset.substring(1)));
              } catch (IOException ignored) {
              }
            }
            return new WebResourceResponse(
                "text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return true;
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            android.util.Log.d("TimelineRenderer", "Page finished: " + url);
            if (!"https://timeline.local/index.html".equals(url)) return;
            String expression =
                input.optBoolean("demo")
                    ? "Object.assign(demoInput(),{hours:"
                        + input.optInt("hours", 24)
                        + ",theme:"
                        + JSONObject.quote(input.optString("theme", "black"))
                        + "})"
                    : input.toString();
            view.evaluateJavascript(
                "draw(" + expression + ").catch(function(e){console.error(String(e));})", null);
          }
        });
    try {
      String html;
      try (InputStream stream = web.getContext().getAssets().open("index.html")) {
        html = DataRepository.readLimited(stream, 2000000);
      }
      html =
          html.replace(
              "script-src 'self' 'unsafe-eval'", "script-src 'self' 'unsafe-eval' 'unsafe-inline'");
      for (String asset : new String[] {"scriptable-adapter.js", "demo.js", "renderer.js"}) {
        String code;
        try (InputStream stream = web.getContext().getAssets().open(asset)) {
          code = DataRepository.readLimited(stream, 2000000);
        }
        html =
            html.replace(
                "<script src=\"" + asset + "\"></script>",
                "<script>" + code.replace("</script", "<\\/script") + "</script>");
      }
      web.loadDataWithBaseURL(
          "https://timeline.local/index.html", html, "text/html", "UTF-8", null);
    } catch (IOException ex) {
      finish(null, "Leitura do desenho local indisponível.");
    }
  }

  private void finish(Bitmap bitmap, String error) {
    if (callback == null) return;
    main.removeCallbacks(timeout);
    Callback cb = callback;
    callback = null;
    web.destroy();
    cb.done(bitmap, error);
  }
}
