/* Portfolio interactions — vanilla JS, no dependencies. */
(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var root = document.body.getAttribute("data-root") || "";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- configurable links ---------- */
  document.querySelectorAll('[data-link="github"]').forEach(function (el) {
    if (cfg.github) {
      var a = el.tagName === "A" ? el : el.querySelector("a");
      if (a) a.href = cfg.github;
      el.classList.remove("is-unset");
    } else {
      el.classList.add("is-unset");
    }
  });
  document.querySelectorAll("[data-repo]").forEach(function (el) {
    var url = cfg.repos && cfg.repos[el.getAttribute("data-repo")];
    if (url) { el.href = url; el.hidden = false; } else { el.hidden = true; }
  });

  /* ---------- images from config (placeholders stay otherwise) ---------- */
  document.querySelectorAll("[data-img]").forEach(function (el) {
    var file = cfg.images && cfg.images[el.getAttribute("data-img")];
    if (!file) return;
    var img = new Image();
    img.alt = el.getAttribute("data-alt") || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.onload = function () { el.classList.add("has-image"); };
    img.src = root + "assets/images/" + file;
    el.appendChild(img);
  });

  /* ---------- header + mobile navigation ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");

  function setMenu(open) {
    if (!toggle || !links) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.classList.toggle("is-open", open);
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 860) setMenu(false); });
  }

  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    if (window.scrollY < 200) document.querySelectorAll('.nav-links a[aria-current="true"]').forEach(function (a) { a.removeAttribute("aria-current"); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- active section highlighting ---------- */
  function spy(linkSelector, activeAttr) {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(linkSelector));
    var targets = navLinks.map(function (a) {
      var id = (a.getAttribute("href") || "").split("#")[1];
      return id ? document.getElementById(id) : null;
    });
    if (!("IntersectionObserver" in window) || !targets.some(Boolean)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var i = targets.indexOf(entry.target);
        navLinks.forEach(function (a, j) {
          if (activeAttr) { if (j === i) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); }
          else a.classList.toggle("is-active", j === i);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach(function (t) { if (t) io.observe(t); });
  }
  spy('.nav-links a[href^="#"]', true);
  spy(".cs-toc a", false);

  /* ---------- gentle reveal on scroll ---------- */
  var revealSel = ".section-head, .about-copy, .area, .skill-group, .role-feature, .tl-item, .flagship, .project-card, " +
    ".minor-projects, .edu-item, .lead-item, .two-col > div, .contact-panel, .cs-section, .proj-entry";
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(revealSel));
  if (!reduceMotion && "IntersectionObserver" in window) {
    revealEls.forEach(function (el) {
      // small stagger between siblings of the same kind
      var i = 0, s = el.previousElementSibling;
      while (s && i < 4) { if (s.className === el.className) i++; s = s.previousElementSibling; }
      el.style.setProperty("--reveal-delay", (i * 0.07) + "s");
      el.classList.add("reveal");
    });
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("is-in");
        rio.unobserve(el);
        // After the entrance finishes, drop the reveal classes so they no longer
        // override the element's own hover transform and transition.
        var delay = parseFloat(el.style.getPropertyValue("--reveal-delay")) || 0;
        setTimeout(function () {
          el.classList.remove("reveal", "is-in");
          el.style.removeProperty("--reveal-delay");
        }, 900 + delay * 1000);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- hero drawing: two-link arm tracking a figure-eight via inverse kinematics ---------- */
  var svg = document.getElementById("arm-drawing");
  if (!svg) return;

  svg.querySelectorAll(".draw").forEach(function (p) {
    try { p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1); } catch (e) { /* ignore */ }
  });

  var S = { x: 200, y: 330 };           // shoulder
  var L1 = 160, L2 = 130;               // link lengths
  var C = { x: 335, y: 205 }, AX = 92, AY = 46; // trajectory centre and amplitudes
  var j1 = svg.getElementById ? svg.getElementById("j1") : document.getElementById("j1");
  var j2 = document.getElementById("j2");
  var arc1 = document.getElementById("arc1");
  var t1 = document.getElementById("t1"), t2 = document.getElementById("t2"), tp = document.getElementById("tp");
  var target = document.getElementById("target");
  var trace = document.getElementById("trace");
  var DEG = 180 / Math.PI;

  function point(t) { return { x: C.x + AX * Math.sin(t), y: C.y + AY * Math.sin(2 * t) }; }

  // planned trajectory (dotted)
  var d = "";
  for (var k = 0; k <= 120; k++) {
    var p = point(k / 120 * Math.PI * 2);
    d += (k ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1);
  }
  trace.setAttribute("d", d + "Z");

  function fmt(v) { return " " + ((v < 0 ? "−" : "+") + Math.abs(v).toFixed(1)).padStart(6, " "); }

  function pose(t) {
    var p = point(t);
    var dx = p.x - S.x, dy = p.y - S.y;
    var c2 = (dx * dx + dy * dy - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    c2 = Math.max(-1, Math.min(1, c2));
    var q2 = Math.acos(c2);                                  // elbow-up in screen space
    var q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    j1.setAttribute("transform", "translate(" + S.x + " " + S.y + ") rotate(" + (q1 * DEG).toFixed(2) + ")");
    j2.setAttribute("transform", "translate(" + L1 + " 0) rotate(" + (q2 * DEG).toFixed(2) + ")");
    target.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ")");

    // angle arc for joint 1, measured from the horizontal reference
    var r = 54, ex = S.x + r * Math.cos(q1), ey = S.y + r * Math.sin(q1);
    arc1.setAttribute("d", "M" + (S.x + r) + "," + S.y + " A" + r + "," + r + " 0 0 0 " + ex.toFixed(1) + "," + ey.toFixed(1));

    // readouts in the usual maths convention (counter-clockwise positive, y up)
    t1.textContent = "θ₁ =" + fmt(-q1 * DEG) + "°";
    t2.textContent = "θ₂ =" + fmt(-q2 * DEG) + "°";
    tp.textContent = "p  = (" + Math.round(dx) + ", " + Math.round(-dy) + ")";
  }

  var start = null, running = true, visible = true, phase = 0.6;
  pose(phase);
  if (reduceMotion) return;

  var stage = document.getElementById("arm-stage");
  function frame(ts) {
    if (!running) return;
    if (stage && stage.classList.contains("is-3d")) { running = false; return; }  // 3D arm took over
    if (start === null) start = ts - phase / 0.00042;
    phase = (ts - start) * 0.00042;
    pose(phase);
    requestAnimationFrame(frame);
  }
  function update() {
    var should = visible && !document.hidden && !(stage && stage.classList.contains("is-3d"));
    if (should && !running) { running = true; start = null; requestAnimationFrame(frame); }
    else if (!should) running = false;
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; update(); }).observe(svg);
  }
  document.addEventListener("visibilitychange", update);
  setTimeout(function () { requestAnimationFrame(frame); }, 1200);
})();
