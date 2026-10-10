"""
The rasterizer shared, line for line, with `src/sim/objects/raster.ts`.

A drawing is a list of strokes; a stroke is a list of (x, y) points in the
256 × 256 space Quick, Draw! uses. `normalize` is the dataset's own step,
which the scene calls *Center and scale the drawing first*: translate so the
drawing's bounding box starts at the origin, scale so its longer side is 255,
then center it in the box. `rasterize` draws every segment as a thick line
into a SIZE × SIZE grayscale image, ink = 1, with no antialiasing: a pixel is
ink when its center lies within RADIUS of the segment. Every operation is
plain IEEE double arithmetic in the same order in both languages, so the two
rasterizers agree pixel for pixel (`raster.test.ts` checks fixtures made here).
"""
import math

SIZE = 64
# The 256-space is mapped onto SIZE with a margin, so a stroke at the edge is not cut.
MARGIN = 4.0
SCALE = (SIZE - 2 * MARGIN) / 255.0
RADIUS = 1.1

def bounds(strokes):
    xs = [p for s in strokes for p in s[0]]
    ys = [p for s in strokes for p in s[1]]
    return min(xs), min(ys), max(xs), max(ys)

def normalize(strokes):
    """Quick, Draw!'s own alignment: bounding box to the origin, longer side to 255, then centered in the 256 square."""
    x0, y0, x1, y1 = bounds(strokes)
    w = x1 - x0
    h = y1 - y0
    longer = max(w, h)
    k = 255.0 / longer if longer > 0 else 1.0
    ox = (255.0 - w * k) / 2.0
    oy = (255.0 - h * k) / 2.0
    return [[[(x - x0) * k + ox for x in s[0]], [(y - y0) * k + oy for y in s[1]]] for s in strokes]

def transform(strokes, dx=0.0, dy=0.0, angle_deg=0.0, scale=1.0, cx=127.5, cy=127.5):
    """Rotate about (cx, cy) by angle_deg, scale about it, then shift by (dx, dy), all in the 256 space."""
    a = angle_deg * math.pi / 180.0
    ca = math.cos(a)
    sa = math.sin(a)
    out = []
    for s in strokes:
        xs = []
        ys = []
        for x, y in zip(s[0], s[1]):
            rx = x - cx
            ry = y - cy
            nx = (rx * ca - ry * sa) * scale + cx + dx
            ny = (rx * sa + ry * ca) * scale + cy + dy
            xs.append(nx)
            ys.append(ny)
        out.append([xs, ys])
    return out

def rasterize(strokes, size=SIZE):
    """A size × size list of rows of 0.0/1.0. Pixel (i, j) has its center at (j + 0.5, i + 0.5) in pixel units."""
    img = [[0.0] * size for _ in range(size)]
    r2 = RADIUS * RADIUS
    for s in strokes:
        xs = s[0]
        ys = s[1]
        n = len(xs)
        for k in range(max(n - 1, 1)):
            ax = xs[k] * SCALE + MARGIN
            ay = ys[k] * SCALE + MARGIN
            bx = xs[min(k + 1, n - 1)] * SCALE + MARGIN
            by = ys[min(k + 1, n - 1)] * SCALE + MARGIN
            lo_x = max(0, int(math.floor(min(ax, bx) - RADIUS)))
            hi_x = min(size - 1, int(math.floor(max(ax, bx) + RADIUS)))
            lo_y = max(0, int(math.floor(min(ay, by) - RADIUS)))
            hi_y = min(size - 1, int(math.floor(max(ay, by) + RADIUS)))
            dx = bx - ax
            dy = by - ay
            len2 = dx * dx + dy * dy
            for i in range(lo_y, hi_y + 1):
                py = i + 0.5
                for j in range(lo_x, hi_x + 1):
                    px = j + 0.5
                    if len2 > 0:
                        t = ((px - ax) * dx + (py - ay) * dy) / len2
                        t = 0.0 if t < 0.0 else 1.0 if t > 1.0 else t
                    else:
                        t = 0.0
                    qx = ax + t * dx
                    qy = ay + t * dy
                    ex = px - qx
                    ey = py - qy
                    if ex * ex + ey * ey <= r2:
                        img[i][j] = 1.0
    return img

def stroke_length(strokes):
    total = 0.0
    for s in strokes:
        for k in range(len(s[0]) - 1):
            total += math.sqrt(((s[0][k + 1] - s[0][k]) * (s[0][k + 1] - s[0][k])) + ((s[1][k + 1] - s[1][k]) * (s[1][k + 1] - s[1][k])))
    return total
