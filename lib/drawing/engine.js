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

  if (isHighlighter) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = stroke.color || '#facc15';
    ctx.lineWidth = (stroke.width || 18) * 1.5;
  } else if (isPencil) {
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = stroke.color || '#475569';
    ctx.lineWidth = Math.max(1, (stroke.width || 2) * 0.8);
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.strokeStyle = stroke.color || '#0f172a';
    ctx.lineWidth = stroke.width || 4;
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
  ctx.lineWidth = shape.width || 3;
  ctx.globalAlpha = shape.opacity ?? 1;

  const fill = shape.fillColor && shape.fillColor !== 'transparent' ? shape.fillColor : null;
  if (fill) {
    ctx.fillStyle = fill;
  }

  switch (shape.type) {
    case 'rect': {
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
      const angle = Math.atan2(dy, dx);
      const headLength = Math.max(14, ctx.lineWidth * 3.5);

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

// Test if a point hits a shape
export function hitTestShape(shape, targetX, targetY) {
  const xMin = Math.min(shape.startX, shape.endX) - 10;
  const xMax = Math.max(shape.startX, shape.endX) + 10;
  const yMin = Math.min(shape.startY, shape.endY) - 10;
  const yMax = Math.max(shape.startY, shape.endY) + 10;

  return targetX >= xMin && targetX <= xMax && targetY >= yMin && targetY <= yMax;
}
