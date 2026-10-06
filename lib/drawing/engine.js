// Coordinate conversion between screen pixels and world document coordinates
export function screenToWorld(screenX, screenY, zoom, panX, panY) {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom
  };
}

export function worldToScreen(worldX, worldY, zoom, panX, panY) {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY
  };
}

// Distance between two points
export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Shortest distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Ramer-Douglas-Peucker stroke simplification to reduce points by 60-80% without visual degradation
export function simplifyPoints(points, tolerance = 1.5) {
  if (points.length <= 2) return points;

  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return distance(point, lineStart);
    return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
  }

  function rdp(pts, start, end) {
    let maxDist = 0;
    let index = 0;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(pts[i], pts[start], pts[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > tolerance) {
      const res1 = rdp(pts, start, index);
      const res2 = rdp(pts, index, end);
      return [...res1.slice(0, -1), ...res2];
    } else {
      return [pts[start], pts[end]];
    }
  }

  return rdp(points, 0, points.length - 1);
}

// Render a smooth stroke with Bezier midpoint interpolation
export function renderStroke(ctx, stroke) {
  const points = stroke.points;
  if (!points || points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const isHighlighter = stroke.tool === 'highlighter';
  const isPencil = stroke.tool === 'pencil';
  const strokeW = Number(stroke.width) || (isHighlighter ? 18 : isPencil ? 2 : 4);

  if (isHighlighter) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = stroke.color || '#facc15';
    ctx.lineWidth = strokeW;
  } else if (isPencil) {
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = stroke.color || '#475569';
    ctx.lineWidth = strokeW;
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.strokeStyle = stroke.color || '#0f172a';
    ctx.lineWidth = strokeW;
  }

  if (points.length === 1) {
    // Single dot
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Multi-point smooth curve using midpoint quadratic Bezier
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
  }

  // Draw through last point
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

// Render geometric shapes: rectangle, circle, line, arrow
export function renderShape(ctx, shape) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = shape.color || '#0f172a';
  ctx.lineWidth = Number(shape.width) || 3;
  ctx.globalAlpha = shape.opacity ?? 1;

  const fill = shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : null;
  if (fill) {
    ctx.fillStyle = fill;
  }

  switch (shape.type) {
    case 'rect':
    case 'rectangle': {
      const x = Math.min(shape.startX, shape.endX);
      const y = Math.min(shape.startY, shape.endY);
      const w = Math.abs(shape.endX - shape.startX);
      const h = Math.abs(shape.endY - shape.startY);
      if (fill) ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      break;
    }

    case 'circle': {
      const rx = Math.abs(shape.endX - shape.startX) / 2;
      const ry = Math.abs(shape.endY - shape.startY) / 2;
      const cx = (shape.startX + shape.endX) / 2;
      const cy = (shape.startY + shape.endY) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      if (fill) ctx.fill();
      ctx.stroke();
      break;
    }

    case 'line': {
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const dx = shape.endX - shape.startX;
      const dy = shape.endY - shape.startY;
      const arrowDist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const headLength = Math.min(Math.max(12, ctx.lineWidth * 3.2), Math.max(arrowDist * 0.5, 4));

      // Main shaft
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();

      // Arrow head wings
      ctx.beginPath();
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(
        shape.endX - headLength * Math.cos(angle - Math.PI / 6),
        shape.endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(
        shape.endX - headLength * Math.cos(angle + Math.PI / 6),
        shape.endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// Test if an eraser pointer hit a stroke
export function hitTestStroke(stroke, targetX, targetY, threshold = 12) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;

  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i].x - targetX, pts[i].y - targetY) < threshold + (stroke.width || 4) / 2) {
      return true;
    }
  }
  return false;
}

// Precise hit-testing for shapes: prevents erasing hollow shapes from empty centers or distant diagonal clicks
export function hitTestShape(shape, targetX, targetY, threshold = 14) {
  const lineWidth = Number(shape.width) || 3;
  const effectiveThreshold = threshold + lineWidth / 2;

  if (shape.type === 'line' || shape.type === 'arrow') {
    return pointToSegmentDistance(targetX, targetY, shape.startX, shape.startY, shape.endX, shape.endY) <= effectiveThreshold;
  }

  if (shape.type === 'rect' || shape.type === 'rectangle') {
    const xMin = Math.min(shape.startX, shape.endX);
    const xMax = Math.max(shape.startX, shape.endX);
    const yMin = Math.min(shape.startY, shape.endY);
    const yMax = Math.max(shape.startY, shape.endY);

    const isFilled = shape.fillColor && shape.fillColor !== 'transparent';
    if (isFilled) {
      return targetX >= xMin - effectiveThreshold &&
             targetX <= xMax + effectiveThreshold &&
             targetY >= yMin - effectiveThreshold &&
             targetY <= yMax + effectiveThreshold;
    }

    // Hollow rect: only hit near the 4 border edges
    const dTop = pointToSegmentDistance(targetX, targetY, xMin, yMin, xMax, yMin);
    const dBottom = pointToSegmentDistance(targetX, targetY, xMin, yMax, xMax, yMax);
    const dLeft = pointToSegmentDistance(targetX, targetY, xMin, yMin, xMin, yMax);
    const dRight = pointToSegmentDistance(targetX, targetY, xMax, yMin, xMax, yMax);

    return Math.min(dTop, dBottom, dLeft, dRight) <= effectiveThreshold;
  }

  if (shape.type === 'circle') {
    const rx = Math.max(Math.abs(shape.endX - shape.startX) / 2, 1);
    const ry = Math.max(Math.abs(shape.endY - shape.startY) / 2, 1);
    const cx = (shape.startX + shape.endX) / 2;
    const cy = (shape.startY + shape.endY) / 2;

    const normDist = Math.hypot((targetX - cx) / rx, (targetY - cy) / ry);
    const isFilled = shape.fillColor && shape.fillColor !== 'transparent';

    if (isFilled) {
      return normDist <= 1 + effectiveThreshold / Math.min(rx, ry);
    }

    // Hollow ellipse: only hit near perimeter
    const minR = Math.min(rx, ry);
    return Math.abs(normDist - 1) * minR <= effectiveThreshold;
  }

  // Fallback bounding box check
  const xMin = Math.min(shape.startX, shape.endX) - effectiveThreshold;
  const xMax = Math.max(shape.startX, shape.endX) + effectiveThreshold;
  const yMin = Math.min(shape.startY, shape.endY) - effectiveThreshold;
  const yMax = Math.max(shape.startY, shape.endY) + effectiveThreshold;

  return targetX >= xMin && targetX <= xMax && targetY >= yMin && targetY <= yMax;
}
