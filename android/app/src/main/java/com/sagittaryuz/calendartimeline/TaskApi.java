package com.sagittaryuz.calendartimeline;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Official REST APIs only. Tokens stay in memory and never follow redirects. */
final class TaskApi {
  interface Transport {
    JSONObject request(String method, String url, String token, JSONObject body, String etag)
        throws Exception;
  }

  static final class Failure extends IOException {
    final int code;

    Failure(int code) {
      super(
          code == 401 || code == 403
              ? "Autorização necessária"
              : code == 412
                  ? "Tarefa alterada na origem; sincronize antes de concluir"
                  : "Serviço de tarefas indisponível (" + code + ")");
      this.code = code;
    }
  }

  static final class Https implements Transport {
    public JSONObject request(
        String method, String address, String token, JSONObject body, String etag)
        throws Exception {
      URL url = safe(address);
      if (token == null || token.isEmpty()) throw new Failure(401);
      HttpURLConnection c = (HttpURLConnection) url.openConnection();
      try {
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestMethod(method);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Accept", "application/json");
        if (etag != null && !etag.isEmpty()) c.setRequestProperty("If-Match", etag);
        if (body != null) {
          c.setDoOutput(true);
          c.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
          try (OutputStream out = c.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
          }
        }
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Failure(code);
        try (InputStream in = c.getInputStream()) {
          String text = DataRepository.readLimited(in, 4000000);
          return text.isEmpty() ? new JSONObject() : new JSONObject(text);
        }
      } finally {
        c.disconnect();
      }
    }
  }

  static URL safe(String address) throws Exception {
    URI u = new URI(address);
    String path = u.getRawPath(), host = u.getHost();
    boolean google =
        "tasks.googleapis.com".equals(host) && path != null && path.startsWith("/tasks/v1/");
    boolean graph =
        "graph.microsoft.com".equals(host)
            && path != null
            && path.startsWith("/v1.0/me/todo/lists");
    if (!"https".equals(u.getScheme())
        || u.getRawUserInfo() != null
        || u.getPort() != -1
        || u.getRawFragment() != null
        || (!google && !graph)
        || path.contains("..")) throw new IOException("Destino de tarefas não permitido");
    return u.toURL();
  }

  static String segment(String id) throws Exception {
    return URLEncoder.encode(id, "UTF-8").replace("+", "%20");
  }

  static final String GOOGLE = "https://tasks.googleapis.com/tasks/v1/";
  static final String GRAPH = "https://graph.microsoft.com/v1.0/me/todo/lists";
  final String provider, account, token;
  final Transport transport;

  TaskApi(String provider, String account, String token, Transport transport) {
    this.provider = provider;
    this.account = account;
    this.token = token;
    this.transport = transport;
  }

  boolean google() {
    return provider.equals("google");
  }

  String base(String list) throws Exception {
    return google()
        ? GOOGLE + "lists/" + segment(list) + "/tasks"
        : GRAPH + "/" + segment(list) + "/tasks";
  }

  JSONArray pages(String start) throws Exception {
    JSONArray result = new JSONArray();
    String next = start;
    Set<String> seen = new HashSet<>();
    while (!next.isEmpty()) {
      safe(next);
      // A continuation can only stay in the exact resource being read.
      if (!new URI(next).getRawPath().equals(new URI(start).getRawPath())
          || !seen.add(next)
          || seen.size() > 1000)
        throw new IOException("Paginação inválida; cache anterior preservado");
      JSONObject page = transport.request("GET", next, token, null, null);
      if (google()
          && !page.optString("kind")
              .equals(start.contains("users/@me") ? "tasks#taskLists" : "tasks#tasks"))
        throw new IOException("Resposta Google incompleta");
      JSONArray rows = page.optJSONArray(google() ? "items" : "value");
      if (rows == null && !google()) throw new IOException("Resposta de tarefas incompleta");
      if (rows != null)
        for (int i = 0; i < rows.length(); i++) {
          if (result.length() >= 10000)
            throw new IOException("Limite de 10.000 itens; cache anterior preservado");
          result.put(rows.getJSONObject(i));
        }
      String cursor = page.optString(google() ? "nextPageToken" : "@odata.nextLink");
      next =
          cursor.isEmpty()
              ? ""
              : google()
                  ? start + (start.contains("?") ? "&" : "?") + "pageToken=" + segment(cursor)
                  : cursor;
    }
    return result;
  }

  JSONArray lists() throws Exception {
    return pages(google() ? GOOGLE + "users/@me/lists?maxResults=100" : GRAPH);
  }

  List<TaskRecord> snapshot(Map<String, String> selected) throws Exception {
    LinkedHashMap<String, TaskRecord> result = new LinkedHashMap<>();
    for (Map.Entry<String, String> list : selected.entrySet()) {
      String url =
          base(list.getKey())
              + (google()
                  ? "?maxResults=100&showCompleted=true&showDeleted=true&showHidden=true&showAssigned=true"
                  : "?$top=100");
      JSONArray rows = pages(url);
      for (int i = 0; i < rows.length(); i++) {
        TaskRecord task =
            new TaskRecord(
                provider, account, list.getKey(), list.getValue(), rows.getJSONObject(i));
        if (!task.deleted()) result.put(task.key, task);
      }
    }
    return new ArrayList<>(result.values());
  }

  void complete(TaskRecord task, boolean completed) throws Exception {
    if (!provider.equals(task.provider) || !account.equals(task.account))
      throw new SecurityException("Conta da tarefa difere da conexão");
    String url = base(task.list) + "/" + segment(task.id);
    JSONObject fresh = transport.request("GET", url, token, null, null);
    TaskRecord current = new TaskRecord(provider, account, task.list, task.listName, fresh);
    if (!task.etag().equals(current.etag()) || !task.version().equals(current.version()))
      throw new Failure(412);
    // Google exposes no recurrence model; Graph recurrence is never expanded/rewritten locally.
    if (current.recurring())
      throw new IOException("Conclua esta série no Microsoft To Do; recorrência preservada");
    if (current.etag().isEmpty())
      throw new IOException("A origem não forneceu versão para conclusão segura");
    JSONObject patch =
        new JSONObject()
            .put("status", completed ? "completed" : google() ? "needsAction" : "notStarted");
    if (google() && !completed) patch.put("completed", JSONObject.NULL);
    transport.request("PATCH", url, token, patch, current.etag());
    // Never optimistic/pending replay: the caller fetches a new complete snapshot after success.
  }
}
