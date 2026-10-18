package com.sagittaryuz.calendartimeline;

import android.content.Context;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** A single serialized worker prevents overlapping writes; no automatic offline mutation replay. */
final class TaskSync {
  static final ExecutorService IO = Executors.newSingleThreadExecutor();

  static TaskApi.Transport guarded(
      ExternalTaskStore store, TaskAuth.Session session, TaskApi.Transport delegate)
      throws Exception {
    JSONObject account = store.account(session.provider, session.account);
    if (account == null) throw new IOException("Conta desconectada");
    String generation = account.getString("generation");
    return (method, url, token, body, etag) -> {
      JSONObject current = store.account(session.provider, session.account);
      if (current == null
          || !generation.equals(current.optString("generation"))
          || TaskAuth.session(session.provider, session.account) != session)
        throw new IOException("Conexão alterada; consulta interrompida");
      return delegate.request(method, url, token, body, etag);
    };
  }

  static TaskApi api(Context context, TaskAuth.Session session) throws Exception {
    return new TaskApi(
        session.provider,
        session.account,
        session.token,
        guarded(new ExternalTaskStore(context), session, new TaskApi.Https()));
  }

  static void refresh(Context context, Runnable done) {
    IO.execute(
        () -> {
          ExternalTaskStore store = new ExternalTaskStore(context);
          boolean changed = false;
          try {
            for (JSONObject a : store.accounts()) {
              String provider = a.getString("provider"), account = a.getString("id");
              TaskAuth.Session session = TaskAuth.session(provider, account);
              if (session == null) {
                store.status(
                    provider,
                    account,
                    "Cache offline · abra Fontes de lembretes para autorizar novamente");
                continue;
              }
              if (System.currentTimeMillis() - a.optLong("syncedAt") < 5 * 60000L) continue;
              try {
                sync(context, session);
                changed = true;
              } catch (Exception e) {
                store.status(
                    provider,
                    account,
                    e instanceof TaskApi.Failure && ((TaskApi.Failure) e).code == 401
                        ? "Autorização expirada · cache preservado"
                        : "Falha de sincronização · cache preservado");
              }
            }
          } catch (Exception ignored) {
          }
          if (done != null && changed) done.run();
        });
  }

  static synchronized void sync(Context context, TaskAuth.Session session) throws Exception {
    ExternalTaskStore store = new ExternalTaskStore(context);
    JSONObject account = store.account(session.provider, session.account);
    if (account == null) throw new IOException("Conta desconectada");
    Map<String, String> lists = store.selected(account);
    List<TaskRecord> rows = api(context, session).snapshot(lists);
    store.snapshot(session.provider, session.account, lists, rows, account.getString("generation"));
  }

  static synchronized void complete(Context context, TaskRecord record, boolean complete)
      throws Exception {
    ExternalTaskStore store = new ExternalTaskStore(context);
    JSONObject account = store.account(record.provider, record.account);
    TaskAuth.Session session = TaskAuth.session(record.provider, record.account);
    if (account == null || session == null)
      throw new IOException("Abra Fontes de lembretes e autorize esta conta novamente");
    if (!session.writable || !account.optBoolean("writable"))
      throw new IOException("Conexão somente leitura; autorize conclusão em Fontes de lembretes");
    api(context, session).complete(record, complete);
    try {
      sync(context, session);
    } catch (Exception e) {
      throw new IOException(
          "Estado alterado na origem; cache ainda pendente. Sincronize antes de repetir.", e);
    }
  }
}
