"""BrewDesk app icon generator.

Motif: a coffee cup whose steam is a wifi signal — the product in one glyph
(measured wifi + a cafe to work from). Bamware studio palette: graphite
surface, signal-lime mark. Rendered at 8x and downsampled for clean edges.

Outputs the three appearances iOS 18 asks for in a single-size appiconset:
light, dark, tinted (tinted must be a grayscale mark on transparent —
the system applies the user's tint).
"""

from PIL import Image, ImageDraw

S = 1024
SS = 8  # supersample factor
N = S * SS

GRAPHITE_TOP = (26, 29, 33)
GRAPHITE_BOT = (12, 14, 16)
DARK_TOP = (16, 18, 21)
DARK_BOT = (7, 8, 9)
LIME = (168, 232, 47)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        d.point(
            (0, y),
            fill=(
                round(top[0] + (bottom[0] - top[0]) * t),
                round(top[1] + (bottom[1] - top[1]) * t),
                round(top[2] + (bottom[2] - top[2]) * t),
            ),
        )
    return img.resize((size, size), Image.NEAREST)


def draw_mark(draw, color):
    """Cup + saucer + wifi steam, centred in an N x N canvas.

    Drawn handle-first so the cup body paints over the handle's inner end —
    that overlap is what makes the handle read as attached rather than floating.
    """
    cx = N // 2

    # --- wifi steam: three concentric arcs rising out of the cup ---
    origin_y = int(N * 0.475)
    stroke = int(N * 0.048)
    for radius_f in (0.098, 0.176, 0.254):
        r = int(N * radius_f)
        draw.arc(
            (cx - r, origin_y - r, cx + r, origin_y + r),
            start=212, end=328, fill=color, width=stroke,
        )

    dot = int(N * 0.027)
    draw.ellipse((cx - dot, origin_y - dot, cx + dot, origin_y + dot), fill=color)

    # --- geometry ---
    rim_half = int(N * 0.163)
    base_half = int(N * 0.118)
    rim_y = int(N * 0.560)
    base_y = int(N * 0.752)
    mid_half = (rim_half + base_half) // 2

    # --- handle (behind the body) ---
    # Sits just outside the body edge: far enough out that its opening stays
    # visible, far enough in that both ends are covered by the cup.
    # The sweep must reach past 117 deg either side of horizontal, or the arc's
    # endpoints never come back far enough left to meet the body and the handle
    # reads as a detached crescent.
    h_stroke = int(N * 0.038)
    hr = int(N * 0.080)
    h_cx = cx + mid_half + int(N * 0.026)
    h_cy = (rim_y + base_y) // 2
    draw.arc(
        (h_cx - hr, h_cy - hr, h_cx + hr, h_cy + hr),
        start=235, end=125, fill=color, width=h_stroke,
    )

    # --- cup body: tapered, with a rounded base ---
    radius = int(N * 0.030)
    draw.polygon(
        [
            (cx - rim_half, rim_y),
            (cx + rim_half, rim_y),
            (cx + base_half, base_y - radius),
            (cx - base_half, base_y - radius),
        ],
        fill=color,
    )
    draw.rounded_rectangle(
        (cx - base_half, base_y - radius * 2, cx + base_half, base_y),
        radius=radius,
        fill=color,
    )

    # --- saucer: tucked under the cup so the two read as one object ---
    s_half = int(N * 0.232)
    s_h = int(N * 0.034)
    s_y = base_y + int(N * 0.014)
    draw.rounded_rectangle(
        (cx - s_half, s_y, cx + s_half, s_y + s_h),
        radius=s_h // 2,
        fill=color,
    )


def render(background, mark_color, path, transparent=False):
    if transparent:
        base = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    else:
        base = background.resize((N, N), Image.NEAREST).convert("RGBA")

    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(layer), mark_color)
    base = Image.alpha_composite(base, layer)

    out = base.resize((S, S), Image.LANCZOS)
    if not transparent:
        out = out.convert("RGB")
    out.save(path)
    print("wrote", path)


if __name__ == "__main__":
    import sys

    outdir = sys.argv[1].rstrip("/")

    render(vertical_gradient(S, GRAPHITE_TOP, GRAPHITE_BOT), LIME + (255,),
           f"{outdir}/icon-1024.png")
    render(vertical_gradient(S, DARK_TOP, DARK_BOT), LIME + (255,),
           f"{outdir}/icon-1024-dark.png")
    # Tinted: grayscale mark on transparent; iOS composites its own tint.
    render(None, (255, 255, 255, 255), f"{outdir}/icon-1024-tinted.png",
           transparent=True)
