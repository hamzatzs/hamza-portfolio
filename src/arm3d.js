/* =========================================================
   3D robot arm for the hero section.
   - Autonomous: runs a pick-and-place cycle on its own
   - Interactive: hover = gripper follows the cursor,
                  drag = rotate the view, tap (touch) = send the gripper
   Kinematics: base yaw + 2-link planar arm (shoulder, elbow), solved
   with closed-form inverse kinematics; the wrist pitch is set so the
   gripper always points straight down.

   This file is the editable source. The site loads the bundled,
   minified copy at js/arm3d.min.js (see README: "Editing the 3D arm").
   ========================================================= */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, LineSegments, EdgesGeometry,
  ExtrudeGeometry, Shape, CylinderGeometry, BoxGeometry, TorusGeometry, RingGeometry, CircleGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial, HemisphereLight, DirectionalLight, PointLight,
  PolarGridHelper, Vector3, Vector2, Raycaster, Plane, Color, DoubleSide, MathUtils, SRGBColorSpace
} from "three";

const stage = document.getElementById("arm-stage");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (stage && !reduceMotion) {
  try { init(); } catch (err) { /* WebGL not available: the 2D drawing stays */ }
}

function init() {
  const css = getComputedStyle(document.documentElement);
  const rgb = (name, fb) => {
    const v = (css.getPropertyValue(name).trim() || fb).split(/\s+/).map(Number);
    return new Color(v[0] / 255, v[1] / 255, v[2] / 255);
  };
  const COL = {
    blue: rgb("--c-blue", "92 132 255"),
    cyan: rgb("--c-cyan", "56 205 240"),
    violet: rgb("--c-violet", "150 112 255"),
    teal: rgb("--c-teal", "45 212 191")
  };

  /* ---------- renderer / scene / camera ---------- */
  const canvas = document.createElement("canvas");
  canvas.className = "arm-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Interactive 3D robot arm performing an autonomous pick-and-place task. Hover to guide the gripper, drag to rotate the view.");
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  stage.insertBefore(canvas, stage.firstChild);

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.05, 30);
  const view = { az: 0.75, el: 0.42, dist: 3.05, target: new Vector3(0, 0.36, 0) };

  scene.add(new HemisphereLight(0x9fb8ff, 0x070b1c, 1.15));
  const key = new DirectionalLight(0xffffff, 2.1); key.position.set(2.2, 3.2, 1.6); scene.add(key);
  const rim = new PointLight(COL.violet, 6, 5, 1.6); rim.position.set(-1.3, 1.2, -0.9); scene.add(rim);
  const fill = new PointLight(COL.blue, 4, 5, 1.6); fill.position.set(1.4, 0.4, 1.4); scene.add(fill);

  /* ---------- materials ---------- */
  const body = new MeshStandardMaterial({ color: 0x1b2647, metalness: 0.55, roughness: 0.32 });
  const bodyDark = new MeshStandardMaterial({ color: 0x0e1530, metalness: 0.6, roughness: 0.4 });
  const glow = new MeshBasicMaterial({ color: COL.cyan });
  const edge = new LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.55 });

  function withEdges(geo, mat) {
    const g = new Group();
    g.add(new Mesh(geo, mat));
    g.add(new LineSegments(new EdgesGeometry(geo, 28), edge));
    return g;
  }
  // tapered link profile (like the 2D drawing), extruded to give thickness
  function linkGeo(len, r0, r1, depth) {
    const s = new Shape();
    s.moveTo(0, -r0); s.lineTo(len, -r1);
    s.absarc(len, 0, r1, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(0, r0);
    s.absarc(0, 0, r0, Math.PI / 2, Math.PI * 1.5, false);
    const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 18 });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  function jointGeo(r, w) { const g = new CylinderGeometry(r, r, w, 32); g.rotateX(Math.PI / 2); return g; }
  function ring(r, t) { const m = new Mesh(new TorusGeometry(r, t, 8, 40), glow); return m; }

  /* ---------- geometry of the arm ---------- */
  const BASE_H = 0.12, H0 = 0.34, L1 = 0.56, L2 = 0.46, LW = 0.17;

  // floor: disc, polar grid, reach band
  const floor = new Mesh(new CircleGeometry(1.35, 64), new MeshBasicMaterial({ color: 0x0a1230, transparent: true, opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new PolarGridHelper(1.3, 16, 6, 64, COL.blue, COL.blue);
  grid.material.transparent = true; grid.material.opacity = 0.22; grid.position.y = 0.001; scene.add(grid);
  const band = new Mesh(new RingGeometry(0.4, 0.9, 72), new MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.05, side: DoubleSide }));
  band.rotation.x = -Math.PI / 2; band.position.y = 0.002; scene.add(band);

  // base + turntable
  const base = withEdges(new CylinderGeometry(0.2, 0.24, BASE_H, 40), bodyDark);
  base.position.y = BASE_H / 2; scene.add(base);
  const baseRing = ring(0.205, 0.006); baseRing.rotation.x = Math.PI / 2; baseRing.position.y = BASE_H + 0.002; scene.add(baseRing);

  const yaw = new Group(); yaw.position.y = BASE_H; scene.add(yaw);
  const turret = withEdges(new CylinderGeometry(0.13, 0.16, H0 - BASE_H - 0.06, 32), body);
  turret.position.y = (H0 - BASE_H - 0.06) / 2; yaw.add(turret);

  const shoulder = new Group(); shoulder.position.y = H0 - BASE_H; yaw.add(shoulder);
  shoulder.add(withEdges(jointGeo(0.1, 0.2), bodyDark));
  const r1a = ring(0.07, 0.006); r1a.position.z = 0.101; shoulder.add(r1a);
  const r1b = ring(0.07, 0.006); r1b.position.z = -0.101; shoulder.add(r1b);
  const link1 = withEdges(linkGeo(L1, 0.075, 0.058, 0.11), body); shoulder.add(link1);

  const elbow = new Group(); elbow.position.x = L1; shoulder.add(elbow);
  elbow.add(withEdges(jointGeo(0.072, 0.16), bodyDark));
  const r2a = ring(0.05, 0.005); r2a.position.z = 0.081; elbow.add(r2a);
  const r2b = ring(0.05, 0.005); r2b.position.z = -0.081; elbow.add(r2b);
  const link2 = withEdges(linkGeo(L2, 0.056, 0.042, 0.085), body); elbow.add(link2);

  const wrist = new Group(); wrist.position.x = L2; elbow.add(wrist);
  wrist.add(withEdges(jointGeo(0.048, 0.12), bodyDark));
  const r3 = ring(0.032, 0.004); r3.position.z = 0.061; wrist.add(r3);
  const palm = withEdges(new BoxGeometry(0.09, 0.07, 0.13), body); palm.position.x = 0.075; wrist.add(palm);
  const fingerGeo = new BoxGeometry(0.075, 0.035, 0.018);
  const fingerA = withEdges(fingerGeo, bodyDark), fingerB = withEdges(fingerGeo, bodyDark);
  fingerA.position.x = fingerB.position.x = LW - 0.01;
  wrist.add(fingerA, fingerB);
  const tipLight = new PointLight(COL.cyan, 1.2, 0.8, 2); tipLight.position.x = LW; wrist.add(tipLight);

  // the object being moved
  const CUBE = 0.07;
  const cubeGeo = new BoxGeometry(CUBE, CUBE, CUBE);
  const cube = new Group();
  cube.add(new Mesh(cubeGeo, new MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 0.45, metalness: 0.2, roughness: 0.35 })));
  cube.add(new LineSegments(new EdgesGeometry(cubeGeo), new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  scene.add(cube);

  // target markers on the floor
  function marker(color) {
    const m = new Mesh(new RingGeometry(0.06, 0.072, 40), new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.003; scene.add(m); return m;
  }
  const pickMark = marker(COL.cyan), placeMark = marker(COL.violet);
  const cursorMark = marker(new Color(0xffffff)); cursorMark.material.opacity = 0;

  /* ---------- kinematics ---------- */
  const q = { yaw: 0, sh: 0.6, el: -1.4, wr: 0 };
  const DMIN = Math.abs(L1 - L2) + 0.05, DMAX = L1 + L2 - 0.02;
  const RMIN = 0.34, RMAX = 0.92;

  function solveIK(tip) {
    // wrist point is LW above the tip because the gripper points straight down
    const wx = tip.x, wz = tip.z, wy = tip.y + LW;
    const r = Math.hypot(wx, wz);
    const h = wy - H0;
    let d = Math.hypot(r, h);
    d = MathUtils.clamp(d, DMIN, DMAX);
    const a = Math.atan2(h, r);
    const sh = a + Math.acos(MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const el = -(Math.PI - Math.acos(MathUtils.clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1)));
    q.yaw = Math.atan2(-wz, wx);
    q.sh = sh; q.el = el; q.wr = -Math.PI / 2 - sh - el;
  }
  function applyPose(grip) {
    yaw.rotation.y = q.yaw;
    shoulder.rotation.z = q.sh;
    elbow.rotation.z = q.el;
    wrist.rotation.z = q.wr;
    fingerA.position.z = grip; fingerB.position.z = -grip;
  }
  function clampReach(v) {
    const r = Math.hypot(v.x, v.z) || 1e-6;
    const rc = MathUtils.clamp(r, RMIN, RMAX);
    v.x *= rc / r; v.z *= rc / r;
    return v;
  }

  /* ---------- autonomous pick-and-place task ---------- */
  const OPEN = 0.058, CLOSED = CUBE / 2 + 0.009;
  const HOVER_Y = 0.3, GRAB_Y = CUBE / 2 - 0.004;
  let gripNow = OPEN, gripGoal = OPEN, carrying = false, cubeYawOffset = 0;
  const tip = new Vector3(0.55, 0.35, 0.2);

  function randomSpot(avoidAngle) {
    for (let i = 0; i < 30; i++) {
      const ang = Math.random() * Math.PI * 2;
      if (avoidAngle !== undefined) {
        const diff = Math.abs(Math.atan2(Math.sin(ang - avoidAngle), Math.cos(ang - avoidAngle)));
        if (diff < 1.0) continue;
      }
      const r = 0.45 + Math.random() * 0.38;
      return new Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    }
    return new Vector3(0.6, 0, 0);
  }
  let pickAt = randomSpot();
  let placeAt = randomSpot(Math.atan2(pickAt.z, pickAt.x));
  cube.position.set(pickAt.x, CUBE / 2, pickAt.z);

  let plan = [], step = 0, segT = 0, segFrom = tip.clone();
  function buildPlan() {
    const up = (p, y) => new Vector3(p.x, y, p.z);
    plan = [
      { to: up(pickAt, HOVER_Y), label: "Approach" },
      { to: up(pickAt, GRAB_Y), label: "Descend" },
      { grip: CLOSED, label: "Grasp" },
      { to: up(pickAt, HOVER_Y + 0.05), label: "Lift" },
      { to: up(placeAt, HOVER_Y + 0.05), label: "Transfer", arc: 0.08 },
      { to: up(placeAt, GRAB_Y), label: "Place" },
      { grip: OPEN, label: "Release" },
      { to: up(placeAt, HOVER_Y), label: "Retract" }
    ];
    step = 0; segT = 0; segFrom.copy(tip);
    pickMark.position.set(pickAt.x, 0.003, pickAt.z);
    placeMark.position.set(placeAt.x, 0.003, placeAt.z);
  }
  buildPlan();

  function segDuration(s) {
    if (s.grip !== undefined) return 0.45;
    return Math.max(0.55, segFrom.distanceTo(s.to) / 0.42);
  }
  const ease = (t) => t * t * (3 - 2 * t);

  function runAuto(dt) {
    const s = plan[step];
    segT += dt / segDuration(s);
    const t = Math.min(segT, 1);
    if (s.grip !== undefined) {
      gripGoal = s.grip;
    } else {
      const k = ease(t);
      tip.lerpVectors(segFrom, s.to, k);
      if (s.arc) tip.y += Math.sin(Math.PI * k) * s.arc;
    }
    if (segT >= 1) {
      if (s.grip === CLOSED && !carrying) { cubeYawOffset = cube.rotation.y - q.yaw; wrist.attach(cube); carrying = true; }
      if (s.grip === OPEN && carrying) {
        scene.attach(cube); carrying = false;
        cube.position.y = CUBE / 2; cube.rotation.set(0, q.yaw + cubeYawOffset, 0);
      }
      step++; segT = 0; segFrom.copy(tip);
      if (step >= plan.length) {           // next cycle: move the cube somewhere new
        pickAt = new Vector3(cube.position.x, 0, cube.position.z);
        placeAt = randomSpot(Math.atan2(pickAt.z, pickAt.x));
        buildPlan();
      }
    }
    return s.label;
  }

  /* ---------- interaction ---------- */
  const ray = new Raycaster(), ndc = new Vector2(), floorPlane = new Plane(new Vector3(0, 1, 0), -0.0);
  let mode = "auto";          // auto | follow | tap
  const followGoal = new Vector3();
  let tapUntil = 0, dragging = false, dragMoved = 0, lastX = 0, lastY = 0, lastInteraction = 0;

  function floorPoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new Vector3();
    if (!ray.ray.intersectPlane(floorPlane, p)) return null;
    return clampReach(p);
  }
  function resumeAuto() {
    if (mode === "auto") return;
    mode = "auto"; segT = 0; segFrom.copy(tip);   // carry on with the current task step from here
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    lastInteraction = performance.now();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      view.az -= dx * 0.008;
      view.el = MathUtils.clamp(view.el + dy * 0.005, 0.12, 1.15);
      lastX = e.clientX; lastY = e.clientY;
      return;
    }
    if (e.pointerType === "mouse") {
      const p = floorPoint(e.clientX, e.clientY);
      if (p) { followGoal.set(p.x, carrying ? 0.2 : 0.12, p.z); mode = "follow"; }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false; canvas.classList.remove("is-dragging");
    if (e.pointerType === "mouse") {                      // drag ended outside the canvas
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) resumeAuto();
    }
    if (dragMoved < 6 && e.pointerType !== "mouse") {     // tap on touch screens: send the gripper there
      const p = floorPoint(e.clientX, e.clientY);
      if (p) { followGoal.set(p.x, carrying ? 0.2 : 0.12, p.z); mode = "tap"; tapUntil = performance.now() + 1800; }
    }
  });
  canvas.addEventListener("pointercancel", () => { dragging = false; canvas.classList.remove("is-dragging"); });
  canvas.addEventListener("pointerleave", (e) => { if (!dragging && e.pointerType === "mouse") resumeAuto(); });

  /* ---------- HUD ---------- */
  const hud = {
    mode: stage.querySelector("[data-hud=mode]"),
    q1: stage.querySelector("[data-hud=q1]"),
    q2: stage.querySelector("[data-hud=q2]"),
    q3: stage.querySelector("[data-hud=q3]"),
    p: stage.querySelector("[data-hud=p]")
  };
  const deg = (r) => {
    let d = MathUtils.radToDeg(r); d = ((d + 540) % 360) - 180;
    return (d < 0 ? "−" : "+") + Math.abs(d).toFixed(1).padStart(5, " ") + "°";
  };
  let hudTick = 0;
  function updateHud(label) {
    if (++hudTick % 3) return;
    if (hud.mode) hud.mode.textContent = mode === "auto" ? "Autonomous: " + label.toLowerCase() : mode === "follow" ? "Following cursor" : "Moving to target";
    if (hud.q1) hud.q1.textContent = "θ₁ base     " + deg(q.yaw);
    if (hud.q2) hud.q2.textContent = "θ₂ shoulder " + deg(q.sh);
    if (hud.q3) hud.q3.textContent = "θ₃ elbow    " + deg(q.el);
    if (hud.p) hud.p.textContent = "p = (" + tip.x.toFixed(2) + ", " + tip.y.toFixed(2) + ", " + tip.z.toFixed(2) + ") m";
  }

  /* ---------- sizing ---------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);

  /* ---------- loop ---------- */
  let last = performance.now(), visible = true, raf = 0, clock = 0;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now; clock += dt;

    let label = "";
    if (mode === "tap" && now > tapUntil) resumeAuto();
    if (mode === "auto") label = runAuto(dt);
    else {
      const k = 1 - Math.exp(-dt * 6);
      tip.lerp(followGoal, k);
      gripGoal = carrying ? CLOSED : OPEN;
    }
    gripNow += (gripGoal - gripNow) * (1 - Math.exp(-dt * 10));
    solveIK(tip); applyPose(gripNow);

    // cursor marker + pulsing task markers
    cursorMark.material.opacity += ((mode !== "auto" ? 0.9 : 0) - cursorMark.material.opacity) * 0.15;
    cursorMark.position.set(followGoal.x, 0.004, followGoal.z);
    const pulse = 1 + Math.sin(clock * 4) * 0.12;
    pickMark.scale.setScalar(pulse); placeMark.scale.setScalar(2 - pulse);
    pickMark.visible = !carrying && mode === "auto"; placeMark.visible = mode === "auto";

    // camera: slow drift when idle
    if (!dragging && now - lastInteraction > 2500) view.az += dt * 0.12;
    camera.position.set(
      view.target.x + view.dist * Math.cos(view.el) * Math.sin(view.az),
      view.target.y + view.dist * Math.sin(view.el),
      view.target.z + view.dist * Math.cos(view.el) * Math.cos(view.az)
    );
    camera.lookAt(view.target);
    renderer.render(scene, camera);
    updateHud(label || "Working");
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; start(); }).observe(stage);
  }
  document.addEventListener("visibilitychange", start);

  stage.classList.add("is-3d");
  start();
}
