"""
The two contour erasers, shared with `src/sim/objects/erasers.ts`.

Both remove the same share of a drawing's total stroke length. They differ
in where the gaps are centered:

  mid-line   at the middles of the runs between joints, so every part is
             still recoverable from what is left;
  joints     on the joints themselves: corners, stroke ends that lie near
             another stroke, and crossings, so the places where parts meet
             are hidden.

Joints are found on the vectors before rasterizing. A *corner* is a point
where the stroke turns by more than CORNER_DEG within a window; a *stroke
end near another stroke* is an endpoint within NEAR of some other stroke's
segment; a *crossing* is where two segments intersect. Every joint is a
position along a stroke (stroke index, arc-length). A gap is a window of
arc-length centered on a position; the gaps are grown together until the
total removed is the share asked for, to within the tolerance the test
pins (2%).

Biederman's drawings were made by hand, and in his nonrecoverable versions
the remaining lines were arranged to run smoothly across the joints. These
erasers only approximate his two kinds of deletion; the scene says so.
"""
import math

CORNER_DEG = 60.0
CORNER_WINDOW = 12.0  # arc-length on each side of a point, in the 256 space, over which the turn is measured
NEAR = 10.0           # an endpoint this close to another stroke counts as a joint
MIN_SEG = 2.0         # pieces shorter than this after erasing are dropped (they would be dots)

def _dist_point_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    qx, qy = ax + t * dx, ay + t * dy
    return math.sqrt(((px - qx) * (px - qx)) + ((py - qy) * (py - qy)))

def resample(strokes, step=2.0):
    """Every stroke resampled to points `step` apart along its length (plus its last point), so joints and gaps are measured on even ground."""
    out = []
    for s in strokes:
        xs, ys = s[0], s[1]
        if len(xs) == 1:
            out.append([[xs[0]], [ys[0]]]); continue
        nx, ny = [xs[0]], [ys[0]]
        carry = 0.0
        for k in range(len(xs) - 1):
            ax, ay, bx, by = xs[k], ys[k], xs[k + 1], ys[k + 1]
            seg = math.sqrt(((bx - ax) * (bx - ax)) + ((by - ay) * (by - ay)))
            pos = step - carry
            while pos <= seg:
                t = pos / seg
                nx.append(ax + t * (bx - ax)); ny.append(ay + t * (by - ay))
                pos += step
            carry = seg - (pos - step)
        if nx[-1] != xs[-1] or ny[-1] != ys[-1]:
            nx.append(xs[-1]); ny.append(ys[-1])
        out.append([nx, ny])
    return out

def arc_positions(stroke):
    xs, ys = stroke
    pos = [0.0]
    for k in range(len(xs) - 1):
        pos.append(pos[-1] + math.sqrt(((xs[k + 1] - xs[k]) * (xs[k + 1] - xs[k])) + ((ys[k + 1] - ys[k]) * (ys[k + 1] - ys[k]))))
    return pos

def find_joints(strokes):
    """Joints as (stroke index, arc-length position), with a kind for the record."""
    joints = []
    arcs = [arc_positions(s) for s in strokes]
    for si, s in enumerate(strokes):
        xs, ys = s
        arc = arcs[si]
        n = len(xs)
        # Corners: direction before against direction after, over a window.
        for k in range(1, n - 1):
            a = arc[k]
            i0 = k
            while i0 > 0 and a - arc[i0] < CORNER_WINDOW: i0 -= 1
            i1 = k
            while i1 < n - 1 and arc[i1] - a < CORNER_WINDOW: i1 += 1
            if i0 == k or i1 == k: continue
            v0 = (xs[k] - xs[i0], ys[k] - ys[i0])
            v1 = (xs[i1] - xs[k], ys[i1] - ys[k])
            l0, l1 = math.sqrt((v0[0] * v0[0]) + (v0[1] * v0[1])), math.sqrt((v1[0] * v1[0]) + (v1[1] * v1[1]))
            if l0 == 0 or l1 == 0: continue
            cosang = max(-1.0, min(1.0, (v0[0] * v1[0] + v0[1] * v1[1]) / (l0 * l1)))
            if math.degrees(math.acos(cosang)) > CORNER_DEG:
                joints.append((si, a, "corner"))
        # Stroke ends near another stroke.
        for end in (0, n - 1):
            px, py = xs[end], ys[end]
            near = False
            for sj, o in enumerate(strokes):
                if sj == si: continue
                ox, oy = o
                for k in range(max(len(ox) - 1, 1)):
                    k2 = min(k + 1, len(ox) - 1)
                    if _dist_point_seg(px, py, ox[k], oy[k], ox[k2], oy[k2]) <= NEAR:
                        near = True; break
                if near: break
            if near:
                joints.append((si, arc[end], "end"))
    # Crossings between segments of different strokes (and non-adjacent segments of the same stroke).
    for si, s in enumerate(strokes):
        xs, ys = s
        for sj in range(si, len(strokes)):
            ox, oy = strokes[sj]
            for k in range(len(xs) - 1):
                for m in range(len(ox) - 1):
                    if sj == si and abs(k - m) <= 1: continue
                    hit = _segments_cross(xs[k], ys[k], xs[k + 1], ys[k + 1], ox[m], oy[m], ox[m + 1], oy[m + 1])
                    if hit is not None:
                        t, u = hit
                        joints.append((si, arcs[si][k] + t * (arcs[si][k + 1] - arcs[si][k]), "crossing"))
                        joints.append((sj, arcs[sj][m] + u * (arcs[sj][m + 1] - arcs[sj][m]), "crossing"))
    # Merge joints closer than CORNER_WINDOW on the same stroke.
    joints.sort()
    merged = []
    for j in joints:
        if merged and merged[-1][0] == j[0] and j[1] - merged[-1][1] < CORNER_WINDOW / 2:
            continue
        merged.append(j)
    return merged

def _segments_cross(ax, ay, bx, by, cx, cy, dx, dy):
    r = (bx - ax, by - ay)
    s = (dx - cx, dy - cy)
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9: return None
    t = ((cx - ax) * s[1] - (cy - ay) * s[0]) / den
    u = ((cx - ax) * r[1] - (cy - ay) * r[0]) / den
    if 1e-6 < t < 1 - 1e-6 and 1e-6 < u < 1 - 1e-6:
        return t, u
    return None

def gap_centers(strokes, joints, kind):
    """Where the gaps go: on the joints, or at the middles of the runs between them (stroke ends count as run boundaries)."""
    arcs = [arc_positions(s) for s in strokes]
    centers = []
    for si, s in enumerate(strokes):
        L = arcs[si][-1]
        js = sorted(j[1] for j in joints if j[0] == si)
        if kind == "joints":
            centers.extend((si, p) for p in js)
        else:
            bounds = [0.0] + js + [L]
            for a, b in zip(bounds[:-1], bounds[1:]):
                if b - a > MIN_SEG:
                    centers.append((si, (a + b) / 2))
    return centers

def erase(strokes, share, kind, joints=None):
    """Remove `share` of the total stroke length in gaps centered as `kind` says. Returns (strokes, removedShare, gapHalfWidth)."""
    rs = resample(strokes)
    if joints is None:
        joints = find_joints(rs)
    centers = gap_centers(rs, joints, kind)
    if kind == "joints" and not centers:
        # A drawing with no joints at all gets mid-line gaps instead, and the record says so.
        centers = gap_centers(rs, joints, "mid")
    total = sum(arc_positions(s)[-1] for s in rs)
    target = share * total
    # Grow one half-width for every gap until the removed length reaches the target (bisection on the half-width).
    lo, hi = 0.0, total
    for _ in range(40):
        mid = (lo + hi) / 2
        removed = _removed_length(rs, centers, mid)
        if removed < target: lo = mid
        else: hi = mid
    half = (lo + hi) / 2
    return _apply(rs, centers, half), _removed_length(rs, centers, half) / total, half

def _intervals(centers, half, n_strokes):
    per = [[] for _ in range(n_strokes)]
    for si, c in centers:
        per[si].append((c - half, c + half))
    out = []
    for iv in per:
        iv.sort()
        merged = []
        for a, b in iv:
            if merged and a <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], b))
            else:
                merged.append((a, b))
        out.append(merged)
    return out

def _removed_length(rs, centers, half):
    iv = _intervals(centers, half, len(rs))
    removed = 0.0
    for si, s in enumerate(rs):
        L = arc_positions(s)[-1]
        for a, b in iv[si]:
            removed += max(0.0, min(b, L) - max(a, 0.0))
    return removed

def _apply(rs, centers, half):
    """Cut the gaps out of each stroke, producing the pieces that remain."""
    iv = _intervals(centers, half, len(rs))
    out = []
    for si, s in enumerate(rs):
        xs, ys = s
        arc = arc_positions(s)
        L = arc[-1]
        keep = []
        pos = 0.0
        for a, b in iv[si]:
            if a > pos: keep.append((pos, a))
            pos = max(pos, b)
        if pos < L: keep.append((pos, L))
        for a, b in keep:
            if b - a < MIN_SEG: continue
            out.append(_slice(xs, ys, arc, a, b))
    return out

def _point_at(xs, ys, arc, p):
    for k in range(len(arc) - 1):
        if arc[k] <= p <= arc[k + 1]:
            seg = arc[k + 1] - arc[k]
            t = 0.0 if seg == 0 else (p - arc[k]) / seg
            return xs[k] + t * (xs[k + 1] - xs[k]), ys[k] + t * (ys[k + 1] - ys[k])
    return xs[-1], ys[-1]

def _slice(xs, ys, arc, a, b):
    px, py = _point_at(xs, ys, arc, a)
    nx, ny = [px], [py]
    for k in range(len(arc)):
        if a < arc[k] < b:
            nx.append(xs[k]); ny.append(ys[k])
    qx, qy = _point_at(xs, ys, arc, b)
    nx.append(qx); ny.append(qy)
    return [nx, ny]

def move_part(strokes, part_indices, dx, dy):
    """Move the strokes in `part_indices` by (dx, dy): the moved-part manipulation."""
    return [[[x + dx for x in s[0]], [y + dy for y in s[1]]] if i in part_indices else s for i, s in enumerate(strokes)]
