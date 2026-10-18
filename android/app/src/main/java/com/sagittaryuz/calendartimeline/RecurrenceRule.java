package com.sagittaryuz.calendartimeline;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Bounded parser for splitting the simple rules this editor creates. Unknown rules stay intact. */
final class RecurrenceRule {
  final LinkedHashMap<String, String> parts = new LinkedHashMap<>();
  final String frequency;
  final int interval, count;

  RecurrenceRule(String rule) {
    for (String token : rule.split(";")) {
      String[] pair = token.split("=", -1);
      if (pair.length != 2 || parts.put(pair[0], pair[1]) != null) throw unsupported();
    }
    if (!Arrays.asList("DAILY", "WEEKLY", "MONTHLY", "YEARLY").contains(parts.get("FREQ")))
      throw unsupported();
    for (String key : parts.keySet())
      if (!Arrays.asList("FREQ", "INTERVAL", "COUNT", "UNTIL", "WKST").contains(key))
        throw unsupported();
    frequency = parts.get("FREQ");
    interval = positive(parts.getOrDefault("INTERVAL", "1"));
    count = positive(parts.getOrDefault("COUNT", "2147483647"));
    if (parts.containsKey("COUNT") && parts.containsKey("UNTIL")) throw unsupported();
  }

  static IllegalArgumentException unsupported() {
    return new IllegalArgumentException(
        "Esta regra precisa de edição individual ou da série inteira. A divisão não foi aplicada.");
  }

  static int positive(String s) {
    try {
      int n = Integer.parseInt(s);
      if (n > 0) return n;
    } catch (NumberFormatException ignored) {
    }
    throw unsupported();
  }

  /** Count real rule slots, including slots hidden by cancellation exceptions. */
  int before(long start, long pivot, ZoneId zone) {
    LocalDateTime seed = Instant.ofEpochMilli(start).atZone(zone).toLocalDateTime();
    int emitted = 0;
    for (int n = 0; n < 200000; n++) {
      LocalDateTime local;
      long step = (long) n * interval;
      switch (frequency) {
        case "DAILY":
          local = seed.plusDays(step);
          break;
        case "WEEKLY":
          local = seed.plusWeeks(step);
          break;
        case "MONTHLY":
          YearMonth month = YearMonth.from(seed).plusMonths(step);
          if (seed.getDayOfMonth() > month.lengthOfMonth()) continue;
          local = month.atDay(seed.getDayOfMonth()).atTime(seed.toLocalTime());
          break;
        default:
          int year = Math.toIntExact(seed.getYear() + step);
          if (seed.getMonthValue() == 2 && seed.getDayOfMonth() == 29 && !Year.isLeap(year))
            continue;
          local = seed.withYear(year);
      }
      if (zone.getRules().getValidOffsets(local).isEmpty()) continue;
      long instant = local.atZone(zone).toInstant().toEpochMilli();
      if (instant == pivot && emitted < count) return emitted;
      if (instant > pivot || ++emitted >= count) throw unsupported();
    }
    throw unsupported();
  }

  String through(long pivot, boolean allDay) {
    LinkedHashMap<String, String> p = new LinkedHashMap<>(parts);
    p.remove("COUNT");
    p.put(
        "UNTIL",
        allDay
            ? Instant.ofEpochMilli(pivot)
                .atZone(ZoneOffset.UTC)
                .toLocalDate()
                .minusDays(1)
                .format(DateTimeFormatter.BASIC_ISO_DATE)
            : DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'")
                .withZone(ZoneOffset.UTC)
                .format(Instant.ofEpochMilli(pivot - 1000)));
    return join(p);
  }

  String remaining(int before) {
    LinkedHashMap<String, String> p = new LinkedHashMap<>(parts);
    if (p.containsKey("COUNT")) p.put("COUNT", Integer.toString(count - before));
    return join(p);
  }

  static String join(Map<String, String> p) {
    List<String> out = new ArrayList<>();
    for (Map.Entry<String, String> part : p.entrySet())
      out.add(part.getKey() + "=" + part.getValue());
    return String.join(";", out);
  }
}
