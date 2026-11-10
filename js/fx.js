/* =========================================================
   Interactive effects (vanilla JS, no dependencies)
   1. Tile spotlight + colour flash that follow the cursor
   2. Soft cursor light across the whole page
   3. Particle network in the hero + contact backgrounds that
      reacts to the cursor
   4. Gentle parallax of the ambient glows
   5. Dot field behind the sections below the hero (cursor + click ripples)

   All of this is skipped when the visitor prefers reduced motion.
   Cursor-only effects are skipped on touch screens.
   To turn everything off, remove the <script src="js/fx.js"> line.
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduceMotion) return;

  var root = document.documentElement;
  function rgbVar(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return (v || fallback).split(/\s+/).join(",");
  }
  var C = {
    blue: rgbVar("--c-blue", "92 132 255"),
    cyan: rgbVar("--c-cyan", "56 205 240"),
    violet: rgbVar("--c-violet", "150 112 255")
  };

  /* ---------- shared pointer state ---------- */
  var pointer = { x: -9999, y: -9999, active: false };
  var moveSubs = [];
  var queued = false;
  window.addEventListener("pointermove", function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    pointer.target = e.target; pointer.type = e.pointerType;
    if (!queued) {
      queued = true;
      requestAnimationFrame(function () { queued = false; moveSubs.forEach(function (fn) { fn(); }); });
    }
  }, { passive: true });
  document.addEventListener("pointerleave", function () { pointer.active = false; });
  window.addEventListener("blur", function () { pointer.active = false; });

  /* =========================================================
     1. TILE SPOTLIGHT + COLOUR FLASH
     ========================================================= */
  var TILE_SELECTOR = [
    ".skill-group", ".flagship", ".project-card", ".project-visual", ".role-feature", ".stat",
    ".tl-item", ".area", ".edu-item", ".lead-item", ".about-facts li", ".contact-grid > div",
    ".loop li", ".results > div", ".cs-meta > div", ".two-col > div"
  ].join(",");

  if (finePointer) {
    var tiles = Array.prototype.slice.call(document.querySelectorAll(TILE_SELECTOR));
    tiles.forEach(function (tile) {
      tile.classList.add("has-spot");
      var spot = document.createElement("span");
      spot.className = "spot";
      spot.setAttribute("aria-hidden", "true");
      tile.insertBefore(spot, tile.firstChild);

      tile.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        setPos(tile, e.clientX, e.clientY);
        // restart the flash animation on every entry
        tile.classList.remove("is-flash");
        void tile.offsetWidth;
        tile.classList.add("is-flash");
        clearTimeout(tile._flashT);
        tile._flashT = setTimeout(function () { tile.classList.remove("is-flash"); }, 1000);
      });
    });

    function setPos(tile, x, y) {
      var r = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", (x - r.left) + "px");
      tile.style.setProperty("--my", (y - r.top) + "px");
    }

    moveSubs.push(function () {
      if (pointer.type === "touch" || !pointer.target || !pointer.target.closest) return;
      var t = pointer.target.closest(".has-spot");
      while (t) {                       // update nested tiles too (card + image area)
        setPos(t, pointer.x, pointer.y);
        t = t.parentElement && t.parentElement.closest(".has-spot");
      }
    });
  }

  /* =========================================================
     2. CURSOR LIGHT (follows the pointer with a soft lag)
     ========================================================= */
  if (finePointer) {
    var light = document.createElement("div");
    light.className = "cursor-light";
    light.setAttribute("aria-hidden", "true");
    document.body.appendChild(light);

    var lx = window.innerWidth / 2, ly = window.innerHeight / 3, running = false;
    function follow() {
      lx += (pointer.x - lx) * 0.12;
      ly += (pointer.y - ly) * 0.12;
      light.style.transform = "translate3d(" + lx.toFixed(1) + "px," + ly.toFixed(1) + "px,0)";
      if (Math.abs(pointer.x - lx) + Math.abs(pointer.y - ly) > 0.5) requestAnimationFrame(follow);
      else running = false;
    }
    moveSubs.push(function () {
      light.classList.toggle("is-on", pointer.active);
      if (!running) { running = true; requestAnimationFrame(follow); }
    });
    document.addEventListener("pointerleave", function () { light.classList.remove("is-on"); });
  }

  /* =========================================================
     3. PARTICLE NETWORK (hero + contact)
     ========================================================= */
  function Field(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "fx-particles";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], visible = false, raf = 0, rect = null;
    var LINK = 125, REACH = 190;

    function resize() {
      rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.max(24, Math.min(finePointer ? 90 : 40, Math.round(W * H / 15000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, s = 0.12 + Math.random() * 0.22;
        pts.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, bs: s });
      }
    }

    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      rect = canvas.getBoundingClientRect();
      var mx = pointer.x - rect.left, my = pointer.y - rect.top;
      var mouseIn = pointer.active && finePointer && mx > -REACH && my > -REACH && mx < W + REACH && my < H + REACH;
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (mouseIn) {                                   // gentle push away from the cursor
          var dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < REACH * REACH && d2 > 1) {
            var d = Math.sqrt(d2), f = (1 - d / REACH) * 0.6;
            p.vx += dx / d * f; p.vy += dy / d * f;
          }
        }
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);   // ease back to cruising speed
        if (sp > p.bs) { p.vx *= 0.94; p.vy *= 0.94; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }

      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        var a = pts[i];
        for (var j = i + 1; j < pts.length; j++) {
          var b = pts[j], ex = a.x - b.x, ey = a.y - b.y, e2 = ex * ex + ey * ey;
          if (e2 < LINK * LINK) {
            ctx.strokeStyle = "rgba(" + C.blue + "," + ((1 - Math.sqrt(e2) / LINK) * 0.28).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (mouseIn) {                                   // threads to the cursor
          var cx = a.x - mx, cy = a.y - my, c2 = cx * cx + cy * cy;
          if (c2 < REACH * REACH) {
            ctx.strokeStyle = "rgba(" + C.cyan + "," + ((1 - Math.sqrt(c2) / REACH) * 0.55).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
          }
        }
      }
      for (i = 0; i < pts.length; i++) {
        ctx.fillStyle = i % 5 === 0 ? "rgba(" + C.violet + ",.85)" : "rgba(" + C.cyan + ",.7)";
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, i % 5 === 0 ? 1.8 : 1.3, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); }).observe(host);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; start(); }).observe(host);
    } else { visible = true; start(); }
    document.addEventListener("visibilitychange", start);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".section--hero .fx, .section--contact .fx"), function (fx) {
    new Field(fx);
  });

  /* =========================================================
     5. DOT FIELD for the sections below the hero
        A grid of faint dots that scrolls with the page. Near the cursor
        the dots light up, grow and are pushed outwards; a click sends a
        ripple across the field; a slow light wave keeps it alive when idle.
        It fades out while the hero or contact section fills the screen
        (they have their own particle network).
     ========================================================= */
  (function dotField() {
    var heroEl = document.querySelector(".section--hero, .cs-hero");
    if (!heroEl) return;
    var contactEl = document.querySelector(".section--contact");

    var canvas = document.createElement("canvas");
    canvas.className = "dot-field";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0, S = 30, R = 190;
    var heroR = 1, contactR = 0, fade = 0, raf = 0, t0 = performance.now();
    var cur = { x: -9999, y: -9999 }, ripples = [];

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = W < 700 ? 26 : 30;
    }
    resize();
    window.addEventListener("resize", resize);

    if ("IntersectionObserver" in window) {
      var th = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
      new IntersectionObserver(function (e) {
        e.forEach(function (en) {
          var ratio = en.intersectionRect.height / window.innerHeight;
          if (en.target === heroEl) heroR = ratio; else contactR = ratio;
        });
        start();
      }, { threshold: th }).observe(heroEl);
      if (contactEl) new IntersectionObserver(function (e) {
        contactR = e[0].intersectionRect.height / window.innerHeight; start();
      }, { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] }).observe(contactEl);
    } else { heroR = 0; }

    window.addEventListener("pointerdown", function (e) {
      ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (ripples.length > 4) ripples.shift();
      start();
    }, { passive: true });
    moveSubs.push(start);
    window.addEventListener("scroll", start, { passive: true });

    // dots are only drawn in empty space, never over cards or text
    var AVOID = [
      ".section-head > *", ".about-copy", ".area", ".areas-note", ".skill-group", ".role-feature", ".earlier-title",
      ".tl-item", ".flagship", ".project-card", ".minor-projects", ".edu-item", ".lead-item", ".two-col > div",
      ".contact-panel", ".cs-layout > div", ".cs-toc", ".proj-entry > *", ".cs-next", ".site-footer", ".cs-hero"
    ].join(",");
    var avoidEls = Array.prototype.slice.call(document.querySelectorAll(AVOID));
    var rects = [];
    function collectRects() {
      rects.length = 0;
      for (var i = 0; i < avoidEls.length; i++) {
        var r = avoidEls[i].getBoundingClientRect();
        if (r.bottom < -10 || r.top > H + 10 || !r.width) continue;
        rects.push(r.left - 8, r.top - 8, r.right + 8, r.bottom + 8);
      }
    }
    function blocked(x, y) {
      for (var i = 0; i < rects.length; i += 4) {
        if (x > rects[i] && x < rects[i + 2] && y > rects[i + 1] && y < rects[i + 3]) return true;
      }
      return false;
    }

    var BUCKETS = 6, buckets = [];
    for (var b = 0; b < BUCKETS; b++) buckets.push([]);

    function frame(now) {
      raf = 0;
      var goal = Math.max(0, 1 - Math.max(heroR, contactR) * 1.6);
      fade += (goal - fade) * 0.12;
      if (fade < 0.01 && goal === 0) { ctx.clearRect(0, 0, W, H); fade = 0; return; }
      if (document.hidden) return;

      // smooth cursor
      if (pointer.active && finePointer) {
        if (cur.x < -1000) { cur.x = pointer.x; cur.y = pointer.y; }
        cur.x += (pointer.x - cur.x) * 0.2; cur.y += (pointer.y - cur.y) * 0.2;
      } else { cur.x = -9999; cur.y = -9999; }

      var t = (now - t0) / 1000;
      ripples = ripples.filter(function (r) { return now - r.t < 1600; });
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;

      var offY = -(window.scrollY % S);
      collectRects();
      for (b = 0; b < BUCKETS; b++) buckets[b].length = 0;

      for (var y = offY + S / 2; y < H + S; y += S) {
        for (var x = S / 2; x < W + S; x += S) {
          if (blocked(x, y)) continue;
          // idle: a slow diagonal light wave
          var w = 0.5 + 0.5 * Math.sin(t * 0.7 - (x * 0.006 + y * 0.004));
          var k = 0, dx = 0, dy = 0;
          var cx = x - cur.x, cy = y - cur.y, d2 = cx * cx + cy * cy;
          if (d2 < R * R) {
            var d = Math.sqrt(d2) || 1; k = 1 - d / R; k *= k;
            dx += cx / d * k * 12; dy += cy / d * k * 12;
          }
          for (var i = 0; i < ripples.length; i++) {
            var rp = ripples[i], age = (now - rp.t) / 1000, rad = age * 520;
            var ex = x - rp.x, ey = y - rp.y, dd = Math.sqrt(ex * ex + ey * ey) || 1;
            var band = 1 - Math.abs(dd - rad) / 46;
            if (band > 0) {
              var life = 1 - age / 1.6, f = band * life;
              k = Math.max(k, f * 0.85); dx += ex / dd * f * 8; dy += ey / dd * f * 8;
            }
          }
          if (k > 0.04) {
            // lit dot near cursor / ripple: drawn individually, colour shifts cyan -> violet with distance
            var col = k > 0.45 ? C.cyan : (k > 0.18 ? C.blue : C.violet);
            ctx.fillStyle = "rgba(" + col + "," + (0.18 + k * 0.75).toFixed(3) + ")";
            ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.1 + k * 2.4, 0, 6.283); ctx.fill();
          } else {
            buckets[Math.min(BUCKETS - 1, (w * BUCKETS) | 0)].push(x, y);
          }
        }
      }
      // faint dots, batched by brightness
      for (b = 0; b < BUCKETS; b++) {
        var arr = buckets[b]; if (!arr.length) continue;
        ctx.fillStyle = "rgba(" + C.blue + "," + (0.07 + b * 0.025).toFixed(3) + ")";
        ctx.beginPath();
        for (var n = 0; n < arr.length; n += 2) ctx.rect(arr[n] - 0.75, arr[n + 1] - 0.75, 1.5, 1.5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    document.addEventListener("visibilitychange", start);
    start();
  })();

  /* =========================================================
     4. PARALLAX of ambient glows (hero, contact, case-study headers)
     ========================================================= */
  if (finePointer) {
    var layers = Array.prototype.slice.call(document.querySelectorAll(".section--hero .fx, .section--contact .fx, .cs-hero .fx"));
    moveSubs.push(function () {
      var nx = pointer.x / window.innerWidth - 0.5, ny = pointer.y / window.innerHeight - 0.5;
      layers.forEach(function (l) {
        l.style.setProperty("--px", (nx * 26).toFixed(1) + "px");
        l.style.setProperty("--py", (ny * 18).toFixed(1) + "px");
      });
    });
  }
})();
