/**
 * Pure geometry for the extraction overlay viewer. DocuPipe bounding boxes
 * are normalized (0..1, origin top-left) against the page as the extractor
 * rendered it — the same basis pdf.js uses by default. When the user rotates
 * the view, the boxes must rotate through the same transform to stay glued to
 * the page content.
 */

export type NormalizedRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Inverse of {@link rotateRect}: map a rect expressed in the rotated view
 * back to the document's base orientation. Used when the user drags a box in
 * a rotated view — DocuPipe stores coordinates against the unrotated page.
 */
export function unrotateRect(
  rect: NormalizedRect,
  extra: number,
): NormalizedRect {
  const r = ((extra % 360) + 360) % 360
  return rotateRect(rect, (360 - r) % 360)
}

/** Clamp a normalized rect so it stays fully inside the page (0..1). */
export function clampRectToPage(rect: NormalizedRect): NormalizedRect {
  const width = Math.min(1, Math.max(0.001, rect.width))
  const height = Math.min(1, Math.max(0.001, rect.height))
  return {
    x: Math.min(1 - width, Math.max(0, rect.x)),
    y: Math.min(1 - height, Math.max(0, rect.y)),
    width,
    height,
  }
}

/** Rotate a normalized rect by `extra` degrees clockwise (multiples of 90). */
export function rotateRect(
  rect: NormalizedRect,
  extra: number,
): NormalizedRect {
  const r = ((extra % 360) + 360) % 360
  if (r === 90) {
    return {
      x: 1 - (rect.y + rect.height),
      y: rect.x,
      width: rect.height,
      height: rect.width,
    }
  }
  if (r === 180) {
    return {
      x: 1 - (rect.x + rect.width),
      y: 1 - (rect.y + rect.height),
      width: rect.width,
      height: rect.height,
    }
  }
  if (r === 270) {
    return {
      x: rect.y,
      y: 1 - (rect.x + rect.width),
      width: rect.height,
      height: rect.width,
    }
  }
  return rect
}
