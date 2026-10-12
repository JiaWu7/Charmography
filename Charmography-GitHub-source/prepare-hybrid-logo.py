"""Keep the original PNG composition and release complete, compact SVG glyphs."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
ASSETS = ROOT / 'dist' / 'assets'
layout_path = ROOT/'source/png-layout.json'
if not layout_path.exists():
    layout_path.write_bytes(subprocess.check_output([
        'git','show','04869f2ec8baecd65ec6af7c8fb200440efbb40d:dist/assets/logo-map.json'
    ],cwd=ROOT))
first = json.loads(layout_path.read_text())
subprocess.run([sys.executable, str(ROOT/'prepare-vector-logo.py')], check=True)
vector = json.loads((ASSETS/'logo-map.json').read_text())
# Keep the first PNG's font height, compact character centres and logo scale.
# Every released outline keeps its own aspect ratio instead of using a crop.
font_scale = first['glyphs'][0]['height'] / vector['glyphs'][0]['height']
glyphs = []
for original, complete in zip(first['glyphs'],vector['glyphs']):
    assert original['char'] == complete['char']
    w, h = complete['width']*font_scale, complete['height']*font_scale
    glyphs.append(dict(complete,
        x=original['x']+original['width']/2-w/2,
        y=original['y']+original['height']/2-h/2,
        width=w,height=h))
hybrid = dict(source=first['source'],bounds=first['bounds'],ring=first['ring'],
              glyphs=glyphs,rest_image='assets/logo.png',
              vector_font_scale=font_scale)
(ASSETS/'logo-map.json').write_text(json.dumps(hybrid,indent=2)+'\n')
shutil.copyfile(ROOT/'source/web-03.png',ASSETS/'logo.png')
print('Restored original PNG scale and compact positions; complete SVGs appear on release.')
