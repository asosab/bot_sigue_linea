/* Arturito — simulador del firmware real (firmware/arturito/arturito.ino).
   La pista es un circuito cerrado que se regenera evitando el texto; el
   carrito la sigue leyendo sus 5 sensores sobre un raster de la página,
   igual que el robot de verdad: no conoce la geometría, solo ve negro o
   blanco bajo cada sensor. Se puede arrastrar a cualquier punto. */
(function () {
  var svg = document.getElementById('track');
  var path = document.getElementById('trackPath');
  var bot = document.getElementById('bot');
  var senDots = bot.querySelectorAll('.sen');

  // --- Mundos y raster de sensores --------------------------------------
  // La página y el probador (lab) tienen cada uno su raster y sus límites;
  // los sensores leen siempre del mundo activo.
  var SCALE = 0.35;
  var raster = document.createElement('canvas');
  var rctx = raster.getContext('2d', { willReadFrequently: true });
  var docW = 0, docH = 0;
  var pageWorld = null;                   // {ctx, w, h}
  var labWorld = null;
  var world = null;                       // mundo activo

  // --- Estado del robot -------------------------------------------------
  // Velocidades máximas traducidas del PWM del firmware a px/s.
  var VMAX = 115, K = VMAX / 255;
  var VEL_RAPIDA = 180, VEL_MEDIA = 150, VEL_LENTA = 120;
  var WHEEL_BASE = 60;                    // distancia entre ruedas, px

  var bot_ = { x: 0, y: 0, th: 0 };       // th: radianes, 0 = hacia abajo +Y? no: ángulo del eje X
  var pwmL = 0, pwmR = 0;                 // salidas del "driver" (-255..255)
  var running = false;
  var dragging = false;
  var ultimoGiro = 0;                     // 0 recto, 1 izquierda, 2 derecha
  var bootPhase = -1, bootT = 0;          // secuencia de prueba de motores del setup()

  // Sensores en coords locales (px); el robot mira hacia su -Y.
  // Cableado real: vistos desde arriba con el frente arriba, de izquierda
  // a derecha van S4, S3, S2, S1, S0 — o sea, el canal 0 queda a la
  // derecha del robot.
  var SENS = [
    { x: 17.7,  y: -16.0 },   // S0 — extremo derecho
    { x: 8.8,   y: -24.8 },   // S1 — centro derecho
    { x: 0,     y: -33.7 },   // S2 — centro
    { x: -8.8,  y: -24.8 },   // S3 — centro izquierdo
    { x: -17.7, y: -16.0 }    // S4 — extremo izquierdo
  ];

  // =====================================================================
  // Generación de la pista: circuito cerrado que evade el contenido
  // =====================================================================
  function contentBoxes() {
    var els = document.querySelectorAll('main > header, main > section, main > footer');
    var boxes = [];
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      boxes.push({ top: r.top + scrollY, bottom: r.bottom + scrollY,
                   left: r.left, right: r.right });
    });
    boxes.sort(function (a, b) { return a.top - b.top; });
    return boxes;
  }

  function build() {
    var W = document.documentElement.clientWidth;
    docW = W;
    docH = Math.max(document.body.scrollHeight, window.innerHeight);

    var boxes = contentBoxes();
    var minL = Infinity, maxR = -Infinity;
    boxes.forEach(function (b) { minL = Math.min(minL, b.left); maxR = Math.max(maxR, b.right); });
    if (!isFinite(minL)) { minL = W * 0.2; maxR = W * 0.8; }

    var L = Math.max(18, minL - 30), R = Math.min(W - 18, maxR + 30);
    if (R - L < 120) { L = Math.max(14, W / 2 - 60); R = Math.min(W - 14, W / 2 + 60); }

    // Huecos verticales entre bloques: ahí van los cruces horizontales.
    var gaps = [];
    var PAD = 34;
    gaps.push({ y: Math.max(46, boxes[0].top - PAD * 2) });              // sobre el hero
    for (var i = 0; i < boxes.length - 1; i++) {
      var mid = (boxes[i].bottom + boxes[i + 1].top) / 2;
      gaps.push({ y: mid });
    }
    gaps.push({ y: Math.min(docH - 46, boxes[boxes.length - 1].bottom + PAD * 2) });

    // Dos "cabos" del lazo: la ida alterna carril L/R en cada hueco; la
    // vuelta usa el otro carril y cruza en X dentro de cada hueco.
    var n = gaps.length;
    var lane = function (i) { return i % 2 === 0 ? L : R; };             // carril de ida
    var other = function (i) { return i % 2 === 0 ? R : L; };            // carril de vuelta

    var d = '';
    var px, py, i, g, a, b;

    // ---- tramo de ida: baja serpenteando
    px = lane(0); py = gaps[0].y - 46;
    d += 'M ' + px + ' ' + py;
    for (i = 0; i < n; i++) {
      g = gaps[i].y; a = lane(i); b = lane(i + 1 >= n ? n - 1 : i + 1);
      if (i === n - 1) b = a;                                          // último hueco: sin cruce
      // bajada vertical por el carril de este tramo
      d += ' L ' + a + ' ' + (g - 16);
      if (i < n - 1) {
        if (i % 2 === 0) {
          // cruce en curva: diagonal suave al otro carril
          d += ' C ' + a + ' ' + (g + 22) + ', ' + b + ' ' + (g - 6) + ', ' + b + ' ' + (g + 16);
        } else {
          // cruce con esquinas a 90°: escalera
          var mx = (a + b) / 2;
          d += ' L ' + a + ' ' + g + ' L ' + mx + ' ' + g +
               ' L ' + mx + ' ' + (g + 14) + ' L ' + b + ' ' + (g + 14) +
               ' L ' + b + ' ' + (g + 16);
        }
      }
    }
    // ---- horquilla inferior: media vuelta del carril de ida al de vuelta
    var yBot = gaps[n - 1].y + 60;
    var aLast = lane(n - 1), bLast = other(n - 1);
    d += ' L ' + aLast + ' ' + (yBot - 40);
    d += ' C ' + aLast + ' ' + yBot + ', ' + bLast + ' ' + yBot + ', ' + bLast + ' ' + (yBot - 40);

    // ---- tramo de vuelta: sube por el otro carril, cruzando en X cada hueco
    for (i = n - 1; i >= 0; i--) {
      g = gaps[i].y;
      var cur = other(i), next = other(i - 1 < 0 ? 0 : i - 1);
      if (i === 0) next = cur;
      d += ' L ' + cur + ' ' + (g + 16);
      if (i > 0) {
        if (i % 2 === 0) {
          d += ' C ' + cur + ' ' + (g - 22) + ', ' + next + ' ' + (g + 6) + ', ' + next + ' ' + (g - 16);
        } else {
          var mx2 = (cur + next) / 2;
          d += ' L ' + cur + ' ' + g + ' L ' + mx2 + ' ' + g +
               ' L ' + mx2 + ' ' + (g - 14) + ' L ' + next + ' ' + (g - 14) +
               ' L ' + next + ' ' + (g - 16);
        }
      }
    }
    // ---- horquilla superior que cierra el circuito
    var yTop = gaps[0].y - 46;
    d += ' L ' + other(0) + ' ' + (yTop + 40);
    d += ' C ' + other(0) + ' ' + (yTop - 14) + ', ' + lane(0) + ' ' + (yTop - 14) + ', ' + lane(0) + ' ' + (yTop + 40);
    d += ' Z';

    svg.setAttribute('width', W);
    svg.setAttribute('height', docH);
    path.setAttribute('d', d);

    // pose inicial: primera vertical tras el primer cruce, tramo recto por delante
    startPose = { x: lane(1), y: gaps[0].y + 40, th: Math.PI / 2 };

    rasterize(boxes);
    pageWorld = { ctx: rctx, w: docW, h: docH };
    if (!inLab) world = pageWorld;
  }
  var startPose = null;

  // Raster: la línea en negro y el texto como franjas oscuras, que el
  // carrito también "ve" si lo sueltas encima.
  function rasterize(boxes) {
    raster.width = Math.max(2, Math.round(docW * SCALE));
    raster.height = Math.max(2, Math.round(docH * SCALE));
    rctx.fillStyle = '#fff';
    rctx.fillRect(0, 0, raster.width, raster.height);

    // texto como franjas (simula renglones impresos)
    rctx.fillStyle = '#000';
    document.querySelectorAll('h1, h2, p, li, figcaption').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      var x = r.left * SCALE, y = (r.top + scrollY) * SCALE;
      var w = r.width * SCALE, h = r.height * SCALE;
      var rowH = Math.max(2.4, 9 * SCALE), gap = Math.max(2, 7 * SCALE);
      for (var yy = y; yy < y + h; yy += rowH + gap) {
        rctx.fillRect(x, yy, w, Math.min(rowH, y + h - yy));
      }
    });

    rctx.save();
    rctx.scale(SCALE, SCALE);
    rctx.strokeStyle = '#000';
    rctx.lineWidth = 18;
    rctx.lineJoin = 'miter';
    rctx.lineCap = 'round';
    rctx.stroke(new Path2D(path.getAttribute('d')));
    rctx.restore();
  }

  // proyección local→mundo: el dibujo mira hacia -Y; th es el rumbo mundo
  function toWorld(lx, ly) {
    var c = Math.cos(bot_.th), s = Math.sin(bot_.th);
    return { x: bot_.x - lx * s - ly * c, y: bot_.y + lx * c - ly * s };
  }

  function darkAt(wx, wy) {
    if (!world) return false;
    var cx = Math.round(wx * SCALE), cy = Math.round(wy * SCALE);
    if (cx < 1 || cy < 1 || cx >= world.ctx.canvas.width - 1 || cy >= world.ctx.canvas.height - 1) return false;
    var px = world.ctx.getImageData(cx - 1, cy - 1, 3, 3).data;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i] + px[i + 1] + px[i + 2] < 384) return true;   // algo oscuro cerca
    }
    return false;
  }

  // =====================================================================
  // Control: traducción directa de la tabla de casos del .ino
  // =====================================================================
  function readSensors() {
    var v = [];
    for (var i = 0; i < 5; i++) {
      var w = toWorld(SENS[i].x, SENS[i].y);
      v[i] = darkAt(w.x, w.y);
      senDots[i].classList.toggle('hit', v[i]);
    }
    return v;
  }

  function control() {
    var v0, v1, v2, v3, v4;
    var s = readSensors();
    v0 = s[0]; v1 = s[1]; v2 = s[2]; v3 = s[3]; v4 = s[4];

    // mismo orden de casos que arturito.ino
    if (v2 && !v0 && !v1 && !v3 && !v4)      { pwmL = VEL_RAPIDA; pwmR = VEL_RAPIDA; ultimoGiro = 0; }
    else if (v3 || (v2 && v3))               { pwmL = VEL_RAPIDA; pwmR = VEL_LENTA;  ultimoGiro = 2; }
    else if (v1 || (v2 && v1))               { pwmL = VEL_LENTA;  pwmR = VEL_RAPIDA; ultimoGiro = 1; }
    else if (v4 || (v3 && v4))               { pwmL = VEL_RAPIDA; pwmR = 0;          ultimoGiro = 2; }
    else if (v0 || (v0 && v1))               { pwmL = 0;          pwmR = VEL_RAPIDA; ultimoGiro = 1; }
    else if (v0 && !v1 && !v2)               { pwmL = 0;          pwmR = VEL_RAPIDA; ultimoGiro = 1; }
    else if (v4 && !v3 && !v2)               { pwmL = VEL_RAPIDA; pwmR = 0;          ultimoGiro = 2; }
    else if (v0 && v1 && v2 && v3 && v4)     { pwmL = VEL_RAPIDA; pwmR = VEL_RAPIDA; }
    else if (!v0 && !v1 && !v2 && !v3 && !v4) {
      if (ultimoGiro === 1)      { pwmL = 0;          pwmR = VEL_RAPIDA; }
      else if (ultimoGiro === 2) { pwmL = VEL_RAPIDA; pwmR = 0;          }
      else                       { pwmL = 0;          pwmR = 0;          }
    }
    else { pwmL = VEL_MEDIA; pwmR = VEL_MEDIA; }
  }

  // Prueba de motores del setup(): adelante, pausa, atrás, pausa.
  var BOOT = [
    { t: 800, l: VEL_MEDIA, r: VEL_MEDIA },
    { t: 300, l: 0, r: 0 },
    { t: 800, l: -VEL_MEDIA, r: -VEL_MEDIA },
    { t: 500, l: 0, r: 0 }
  ];

  function physics(dt) {
    var vL = pwmL * K, vR = pwmR * K;
    // pantalla con Y hacia abajo: vL>vR gira a la derecha del robot (theta sube)
    var omega = (vL - vR) / WHEEL_BASE;
    var v = (vL + vR) / 2;
    bot_.th += omega * dt;
    bot_.x += Math.cos(bot_.th) * v * dt;
    bot_.y += Math.sin(bot_.th) * v * dt;
    if (world) {
      bot_.x = Math.min(Math.max(bot_.x, 8), world.w - 8);
      bot_.y = Math.min(Math.max(bot_.y, 8), world.h - 8);
    }
  }

  var lastT = null;
  function tick(t) {
    if (!running || dragging) { lastT = t; requestAnimationFrame(tick); return; }
    if (lastT === null) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (bootPhase >= 0) {                       // todavía en setup()
      bootT += dt * 1000;
      var ph = BOOT[bootPhase];
      if (bootT >= ph.t) {
        bootT = 0; bootPhase++;
        if (bootPhase >= BOOT.length) bootPhase = -1;
      } else { pwmL = ph.l; pwmR = ph.r; }
    } else {
      control();
    }
    physics(dt);
    place();
    requestAnimationFrame(tick);
  }

  function place() {
    var deg = bot_.th * 180 / Math.PI + 90;
    var wob = running && bootPhase < 0 ? Math.sin(performance.now() * 0.02) * 1.5 : 0;
    bot.setAttribute('transform',
      'translate(' + bot_.x + ' ' + bot_.y + ') rotate(' + (deg + wob) + ')');
  }

  // =====================================================================
  // Interacción: click = encender/apagar, drag = reubicar
  // =====================================================================
  var dragStart = null, moved = false;

  bot.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    bot.setPointerCapture(e.pointerId);
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    moved = false;
  });
  bot.addEventListener('pointermove', function (e) {
    if (!dragStart) return;
    var dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
    if (!moved && Math.hypot(dx, dy) > 6) { moved = true; dragging = true; bot.classList.add('drag'); }
    if (dragging) {
      var nx = bot_.x + dx, ny = bot_.y + dy;
      if (Math.hypot(nx - bot_.x, ny - bot_.y) > 2) {
        bot_.th = Math.atan2(ny - bot_.y, nx - bot_.x);
        bot_.x = nx; bot_.y = ny;
      }
      dragStart.x = e.clientX; dragStart.y = e.clientY;
      place();
    }
  });
  bot.addEventListener('pointerup', function (e) {
    if (!dragStart) return;
    var quick = performance.now() - dragStart.t < 400;
    if (!moved && quick) toggle();
    dragging = false; dragStart = null;
    bot.classList.remove('drag');
  });
  bot.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  function toggle() {
    running = !running;
    bot.classList.toggle('on', running);
    if (running) { bootPhase = 0; bootT = 0; lastT = null; requestAnimationFrame(tick); }
    else { pwmL = pwmR = 0; }
  }

  // =====================================================================
  // Probador (lab): pantalla completa con la pista de práctica
  // =====================================================================
  var lab = document.getElementById('lab');
  var labSvg = document.getElementById('labTrack');
  var labPath = document.getElementById('labPath');
  var labRaster = document.createElement('canvas');
  var labCtx = labRaster.getContext('2d', { willReadFrequently: true });
  var inLab = false;
  var savedPose = null;

  function buildLab() {
    var W = window.innerWidth, H = window.innerHeight;
    var m = Math.min(80, Math.min(W, H) * 0.12);   // margen a los muros
    var cx = W / 2, cy = H / 2;
    var d;

    // Figura como la pista de práctica: un circuito cerrado tipo ocho con
    // un cruce en el medio. Apaisada si la pantalla es ancha, vertical si
    // es alta.
    var rx = (W - 2 * m) / 2, ry = (H - 2 * m) / 2;
    if (H > W) {
      // vertical: dos lobos apilados, cruce en el centro
      var a = ry * 0.52;
      d = 'M ' + cx + ' ' + cy +
          ' C ' + (cx - rx * 1.25) + ' ' + (cy - a * 0.55) + ', ' + (cx - rx) + ' ' + (cy - 2 * a) + ', ' + cx + ' ' + (cy - 2 * a) +
          ' C ' + (cx + rx) + ' ' + (cy - 2 * a) + ', ' + (cx + rx * 1.25) + ' ' + (cy - a * 0.55) + ', ' + cx + ' ' + cy +
          ' C ' + (cx + rx * 1.25) + ' ' + (cy + a * 0.55) + ', ' + (cx + rx) + ' ' + (cy + 2 * a) + ', ' + cx + ' ' + (cy + 2 * a) +
          ' C ' + (cx - rx) + ' ' + (cy + 2 * a) + ', ' + (cx - rx * 1.25) + ' ' + (cy + a * 0.55) + ', ' + cx + ' ' + cy + ' Z';
      labStart = { x: cx, y: cy - 2 * a, th: 0 };
    } else {
      // horizontal: dos lobos lado a lado
      var b = rx * 0.52;
      d = 'M ' + cx + ' ' + cy +
          ' C ' + (cx - b * 0.55) + ' ' + (cy - ry * 1.25) + ', ' + (cx - 2 * b) + ' ' + (cy - ry) + ', ' + (cx - 2 * b) + ' ' + cy +
          ' C ' + (cx - 2 * b) + ' ' + (cy + ry) + ', ' + (cx - b * 0.55) + ' ' + (cy + ry * 1.25) + ', ' + cx + ' ' + cy +
          ' C ' + (cx + b * 0.55) + ' ' + (cy + ry * 1.25) + ', ' + (cx + 2 * b) + ' ' + (cy + ry) + ', ' + (cx + 2 * b) + ' ' + cy +
          ' C ' + (cx + 2 * b) + ' ' + (cy - ry) + ', ' + (cx + b * 0.55) + ' ' + (cy - ry * 1.25) + ', ' + cx + ' ' + cy + ' Z';
      labStart = { x: cx - 2 * b, y: cy, th: Math.PI / 2 };
    }

    labPath.setAttribute('d', d);

    labRaster.width = Math.max(2, Math.round(W * SCALE));
    labRaster.height = Math.max(2, Math.round(H * SCALE));
    labCtx.fillStyle = '#fff';
    labCtx.fillRect(0, 0, labRaster.width, labRaster.height);
    labCtx.save();
    labCtx.scale(SCALE, SCALE);
    labCtx.strokeStyle = '#000';
    labCtx.lineWidth = 18;
    labCtx.lineJoin = 'miter';
    labCtx.lineCap = 'round';
    labCtx.stroke(new Path2D(d));
    labCtx.restore();

    labWorld = { ctx: labCtx, w: W, h: H };
    if (inLab) world = labWorld;
  }
  var labStart = null;

  function openLab() {
    buildLab();
    savedPose = { x: bot_.x, y: bot_.y, th: bot_.th };
    lab.hidden = false;
    document.body.style.overflow = 'hidden';
    labSvg.appendChild(bot);                    // el carrito pasa al lab
    world = labWorld; inLab = true;
    bot_.x = labStart.x; bot_.y = labStart.y; bot_.th = labStart.th;
    place();
  }

  function closeLab() {
    inLab = false; world = pageWorld;
    svg.appendChild(bot);                       // vuelve a la página
    if (savedPose) { bot_.x = savedPose.x; bot_.y = savedPose.y; bot_.th = savedPose.th; }
    lab.hidden = true;
    document.body.style.overflow = '';
    place();
  }

  document.getElementById('openLab').addEventListener('click', openLab);
  document.getElementById('closeLab').addEventListener('click', closeLab);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inLab) closeLab();
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      build();
      if (inLab) buildLab();
    }, 120);
  });

  window.addEventListener('load', function () {
    build();
    if (startPose) { bot_.x = startPose.x; bot_.y = startPose.y; bot_.th = startPose.th; }
    place();
  });

  // handle de depuración
  window.__art = { bot_, SENS, toWorld, darkAt, readSensors, raster,
                   path: path, build: build };

  build();
  place();
})();
