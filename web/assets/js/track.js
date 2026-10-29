/* Arturito — simulador del firmware real (firmware/arturito/arturito.ino).
   La pista es una cinta cerrada dibujada como cadena Verlet: se puede
   agarrar y deformar con el dedo o el mouse, y el carrito la sigue leyendo
   sus 5 sensores sobre la geometría real de la cadena. El probador (lab)
   dibuja la figura de la pista de práctica en pantalla completa. */
(function () {
  var svg = document.getElementById('track');
  var path = document.getElementById('trackPath');
  var hitPath = document.getElementById('trackHit');
  var bot = document.getElementById('bot');
  var senDots = bot.querySelectorAll('.sen');

  var SCALE = 0.35;
  var docW = 0, docH = 0;
  var WALL = 30;                       // muro invisible: la cinta llega a 30 px del borde

  // --- Mundo activo (página o probador) ---------------------------------
  var pageWorld = null, labWorld = null, world = null;

  // --- Robot -------------------------------------------------------------
  var VMAX = 115, K = VMAX / 255;
  var VEL_RAPIDA = 180, VEL_MEDIA = 150, VEL_LENTA = 120;
  var WHEEL_BASE = 60;
  var LINE_HALF = 7.2;                 // 14.4 px de línea ≈ 1.6 cm

  var bot_ = { x: 0, y: 0, th: 0 };
  var botScale = 1;
  var pwmL = 0, pwmR = 0;
  var running = false;
  var ultimoGiro = 0;
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
  // La cinta: cadena cerrada de puntos con física Verlet
  // =====================================================================
  var rope = { px: [], py: [], ox: [], oy: [], segLen: [], n: 0, grab: -1 };
  var BEND_RADIUS = 100;               // radio mínimo de curvatura de la cinta, px
  var BEND_SPAN = 6;                   // segmentos por lado que revisa el límite

  function ropeInit() {
    if (ropeRestore()) return;         // la figura guardada gana al diseño inicial
    var W = docW, H = docH;
    var m = WALL;
    var L = m, R = W - m;

    // la cinta rodea el bloque inicial: el borde superior pasa justo
    // entre el carrito aparcado sobre el hero y el título «Arturito»,
    // y el inferior queda arriba del título de «El equipo»
    var h1 = document.querySelector('.hero h1');
    var h2 = document.querySelector('#equipo h2');
    var T = m, B = H - m;
    if (h1 && h2) {
      var botBottom = Math.min(120, docH * 0.06) + 44; // borde bajo del carrito aparcado
      var h1Top = h1.getBoundingClientRect().top + window.scrollY;
      T = botBottom + (h1Top - botBottom) / 2;
      B = h2.getBoundingClientRect().top + window.scrollY - 18;
    }
    var rad = Math.min(150, (R - L) * 0.35, (B - T) * 0.2);
    var sw = R - L - 2 * rad, sh = B - T - 2 * rad;
    var arcLen = Math.PI * rad / 2;
    var per = 2 * (sw + sh) + 4 * arcLen;
    var n = Math.max(64, Math.min(180, Math.round(per / 42)));
    rope.n = n;
    rope.px = new Float64Array(n); rope.py = new Float64Array(n);
    rope.ox = new Float64Array(n); rope.oy = new Float64Array(n);
    rope.segLen = new Float64Array(n);

    // recorrido horario del perímetro, tramo recto + esquina de 90°,
    // empezando por el borde superior desde la izquierda
    var segs = [
      [sw,     function (t) { return [L + rad + t * sw, T]; }],
      [arcLen, function (t) { var a = (t - 1) * Math.PI / 2; return [R - rad + rad * Math.cos(a), T + rad + rad * Math.sin(a)]; }],
      [sh,     function (t) { return [R, T + rad + t * sh]; }],
      [arcLen, function (t) { var a = t * Math.PI / 2;         return [R - rad + rad * Math.cos(a), B - rad + rad * Math.sin(a)]; }],
      [sw,     function (t) { return [R - rad - t * sw, B]; }],
      [arcLen, function (t) { var a = (t + 1) * Math.PI / 2;   return [L + rad + rad * Math.cos(a), B - rad + rad * Math.sin(a)]; }],
      [sh,     function (t) { return [L, B - rad - t * sh]; }],
      [arcLen, function (t) { var a = (t + 2) * Math.PI / 2;   return [L + rad + rad * Math.cos(a), T + rad + rad * Math.sin(a)]; }]
    ];
    var idx = 0, acc = segs[0][0];
    for (var i = 0; i < n; i++) {
      var s = i * per / n;
      while (s > acc && idx < segs.length - 1) { idx++; acc += segs[idx][0]; }
      var p = segs[idx][1]((s - (acc - segs[idx][0])) / segs[idx][0]);
      rope.px[i] = rope.ox[i] = p[0];
      rope.py[i] = rope.oy[i] = p[1];
    }
    retarget();
  }

  // longitudes de reposo = distancias actuales: la figura queda plástica,
  // no elástica — sin holgura, la cinta se queda quieta donde la dejes
  function retarget() {
    var n = rope.n;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      rope.segLen[i] = Math.hypot(rope.px[j] - rope.px[i], rope.py[j] - rope.py[i]);
    }
  }

  // la figura se guarda en localStorage cada vez que se suelta la cinta:
  // al recargar la página reaparece el diseño que le dejó el usuario
  var ROPE_KEY = 'arturito-rope';

  function ropeSave() {
    try {
      var p = new Array(rope.n);
      for (var i = 0; i < rope.n; i++) {
        p[i] = [Math.round(rope.px[i] * 10) / 10,
                Math.round(rope.py[i] * 10) / 10];
      }
      localStorage.setItem(ROPE_KEY,
        JSON.stringify({ w: docW, h: docH, p: p }));
    } catch (e) { /* sin storage disponible, la cinta no persiste */ }
  }

  function ropeRestore() {
    var saved;
    try { saved = JSON.parse(localStorage.getItem(ROPE_KEY)); }
    catch (e) { return false; }
    if (!saved || !saved.p || saved.p.length < 32 ||
        !saved.w || !saved.h) return false;
    // si la ventana cambió de tamaño la figura se escala en proporción
    // y se recorta a los muros para que no quede nada fuera
    var sx = docW / saved.w, sy = docH / saved.h;
    var n = saved.p.length;
    rope.n = n;
    rope.px = new Float64Array(n); rope.py = new Float64Array(n);
    rope.ox = new Float64Array(n); rope.oy = new Float64Array(n);
    rope.segLen = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var x = Math.min(Math.max(saved.p[i][0] * sx, WALL), docW - WALL);
      var y = Math.min(Math.max(saved.p[i][1] * sy, WALL), docH - WALL);
      rope.px[i] = rope.ox[i] = x;
      rope.py[i] = rope.oy[i] = y;
    }
    retarget();
    return true;
  }

  function ropeStep() {
    var n = rope.n, px = rope.px, py = rope.py, ox = rope.ox, oy = rope.oy;

    // integración Verlet con amortiguación fuerte y umbral de sueño:
    // la cinta quiere estar quieta, no un columpio eterno
    for (var i = 0; i < n; i++) {
      var vx = (px[i] - ox[i]) * 0.90, vy = (py[i] - oy[i]) * 0.90;
      if (vx * vx + vy * vy < 0.0009) { vx = 0; vy = 0; }
      ox[i] = px[i]; oy[i] = py[i];
      px[i] += vx; py[i] += vy;
    }

    // agarre: el punto arrastrado sigue el puntero
    if (rope.grab >= 0) {
      px[rope.grab] = rope.gx; py[rope.grab] = rope.gy;
      ox[rope.grab] = rope.gx; oy[rope.grab] = rope.gy;
    }

    // restricciones de distancia entre vecinos (anillos cerrados)
    for (var it = 0; it < 4; it++) {
      for (var j = 0; j < n; j++) {
        var k = (j + 1) % n;
        var dx = px[k] - px[j], dy = py[k] - py[j];
        var d = Math.hypot(dx, dy) || 1e-6;
        var diff = (d - rope.segLen[j]) / d * 0.5;
        dx *= diff; dy *= diff;
        px[j] += dx; py[j] += dy;
        px[k] -= dx; py[k] -= dy;
      }
      if (rope.grab >= 0) {
        // radio mínimo de curvatura mientras se arrastra: la cinta no se
        // dobla más cerrada que un arco de BEND_RADIUS. Se revisa en varias
        // escalas (spans de k segmentos) para que el doblez se reparta en
        // una curva amplia en vez de concentrarse en un pico. Solo durante
        // el arrastre: en reposo deformaría sola la figura guardada
        var kmax = Math.min(BEND_SPAN, (n >> 1) - 1);
        for (var c = 0; c < n; c++) {
          var arc = 0;
          for (var k = 1; k <= kmax; k++) {
            arc += rope.segLen[(c + n - k) % n] + rope.segLen[(c + k - 1) % n];
            // un arco más largo que media circunferencia puede cerrarse
            // legítimamente: ahí la cuerda corta ya no delata un pliegue
            if (arc >= Math.PI * BEND_RADIUS) break;
            var i0 = (c + n - k) % n, i2 = (c + k) % n;
            var cx0 = px[i2] - px[i0], cy0 = py[i2] - py[i0];
            var cd = Math.hypot(cx0, cy0) || 1e-6;
            var minD = 2 * BEND_RADIUS * Math.sin(arc / (2 * BEND_RADIUS));
            if (cd < minD) {
              var push = (minD - cd) / cd;
              // si un extremo es el punto agarrado, empuja solo el libre:
              // el agarrado vuelve al puntero al final de la iteración
              if (i0 === rope.grab) {
                px[i2] += cx0 * push; py[i2] += cy0 * push;
              } else if (i2 === rope.grab) {
                px[i0] -= cx0 * push; py[i0] -= cy0 * push;
              } else {
                push *= 0.5;
                px[i0] -= cx0 * push; py[i0] -= cy0 * push;
                px[i2] += cx0 * push; py[i2] += cy0 * push;
              }
            }
          }
        }
      } else {
        // en reposo solo se evita el pliegue degenerado (doblez de más de
        // ~130° en un solo punto); la figura guardada no se toca
        for (var c = 0; c < n; c++) {
          var i0 = (c + n - 1) % n, i2 = (c + 1) % n;
          var cx0 = px[i2] - px[i0], cy0 = py[i2] - py[i0];
          var cd = Math.hypot(cx0, cy0) || 1e-6;
          var minD = 0.85 * (rope.segLen[i0] + rope.segLen[c]) * 0.5;
          if (cd < minD) {
            var push = (minD - cd) / cd * 0.5;
            px[i0] -= cx0 * push; py[i0] -= cy0 * push;
            px[i2] += cx0 * push; py[i2] += cy0 * push;
          }
        }
      }
      if (rope.grab >= 0) { px[rope.grab] = rope.gx; py[rope.grab] = rope.gy; }
    }

    // rigidez de cinta solo mientras se arrastra: suaviza la forma que se
    // está creando sin volver al óvalo (si actuara en reposo parecería un
    // elástico que tira para atrás). También mueve la posición previa
    // para no inyectar velocidad.
    if (rope.grab >= 0) {
      for (var s = 0; s < n; s++) {
        var p0 = (s + n - 1) % n, p1 = (s + 1) % n;
        if (s === rope.grab) continue;
        var sx = ((px[p0] + px[p1]) / 2 - px[s]) * 0.16;
        var sy = ((py[p0] + py[p1]) / 2 - py[s]) * 0.16;
        px[s] += sx; ox[s] += sx;
        py[s] += sy; oy[s] += sy;
      }
    }

    // muros invisibles
    var m = WALL;
    for (var w = 0; w < n; w++) {
      if (px[w] < m) px[w] = m; else if (px[w] > docW - m) px[w] = docW - m;
      if (py[w] < m) py[w] = m; else if (py[w] > docH - m) py[w] = docH - m;
    }
  }

  // Catmull-Rom cerrado → curvas suaves de río
  function ropeD() {
    var n = rope.n, px = rope.px, py = rope.py;
    var d = 'M ' + px[0].toFixed(1) + ' ' + py[0].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = px[(i + n - 1) % n], p0y = py[(i + n - 1) % n];
      var p1 = px[i], p1y = py[i];
      var p2 = px[(i + 1) % n], p2y = py[(i + 1) % n];
      var p3 = px[(i + 2) % n], p3y = py[(i + 2) % n];
      d += ' C ' + (p1 + (p2 - p0) / 6).toFixed(1) + ' ' + (p1y + (p2y - p0y) / 6).toFixed(1) +
           ', ' + (p2 - (p3 - p1) / 6).toFixed(1) + ' ' + (p2y - (p3y - p1y) / 6).toFixed(1) +
           ', ' + p2.toFixed(1) + ' ' + p2y.toFixed(1);
    }
    return d + ' Z';
  }

  function distToRope(x, y) {
    var n = rope.n, best = Infinity;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var ax = rope.px[i], ay = rope.py[i];
      var bx = rope.px[j], by = rope.py[j];
      var abx = bx - ax, aby = by - ay;
      var t = ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby || 1);
      t = Math.max(0, Math.min(1, t));
      var dx = x - (ax + abx * t), dy = y - (ay + aby * t);
      var dd = dx * dx + dy * dy;
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  }

  function build() {
    docW = document.documentElement.clientWidth;
    docH = Math.max(document.body.scrollHeight, window.innerHeight);
    svg.setAttribute('width', docW);
    svg.setAttribute('height', docH);
    ropeInit();
    pageWorld = { kind: 'page', w: docW, h: docH };
    if (!inLab) world = pageWorld;
  }

  function toWorld(lx, ly) {
    var c = Math.cos(bot_.th), s = Math.sin(bot_.th);
    return { x: bot_.x - lx * s - ly * c, y: bot_.y + lx * c - ly * s };
  }

  function darkAt(wx, wy) {
    if (!world) return false;
    if (world.kind === 'page') {
      // los sensores solo ven la cinta; texto y fotos son blanco
      return distToRope(wx, wy) < LINE_HALF + 3;
    }
    // lab: raster estático con la figura dibujada
    var ctx = world.ctx;
    var cx = Math.round(wx * SCALE), cy = Math.round(wy * SCALE);
    if (cx < 1 || cy < 1 || cx >= ctx.canvas.width - 1 || cy >= ctx.canvas.height - 1) return false;
    var px = ctx.getImageData(cx - 1, cy - 1, 3, 3).data;
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
  // Bucle principal: cuerda, drag del carrito, motores
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

    if (world && world.kind === 'page') {
      ropeStep();
      var d = ropeD();
      path.setAttribute('d', d);
      hitPath.setAttribute('d', d);
    }

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

    var target = drag.held ? 1.12 : 1;
    botScale += (target - botScale) * Math.min(1, dt * 10);
    place();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function dragStep(dt) {
    var grab = drag.g;
    var armAng = Math.atan2(-grab.y, -grab.x);
    var desired;
    if (Math.hypot(drag.vx, drag.vy) > 20) {
      desired = Math.atan2(-drag.vy, -drag.vx) - armAng - Math.PI / 2;
    } else {
      desired = Math.atan2(1, 0) - armAng - Math.PI / 2;
    }
    var dth = desired - bot_.th;
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    bot_.th += dth * Math.min(1, dt * 8);

    var phi = bot_.th + Math.PI / 2;
    var gx = Math.cos(phi) * grab.x - Math.sin(phi) * grab.y;
    var gy = Math.sin(phi) * grab.x + Math.cos(phi) * grab.y;
    bot_.x = drag.px - gx;
    bot_.y = drag.py - gy;
    clampWalls();
  }

  function fallStep(dt) {
    drag.fallT -= dt;
    bot_.x += drag.fallV.x * dt;
    bot_.y += drag.fallV.y * dt;
    drag.fallV.x *= 0.90;
    drag.fallV.y *= 0.90;
    clampWalls();
    if (drag.fallT <= 0) { drag.fallT = 0; bot.classList.remove('lift'); }
  }

  function place() {
    var deg = bot_.th * 180 / Math.PI + 90;
    bot.setAttribute('transform',
      'translate(' + bot_.x + ' ' + bot_.y + ') rotate(' + deg + ') scale(' + botScale + ')');
  }

  // =====================================================================
  // Interacción con el carrito
  // =====================================================================
  function localPoint(clientX, clientY) {
    var r = bot.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = clientX - cx, dy = clientY - cy;
    var phi = bot_.th + Math.PI / 2;
    var c = Math.cos(-phi), s = Math.sin(-phi);
    return { x: (dx * c - dy * s) / botScale, y: (dx * s + dy * c) / botScale };
  }

  bot.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
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
    if (!drag.moved && quick) { toggle(); drag.held = false; return; }
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
  // Agarrar la cinta: el punto más cercano sigue al puntero
  // =====================================================================
  function svgPoint(e) {
    var r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  hitPath.addEventListener('pointerdown', function (e) {
    if (inLab) return;
    e.preventDefault();
    hitPath.setPointerCapture(e.pointerId);
    var p = svgPoint(e);
    var best = -1, bd = Infinity;
    for (var i = 0; i < rope.n; i++) {
      var dd = (rope.px[i] - p.x) * (rope.px[i] - p.x) + (rope.py[i] - p.y) * (rope.py[i] - p.y);
      if (dd < bd) { bd = dd; best = i; }
    }
    rope.grab = best; rope.gx = p.x; rope.gy = p.y;
    hitPath.classList.add('rope-drag');
  });

  hitPath.addEventListener('pointermove', function (e) {
    if (rope.grab < 0) return;
    var p = svgPoint(e);
    rope.gx = p.x; rope.gy = p.y;
  });

  function ropeRelease() {
    if (rope.grab >= 0) {
      retarget();                      // la figura nueva se queda
      for (var i = 0; i < rope.n; i++) {   // y parada en seco, sin rebote
        rope.ox[i] = rope.px[i];
        rope.oy[i] = rope.py[i];
      }
      ropeSave();
    }
    rope.grab = -1;
    hitPath.classList.remove('rope-drag');
  }
  hitPath.addEventListener('pointerup', ropeRelease);
  hitPath.addEventListener('pointercancel', ropeRelease);

  // =====================================================================
  // Probador (lab)
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
    labCtx.lineWidth = 14.4;
    labCtx.lineJoin = 'miter';
    labCtx.lineCap = 'round';
    labCtx.stroke(new Path2D(d));
    labCtx.restore();

    labWorld = { kind: 'lab', ctx: labCtx, w: W, h: H };
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

  // =====================================================================
  // Arranque: el carrito espera quieto sobre el hero, fuera de la cinta
  // =====================================================================
  function spawn() {
    bot_.x = docW / 2;
    bot_.y = Math.min(120, docH * 0.06);
    bot_.th = Math.PI / 2 + (Math.random() - 0.5) * 0.7;
  }

  window.addEventListener('load', function () {
    build();
    spawn();
    place();
  });

  window.__art = { bot_, SENS, toWorld, darkAt, readSensors, rope: rope,
                   path: path, build: build, drag: drag };

  // =====================================================================
  // Menú hamburguesa: cuando los enlaces no caben en la barra se agrupan
  // en un desplegable. No hay breakpoint fijo: se mide el desborde real
  // =====================================================================
  var menu = document.getElementById('menu');
  var menuToggle = document.getElementById('menuToggle');
  var menuLinks = document.getElementById('menuLinks');

  function fitMenu() {
    menu.classList.remove('compact', 'open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menu.classList.toggle('compact',
      menuLinks.scrollWidth > menuLinks.clientWidth + 2);
  }

  function closeMenu() {
    menu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  menuToggle.addEventListener('click', function () {
    menuToggle.setAttribute('aria-expanded',
      menu.classList.toggle('open') ? 'true' : 'false');
  });
  menuLinks.addEventListener('click', function (e) {
    if (e.target.closest('a, button')) closeMenu();
  });
  document.addEventListener('click', function (e) {
    if (menu.classList.contains('open') && !e.target.closest('#menu')) closeMenu();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });

  fitMenu();
  window.addEventListener('resize', fitMenu);
  window.addEventListener('load', fitMenu);   // las fuentes cambian el ancho

  build();
  world = pageWorld;
  spawn();
  place();
})();
