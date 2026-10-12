export function createScene(Matter, map, width, height, options = {}) {
  const { Engine, Bodies, Body, Composite, Sleeping } = Matter;
  const engine = Engine.create({ enableSleeping:true, positionIterations:8, velocityIterations:8 });
  engine.gravity.y = .85;
  const narrow = width <= 640;
  const scale = Math.min(width * (narrow ? .89 : .8), 1320) / map.bounds.width;
  const floor = height - (narrow ? 24 : 28);
  const left = (width - map.bounds.width * scale) / 2;
  const top = Math.max(65, Math.min(height * .30, floor - map.bounds.height * scale - 80));
  const letters = map.glyphs.map((glyph, index) => {
    const w = glyph.width * scale, h = glyph.height * scale;
    const x = left + (glyph.x + glyph.width / 2) * scale;
    const y = top + (glyph.y + glyph.height / 2) * scale;
    const body = Bodies.rectangle(x, y, w, h, {
      restitution:.25, friction:.72, frictionStatic:1.1,
      frictionAir:.016, density:.002, sleepThreshold:90, label:`letter-${index}`
    });
    Body.setAngle(body, (glyph.rotation ?? 0) * Math.PI / 180);
    // Create a finite-mass body first so changing it back from static retains
    // its mass and inertia when the connection is released.
    Body.setStatic(body, true);
    return { glyph, body, width:w, height:h, origin:{ x, y } };
  });
  const ringWidth = map.ring.width * scale;
  const ringHeight = map.ring.height * scale;
  const ringSize = Math.max(ringWidth, ringHeight);
  const ringOrigin = { x:left+map.ring.x*scale, y:top+map.ring.y*scale };
  const ring = Bodies.circle(ringOrigin.x, ringOrigin.y, ringSize * .49, {
    restitution:.25, friction:.7, frictionAir:.02,
    density:.002, sleepThreshold:90, label:'connecting-o'
  });
  Body.setStatic(ring, true);
  const border = narrow ? 18 : 28;
  Composite.add(engine.world, [
    ...letters.map(x => x.body), ring,
    Bodies.rectangle(width/2, floor+50, width+200, 100, { isStatic:true, friction:.8, label:'floor' }),
    Bodies.rectangle(border-50, height/2, 100, height+300, { isStatic:true, label:'left-wall' }),
    Bodies.rectangle(width-border+50, height/2, 100, height+300, { isStatic:true, label:'right-wall' }),
    Bodies.rectangle(width/2, -60, width+200, 100, { isStatic:true, label:'ceiling' })
  ]);
  let released = false, reduced = !!options.reducedMotion;
  const scene = {
    engine, letters, ring, ringSize, ringWidth, ringHeight, ringOrigin, scale, left, top, floor, width, height,
    get released() { return released; },
    release() {
      if (released) return;
      released = true;
      if (reduced) {
        const items = [...letters.slice(0, 5), {body:ring,width:ringSize,height:ringSize}, ...letters.slice(5)];
        const gap = Math.max(3, width*.006);
        const total = items.reduce((sum, x) => sum+x.width, 0) + gap*(items.length-1);
        let x = (width-total)/2;
        for (const item of items) {
          Body.setAngle(item.body, 0);
          Body.setPosition(item.body, {x:x+item.width/2,y:floor-item.height/2});
          Body.setVelocity(item.body, {x:0,y:0});
          Body.setStatic(item.body, true);
          x += item.width+gap;
        }
        return;
      }
      letters.forEach((item, i) => {
        Body.setStatic(item.body, false);
        Sleeping.set(item.body, false);
        Body.setVelocity(item.body, {x:Math.sin(i*2.17)*.72, y:.1+(i%3)*.08});
        Body.setAngularVelocity(item.body, Math.sin((i+1)*1.83)*.024);
      });
    },
    holdRing() {
      Body.setStatic(ring, true);
      Body.setVelocity(ring, {x:0,y:0});
      Body.setAngularVelocity(ring, 0);
    },
    moveRing(point) {
      const r = ringSize / 2;
      const position = {
        x:Math.max(border+r, Math.min(width-border-r, point.x)),
        y:Math.max(r+4, Math.min(floor-r, point.y))
      };
      Body.setPosition(ring, position, true);
    },
    letGoRing(velocity = {x:0,y:0}) {
      if (!released || reduced) return;
      Body.setStatic(ring, false);
      Sleeping.set(ring, false);
      Body.setVelocity(ring, {x:Math.max(-7,Math.min(7,velocity.x)),y:Math.max(-7,Math.min(7,velocity.y))});
      Body.setAngularVelocity(ring, .012);
    },
    step(delta = 1000/120) {
      if (released && !reduced) Engine.update(engine, delta);
    },
    get settled() {
      return reduced || [...letters.map(x=>x.body),ring].every(x=>x.isStatic||x.isSleeping);
    },
    destroy() { Composite.clear(engine.world, false); Engine.clear(engine); }
  };
  return scene;
}
