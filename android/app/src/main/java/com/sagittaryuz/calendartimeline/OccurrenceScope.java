package com.sagittaryuz.calendartimeline;

import android.app.*;
import java.util.function.Consumer;

final class OccurrenceScope {
  static void choose(Activity a, String title, Consumer<CalendarStore.Scope> action) {
    new AlertDialog.Builder(a)
        .setTitle(title)
        .setItems(
            new String[] {"Somente esta ocorrência", "Esta e as futuras", "Série inteira"},
            (d, w) -> action.accept(CalendarStore.Scope.values()[w]))
        .setNegativeButton("Cancelar", null)
        .show();
  }
}
