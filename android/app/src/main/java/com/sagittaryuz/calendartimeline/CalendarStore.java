package com.sagittaryuz.calendartimeline;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import java.time.*;
import java.util.*;

/** Device Calendar Provider. Account calendars stay read-only: no implicit cloud writes. */
final class CalendarStore {
  static final String LOCAL = CalendarContract.ACCOUNT_TYPE_LOCAL;
  final Context context;
  final ContentResolver resolver;

  CalendarStore(Context c) {
    context = c;
    resolver = c.getContentResolver();
  }

  boolean readable() {
    return context.checkSelfPermission(Manifest.permission.READ_CALENDAR)
        == PackageManager.PERMISSION_GRANTED;
  }

  boolean writable() {
    return readable()
        && context.checkSelfPermission(Manifest.permission.WRITE_CALENDAR)
            == PackageManager.PERMISSION_GRANTED;
  }

  static final class Agenda {
    long id;
    String name, account, type;
    int color, access;
    boolean visible;

    boolean editable() {
      return LOCAL.equals(type) && access >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR;
    }

    @Override
    public String toString() {
      return name + (editable() ? " · neste aparelho" : " · leitura");
    }
  }

  static final class Item {
    long id, calendarId, start, end, occurrenceStart, occurrenceEnd, originalId;
    String seriesRule = "";
    String title = "", location = "", notes = "", zone = ZoneId.systemDefault().getId(), rule = "";
    boolean allDay, reminder, completed, editable;
    int color = 0xff007aff, alert = -1, priority;
    String localId = "", calendarName = "";

    Item copy() {
      Item x = new Item();
      x.id = id;
      x.calendarId = calendarId;
      x.occurrenceStart = occurrenceStart;
      x.occurrenceEnd = occurrenceEnd;
      x.originalId = originalId;
      x.seriesRule = seriesRule;
      x.start = start;
      x.end = end;
      x.title = title;
      x.location = location;
      x.notes = notes;
      x.zone = zone;
      x.rule = rule;
      x.allDay = allDay;
      x.reminder = reminder;
      x.completed = completed;
      x.editable = editable;
      x.color = color;
      x.alert = alert;
      x.localId = localId;
      x.calendarName = calendarName;
      x.priority = priority;
      return x;
    }

    LocalDate date() {
      return Instant.ofEpochMilli(start).atZone(ZoneId.systemDefault()).toLocalDate();
    }
  }

  List<Agenda> calendars() {
    List<Agenda> out = new ArrayList<>();
    if (!readable()) return out;
    try (Cursor c =
        resolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            new String[] {
              "_id",
              "calendar_displayName",
              "account_name",
              "account_type",
              "calendar_color",
              "calendar_access_level",
              "visible"
            },
            null,
            null,
            "calendar_displayName ASC")) {
      if (c == null) throw new IllegalStateException("Agendas indisponíveis");
      while (c.moveToNext()) {
        Agenda a = new Agenda();
        a.id = c.getLong(0);
        a.name = c.getString(1);
        a.account = c.getString(2);
        a.type = c.getString(3);
        a.color = c.getInt(4);
        a.access = c.getInt(5);
        a.visible = c.getInt(6) != 0;
        out.add(a);
      }
    }
    return out;
  }

  long createLocal(String displayName) {
    if (!writable()) throw new SecurityException("Permita editar a agenda");
    String name = displayName.trim();
    if (name.isEmpty() || name.length() > 100)
      throw new IllegalArgumentException("Informe um nome de até 100 caracteres");
    // Only our LOCAL account is accessed as a local sync adapter; it never has a server.
    Uri u =
        CalendarContract.Calendars.CONTENT_URI
            .buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter("account_name", BackupStore.APP_ID)
            .appendQueryParameter("account_type", LOCAL)
            .build();
    ContentValues v = new ContentValues();
    v.put("account_name", BackupStore.APP_ID);
    v.put("account_type", LOCAL);
    v.put("name", UUID.randomUUID().toString());
    v.put("calendar_displayName", name);
    v.put("calendar_color", 0xff007aff);
    v.put("calendar_access_level", CalendarContract.Calendars.CAL_ACCESS_OWNER);
    v.put("ownerAccount", BackupStore.APP_ID);
    v.put("visible", 1);
    v.put("sync_events", 1);
    v.put("calendar_timezone", ZoneId.systemDefault().getId());
    v.put("allowedReminders", "1");
    v.put("maxReminders", 5);
    Uri inserted = resolver.insert(u, v);
    if (inserted == null) throw new IllegalStateException("Não foi possível criar agenda");
    return ContentUris.parseId(inserted);
  }

  List<Item> instances(long from, long to, Set<String> hidden, Long onlyCalendar) {
    List<Item> out = new ArrayList<>();
    if (!readable()) return out;
    List<Agenda> agendas = calendars();
    Map<Long, Agenda> map = new HashMap<>();
    for (Agenda a : agendas) map.put(a.id, a);
    Uri.Builder u = CalendarContract.Instances.CONTENT_URI.buildUpon();
    ContentUris.appendId(u, from);
    ContentUris.appendId(u, to);
    String selection = "visible=1" + (onlyCalendar == null ? "" : " AND calendar_id=?");
    try (Cursor c =
        resolver.query(
            u.build(),
            new String[] {
              "event_id",
              "calendar_id",
              "title",
              "begin",
              "end",
              "allDay",
              "displayColor",
              "eventLocation",
              "description",
              "eventTimezone",
              "rrule"
            },
            selection,
            onlyCalendar == null ? null : new String[] {onlyCalendar.toString()},
            "begin ASC")) {
      if (c == null) throw new IllegalStateException("Eventos indisponíveis");
      while (c.moveToNext()) {
        long cid = c.getLong(1);
        if (hidden.contains(Long.toString(cid))) continue;
        Item x = new Item();
        x.id = c.getLong(0);
        x.calendarId = cid;
        x.title = safe(c.getString(2));
        x.start = c.getLong(3);
        x.end = c.getLong(4);
        x.allDay = c.getInt(5) != 0;
        x.color = c.getInt(6) | 0xff000000;
        x.location = safe(c.getString(7));
        x.notes = safe(c.getString(8));
        x.zone = safe(c.getString(9));
        x.rule = safe(c.getString(10));
        Agenda a = map.get(cid);
        x.editable = a != null && a.editable();
        x.calendarName = a == null ? "Calendário" : a.name;
        if (x.allDay) {
          x.start = civilToDevice(x.start);
          x.end = civilToDevice(x.end);
        }
        if (x.end > from && x.start < to) out.add(x);
      }
    }
    return out;
  }

  Item event(long id) {
    if (!readable()) throw new SecurityException("Permita ler a agenda");
    try (Cursor c =
        resolver.query(
            ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id),
            new String[] {
              "_id",
              "calendar_id",
              "title",
              "dtstart",
              "dtend",
              "duration",
              "allDay",
              "eventTimezone",
              "rrule",
              "eventLocation",
              "description",
              "rdate",
              "original_id",
              "originalInstanceTime",
              "exrule",
              "exdate"
            },
            null,
            null,
            null)) {
      if (c == null || !c.moveToFirst())
        throw new IllegalArgumentException("Evento não encontrado");
      Item x = new Item();
      x.id = id;
      x.calendarId = c.getLong(1);
      x.title = safe(c.getString(2));
      x.start = c.getLong(3);
      x.end = c.isNull(4) ? x.start + Duration.parse(c.getString(5)).toMillis() : c.getLong(4);
      x.allDay = c.getInt(6) != 0;
      x.zone = safe(c.getString(7));
      x.rule = safe(c.getString(8));
      x.location = safe(c.getString(9));
      x.notes = safe(c.getString(10));
      for (Agenda a : calendars())
        if (a.id == x.calendarId) {
          x.calendarName = a.name;
          x.color = a.color | 0xff000000;
          x.editable = a.editable();
        }
      // Preserve unsupported recurring exceptions by making them read-only, never silently flatten.
      if (!c.isNull(11) || !c.isNull(14) || !c.isNull(15)) x.editable = false;
      x.originalId = c.isNull(12) ? 0 : c.getLong(12);
      x.occurrenceStart = c.isNull(13) ? 0 : c.getLong(13);
      if (x.allDay) {
        x.start = civilToDevice(x.start);
        x.end = civilToDevice(x.end);
      }
      try (Cursor r =
          resolver.query(
              CalendarContract.Reminders.CONTENT_URI,
              new String[] {"minutes"},
              "event_id=? AND method=?",
              new String[] {Long.toString(id), "1"},
              "minutes ASC")) {
        if (r != null && r.moveToFirst()) x.alert = r.getInt(0);
      }
      return x;
    }
  }

  static String safe(String s) {
    return s == null ? "" : s;
  }

  static long civilToDevice(long utc) {
    return Instant.ofEpochMilli(utc)
        .atZone(ZoneOffset.UTC)
        .toLocalDate()
        .atStartOfDay(ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli();
  }

  static long deviceToCivil(long ms) {
    return Instant.ofEpochMilli(ms)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .atStartOfDay(ZoneOffset.UTC)
        .toInstant()
        .toEpochMilli();
  }

  static void validate(Item x) {
    if (x.title.trim().isEmpty() || x.title.length() > 4096)
      throw new IllegalArgumentException("Informe um título de até 4096 caracteres");
    if (x.end <= x.start) throw new IllegalArgumentException("O término deve ser depois do início");
    ZoneId.of(x.zone);
    if (x.alert < -1 || x.alert > 40320) throw new IllegalArgumentException("Alerta inválido");
    if (x.notes.length() > 16000 || x.location.length() > 4096)
      throw new IllegalArgumentException("Texto muito longo");
    if (x.start < -62135596800000L || x.end > 253402300799999L)
      throw new IllegalArgumentException("Data fora do intervalo");
  }

  long save(Item x) throws Exception {
    if (!writable()) throw new SecurityException("Permita editar a agenda");
    validate(x);
    boolean allowed = false;
    for (Agenda a : calendars()) if (a.id == x.calendarId && a.editable()) allowed = true;
    if (!allowed) throw new IllegalArgumentException("Escolha uma agenda local editável");
    Item previous = x.id > 0 ? event(x.id) : null;
    if (previous != null && !previous.editable)
      throw new SecurityException("Este evento está disponível somente para leitura");
    if (previous != null && previous.originalId > 0 && previous.calendarId != x.calendarId)
      throw new IllegalArgumentException(
          "Uma ocorrência modificada deve permanecer na agenda da série original.");
    // Editing a title/date must preserve additional system alerts unless the alert is changed.
    boolean replaceAlerts = previous == null || previous.alert != x.alert;
    ContentValues v = values(x);
    if (!replaceAlerts) v.remove("hasAlarm");
    ArrayList<ContentProviderOperation> ops = new ArrayList<>();
    if (x.id == 0)
      ops.add(
          ContentProviderOperation.newInsert(CalendarContract.Events.CONTENT_URI)
              .withValues(v)
              .build());
    else
      ops.add(
          ContentProviderOperation.newUpdate(
                  ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, x.id))
              .withValues(v)
              .withExpectedCount(1)
              .build());
    if (x.id > 0 && replaceAlerts)
      ops.add(
          ContentProviderOperation.newDelete(CalendarContract.Reminders.CONTENT_URI)
              .withSelection("event_id=?", new String[] {Long.toString(x.id)})
              .build());
    if (x.alert >= 0 && replaceAlerts) {
      ContentProviderOperation.Builder r =
          ContentProviderOperation.newInsert(CalendarContract.Reminders.CONTENT_URI)
              .withValue("minutes", x.alert)
              .withValue("method", CalendarContract.Reminders.METHOD_ALERT);
      if (x.id == 0) r.withValueBackReference("event_id", 0);
      else r.withValue("event_id", x.id);
      ops.add(r.build());
    }
    if (previous != null && previous.originalId > 0) refreshSeries(ops, event(previous.originalId));
    ContentProviderResult[] result = resolver.applyBatch(CalendarContract.AUTHORITY, ops);
    return x.id == 0 ? ContentUris.parseId(result[0].uri) : x.id;
  }

  void delete(long id) throws Exception {
    if (!writable() || !event(id).editable)
      throw new SecurityException("Este evento não pode ser apagado");
    if (resolver.delete(
            ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id), null, null)
        != 1) throw new IllegalStateException("Evento não encontrado");
  }

  enum Scope {
    SINGLE,
    FUTURE,
    SERIES
  }

  Item occurrence(long id, long start, long end) {
    Item x = event(id);
    if (!x.rule.isEmpty()) {
      x.seriesRule = x.rule;
      x.occurrenceStart = start;
      x.occurrenceEnd = end;
      x.start = start;
      x.end = end;
    }
    return x;
  }

  static ContentValues values(Item x) {
    ContentValues v = new ContentValues();
    v.put("calendar_id", x.calendarId);
    v.put("title", x.title.trim());
    v.put("eventLocation", x.location);
    v.put("description", x.notes);
    v.put("allDay", x.allDay ? 1 : 0);
    v.put("eventTimezone", x.allDay ? "UTC" : x.zone);
    v.put("dtstart", x.allDay ? deviceToCivil(x.start) : x.start);
    v.put("hasAlarm", x.alert >= 0 ? 1 : 0);
    if (x.originalId > 0) {
      v.put("original_id", x.originalId);
      v.put("originalInstanceTime", x.occurrenceStart);
    }
    if (x.rule.isEmpty()) {
      v.put("dtend", x.allDay ? deviceToCivil(x.end) : x.end);
      v.putNull("duration");
      v.putNull("rrule");
    } else {
      v.putNull("dtend");
      v.put(
          "duration",
          x.allDay
              ? "P"
                  + java.time.temporal.ChronoUnit.DAYS.between(
                      x.date(),
                      Instant.ofEpochMilli(x.end).atZone(ZoneId.systemDefault()).toLocalDate())
                  + "D"
              : "PT" + ((x.end - x.start) / 1000) + "S");
      v.put("rrule", x.rule);
    }
    return v;
  }

  Uri ownedLocalUri() {
    return CalendarContract.Events.CONTENT_URI
        .buildUpon()
        .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
        .appendQueryParameter("account_name", BackupStore.APP_ID)
        .appendQueryParameter("account_type", LOCAL)
        .build();
  }

  String ensureLocalIdentity(Item master) {
    boolean owned = false;
    for (Agenda a : calendars())
      if (a.id == master.calendarId)
        owned = LOCAL.equals(a.type) && BackupStore.APP_ID.equals(a.account);
    if (!owned)
      throw new IllegalArgumentException(
          "Exceções são editáveis nas agendas locais criadas por este app.");
    try (Cursor c =
        resolver.query(
            ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, master.id),
            new String[] {"_sync_id"},
            null,
            null,
            null)) {
      if (c == null || !c.moveToFirst()) throw new IllegalArgumentException("Série não encontrada");
      String uid = c.getString(0);
      if (uid != null && !uid.isEmpty()) return uid;
    }
    // AOSP's recurrence expansion matches exceptions through original_sync_id, even in
    // a LOCAL account. This UUID is only a local relation key; no sync service exists.
    String uid = UUID.randomUUID().toString();
    ContentValues v = new ContentValues();
    v.put("_sync_id", uid);
    v.put("dirty", 1);
    if (resolver.update(ContentUris.withAppendedId(ownedLocalUri(), master.id), v, null, null) != 1)
      throw new IllegalStateException("Não foi possível preparar a série local");
    return uid;
  }

  void refreshSeries(ArrayList<ContentProviderOperation> ops, Item master) {
    // AOSP 11 skips instance rebuilding for partial updates and expands only the exception
    // after an exception insert. A full master update rebuilds the entire local recurrence.
    ops.add(
        ContentProviderOperation.newUpdate(
                ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, master.id))
            .withValues(values(master))
            .withExpectedCount(1)
            .build());
  }

  List<int[]> alerts(long event) {
    List<int[]> out = new ArrayList<>();
    try (Cursor c =
        resolver.query(
            CalendarContract.Reminders.CONTENT_URI,
            new String[] {"minutes", "method"},
            "event_id=?",
            new String[] {Long.toString(event)},
            null)) {
      if (c == null) throw new IllegalStateException("Alertas indisponíveis");
      while (c.moveToNext()) out.add(new int[] {c.getInt(0), c.getInt(1)});
    }
    return out;
  }

  void copyAlerts(ArrayList<ContentProviderOperation> ops, Item master, Item edit, int ref) {
    List<int[]> list = master.alert == edit.alert ? alerts(master.id) : new ArrayList<>();
    if (master.alert != edit.alert && edit.alert >= 0) list.add(new int[] {edit.alert, 1});
    for (int[] a : list)
      ops.add(
          ContentProviderOperation.newInsert(CalendarContract.Reminders.CONTENT_URI)
              .withValueBackReference("event_id", ref)
              .withValue("minutes", a[0])
              .withValue("method", a[1])
              .build());
  }

  Item checkedMaster(Item x) {
    if (!writable()) throw new SecurityException("Permita editar a agenda");
    Item master = event(x.id);
    if (!master.editable || master.calendarId != x.calendarId)
      throw new IllegalArgumentException("Mantenha esta ocorrência na agenda local original.");
    return master;
  }

  long saveScoped(Item x, Scope scope) throws Exception {
    validate(x);
    if (x.id == 0 || x.occurrenceStart == 0 || x.seriesRule.isEmpty()) return save(x);
    Item master = checkedMaster(x);
    if (!master.rule.equals(x.seriesRule))
      throw new IllegalArgumentException("A série mudou. Abra o evento novamente.");
    if (scope == Scope.SERIES) {
      Item whole = x.copy();
      ZoneId zone = ZoneId.of(master.zone);
      LocalDateTime before = Instant.ofEpochMilli(x.occurrenceStart).atZone(zone).toLocalDateTime();
      LocalDateTime after = Instant.ofEpochMilli(x.start).atZone(zone).toLocalDateTime();
      whole.start =
          Instant.ofEpochMilli(master.start)
              .atZone(zone)
              .toLocalDateTime()
              .plus(Duration.between(before, after))
              .atZone(zone)
              .toInstant()
              .toEpochMilli();
      whole.end = whole.start + (x.end - x.start);
      if (x.allDay)
        whole.end =
            whole
                .date()
                .plusDays(
                    java.time.temporal.ChronoUnit.DAYS.between(
                        x.date(),
                        Instant.ofEpochMilli(x.end).atZone(ZoneId.systemDefault()).toLocalDate()))
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli();
      return save(whole);
    }
    ArrayList<ContentProviderOperation> ops = new ArrayList<>();
    long pivot = master.allDay ? deviceToCivil(x.occurrenceStart) : x.occurrenceStart;
    if (scope == Scope.SINGLE) {
      String localUid = ensureLocalIdentity(master);
      Item one = x.copy();
      one.rule = "";
      ContentValues v = values(one);
      v.put("original_id", master.id);
      v.put("original_sync_id", localUid);
      v.put("originalInstanceTime", pivot);
      v.put("originalAllDay", master.allDay ? 1 : 0);
      v.put("eventStatus", CalendarContract.Events.STATUS_CONFIRMED);
      try (Cursor c =
          resolver.query(
              CalendarContract.Events.CONTENT_URI,
              new String[] {"_id"},
              "original_id=? AND originalInstanceTime=?",
              new String[] {Long.toString(master.id), Long.toString(pivot)},
              null)) {
        if (c == null) throw new IllegalStateException("Exceções indisponíveis");
        if (c.moveToFirst())
          throw new IllegalArgumentException("A ocorrência mudou. Abra-a novamente.");
      }
      ops.add(
          ContentProviderOperation.newInsert(CalendarContract.Events.CONTENT_URI)
              .withValues(v)
              .build());
      copyAlerts(ops, master, one, 0);
      refreshSeries(ops, master);
      return ContentUris.parseId(resolver.applyBatch(CalendarContract.AUTHORITY, ops)[0].uri);
    }
    RecurrenceRule rule = new RecurrenceRule(master.rule);
    int before =
        rule.before(
            master.allDay ? deviceToCivil(master.start) : master.start,
            pivot,
            master.allDay ? ZoneOffset.UTC : ZoneId.of(master.zone));
    List<Long> futureExceptions = new ArrayList<>();
    try (Cursor c =
        resolver.query(
            CalendarContract.Events.CONTENT_URI,
            new String[] {"_id"},
            "original_id=? AND originalInstanceTime>=?",
            new String[] {Long.toString(master.id), Long.toString(pivot)},
            null)) {
      if (c == null) throw new IllegalStateException("Exceções indisponíveis");
      while (c.moveToNext()) futureExceptions.add(c.getLong(0));
    }
    if (!futureExceptions.isEmpty()
        && (x.start != x.occurrenceStart
            || x.allDay != master.allDay
            || !x.zone.equals(master.zone)
            || !x.rule.equals(master.rule)))
      throw new IllegalArgumentException(
          "Há exceções futuras. Mantenha início, fuso e repetição ou edite cada ocorrência; nada"
              + " foi alterado.");
    if (before == 0) return save(x);
    Item next = x.copy();
    if (next.rule.equals(master.rule)) next.rule = rule.remaining(before);
    ensureLocalIdentity(master);
    String nextUid = UUID.randomUUID().toString();
    ContentValues nextValues = values(next);
    nextValues.put("_sync_id", nextUid);
    nextValues.put("dirty", 1);
    ops.add(ContentProviderOperation.newInsert(ownedLocalUri()).withValues(nextValues).build());
    copyAlerts(ops, master, next, 0);
    // Reparent explicit exceptions before truncating, preserving their custom dates and alerts.
    for (long id : futureExceptions)
      ops.add(
          ContentProviderOperation.newUpdate(
                  ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id))
              .withValueBackReference("original_id", 0)
              .withValue("original_sync_id", nextUid)
              .withExpectedCount(1)
              .build());
    Item past = master.copy();
    past.rule = rule.through(pivot, master.allDay);
    refreshSeries(ops, past);
    ops.add(
        ContentProviderOperation.newUpdate(CalendarContract.Events.CONTENT_URI)
            .withSelection("_id=?", new String[] {"0"})
            .withSelectionBackReference(0, 0)
            .withValues(values(next))
            .withExpectedCount(1)
            .build());
    return ContentUris.parseId(resolver.applyBatch(CalendarContract.AUTHORITY, ops)[0].uri);
  }

  void deleteScoped(Item x, Scope scope) throws Exception {
    Item master = checkedMaster(x);
    if (master.originalId > 0) {
      ContentValues v = values(master);
      v.put("eventStatus", CalendarContract.Events.STATUS_CANCELED);
      ArrayList<ContentProviderOperation> ops = new ArrayList<>();
      ops.add(
          ContentProviderOperation.newUpdate(
                  ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, x.id))
              .withValues(v)
              .build());
      refreshSeries(ops, event(master.originalId));
      resolver.applyBatch(CalendarContract.AUTHORITY, ops);
      return;
    }
    if (master.rule.isEmpty() || scope == Scope.SERIES) {
      delete(x.id);
      return;
    }
    if (x.occurrenceStart == 0) throw new IllegalArgumentException("Selecione uma ocorrência.");
    long pivot = master.allDay ? deviceToCivil(x.occurrenceStart) : x.occurrenceStart;
    ArrayList<ContentProviderOperation> ops = new ArrayList<>();
    if (scope == Scope.SINGLE) {
      String localUid = ensureLocalIdentity(master);
      Item cancelled = x.copy();
      cancelled.rule = "";
      cancelled.alert = -1;
      ContentValues v = values(cancelled);
      v.put("original_id", master.id);
      v.put("original_sync_id", localUid);
      v.put("originalInstanceTime", pivot);
      v.put("originalAllDay", master.allDay ? 1 : 0);
      v.put("eventStatus", CalendarContract.Events.STATUS_CANCELED);
      ops.add(
          ContentProviderOperation.newInsert(CalendarContract.Events.CONTENT_URI)
              .withValues(v)
              .build());
      refreshSeries(ops, master);
    } else {
      RecurrenceRule rule = new RecurrenceRule(master.rule);
      if (rule.before(
              master.allDay ? deviceToCivil(master.start) : master.start,
              pivot,
              master.allDay ? ZoneOffset.UTC : ZoneId.of(master.zone))
          == 0) {
        delete(x.id);
        return;
      }
      ops.add(
          ContentProviderOperation.newDelete(CalendarContract.Events.CONTENT_URI)
              .withSelection(
                  "original_id=? AND originalInstanceTime>=?",
                  new String[] {Long.toString(master.id), Long.toString(pivot)})
              .build());
      Item past = master.copy();
      past.rule = rule.through(pivot, master.allDay);
      refreshSeries(ops, past);
    }
    resolver.applyBatch(CalendarContract.AUTHORITY, ops);
  }
}
