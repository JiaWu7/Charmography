"""Extract vector letter sprites from the supplied logo for the interaction.

The untouched PNG is used for the resting logo. Connected pink shapes are
partitioned into letters; the hidden parts beneath the ring are not invented.
"""
import json
import shutil
from pathlib import Path

import contourpy
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, label

ROOT = Path(__file__).parent
ASSETS = ROOT / 'dist' / 'assets'
SOURCE = ROOT / 'source' / 'web-03.png'
ASSETS.mkdir(parents=True, exist_ok=True)
rgba = np.array(Image.open(SOURCE).convert('RGBA'))
pink = (rgba[:, :, 3] > 25) & (
    rgba[:, :, 0].astype(int) - rgba[:, :, 1].astype(int) > 15
)
labels, _ = label(pink)
word = np.zeros(labels.shape, np.uint8)
for component_id in range(1, int(labels.max()) + 1):
    ys, xs = np.where(labels == component_id)
    if len(xs) > 100:
        word[labels == component_id] = 1 if len(xs) < 55000 else 2
# Attach faint antialiased edge pixels to the nearest solid pink shape.
_, nearest = distance_transform_edt(word == 0, return_indices=True)
nearest_word = word[nearest[0], nearest[1]]
pink_all = (rgba[:, :, 3] > 0) & (
    rgba[:, :, 0].astype(int) - rgba[:, :, 1].astype(int) > 15
)
glyphs = []
groups = [
    (1, 'Charm', [261, 434, 576, 710, 830, 1012]),
    (2, 'graphy', [972, 1145, 1270, 1410, 1541, 1686, 1815]),
]
for group_id, text, cuts in groups:
    for index, char in enumerate(text):
        x0, x1 = cuts[index:index + 2]
        local = pink_all[:, x0:x1] & (nearest_word[:, x0:x1] == group_id)
        ys, xs = np.where(local)
        left, top = x0 + int(xs.min()), int(ys.min())
        right, bottom = x0 + int(xs.max()) + 1, int(ys.max()) + 1
        mask = (local[top:bottom, left-x0:right-x0].astype(np.uint8) * 255)
        contours = contourpy.contour_generator(z=np.pad(mask / 255., 1)).lines(.5)
        parts = []
        for contour in contours:
            if len(contour) < 3:
                continue
            points = contour - 1
            # Keep only turns, retaining the original pixel outline.
            keep = []
            for j, point in enumerate(points):
                previous = points[j-1]
                following = points[(j+1) % len(points)]
                a, b = point-previous, following-point
                if abs(a[0]*b[1]-a[1]*b[0]) > .01:
                    keep.append(point)
            if len(keep) >= 3:
                parts.append('M' + ' L'.join(f'{x:g},{y:g}' for x, y in keep) + ' Z')
        width, height = right-left, bottom-top
        filename = f'letter-{len(glyphs):02d}.svg'
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">'
            f'<path fill="#f4afcd" fill-rule="evenodd" d="{" ".join(parts)}"/>'
            '</svg>\n'
        )
        (ASSETS / filename).write_text(svg)
        glyphs.append(dict(char=char, x=left-261, y=top-532,
                           width=width, height=height, src=f'assets/{filename}'))
shutil.copyfile(SOURCE, ASSETS / 'logo.png')
(ASSETS / 'ring.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132"><ellipse cx="66" cy="66" rx="53" ry="50" transform="rotate(-38 66 66)" fill="none" stroke="#c6c6c6" stroke-width="22"/></svg>\n''')
(ASSETS / 'logo-map.json').write_text(json.dumps(dict(
    source=dict(width=2048, height=1448),
    bounds=dict(x=261, y=532, width=1554, height=373),
    ring=dict(x=746, y=183.5, width=132, height=132),
    glyphs=glyphs,
), indent=2) + '\n')
print(f'Prepared {len(glyphs)} vector letter sprites; retained original PNG.')
