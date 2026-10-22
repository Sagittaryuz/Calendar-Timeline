// Restored verbatim from Sagittaryuz/Calendar-Timeline commit 3bcb13b.
// Build-time reference; consumed only by tools/build-scripting.cjs.
function titleHeaderFontSize() {
  return Math.min(scaleFontSize(22),
    Math.floor((titleDayCardRect(0).width - 24) / (8.5 * 0.60)));
}

function titleDayCardRect(index) {
  const cardCount = TITLE_CARD_COUNT;
  const cardGap = titleCardGap();
  const cardsLeft = CANVAS.marginX;
  const cardsRight = CANVAS.width - CANVAS.marginX;
  const cardWidth =
    (cardsRight - cardsLeft - cardGap * (cardCount - 1)) /
    cardCount;

  // A linha superior do dia atual é um traço centrado na borda,
  // então os demais quadros sobem metade da espessura para alinhar
  // seus limites visuais superiores.
  const titleCardTop =
    index === titleTodayCardIndex()
      ? WIDGET_CONTOUR.strokeInset
      : WIDGET_CONTOUR.strokeInset - dayBoundaryLineWidth() / 2;
  // O cartão atual termina na mesma altura dos demais. Seu topo lógico
  // fica 2 px abaixo por causa do contorno branco centrado; reduzir sua
  // altura preserva o alinhamento externo superior sem encurtar o vão.
  const titleCardHeight =
    index === titleTodayCardIndex()
      ? Math.max(
          1,
          TITLE_CARD_HEIGHT - dayBoundaryLineWidth() / 2
        )
      : TITLE_CARD_HEIGHT;

  return new Rect(
    cardsLeft + index * (cardWidth + cardGap),
    titleCardTop,
    cardWidth,
    titleCardHeight
  );
}

function drawDatePanel(ctx, holidayDates) {
  // A área do título agora é uma faixa compacta de previsão. O restante
  // do desenho continua começando no mesmo ponto e não sofre deslocamento.
  const cardCount = TITLE_CARD_COUNT;
  const firstDay = titleWeekStart();

  for (let index = 0; index < cardCount; index++) {
    const date = addDays(firstDay, index);
    drawTitleDayCard(
      ctx,
      date,
      titleDayCardRect(index),
      index === titleTodayCardIndex(),
      index === cardCount - 1
    );
  }
}

function drawTitleDayCard(
  ctx,
  date,
  card,
  isSelected,
  isLast
) {
  const borderColor = new Color("#303136", 0.82);
  const dayBackgroundColor = timelineBackgroundColorForDate(date);
  const isSpecialDay =
    dayBackgroundColor !== SETTINGS.timelineBackgroundColor;
  const blurEnabled = shouldBlurFutureTimeline();
  const useBlurredSundayColor =
    !isSelected &&
    blurEnabled &&
    date.getDay() === 0 &&
    dayBackgroundColor === SETTINGS.sundayTimelineBackgroundColor;
  // Dias úteis não atuais usam o cinza da timeline; sábado, domingo e
  // feriado preservam respectivamente azul, vermelho e amarelo. Durante
  // o blur, apenas o cartão futuro de domingo usa o vermelho mais escuro.
  // Os demais cartões seguem as cores especiais ou o cinza do dia útil.
  const cardColor = new Color(
    useBlurredSundayColor
      ? SETTINGS.blurredSundayCardColor
      : isSpecialDay
      ? dayBackgroundColor
      : blurEnabled
        ? "#232327"
        : SETTINGS.nonBlurredFutureCardColor,
    1.0
  );

  // Só as extremidades externas da faixa recebem raio. As junções entre
  // cartões permanecem retas; a moldura contínua de hoje é desenhada à parte.
  const rightCornerRadius = isLast
    ? TITLE_CARD_OUTER_CORNER_RADIUS
    : 0;
  const leftCornerRadius = card.x <= CANVAS.marginX + 1
    ? TITLE_CARD_OUTER_CORNER_RADIUS
    : 0;
  const cornerRadii = {
    topLeft: leftCornerRadius,
    topRight: rightCornerRadius,
    // Hoje mantém sua geometria contínua própria, desenhada separadamente.
    bottomRight: isSelected ? (isLast ? 0 : rightCornerRadius) : 0,
    bottomLeft: isSelected ? TITLE_CARD_STANDARD_CORNER_RADIUS : 0,
  };

  // O cartão de hoje já foi preenchido pela geometria contínua
  // que também cobre sua faixa na timeline. Não desenhamos uma segunda
  // forma aqui, evitando a separação entre duas geometrias.
  if (!isSelected) {
    // Os demais cartões conservam a borda fina escura.
    fillTitleCardShape(ctx, card, cornerRadii, borderColor);
    const inner = new Rect(
      card.x + 2,
      card.y + scaleVertical(2),
      card.width - 4,
      card.height - scaleVertical(4)
    );
    fillTitleCardShape(
      ctx,
      inner,
      {
        topLeft: Math.max(0, cornerRadii.topLeft - scaleVertical(2)),
        topRight: Math.max(0, cornerRadii.topRight - scaleVertical(2)),
        bottomRight: Math.max(0, cornerRadii.bottomRight - scaleVertical(2)),
        bottomLeft: Math.max(0, cornerRadii.bottomLeft - scaleVertical(2)),
      },
      cardColor
    );
  }

  // A data mantém a cor original; somente a palavra do dia recebe
  // a cor correspondente a sábado, domingo ou feriado.
  const weekdayColor = titleWeekdayColor(
    date,
    loadResult.holidayDates
  );
  const dateColor = isSelected
    ? new Color("#FFFFFF", 0.96)
    : new Color(SETTINGS.secondaryTextColor, 1.0);
  const detailColor = isSelected
    ? new Color("#FFFFFF", 0.96)
    : new Color("#D1D1D6", 0.96);

  const weekdayLabel = shortWeekday(date);
  const dateLabel = titleDayMonthLabel(date);

  const titleFontSize = titleHeaderFontSize();
  const titleCharacterWidth = titleFontSize * 0.60;
  const weekdayWidth = weekdayLabel.length * titleCharacterWidth;
  const titleGap = titleCharacterWidth / 2;
  const titleGroupWidth = (weekdayLabel.length + dateLabel.length + 0.5) * titleCharacterWidth;
  const titleY = titleSafeTextY(titleGroupWidth + 4, titleFontSize * 1.15,
    WIDGET_CONTOUR.strokeInset + scaleVertical(7),
    scaleVertical(3), titleFontSize * TITLE_CARD_TEXT_VISIBLE_TOP_RATIO);
  const titleStartX = card.x + (card.width - titleGroupWidth) / 2;
  ctx.setTextAlignedLeft();
  ctx.setFont(Font.blackMonospacedSystemFont(titleFontSize));
  ctx.setTextColor(weekdayColor);
  ctx.drawText(weekdayLabel, new Point(titleStartX, titleY));
  ctx.setTextColor(dateColor);
  ctx.drawText(dateLabel, new Point(titleStartX + weekdayWidth + titleGap, titleY));

  const daily = titleDailyTemperatureForDay(date);
  const minimum = Number.isFinite(Number(daily?.minimum))
    ? String(Math.round(Number(daily.minimum))) + "º" : "--º";
  const maximum = Number.isFinite(Number(daily?.maximum))
    ? String(Math.round(Number(daily.maximum))) + "º" : "--º";
  const counts = titleScheduleCountsForDay(date);
  const detailFontSize = scaleFontSize(18);
  const detailCharacterWidth = detailFontSize * 0.62;
  const iconSize = scaleVertical(22);
  const iconGap = scaleVertical(2);
  const minimumWidth = minimum.length * detailCharacterWidth;
  const maximumWidth = maximum.length * detailCharacterWidth;
  const weatherWidth = minimumWidth + iconGap * 2 + iconSize + maximumWidth;
  const weatherX = card.x + (card.width - weatherWidth) / 2;
  const weatherY = titleY + titleFontSize * 1.15 + scaleVertical(3);
  const weatherCenterY = weatherY + detailFontSize / 2;
  ctx.setFont(Font.blackMonospacedSystemFont(detailFontSize));
  ctx.setTextColor(new Color(SETTINGS.minimumTemperatureColor, 1.0));
  ctx.drawText(minimum, new Point(weatherX, weatherY));
  drawTitleWeatherIcon(ctx, titleForecastForDay(date),
    weatherX + minimumWidth + iconGap + iconSize / 2, weatherCenterY, iconSize);
  ctx.setTextColor(new Color(SETTINGS.maximumTemperatureColor, 1.0));
  ctx.drawText(maximum, new Point(weatherX + minimumWidth + iconGap * 2 + iconSize, weatherY));

  // Terceira linha: somente as letras E e L recebem negrito.
  const parts = [
    { text: "E", bold: true },
    { text: ": " + String(counts.events) + " | ", bold: false },
    { text: "L", bold: true },
    { text: ": " + String(counts.reminders), bold: false },
  ];
  const countLength = parts.reduce((total, part) => total + part.text.length, 0);
  const countFontSize = Math.min(scaleFontSize(16),
    Math.floor((card.width - 16) / (countLength * 0.62)));
  const countCharacterWidth = countFontSize * 0.62;
  let countX = card.x + (card.width - countLength * countCharacterWidth) / 2;
  const countY = weatherCenterY + iconSize / 2 + scaleVertical(4);
  ctx.setTextColor(detailColor);
  for (const part of parts) {
    ctx.setFont(part.bold ? Font.blackMonospacedSystemFont(countFontSize)
      : Font.regularMonospacedSystemFont(countFontSize));
    ctx.drawText(part.text, new Point(countX, countY));
    countX += part.text.length * countCharacterWidth;
  }
}

