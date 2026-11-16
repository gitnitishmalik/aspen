/* Aspen Homes planner: a 3D model of the visitor's home, built from their answers.
   Loaded only when the planner comes near the screen, after three.js (features.js adds both as plain
   scripts, so it also works when index.html is opened from the folder). Drag sideways to turn it.
   Walls rise first and the roof drops on, like a small build. Exposes window.AspenHouse3D.mount. */
(() => {
'use strict';
const THREE = window.THREE;
if (!THREE) return;

// colour handling as in current three.js: hex colours are sRGB, lights are physical
if (THREE.ColorManagement) {
  if ('enabled' in THREE.ColorManagement) THREE.ColorManagement.enabled = true;
  else THREE.ColorManagement.legacyMode = false;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeBack = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function mount(canvas, tagLayer, { calm = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;   // no WebGL: the planner keeps the 2D elevation
  }
  if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  if ('physicallyCorrectLights' in renderer) renderer.physicallyCorrectLights = true;
  // phones: 1.5x is as sharp at that size and a quarter fewer pixels to light and shadow every frame
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1b3d, 170, 330);
  const camera = new THREE.PerspectiveCamera(30, 1.6, 1, 1200);

  /* ---------------------------------------------- light: a warm late-afternoon sun (setTime moves it) */
  const hemi = new THREE.HemisphereLight(0xe8eeff, 0x2a2318, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
  sun.position.set(-70, 110, 95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.5;
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 420 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9db6ff, 0.7);
  rim.position.set(90, 45, -70);
  scene.add(rim);
  // porch lights: off by day, warm at dusk and night (placed at the front door on each build)
  const porch = new THREE.PointLight(0xffc27a, 0, 70, 2);
  const porch2 = new THREE.PointLight(0xffc27a, 0, 70, 2);
  scene.add(porch, porch2);

  /* ---------------------------------------------- the lot: navy pad, drafting grid, brass boundary */
  const padMat = new THREE.MeshStandardMaterial({ color: 0x0f2752, roughness: 1 });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(112, 80), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.receiveShadow = true;
  scene.add(pad);
  const grid = new THREE.GridHelper(224, 56, 0x6d8dc2, 0x2c4a7c);
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  grid.position.y = 0.04;
  scene.add(grid);
  const ring = new THREE.Mesh(new THREE.RingGeometry(110, 112, 120), new THREE.MeshBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  scene.add(ring);

  /* ---------------------------------------------- materials */
  const std = (color, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const M = {
    wall: std(0xf2eee6, 0.92),
    trim: std(0x1a202b, 0.6),
    shingle: std(0x454b55, 0.8),
    metal: std(0x58616d, 0.4, { metalness: 0.5 }),
    glass: std(0x1b2638, 0.15, { metalness: 0.3, emissive: 0xf2c27a, emissiveIntensity: 0.34 }),
    cedar: std(0xa96f3d, 0.7),
    stone: std(0xcdbf9e, 1),
    door: std(0x241b14, 0.6),
    garage: std(0xd9d4ca, 0.7),
    slab: std(0xbcb5a7, 1),
    brass: std(0xc9a96e, 0.4, { metalness: 0.35, emissive: 0x3d2b0e, emissiveIntensity: 0.6 }),
    ghost: std(0xffffff, 1, { transparent: true, opacity: 0.1, depthWrite: false }),
    zone: new THREE.MeshBasicMaterial({ color: 0xe4cf9f, transparent: true, opacity: 0.3, depthWrite: false }),
  };
  const EDGE = new THREE.LineBasicMaterial({ color: 0x0b1530, transparent: true, opacity: 0.38 });
  const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xebe3d0, transparent: true, opacity: 0.8 });

  /* ---------------------------------------------- building blocks */
  function add(geo, mat, x, y, z, parent, edge = EDGE, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    if (edge) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edge));
    parent.add(m);
    return m;
  }
  // a box standing on y0
  const box = (p, w, h, d, mat, x, y0, z, edge = EDGE, shadow = true) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, p, edge, shadow);

  // gable roof over `span` (across x) running `len` along z; turn=true runs the ridge along x
  function gable(p, span, len, rise, x, y0, z, roofMat, endMat, turn, o = 1.4) {
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    if (turn) g.rotation.y = Math.PI / 2;
    p.add(g);
    const ghost = endMat === M.ghost;
    const s = new THREE.Shape();
    s.moveTo(-span / 2, 0); s.lineTo(0, rise); s.lineTo(span / 2, 0); s.closePath();
    const tri = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    tri.translate(0, 0, -len / 2);
    add(tri, endMat, 0, 0, 0, g, ghost ? GHOST_EDGE : EDGE, !ghost);
    const a = Math.atan2(rise, span / 2), t = 0.5;
    const L = Math.hypot(span / 2, rise) + o;
    const mx = (span / 2 + o * Math.cos(a)) / 2, my = (rise - o * Math.sin(a)) / 2;
    [-1, 1].forEach((side) => {
      const slab = add(new THREE.BoxGeometry(L, t, len + o * 1.2), roofMat, side * (mx + Math.sin(a) * t / 2), my + Math.cos(a) * t / 2, 0, g, ghost ? GHOST_EDGE : EDGE, !ghost);
      slab.rotation.z = -side * a;
    });
    return g;
  }

  // hip roof over a w x d plan, eaves overhanging by o
  function hip(p, w, d, rise, x, y0, z, mat, o = 1.6, edge = EDGE, shadow = true) {
    const W = w / 2 + o, D = d / 2 + o, drop = (o * rise) / (Math.min(w, d) / 2);
    const along = w >= d, rl = Math.max(0, along ? W - D : D - W);
    const b0 = [-W, -drop, -D], b1 = [W, -drop, -D], b2 = [W, -drop, D], b3 = [-W, -drop, D];
    const r1 = along ? [-rl, rise, 0] : [0, rise, -rl];
    const r2 = along ? [rl, rise, 0] : [0, rise, rl];
    const tris = along
      ? [[b3, b2, r2], [b3, r2, r1], [b1, b0, r1], [b1, r1, r2], [b0, b3, r1], [b2, b1, r2], [b0, b1, b2], [b0, b2, b3]]
      : [[b3, b2, r2], [b1, b0, r1], [b0, b3, r2], [b0, r2, r1], [b2, b1, r1], [b2, r1, r2], [b0, b1, b2], [b0, b2, b3]];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris.flat(2)), 3));
    geo.computeVertexNormals();
    return add(geo, mat, x, y0, z, p, edge, shadow);
  }

  // a window on a wall; rot turns it to face back (PI) or the sides (+-PI/2)
  function win(p, x, y0, z, w, h, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y0, z);
    g.rotation.y = rot;
    p.add(g);
    box(g, w + 0.8, h + 0.8, 0.3, M.trim, 0, -0.4, 0.15, null, false);
    box(g, w, h, 0.36, M.glass, 0, 0, 0.22, null, false);
    box(g, 0.2, h, 0.44, M.trim, 0, 0, 0.24, null, false);
    return g;
  }
  // windows spread across open stretches of a wall
  function row(p, spans, n, y0, z, w, h, rot = 0) {
    const open = spans.map(([a, b]) => [a, b, b - a]).filter((s) => s[2] > w + 3);
    const total = open.reduce((t, s) => t + s[2], 0);
    if (!total) return;
    let left = n;
    open.forEach((s, i) => {
      let c = i === open.length - 1 ? left : Math.round((n * s[2]) / total);
      c = Math.min(c, Math.floor(s[2] / (w + 3)), left);
      left -= c;
      for (let j = 0; j < c; j++) win(p, s[0] + (s[2] * (j + 1)) / (c + 1), y0, z, w, h, rot);
    });
  }
  function posts(p, a, b, z, h, every, mat, alongX = true) {
    const n = Math.max(2, Math.round((b - a) / every) + 1);
    for (let i = 0; i < n; i++) {
      const v = a + ((b - a) * i) / (n - 1);
      if (alongX) box(p, 0.8, h, 0.8, mat, v, 0.8, z);
      else box(p, 0.8, h, 0.8, mat, z, 0.8, v);
    }
  }

  /* ---------------------------------------------- labels that follow points in 3D */
  let tags = [];
  function tag(text, x, y, z) {
    const el = document.createElement('span');
    el.className = 'tag3d';
    el.textContent = text;
    tagLayer.append(el);
    tags.push({ el, p: new THREE.Vector3(x, y, z) });
  }
  const v = new THREE.Vector3();
  function placeTags() {
    if (!tags.length) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    tags.forEach((t) => {
      v.copy(t.p).applyMatrix4(house.matrixWorld).project(camera);
      const off = v.z > 1;
      t.el.style.opacity = off ? '0' : '';
      t.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px)`;
    });
  }

  /* ---------------------------------------------- the house */
  let house = null, base = null, top = null, tween = null, built = false;
  const target = new THREE.Vector3(0, 6, 0);
  let theta = 0.55, phi = 1.2, dist = 200, goal = 200;

  function dispose(o) {
    o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
  }

  function build(s, animate) {
    if (house) { scene.remove(house); dispose(house); }
    tags.forEach((t) => t.el.remove());
    tags = [];
    house = new THREE.Group();
    base = new THREE.Group();
    top = new THREE.Group();
    house.add(base, top);
    scene.add(house);

    const remodel = s.type === 'remodel';
    const stories = remodel ? 1 : (s.stories === 2 ? 2 : 1);
    const S = s.sqft / stories;
    const W = Math.round(Math.sqrt(S * 1.6));
    const D = Math.max(26, Math.round(S / W));
    const beds = clamp(s.beds || 3, 2, 6);
    const y1 = 0.8;               // top of the slab
    let span = W, extraZ = 0, shiftX = 0, H;

    if (s.type === 'farmhouse') {
      H = 10 * stories;
      box(base, W + 2, 0.8, D + 2, M.slab, 0, 0, 0);
      box(base, W, H, D, M.wall, 0, y1, 0);
      gable(top, D, W, D * 0.36, 0, y1 + H, 0, M.shingle, M.wall, true);
      // front gables: a big one, and a small one on wider houses
      const gw = clamp(W * 0.3, 16, 28), gx = W * 0.16, proj = 7;
      box(base, gw, H, proj + 4, M.wall, gx, y1, D / 2 + (proj - 4) / 2);
      const gl = proj + D * 0.5;
      gable(top, gw, gl, gw * 0.56, gx, y1 + H, D / 2 + proj - gl / 2, M.shingle, M.wall, false);
      let sx = null, sw = 0;
      if (W > 52) {
        sw = gw * 0.68; sx = -W * 0.28;
        const sp = 5, sl = sp + D * 0.4;
        box(base, sw, H, sp + 4, M.wall, sx, y1, D / 2 + (sp - 4) / 2);
        gable(top, sw, sl, sw * 0.56, sx, y1 + H, D / 2 + sp - sl / 2, M.shingle, M.wall, false);
      }
      // windows: big one in the main gable, an attic window, the front door, then the rest
      win(base, gx, y1 + 2.5, D / 2 + proj, gw * 0.46, 6.5);
      if (stories === 2) win(base, gx, y1 + 12.5, D / 2 + proj, gw * 0.36, 5);
      win(top, gx, y1 + H + gw * 0.18, D / 2 + proj + 0.1, 2.6, 2.6);   // attic window rides in with its gable
      const pl = (sx !== null ? sx + sw / 2 : -W / 2) + 1, pr = gx - gw / 2 - 1;
      const dx = sx !== null ? sx : (pl + pr) / 2;
      box(base, 3.6, 7.5, 0.5, M.door, dx, y1, (sx !== null ? D / 2 + 5 : D / 2) + 0.25);
      const front = sx !== null
        ? [[-W / 2 + 2, sx - sw / 2 - 1], [sx + sw / 2 + 1, gx - gw / 2 - 1], [gx + gw / 2 + 1, W / 2 - 2]]
        : [[-W / 2 + 2, dx - 3], [dx + 3, gx - gw / 2 - 1], [gx + gw / 2 + 1, W / 2 - 2]];
      row(base, front, Math.max(2, beds - 1), y1 + 3, D / 2, 3.2, 5.2);
      if (stories === 2) row(base, front, beds, y1 + 13, D / 2, 3.2, 4.6);
      row(base, [[-W / 2 + 3, W / 2 - 3]], beds, y1 + 3, -D / 2, 3.2, 5, Math.PI);
      // cedar porch between the gables
      if (pr - pl > 9) {
        posts(base, pl + 0.6, pr - 0.6, D / 2 + 6.4, 8.4, 9, M.cedar);
        const roof = box(top, pr - pl + 1.5, 0.5, 7.6, M.shingle, (pl + pr) / 2, y1 + 8.4, D / 2 + 3.4);
        roof.rotation.x = 0.1;
      }
      extraZ = proj;
    } else if (s.type === 'barndo') {
      H = 12 * stories;
      box(base, W + 2, 0.8, D + 2, M.slab, 0, 0, 0);
      box(base, W, H, D, M.wall, 0, y1, 0);
      box(base, W + 0.3, 3, D + 0.3, M.metal, 0, y1, 0);            // metal wainscot
      gable(top, W, D, W * 0.17, 0, y1 + H, 0, M.metal, M.wall, false);
      win(top, 0, y1 + H + W * 0.06, D / 2 + 0.1, 3, 3);
      // shop door, the entry, windows
      box(base, 12, 10, 0.5, M.garage, W / 2 - 9, y1, D / 2 + 0.25);
      box(base, 6, 8, 0.5, M.door, -W * 0.1, y1, D / 2 + 0.25);
      row(base, [[-W / 2 + 2, -W * 0.1 - 4], [-W * 0.1 + 4, W / 2 - 16]], Math.max(2, beds - 1), y1 + 3.5, D / 2, 3.6, 4.6);
      if (stories === 2) row(base, [[-W / 2 + 2, W / 2 - 2]], beds + 1, y1 + 15, D / 2, 3.6, 4.6);
      row(base, [[-W / 2 + 3, W / 2 - 3]], beds, y1 + 3.5, -D / 2, 3.6, 4.6, Math.PI);
      // wraparound porch along the front and the right side
      const pf = box(top, W + 11, 0.5, 9, M.metal, 3.5, y1 + 9.2, D / 2 + 4.5);
      pf.rotation.x = 0.06;
      const ps = box(top, 9, 0.5, D - 4, M.metal, W / 2 + 4.5, y1 + 9.2, 2);
      ps.rotation.z = -0.06;
      posts(base, -W / 2 - 1.5, W / 2 + 8.4, D / 2 + 8.4, 9, 10, M.cedar);
      posts(base, -D / 2 + 4.5, D / 2 - 1, W / 2 + 8.4, 9, 10, M.cedar, false);
      span = W + 9;
      extraZ = 9;
      shiftX = 4;
    } else if (s.type === 'custom') {
      H = 10 * stories;
      box(base, W + 2, 0.8, D + 2, M.slab, 0, 0, 0);
      box(base, W, H, D, M.wall, 0, y1, 0);
      box(base, W + 0.3, 3.5, D + 0.3, M.stone, 0, y1, 0);
      hip(top, W, D, D * 0.2, 0, y1 + H, 0, M.metal);
      // entry tower with tall glass and a brass pivot door
      const tw = clamp(W * 0.2, 12, 18), tx = -W * 0.12, td = D * 0.55, th = H + 6, tz = D / 2 - td / 2 + 3;
      box(base, tw, th, td, M.wall, tx, y1, tz);
      box(base, tw + 0.3, 3.5, td + 0.3, M.stone, tx, y1, tz);
      hip(top, tw, td, 5, tx, y1 + th, tz, M.metal, 1.4);
      win(base, tx, y1 + 9.5, D / 2 + 3, tw * 0.52, th - 12.5);
      box(base, 3.6, 8.5, 0.5, M.brass, tx, y1, D / 2 + 3.25);
      // garage bays at the right end
      const bays = W > 70 ? 2 : 1;
      for (let b = 0; b < bays; b++) box(base, 9, 8, 0.5, M.garage, W / 2 - 6.5 - b * 11, y1, D / 2 + 0.25);
      const gL = W / 2 - 2 - bays * 11;
      row(base, [[-W / 2 + 2, tx - tw / 2 - 1.5], [tx + tw / 2 + 1.5, gL - 1.5]], Math.max(2, beds), y1 + 4.5, D / 2, 4, 4.2);
      if (stories === 2) row(base, [[-W / 2 + 2, tx - tw / 2 - 1.5], [tx + tw / 2 + 1.5, W / 2 - 2]], beds + 1, y1 + 14, D / 2, 4, 4.2);
      row(base, [[-W / 2 + 3, W / 2 - 3]], beds, y1 + 4.5, -D / 2, 4.4, 4.2, Math.PI);
      extraZ = 3;
    } else {
      // remodel: today's house as a glass outline, the new work in brass
      H = 10;
      box(base, W + 2, 0.8, D + 2, M.slab, 0, 0, 0);
      box(base, W, H, D, M.ghost, 0, y1, 0, GHOST_EDGE, false);
      hip(top, W, D, D * 0.24, 0, y1 + H, 0, M.ghost, 1.4, GHOST_EDGE, false);
      tag('Existing', 0, y1 + H + D * 0.24 + 3, -D * 0.25);
      const has = (k) => s.scope.includes(k);
      if (has('Kitchen')) { box(base, W * 0.32, H - 1.2, D * 0.45, M.zone, -W * 0.27, y1 + 0.2, D * 0.2, null, false); tag('Kitchen', -W * 0.27, y1 + H * 0.55, D * 0.2); }
      if (has('Bathrooms')) { box(base, W * 0.22, H - 1.2, D * 0.34, M.zone, W * 0.25, y1 + 0.2, -D * 0.22, null, false); tag('Bathrooms', W * 0.25, y1 + H * 0.55, -D * 0.22); }
      if (has('Flooring')) { box(base, W - 1, 0.25, D - 1, M.brass, 0, y1 + 0.05, 0, null, false); tag('Flooring', -W * 0.05, y1 + 1, -D * 0.05); }
      if (has('Porch')) {
        posts(base, -W * 0.38, W * 0.38, D / 2 + 6.6, 8.4, 9, M.brass);
        box(top, W * 0.8, 0.5, 7.6, M.brass, 0, y1 + 8.4, D / 2 + 3.6);
        tag('New porch', W * 0.3, y1 + 9.5, D / 2 + 7);
        extraZ = 7;
      }
      if (has('Addition')) {
        const aw = clamp(W * 0.38, 16, 28), ad = D * 0.72, az = -(D - ad) / 2;
        box(base, aw, H, ad, M.brass, W / 2 + aw / 2, y1, az);
        gable(top, aw, ad + 1, aw * 0.42, W / 2 + aw / 2, y1 + H, az, M.brass, M.brass, false);
        win(base, W / 2 + aw / 2, y1 + 3, az + ad / 2, aw * 0.4, 5);
        tag('New addition', W / 2 + aw / 2, y1 + H + aw * 0.42 + 3, az);
        span = W + aw * 2;
        shiftX = aw / 2;
      }
    }

    // frame the camera on the house and its porch or wing
    house.position.x = -shiftX;
    porch.position.set(-W * 0.12 - shiftX, H * 0.75, D / 2 + extraZ + 5);
    porch2.position.set(W * 0.3 - shiftX, H * 0.75, D / 2 + extraZ + 5);
    target.set(0, H * 0.32 + 2, extraZ / 3);
    // fit the whole footprint at any angle: frame its diagonal, plus room for the roof
    goal = Math.hypot(span, D + extraZ) * 2.05 + H * 1.2 + 16;
    if (!built) { dist = goal; built = true; }   // first view starts framed; later size changes glide

    if (animate && !calm) {
      base.scale.y = 0.001;
      top.position.y = 20;
      top.visible = false;
      tween = performance.now();
    }
    dirty = true;
    kick();
  }

  /* ---------------------------------------------- camera, drag to turn, auto-turn while idle */
  let drag = null, idleAt = 0, dirty = true;
  const place = () => {
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.sin(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(target);
  };
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, t: theta, p: phi, id: e.pointerId };
    canvas.classList.add('is-drag');
    canvas.dispatchEvent(new CustomEvent('house:touched', { bubbles: true }));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!canvas.hasPointerCapture(drag.id) && Math.abs(e.clientX - drag.x) > 4) canvas.setPointerCapture(drag.id);
    theta = drag.t - (e.clientX - drag.x) * 0.008;
    phi = clamp(drag.p - (e.clientY - drag.y) * 0.005, 0.42, 1.32);
    dirty = true;
  });
  const release = () => { if (!drag) return; drag = null; idleAt = performance.now() + 2600; canvas.classList.remove('is-drag'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, release));
  canvas.addEventListener('dblclick', () => { theta = 0.55; phi = 1.2; dirty = true; });
  // side scroll on a mouse (thumb wheel, tilt, Shift + wheel) turns the house; the loop eases it in
  let spin = 0;
  canvas.addEventListener('wheel', (e) => {
    const dx = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * (e.deltaMode === 1 ? 40 : 1);
    if (!dx) return;
    e.preventDefault();
    spin -= dx * 0.006;
    idleAt = performance.now() + 2600;
    dirty = true;
    kick();
  }, { passive: false });

  /* ---------------------------------------------- render only while visible and in use */
  let running = false, visible = false, active = true, last = 0;
  function loop(now) {
    if (!running) return;
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    if (!calm && !drag && now > idleAt) { theta += dt * 0.00011; dirty = true; }
    if (spin) { const s = calm ? spin : spin * 0.2; theta += s; spin -= s; if (Math.abs(spin) < 0.0005) spin = 0; dirty = true; }
    if (Math.abs(goal - dist) > 0.05) { dist += (goal - dist) * 0.08; dirty = true; }
    if (tween !== null) {
      const t = (now - tween) / 1000;
      base.scale.y = Math.max(0.001, easeOut(clamp(t / 0.75, 0, 1)));
      const r = clamp((t - 0.5) / 0.6, 0, 1);
      top.visible = r > 0;
      top.position.y = 20 * (1 - easeBack(r));
      if (t > 1.15) { base.scale.y = 1; top.position.y = 0; top.visible = true; tween = null; }
      dirty = true;
    }
    if (dirty) {
      place();
      renderer.render(scene, camera);
      placeTags();
      dirty = false;
    }
    requestAnimationFrame(loop);
  }
  function kick() {
    const want = visible && active;
    if (want && !running) { running = true; last = 0; requestAnimationFrame(loop); } else if (!want) running = false;
  }
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }).observe(canvas);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
    kick();
  };
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
  resize();

  /* ---------------------------------------------- Design Studio: finishes swap colours in place */
  const FINISH = {
    siding: { alabaster: 0xf2eee6, greige: 0xd6ccbc, sage: 0xa7b19e, iron: 0x3a3e44 },
    roof: { charcoal: [0x454b55, 0x58616d], black: [0x23262b, 0x2b2f35], galvalume: [0x8e959c, 0xaab1b7], bronze: [0x5b4636, 0x6e5442] },
    masonry: { limestone: 0xcdbf9e, brick: 0x9b5643, slate: 0x6c7077 },
    accent: { cedar: 0xa96f3d, black: 0x1f2329, oak: 0xc89a62 },
  };
  function setFinish(f) {
    if (FINISH.siding[f.siding] !== undefined) M.wall.color.setHex(FINISH.siding[f.siding]);
    if (FINISH.roof[f.roof]) { M.shingle.color.setHex(FINISH.roof[f.roof][0]); M.metal.color.setHex(FINISH.roof[f.roof][1]); }
    if (FINISH.masonry[f.masonry] !== undefined) M.stone.color.setHex(FINISH.masonry[f.masonry]);
    if (FINISH.accent[f.accent] !== undefined) M.cedar.color.setHex(FINISH.accent[f.accent]);
    dirty = true;
    kick();
  }

  /* ---------------------------------------------- time of day: day, golden hour, dusk, night */
  const TOD = [
    { t: 0, sun: [-70, 110, 95], sunC: 0xfff0d6, sunI: 3.1, sky: 0xe8eeff, gnd: 0x2a2318, hemiI: 1.5, rimI: 0.7, glow: 0.34, porchI: 0, exp: 1.08, top: 0x1f3c72, bot: 0x0f2752, pad: 0x0f2752 },
    { t: 0.45, sun: [-95, 48, 70], sunC: 0xffc48a, sunI: 2.7, sky: 0xffd9b5, gnd: 0x2b2018, hemiI: 1.15, rimI: 0.5, glow: 0.7, porchI: 60, exp: 1.06, top: 0x3c4c80, bot: 0xd99a68, pad: 0x152a52 },
    { t: 0.75, sun: [-105, 16, 55], sunC: 0xff8a4e, sunI: 1.3, sky: 0xa58dc2, gnd: 0x1d1622, hemiI: 0.78, rimI: 0.4, glow: 1.8, porchI: 260, exp: 1.12, top: 0x1e2652, bot: 0xc8704c, pad: 0x101d3e },
    { t: 1, sun: [-105, 8, 55], sunC: 0x7584c0, sunI: 0.45, sky: 0x40548c, gnd: 0x0b0d18, hemiI: 0.8, rimI: 0.45, glow: 3.2, porchI: 560, exp: 1.26, top: 0x050a1d, bot: 0x18264c, pad: 0x0a1531 },
  ];
  const ca = new THREE.Color(), cb = new THREE.Color();
  const mixHex = (a, b, k) => ca.setHex(a).lerp(cb.setHex(b), k).clone();
  const mixN = (a, b, k) => a + (b - a) * k;
  let sky = { top: '#1f3c72', bot: '#0f2752' }, todNow = 0;
  function setTime(t) {
    todNow = clamp(t, 0, 1);
    let i = 0;
    while (i < TOD.length - 2 && todNow > TOD[i + 1].t) i++;
    const A = TOD[i], B = TOD[i + 1], k = clamp((todNow - A.t) / (B.t - A.t), 0, 1);
    sun.position.set(mixN(A.sun[0], B.sun[0], k), mixN(A.sun[1], B.sun[1], k), mixN(A.sun[2], B.sun[2], k));
    sun.color.copy(mixHex(A.sunC, B.sunC, k));
    sun.intensity = mixN(A.sunI, B.sunI, k);
    hemi.color.copy(mixHex(A.sky, B.sky, k));
    hemi.groundColor.copy(mixHex(A.gnd, B.gnd, k));
    hemi.intensity = mixN(A.hemiI, B.hemiI, k);
    rim.intensity = mixN(A.rimI, B.rimI, k);
    M.glass.emissiveIntensity = mixN(A.glow, B.glow, k);
    porch.intensity = porch2.intensity = mixN(A.porchI, B.porchI, k);
    renderer.toneMappingExposure = mixN(A.exp, B.exp, k);
    padMat.color.copy(mixHex(A.pad, B.pad, k));
    const top = mixHex(A.top, B.top, k), bot = mixHex(A.bot, B.bot, k);
    scene.fog.color.copy(bot);
    sky = { top: `#${top.getHexString()}`, bot: `#${bot.getHexString()}` };
    canvas.style.background = `linear-gradient(180deg, ${sky.top} 0%, ${sky.bot} 58%, ${sky.bot} 100%)`;
    dirty = true;
    kick();
  }

  /* ---------------------------------------------- a picture of the current design, for the Home Brief */
  function snapshot(type = 'image/jpeg') {
    place();
    renderer.render(scene, camera);   // draw now: the canvas keeps no buffer between frames
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const c = out.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, out.height);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.58, sky.bot);
    g.addColorStop(1, sky.bot);
    c.fillStyle = g;
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(canvas, 0, 0);
    try { return out.toDataURL(type, 0.92); } catch (e) { return null; }
  }

  setTime(0);

  return {
    build,
    setFinish,
    setTime,
    snapshot,
    setActive(on) { active = on; dirty = true; kick(); },
  };
}

window.AspenHouse3D = { mount };
})();
