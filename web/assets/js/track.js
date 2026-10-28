/* Arturito — simulador del firmware real (firmware/arturito/arturito.ino).
   La pista de la página es un circuito cerrado que evade el texto y se
   recalcula al redimensionar; el probador dibuja la figura de la pista de
   práctica. El carrito lee sus 5 sensores sobre un raster del mundo
   activo, igual que el robot de verdad. El arrastre simula sujetarlo por
   un punto: se eleva, cuelga del agarre y cae suave al soltar. */
(function () {
  var svg = document.getElementById('track');
  var path = document.getElementById('trackPath');
  var bot = document.getElementById('bot');
  var senDots = bot.querySelectorAll('.sen');

  // --- Mundos y raster de sensores --------------------------------------
  var SCALE = 0.35;
  var raster = document.createElement('canvas');
  var rctx = raster.getContext('2d', { willReadFrequently: true });
  var docW = 0, docH = 0;
  var pageWorld = null;                   // {ctx, w, h}
  var labWorld = null;
  var world = null;                       // mundo activo

  // --- Estado del robot -------------------------------------------------
  var VMAX = 115, K = VMAX / 255;
  var VEL_RAPIDA = 180, VEL_MEDIA = 150, VEL_LENTA = 120;
  var WHEEL_BASE = 60;

  var bot_ = { x: 0, y: 0, th: 0 };
  var botScale = 1;                       // se agranda un poco al levantarlo
  var pwmL = 0, pwmR = 0;
  var running = false;
  var ultimoGiro = 0;                     // 0 recto, 1 izquierda, 2 derecha
  var bootPhase = -1, bootT = 0;

  // Cableado real verificado con la prueba de la cinta (2026-10-28):
  // vistos desde arriba, de izquierda a derecha van S0, S1, S2, S3, S4.
  var SENS = [
    { x: -17.7, y: -16.0 },   // S0 — extremo izquierdo
    { x: -8.8,  y: -24.8 },   // S1 — centro izquierdo
    { x: 0,     y: -33.7 },   // S2 — centro (punta adelantada)
    { x: 8.8,   y: -24.8 },   // S3 — centro derecho
    { x: 17.7,  y: -16.0 }    // S4 — extremo derecho
  ];

  // =====================================================================
  // Pista de la página: circuito cerrado sin cruces ni paralelas pegadas
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

    var L = Math.max(24, minL - 30), R = Math.min(W - 24, maxR + 30);
    if (R - L < 120) { L = Math.max(16, W / 2 - 60); R = Math.min(W - 16, W / 2 + 60); }
    var EDGE = 12;

    // Huecos verticales entre bloques: ahí cruza la línea de lado a lado.
    var gaps = [];
    gaps.push(Math.max(70, boxes[0].top - 80));
    for (var i = 0; i < boxes.length - 1; i++) {
      gaps.push((boxes[i].bottom + boxes[i + 1].top) / 2);
    }
    gaps.push(Math.min(docH - 70, boxes[boxes.length - 1].bottom + 80));

    var n = gaps.length;
    var lane = function (i) { return i % 2 === 0 ? L : R; };   // carril de cada tramo

    // Una sola hebra: baja zigzagueando entre bloques y el circuito se
    // cierra por los bordes de la página (derecha y arriba).
    var d = 'M ' + L + ' ' + EDGE;
    var rung = function (a, b, y, stairs) {
      if (stairs) {
        var mx = (a + b) / 2;
        return ' L ' + a + ' ' + y + ' L ' + mx + ' ' + y +
               ' L ' + mx + ' ' + (y + 16) + ' L ' + b + ' ' + (y + 16);
      }
      return ' C ' + a + ' ' + (y - 24) + ', ' + b + ' ' + (y + 24) + ', ' + b + ' ' + y;
    };

    for (var g = 0; g < n; g++) {
      var a = lane(g), b = lane(g + 1);
      var y = gaps[g];
      d += ' L ' + a + ' ' + (y - 18);
      d += rung(a, b, y, g % 2 === 1);          // alterna curva y escalera 90°
      if (g === n - 1) {
        d += ' L ' + b + ' ' + (docH - EDGE);
      }
    }
    d += ' L ' + (W - EDGE) + ' ' + (docH - EDGE);
    d += ' L ' + (W - EDGE) + ' ' + EDGE;
    d += ' Z';

    svg.setAttribute('width', W);
    svg.setAttribute('height', docH);
    path.setAttribute('d', d);

    startPose = { x: lane(1), y: gaps[0] + 60, th: Math.PI / 2 };

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
    rctx.lineWidth = 18;                        // 2 cm ≈ separación S1–S3
    rctx.lineJoin = 'miter';
    rctx.lineCap = 'round';
    rctx.stroke(new Path2D(path.getAttribute('d')));
    rctx.restore();
  }

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
      if (px[i] + px[i + 1] + px[i + 2] < 384) return true;
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
    var s = readSensors();
    var v0 = s[0], v1 = s[1], v2 = s[2], v3 = s[3], v4 = s[4];

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
    clampWalls();
  }

  function clampWalls() {
    if (!world) return;
    bot_.x = Math.min(Math.max(bot_.x, 8), world.w - 8);
    bot_.y = Math.min(Math.max(bot_.y, 8), world.h - 8);
  }

  // =====================================================================
  // Bucle principal: física del drag, caída y motores
  // =====================================================================
  var drag = {
    held: false, moved: false, g: null,
    px: 0, py: 0, vx: 0, vy: 0,
    fallT: 0, fallV: { x: 0, y: 0 },
    downT: 0, sx: 0, sy: 0
  };

  var lastT = null;
  function tick(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    if (drag.held) {
      dragStep(dt);
    } else if (drag.fallT > 0) {
      fallStep(dt);
    } else if (running) {
      if (bootPhase >= 0) {
        bootT += dt * 1000;
        var ph = BOOT[bootPhase];
        if (bootT >= ph.t) { bootT = 0; if (++bootPhase >= BOOT.length) bootPhase = -1; }
        else { pwmL = ph.l; pwmR = ph.r; }
      } else {
        control();
      }
      physics(dt);
    }

    // escala: sube al levantarlo, baja al caer
    var target = drag.held ? 1.12 : 1;
    botScale += (target - botScale) * Math.min(1, dt * 10);
    place();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // El punto de agarre sigue el puntero; el cuerpo cuelga detrás, como un
  // carrito real tomado de una esquina.
  function dragStep(dt) {
    var grab = drag.g;
    // vector local agarre→centro
    var armAng = Math.atan2(-grab.y, -grab.x);
    var armLen = Math.hypot(grab.x, grab.y);
    // orientación deseada: el centro se queda atrás del movimiento
    var desired;
    if (Math.hypot(drag.vx, drag.vy) > 20) {
      desired = Math.atan2(-drag.vy, -drag.vx) - armAng - Math.PI / 2;
    } else {
      desired = Math.atan2(1, 0) - armAng - Math.PI / 2;   // cuelga hacia abajo
    }
    var dth = desired - bot_.th;
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    bot_.th += dth * Math.min(1, dt * 8);

    // posición: el agarre va en el puntero
    var phi = bot_.th + Math.PI / 2;
    var gx = Math.cos(phi) * grab.x - Math.sin(phi) * grab.y;
    var gy = Math.sin(phi) * grab.x + Math.cos(phi) * grab.y;
    bot_.x = drag.px - gx;
    bot_.y = drag.py - gy;
    clampWalls();
  }

  // Al soltar: cae despacito (poca gravedad) y conserva el impulso un rato.
  function fallStep(dt) {
    drag.fallT -= dt;
    bot_.x += drag.fallV.x * dt;
    bot_.y += drag.fallV.y * dt;
    drag.fallV.x *= 0.90;
    drag.fallV.y *= 0.90;
    clampWalls();
    if (drag.fallT <= 0) {
      drag.fallT = 0;
      bot.classList.remove('lift');
    }
  }

  function place() {
    var deg = bot_.th * 180 / Math.PI + 90;
    bot.setAttribute('transform',
      'translate(' + bot_.x + ' ' + bot_.y + ') rotate(' + deg + ') scale(' + botScale + ')');
  }

  // =====================================================================
  // Interacción: click = encender/apagar, drag físico = reubicar
  // =====================================================================
  function localPoint(clientX, clientY) {
    // punto del carrito (coords locales, dibujo centrado en 0,0)
    var r = bot.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = clientX - cx, dy = clientY - cy;
    var phi = (bot_.th + Math.PI / 2);
    var c = Math.cos(-phi), s = Math.sin(-phi);
    return { x: (dx * c - dy * s) / botScale, y: (dx * s + dy * c) / botScale };
  }

  bot.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    bot.setPointerCapture(e.pointerId);
    drag.held = true; drag.moved = false;
    drag.downT = performance.now();
    drag.g = localPoint(e.clientX, e.clientY);
    drag.px = e.clientX; drag.py = e.clientY;
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.vx = 0; drag.vy = 0;
  });

  bot.addEventListener('pointermove', function (e) {
    if (!drag.held) return;
    var dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    var now = performance.now();
    // velocidad suavizada para el péndulo y el lanzamiento
    drag.vx = drag.vx * 0.7 + dx * 0.3 * 60;
    drag.vy = drag.vy * 0.7 + dy * 0.3 * 60;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true;
      bot.classList.add('drag', 'lift');
    }
    drag.px = e.clientX; drag.py = e.clientY;
  });

  bot.addEventListener('pointerup', function (e) {
    if (!drag.held) return;
    var quick = performance.now() - drag.downT < 400;
    if (!drag.moved && quick) {
      toggle();
      drag.held = false;
      return;
    }
    // suelta: impulso residual + caída lenta
    drag.fallV.x = drag.vx * 60 * 0.012;
    drag.fallV.y = drag.vy * 60 * 0.012;
    drag.fallT = 0.55;
    drag.held = false;
    bot.classList.remove('drag');
  });

  bot.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  function toggle() {
    running = !running;
    bot.classList.toggle('on', running);
    if (running) { bootPhase = 0; bootT = 0; }
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
  var labStart = null;

  function buildLab() {
    var W = window.innerWidth, H = window.innerHeight;
    var m = Math.min(80, Math.min(W, H) * 0.12);
    var cx = W / 2, cy = H / 2;
    var d;

    var rx = (W - 2 * m) / 2, ry = (H - 2 * m) / 2;
    if (H > W) {
      var a = ry * 0.52;
      d = 'M ' + cx + ' ' + cy +
          ' C ' + (cx - rx * 1.25) + ' ' + (cy - a * 0.55) + ', ' + (cx - rx) + ' ' + (cy - 2 * a) + ', ' + cx + ' ' + (cy - 2 * a) +
          ' C ' + (cx + rx) + ' ' + (cy - 2 * a) + ', ' + (cx + rx * 1.25) + ' ' + (cy - a * 0.55) + ', ' + cx + ' ' + cy +
          ' C ' + (cx + rx * 1.25) + ' ' + (cy + a * 0.55) + ', ' + (cx + rx) + ' ' + (cy + 2 * a) + ', ' + cx + ' ' + (cy + 2 * a) +
          ' C ' + (cx - rx) + ' ' + (cy + 2 * a) + ', ' + (cx - rx * 1.25) + ' ' + (cy + a * 0.55) + ', ' + cx + ' ' + cy + ' Z';
      labStart = { x: cx, y: cy - 2 * a, th: 0 };
    } else {
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

  function openLab() {
    buildLab();
    savedPose = { x: bot_.x, y: bot_.y, th: bot_.th };
    lab.hidden = false;
    document.body.style.overflow = 'hidden';
    labSvg.appendChild(bot);
    world = labWorld; inLab = true;
    bot_.x = labStart.x; bot_.y = labStart.y; bot_.th = labStart.th;
    place();
  }

  function closeLab() {
    inLab = false; world = pageWorld;
    svg.appendChild(bot);
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
                   path: path, build: build, drag: drag };

  build();
  world = pageWorld;
  place();
})();
