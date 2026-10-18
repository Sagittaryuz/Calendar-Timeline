package com.sagittaryuz.calendartimeline;

import android.content.*;
import java.io.IOException;
import java.util.*;
import org.json.*;

/** Private, transactional snapshots. Failure never clears tasks or renews the sync timestamp. */
final class ExternalTaskStore {
  static final Object LOCK = new Object();
  static final String FILE = "external-tasks.json";
  final Context context;

  ExternalTaskStore(Context c) {
    context = c.getApplicationContext();
  }

  JSONObject read() throws Exception {
    JSONObject value = new DataRepository(context).read(FILE);
    if (value != null) return value;
    if (new java.io.File(context.getFilesDir(), FILE).exists())
      throw new IOException("Cache de tarefas ilegível; dados preservados");
    return new JSONObject().put("accounts", new JSONArray()).put("tasks", new JSONArray());
  }

  void write(JSONObject value) throws Exception {
    if (value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 3500000)
      throw new IOException("Limite do cache de tarefas; dados anteriores preservados");
    new DataRepository(context).save(FILE, value);
  }

  List<JSONObject> accounts() throws Exception {
    synchronized (LOCK) {
      JSONArray rows = read().getJSONArray("accounts");
      List<JSONObject> result = new ArrayList<>();
      for (int i = 0; i < rows.length(); i++) result.add(rows.getJSONObject(i));
      return result;
    }
  }

  JSONObject account(String provider, String id) throws Exception {
    for (JSONObject row : accounts())
      if (row.getString("provider").equals(provider) && row.getString("id").equals(id)) return row;
    return null;
  }

  static String accountKey(String provider, String id) {
    return provider + ":" + id;
  }

  void authorize(String provider, String id, String label, boolean writable) throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray rows = data.getJSONArray("accounts");
      JSONObject a = null;
      for (int i = 0; i < rows.length(); i++) {
        JSONObject row = rows.getJSONObject(i);
        if (provider.equals(row.optString("provider")) && id.equals(row.optString("id"))) a = row;
      }
      if (a == null) {
        a =
            new JSONObject()
                .put("provider", provider)
                .put("id", id)
                .put("selected", new JSONObject());
        rows.put(a);
      }
      a.put("label", label)
          .put("writable", writable)
          .put("generation", UUID.randomUUID().toString())
          .put("status", "Escolha as listas a consultar");
      write(data);
    }
  }

  Map<String, String> selected(JSONObject account) throws Exception {
    Map<String, String> out = new LinkedHashMap<>();
    JSONObject selected = account.getJSONObject("selected");
    for (Iterator<String> i = selected.keys(); i.hasNext(); ) {
      String id = i.next();
      out.put(id, selected.getString(id));
    }
    return out;
  }

  void select(String provider, String id, Map<String, String> lists) throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray rows = data.getJSONArray("accounts");
      for (int i = 0; i < rows.length(); i++) {
        JSONObject a = rows.getJSONObject(i);
        if (provider.equals(a.optString("provider")) && id.equals(a.optString("id")))
          a.put("selected", new JSONObject(lists));
      }
      write(data);
    }
  }

  void snapshot(
      String provider,
      String account,
      Map<String, String> selected,
      List<TaskRecord> fresh,
      String generation)
      throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray tasks = new JSONArray();
      // Identity includes account/list/task; Samsung uses the same Microsoft identity, not a copy.
      LinkedHashMap<String, TaskRecord> merged = new LinkedHashMap<>();
      JSONArray old = data.getJSONArray("tasks");
      for (int i = 0; i < old.length(); i++) {
        TaskRecord r = TaskRecord.decode(old.getJSONObject(i));
        if (!r.provider.equals(provider) || !r.account.equals(account)) merged.put(r.key, r);
      }
      JSONObject a = null;
      JSONArray accounts = data.getJSONArray("accounts");
      for (int i = 0; i < accounts.length(); i++) {
        JSONObject row = accounts.getJSONObject(i);
        if (provider.equals(row.optString("provider")) && account.equals(row.optString("id")))
          a = row;
      }
      if (a == null
          || !a.optString("generation").equals(generation)
          || !selected(a).equals(selected))
        throw new IOException("Conexão/listas alteradas durante a consulta; repita");
      for (TaskRecord r : fresh) {
        if (!r.provider.equals(provider)
            || !r.account.equals(account)
            || !selected.containsKey(r.list))
          throw new IOException("Tarefa fora das listas autorizadas");
        if (!r.deleted()) merged.put(r.key, r);
      }
      if (merged.size() > 10000) throw new IOException("Limite do cache de tarefas");
      for (TaskRecord r : merged.values()) tasks.put(r.encode());
      a.put("syncedAt", System.currentTimeMillis()).put("status", "Sincronizado");
      data.put("tasks", tasks);
      write(data);
    }
  }

  void status(String provider, String id, String status) throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray rows = data.getJSONArray("accounts");
      for (int i = 0; i < rows.length(); i++) {
        JSONObject a = rows.getJSONObject(i);
        if (provider.equals(a.optString("provider")) && id.equals(a.optString("id")))
          a.put("status", status);
      }
      write(data);
    }
  }

  void disconnect(String provider, String id) throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray accounts = new JSONArray(), tasks = new JSONArray();
      JSONArray old = data.getJSONArray("accounts");
      for (int i = 0; i < old.length(); i++) {
        JSONObject a = old.getJSONObject(i);
        if (!provider.equals(a.optString("provider")) || !id.equals(a.optString("id")))
          accounts.put(a);
      }
      old = data.getJSONArray("tasks");
      for (int i = 0; i < old.length(); i++) {
        JSONObject a = old.getJSONObject(i);
        if (!provider.equals(a.optString("provider")) || !id.equals(a.optString("account")))
          tasks.put(a);
      }
      data.put("accounts", accounts).put("tasks", tasks);
      write(data);
    }
  }

  List<TaskRecord> all() throws Exception {
    synchronized (LOCK) {
      JSONObject data = read();
      JSONArray rows = data.getJSONArray("tasks");
      Map<String, Set<String>> allowed = new HashMap<>();
      for (JSONObject a : accounts())
        allowed.put(accountKey(a.getString("provider"), a.getString("id")), selected(a).keySet());
      List<TaskRecord> out = new ArrayList<>();
      for (int i = 0; i < rows.length(); i++) {
        TaskRecord r = TaskRecord.decode(rows.getJSONObject(i));
        Set<String> lists = allowed.get(accountKey(r.provider, r.account));
        if (lists != null && lists.contains(r.list) && !r.deleted()) out.add(r);
      }
      return out;
    }
  }

  TaskRecord task(String key) throws Exception {
    for (TaskRecord r : all()) if (r.key.equals(key)) return r;
    throw new IOException("Tarefa não está mais conectada");
  }

  JSONArray widget() throws Exception {
    JSONArray rows = new JSONArray();
    for (TaskRecord r : all()) {
      JSONObject value = r.widget();
      if (value != null) rows.put(value);
    }
    return rows;
  }

  List<CalendarStore.Item> visible(long from, long to, boolean completed) throws Exception {
    List<CalendarStore.Item> rows = new ArrayList<>();
    for (TaskRecord r : all()) {
      CalendarStore.Item item = r.item();
      if (item != null
          && (completed || !r.completed())
          && ((item.start >= from && item.start < to)
              || (!r.completed() && item.start < System.currentTimeMillis()))) rows.add(item);
    }
    return rows;
  }
}
