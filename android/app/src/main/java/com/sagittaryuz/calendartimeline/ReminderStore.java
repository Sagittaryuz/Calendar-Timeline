package com.sagittaryuz.calendartimeline;

import android.content.*;
import java.io.IOException;
import java.time.*;
import java.util.*;
import org.json.*;

/** Local reminders have no account or network. A completed repeat advances by civil time. */
final class ReminderStore {
  final Context context;
  final SharedPreferences prefs;

  ReminderStore(Context c) {
    context = c;
    prefs = c.getSharedPreferences("settings", 0);
  }

  List<CalendarStore.Item> all() throws JSONException {
    JSONArray a = new JSONArray(prefs.getString("reminders", "[]"));
    List<CalendarStore.Item> out = new ArrayList<>();
    for (int i = 0; i < a.length(); i++) out.add(decode(a.getJSONObject(i)));
    return out;
  }

  static CalendarStore.Item decode(JSONObject o) throws JSONException {
    CalendarStore.Item x = new CalendarStore.Item();
    x.reminder = true;
    x.editable = true;
    x.localId = o.getString("identifier");
    x.title = o.getString("title");
    x.start = o.getLong("dueDate");
    x.end = x.start + 60000;
    x.allDay = !o.getBoolean("dueDateIncludesTime");
    x.notes = o.optString("notes", "");
    x.rule = o.optString("repeat", "");
    x.zone = o.optString("timezone", ZoneId.systemDefault().getId());
    if (x.allDay) {
      // A date-only reminder floats with its civil date when the device changes time zone.
      LocalDate civil = Instant.ofEpochMilli(x.start).atZone(ZoneId.of(x.zone)).toLocalDate();
      x.start = civil.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
      x.end = x.start + 60000;
      x.zone = ZoneId.systemDefault().getId();
    }
    x.alert = o.optInt("alertMinutes", -1);
    x.completed = o.optBoolean("completed", false);
    x.priority = o.optInt("priority", 0);
    x.color = 0xffff9f0a;
    x.calendarName = "Lembretes locais";
    return x;
  }

  static JSONObject encode(CalendarStore.Item x) throws JSONException {
    return new JSONObject()
        .put("identifier", x.localId)
        .put("title", x.title.trim())
        .put("dueDate", x.start)
        .put("dueDateIncludesTime", !x.allDay)
        .put("notes", x.notes)
        .put("repeat", x.rule)
        .put("timezone", x.allDay ? ZoneId.systemDefault().getId() : x.zone)
        .put("alertMinutes", x.alert)
        .put("completed", x.completed)
        .put("priority", x.priority)
        .put(
            "calendar",
            new JSONObject()
                .put("identifier", "local")
                .put("title", "Lembretes locais")
                .put("color", new JSONObject().put("hex", "FF9F0A")));
  }

  void save(CalendarStore.Item x) throws Exception {
    CalendarStore.validate(x);
    if (!Arrays.asList("", "DAILY", "WEEKLY", "MONTHLY", "YEARLY").contains(x.rule))
      throw new IllegalArgumentException("Repetição inválida");
    if (x.localId.isEmpty()) x.localId = UUID.randomUUID().toString();
    List<CalendarStore.Item> list = all();
    boolean found = false;
    for (int i = 0; i < list.size(); i++)
      if (list.get(i).localId.equals(x.localId)) {
        list.set(i, x);
        found = true;
      }
    if (!found) list.add(x);
    write(list);
  }

  void delete(String id) throws Exception {
    List<CalendarStore.Item> list = all();
    list.removeIf(x -> x.localId.equals(id));
    write(list);
  }

  void toggle(CalendarStore.Item x) throws Exception {
    if (!x.completed && !x.rule.isEmpty()) {
      List<CalendarStore.Item> list = all();
      CalendarStore.Item done = x.copy();
      done.completed = true;
      done.rule = "";
      done.alert = -1;
      done.localId = UUID.randomUUID().toString();
      CalendarStore.Item next = x.copy();
      ZonedDateTime due = Instant.ofEpochMilli(x.start).atZone(ZoneId.of(x.zone));
      switch (x.rule) {
        case "DAILY":
          due = due.plusDays(1);
          break;
        case "WEEKLY":
          due = due.plusWeeks(1);
          break;
        case "MONTHLY":
          due = due.plusMonths(1);
          break;
        case "YEARLY":
          due = due.plusYears(1);
          break;
        default:
          throw new IllegalArgumentException("Repetição inválida");
      }
      next.start = due.toInstant().toEpochMilli();
      next.end = next.start + 60000;
      for (int i = 0; i < list.size(); i++)
        if (list.get(i).localId.equals(x.localId)) list.set(i, next);
      list.add(done);
      write(list);
    } else {
      x.completed = !x.completed;
      save(x);
    }
  }

  private void write(List<CalendarStore.Item> list) throws Exception {
    if (list.size() > 2000)
      throw new IllegalArgumentException("Limite de 2000 lembretes; apague os concluídos antigos");
    JSONArray a = new JSONArray();
    for (CalendarStore.Item x : list) a.put(encode(x));
    if (!prefs.edit().putString("reminders", a.toString()).commit())
      throw new IOException("Não foi possível salvar");
    ReminderAlerts.schedule(context);
  }

  JSONArray forWidget() throws JSONException {
    JSONArray a = new JSONArray();
    for (CalendarStore.Item x : all()) if (!x.completed) a.put(encode(x));
    return a;
  }
}
