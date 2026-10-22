// @ts-nocheck
// Generated from original rasterizeDiagonalWeekdayLabels. No runtime eval.
export function drawDiagonal(context, entries, options) {
const canvasWidth=options.width;
  const gridTop = Number(entries[0].top);
  const gridBottom = Number(entries[0].bottom);
  const rgba = function(hex, alpha) {
    const value = hex.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
  };
  const minFontSize = options.minFontSize;
  const minDateFontSize = options.minDateFontSize;
  const maxFontSize = options.maxFontSize;
  const fontFamily = 'Arial Narrow, HelveticaNeue-CondensedBlack, Impact, Arial Black, sans-serif';
  const verticalScale = options.verticalScale;
  const minimumHorizontalScale = 0.62;
  const maximumHorizontalScale = 1.45;
  const chooseTypography = function(entry) {
    const x0 = Number(entry.x0);
    const x1 = Number(entry.x1);
    const top = Number(entry.top);
    const bottom = Number(entry.bottom);
    const dx = x1 - x0;
    const dy = bottom - top;
    const angle = -Math.atan2(dy, dx);
    const theta = Math.abs(angle);
    const sinTheta = Math.max(0.0001, Math.sin(theta));
    const cosTheta = Math.max(0.0001, Math.cos(theta));
    let selected = null;
    let closestAboveMaximum = null;
    let closestBelowMinimum = null;
    for (let candidateSize = minFontSize; candidateSize <= maxFontSize; candidateSize += 2) {
      context.font = '900 ' + candidateSize + 'px ' + fontFamily;
      const measuredWidth = Math.max(1, context.measureText(entry.label).width);
      const strokeWidth = Math.max(2.6, candidateSize * 0.07);
      const dateFontSize = Math.max(minDateFontSize, Math.round(candidateSize * 0.38));
      const dateStrokeWidth = Math.max(1, dateFontSize * 0.07);
      const weekdayHeight = candidateSize * verticalScale + strokeWidth * 2;
      const dateHeight = dateFontSize * verticalScale + dateStrokeWidth * 2;
      const lineGap = Math.max(2, dateFontSize * 0.2);
      const textHeight = weekdayHeight + lineGap + dateHeight;
      const weekdayCenterOffset = -(lineGap + dateHeight) / 2;
      const dateCenterOffset = (weekdayHeight + lineGap) / 2;
      const widthLimit =
        (dx - textHeight * sinTheta) / cosTheta;
      const heightLimit =
        (dy - textHeight * cosTheta) / sinTheta;
      const safeLength =
        Math.max(1, Math.min(widthLimit, heightLimit)) * 0.94;
      const horizontalScale = safeLength / measuredWidth;
      const typography = {
        fontSize: candidateSize,
        measuredWidth,
        strokeWidth,
        dateFontSize,
        dateStrokeWidth,
        weekdayCenterOffset,
        dateCenterOffset,
        safeLength,
        horizontalScale,
        angle,
      };
      if (
        horizontalScale >= minimumHorizontalScale &&
        horizontalScale <= maximumHorizontalScale
      ) {
        selected = typography;
      } else if (
        horizontalScale > maximumHorizontalScale &&
        (!closestAboveMaximum ||
          horizontalScale < closestAboveMaximum.horizontalScale)
      ) {
        closestAboveMaximum = typography;
      } else if (
        horizontalScale < minimumHorizontalScale &&
        (!closestBelowMinimum ||
          horizontalScale > closestBelowMinimum.horizontalScale)
      ) {
        closestBelowMinimum = typography;
      }
    }
    selected =
      selected || closestAboveMaximum || closestBelowMinimum;
    if (!selected) return null;
    const targetLength =
      selected.horizontalScale > maximumHorizontalScale
        ? selected.measuredWidth * maximumHorizontalScale
        : selected.safeLength;
    return {
      ...selected,
      targetLength,
      horizontalScale: targetLength / selected.measuredWidth,
    };
  };
  context.save();
  context.beginPath();
  context.rect(0, gridTop, canvasWidth, Math.max(1, gridBottom - gridTop));
  context.clip();
  for (const entry of entries) {
    const x0 = Number(entry.x0);
    const x1 = Number(entry.x1);
    const top = Number(entry.top);
    const bottom = Number(entry.bottom);
    if (!(x1 > x0) || !(bottom > top)) continue;
    const typography = chooseTypography(entry);
    if (!typography) continue;
    context.font =
      '900 ' + typography.fontSize + 'px ' + fontFamily;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.save();
    context.beginPath();
    context.rect(x0, top, x1 - x0, bottom - top);
    context.clip();
    const centerX = Number.isFinite(Number(entry.centerX))
      ? Number(entry.centerX)
      : (x0 + x1) / 2;
    const centerY = Number.isFinite(Number(entry.centerY))
      ? Number(entry.centerY)
      : (top + bottom) / 2;
    context.translate(centerX, centerY);
    context.rotate(typography.angle);
    context.scale(typography.horizontalScale, verticalScale);
    context.lineJoin = 'round';
    const weekdayCenterY = typography.weekdayCenterOffset;
    const dateCenterY = typography.dateCenterOffset;
    context.lineWidth = typography.strokeWidth + 1.8;
    context.strokeStyle = rgba('#000000', 0.22);
    context.strokeText(entry.label, 0, weekdayCenterY);
    context.lineWidth = typography.strokeWidth;
    context.strokeStyle = rgba('#FFFFFF', 0.30);
    context.strokeText(entry.label, 0, weekdayCenterY);
    context.fillStyle = rgba(entry.color, 1);
    context.fillText(entry.label, 0, weekdayCenterY);
    if (entry.dateLabel) {
      context.font = '900 ' + typography.dateFontSize + 'px ' + fontFamily;
      context.lineWidth = typography.dateStrokeWidth + 1.2;
      context.strokeStyle = rgba('#000000', 0.22);
      context.strokeText(entry.dateLabel, 0, dateCenterY);
      context.lineWidth = typography.dateStrokeWidth;
      context.strokeStyle = rgba('#FFFFFF', 0.30);
      context.strokeText(entry.dateLabel, 0, dateCenterY);
      context.fillStyle = rgba(entry.color, 1);
      context.fillText(entry.dateLabel, 0, dateCenterY);
    }
    context.restore();
  }
  context.restore();

}
