"""Outline the supplied SVG's live font into exact, independent letter assets."""
import json
import math
import re
from pathlib import Path
from xml.etree import ElementTree as ET

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).parent
ASSETS = ROOT / 'dist' / 'assets'
font = TTFont(ROOT / 'source' / 'MoiraiOne-Regular.ttf')
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 85.4 / font['head'].unitsPerEm
ns = {'svg': 'http://www.w3.org/2000/svg'}
svg = ET.parse(ROOT / 'source' / 'web-04.svg').getroot()
stroke_width = 8
items = []

def rotate(x, y, angle):
    r = math.radians(angle)
    return x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r)

for text_node in svg.findall('svg:text', ns):
    transform = text_node.attrib['transform']
    translate = re.search(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)', transform)
    angle_match = re.search(r'rotate\(([-\d.]+)\)', transform)
    anchor_x, anchor_y = map(float, translate.groups())
    angle = float(angle_match.group(1)) if angle_match else 0
    color = '#c6c6c6' if text_node.attrib['class'] == 'cls-2' else '#f3afcd'
    advance = 0
    for char in ''.join(text_node.itertext()):
        name = cmap[ord(char)]
        if char.isspace():
            advance += font['hmtx'][name][0] * scale
            continue
        bounds_pen = BoundsPen(glyph_set)
        glyph_set[name].draw(bounds_pen)
        xmin, ymin, xmax, ymax = bounds_pen.bounds
        x0, y0 = xmin*scale - stroke_width/2, -ymax*scale - stroke_width/2
        x1, y1 = xmax*scale + stroke_width/2, -ymin*scale + stroke_width/2
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, 0, 0)))
        path = pen.getCommands()
        dx, dy = rotate(advance, 0, angle)
        origin_x, origin_y = anchor_x + dx, anchor_y + dy
        cx, cy = rotate((x0+x1)/2, (y0+y1)/2, angle)
        corners = [rotate(x, y, angle) for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]]
        items.append(dict(char=char, color=color, path=path,
                          origin_x=origin_x, origin_y=origin_y,
                          center_x=origin_x+cx, center_y=origin_y+cy,
                          box=(x0,y0,x1-x0,y1-y0), rotation=angle,
                          corners=[(origin_x+x,origin_y+y) for x,y in corners]))
        advance += font['hmtx'][name][0] * scale

min_x = min(x for item in items for x,y in item['corners'])
max_x = max(x for item in items for x,y in item['corners'])
min_y = min(y for item in items for x,y in item['corners'])
max_y = max(y for item in items for x,y in item['corners'])
width, height = max_x-min_x, max_y-min_y
full = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}">', f'<g transform="translate({-min_x:g} {-min_y:g})">']
glyphs = []
ring = None
for item in items:
    path = (f'<path d="{item["path"]}" fill="#fff" stroke="{item["color"]}" '
            f'stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>')
    x0,y0,w,h = item['box']
    asset = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {y0:g} {w:g} {h:g}">{path}</svg>\n'
    data = dict(char=item['char'], x=item['center_x']-min_x-w/2,
                y=item['center_y']-min_y-h/2, width=w, height=h,
                rotation=item['rotation'])
    if item['char'] == 'o':
        (ASSETS/'ring.svg').write_text(asset)
        ring = dict(x=item['center_x']-min_x, y=item['center_y']-min_y, width=w, height=h)
    else:
        name = f'letter-{len(glyphs):02d}.svg'
        (ASSETS/name).write_text(asset)
        data['src'] = 'assets/' + name
        glyphs.append(data)
    full.append(f'<g transform="translate({item["origin_x"]:g} {item["origin_y"]:g}) rotate({item["rotation"]:g})">{path}</g>')
full.extend(['</g>','</svg>\n'])
(ASSETS/'logo.svg').write_text(''.join(full))
assert ''.join(item['char'] for item in items) == 'Charmography'
assert len(glyphs) == 11 and ring
(ASSETS/'logo-map.json').write_text(json.dumps(dict(
    source=dict(width=width,height=height),
    bounds=dict(x=0,y=0,width=width,height=height),
    ring=ring,glyphs=glyphs,
),indent=2)+'\n')
print(f'Outlined 12 glyphs from Moirai One; logo bounds {width:.2f} × {height:.2f}.')
