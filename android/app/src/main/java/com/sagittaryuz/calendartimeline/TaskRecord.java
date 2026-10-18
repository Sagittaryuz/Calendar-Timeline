package com.sagittaryuz.calendartimeline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.json.*;

/** Provider identity and untouched source data. Never converts external tasks into events. */
final class TaskRecord {
  final String provider, account, list, id, listName, key;
  final JSONObject raw;

  TaskRecord(String provider, String account, String list, String listName, JSONObject raw)
      throws Exception {
    if (!provider.equals("google") && !provider.equals("microsoft"))
      throw new IllegalArgumentException("Provedor desconhecido");
    this.provider = provider;
    this.account = account;
    this.list = list;
    this.listName = listName;
    this.raw = new JSONObject(raw.toString());
    id = raw.getString("id");
    if (account.isEmpty() || list.isEmpty() || id.isEmpty())
      throw new IllegalArgumentException("Identidade de tarefa incompleta");
    key = identity(provider, account, list, id);
  }

  static String identity(String provider, String account, String list, String id) throws Exception {
    byte[] bytes =
        MessageDigest.getInstance("SHA-256")
            .digest(
                new JSONArray()
                    .put(provider)
                    .put(account)
                    .put(list)
                    .put(id)
                    .toString()
                    .getBytes(StandardCharsets.UTF_8));
    StringBuilder out = new StringBuilder("external:");
    for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
    return out.toString();
  }

  String source() {
    return provider.equals("google") ? "Google Tasks" : "Microsoft To Do";
  }

  String title() {
    return raw.optString("title", "Sem título");
  }

  boolean completed() {
    return "completed".equals(raw.optString("status"));
  }

  boolean deleted() {
    return raw.optBoolean("deleted") || raw.has("@removed");
  }

  String etag() {
    return raw.optString(provider.equals("google") ? "etag" : "@odata.etag");
  }

  boolean recurring() {
    return raw.optJSONObject("recurrence") != null;
  }

  String version() {
    return raw.optString(provider.equals("google") ? "updated" : "lastModifiedDateTime");
  }

  boolean dateOnly() {
    return provider.equals("google");
  }

  /** Null means undated or unsupported time zone, not January 1970. */
  Long scheduledAt() {
    try {
      if (provider.equals("google")) {
        String due = raw.optString("due");
        if (due.isEmpty()) return null;
        return LocalDate.parse(due.substring(0, 10))
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli();
      }
      JSONObject stamp = raw.optJSONObject("dueDateTime");
      if (stamp == null && raw.optBoolean("isReminderOn"))
        stamp = raw.optJSONObject("reminderDateTime");
      return graphTime(stamp);
    } catch (RuntimeException ex) {
      return null;
    }
  }

  static Long graphTime(JSONObject value) {
    if (value == null) return null;
    String zone = value.optString("timeZone"), time = value.optString("dateTime");
    try {
      try {
        return OffsetDateTime.parse(time).toInstant().toEpochMilli();
      } catch (java.time.format.DateTimeParseException ignored) {
      }
      ZoneId id;
      try {
        id = ZoneId.of(zone);
      } catch (DateTimeException ex) {
        String mapped = android.icu.util.TimeZone.getIDForWindowsID(zone, "001");
        if (mapped == null) return null;
        id = ZoneId.of(mapped);
      }
      return LocalDateTime.parse(time).atZone(id).toInstant().toEpochMilli();
    } catch (DateTimeException ex) {
      return null;
    }
  }

  CalendarStore.Item item() {
    Long at = scheduledAt();
    if (at == null) return null;
    CalendarStore.Item item = new CalendarStore.Item();
    item.reminder = true;
    item.localId = key;
    item.title = title();
    item.start = at;
    item.end = at + 60000;
    item.allDay = dateOnly();
    item.completed = completed();
    item.calendarName = source() + " · " + listName;
    item.color = provider.equals("google") ? 0xff4285f4 : 0xff2564cf;
    item.notes = provider.equals("google") ? raw.optString("notes") : "";
    // External recurrence is kept at its source; local repeat/toggle must never advance it.
    item.editable = false;
    return item;
  }

  JSONObject widget() throws Exception {
    CalendarStore.Item item = item();
    if (item == null || completed() || deleted()) return null;
    return new JSONObject()
        .put("identifier", key)
        .put("title", item.title)
        .put("dueDate", item.start)
        .put("dueDateIncludesTime", !item.allDay)
        .put("completed", false)
        .put(
            "calendar",
            new JSONObject()
                .put("identifier", provider + ":" + list)
                .put("title", item.calendarName)
                .put(
                    "color",
                    new JSONObject().put("hex", provider.equals("google") ? "4285F4" : "2564CF")));
  }

  JSONObject encode() throws Exception {
    return new JSONObject()
        .put("provider", provider)
        .put("account", account)
        .put("list", list)
        .put("listName", listName)
        .put("raw", raw);
  }

  static TaskRecord decode(JSONObject value) throws Exception {
    return new TaskRecord(
        value.getString("provider"),
        value.getString("account"),
        value.getString("list"),
        value.getString("listName"),
        value.getJSONObject("raw"));
  }
}
