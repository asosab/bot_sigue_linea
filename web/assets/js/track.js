/* Arturito — simulador del firmware real (firmware/arturito_v2/arturito_v2.ino).
   La pista es una cinta cerrada dibujada como cadena Verlet: se puede
   agarrar y deformar con el dedo o el mouse, y el carrito la sigue leyendo
   sus 5 sensores sobre la geometría real de la cadena. El probador (lab)
   usa otra cadena igual, con la figura de la pista de práctica como forma
   inicial; ambas recuerdan su última posición en localStorage. */
(function () {
  var svg = document.getElementById('track');       // cinta visible, bajo el contenido
  var svgTop = document.getElementById('trackTop'); // carrito sobre el contenido
  var path = document.getElementById('trackPath');
  var bot = document.getElementById('bot');
  var senDots = bot.querySelectorAll('.sen');

  var docW = 0, docH = 0;
  var WALL = 30;                       // muro invisible: la cinta llega a 30 px del borde

  // --- Mundo activo (página o probador) ---------------------------------
  var pageWorld = null, labWorld = null, world = null;

  // --- Robot -------------------------------------------------------------
  var VMAX = 115, K = VMAX / 255;
  var WHEEL_BASE = 60;
  var LINE_HALF = 7.2;                 // 14.4 px de línea ≈ 1.6 cm
  var SPOT = 4;                        // margen de lectura del sensor, px

  // parámetros del firmware (firmware/arturito_v2/arturito_v2.ino)
  var VEL_MAX = 180, VEL_MIN = 70;
  var KP = 40, KD = 25, KS = 70, ALPHA = 0.4, REV_MAX = 60;
  var TRIM_IZQ = 1.0, TRIM_DER = 1.0;
  var N_ON = 0.6, N_OFF = 0.4;
  var VEL_CRUCE = 140, AVANCE_CRUCE_MS = 200;
  var GIRO_BUSQUEDA_MS = 1500, VEL_BUSQUEDA = 130, VEL_REBOBINADO = 90;
  var PESO = [-2, -1, 0, 1, 2];
  var CAL_MIN_INI = 0.03, CAL_MAX_INI = 0.93;
  // el firmware larga con un pulsador; acá equivale a sostener el
  // carrito quieto sobre la línea este tiempo antes de arrancar
  var LARGADA_MS = 300;

  var bot_ = { x: 0, y: 0, th: 0 };
  var botScale = 1;
  var pwmL = 0, pwmR = 0;
  var running = false;

  // estado del control (espejo de las variables del .ino)
  var calMin = [], calMax = [], lecturas = [0, 0, 0, 0, 0];
  var posF = 0, posPrev = 0;
  var ultimoLado = 0;
  var perdidaDesde = 0, cruceHasta = 0, lineaDesde = 0;
  var arrancado = false;

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
  var labRope = { px: [], py: [], ox: [], oy: [], segLen: [], n: 0, grab: -1 };
  var ROPE_KEY = 'arturito-rope';
  var ROPE_LAB_KEY = 'arturito-rope-lab';
  var BEND_RADIUS = 100;               // radio mínimo de curvatura de la cinta, px
  var BEND_SPAN = 6;                   // segmentos por lado que revisa el límite

  function ropeAlloc(r, n) {
    r.n = n;
    r.px = new Float64Array(n); r.py = new Float64Array(n);
    r.ox = new Float64Array(n); r.oy = new Float64Array(n);
    r.segLen = new Float64Array(n);
  }

  function ropeInit() {
    if (ropeRestore(rope, ROPE_KEY, docW, docH)) return;   // la figura guardada gana
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
    ropeAlloc(rope, n);

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
    retarget(rope);
  }

  // longitudes de reposo = distancias actuales: la figura queda plástica,
  // no elástica — sin holgura, la cinta se queda quieta donde la dejes
  function retarget(r) {
    var n = r.n;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      r.segLen[i] = Math.hypot(r.px[j] - r.px[i], r.py[j] - r.py[i]);
    }
  }

  // la figura se guarda en localStorage cada vez que se suelta la cinta:
  // al recargar la página reaparece el diseño que le dejó el usuario
  function ropeSave(r, key, w, h) {
    try {
      var p = new Array(r.n);
      for (var i = 0; i < r.n; i++) {
        p[i] = [Math.round(r.px[i] * 10) / 10,
                Math.round(r.py[i] * 10) / 10];
      }
      localStorage.setItem(key,
        JSON.stringify({ w: w, h: h, p: p }));
    } catch (e) { /* sin storage disponible, la cinta no persiste */ }
  }

  function ropeRestore(r, key, w, h) {
    var saved;
    try { saved = JSON.parse(localStorage.getItem(key)); }
    catch (e) { return false; }
    if (!saved || !saved.p || saved.p.length < 32 ||
        !saved.w || !saved.h) return false;
    // si la ventana cambió de tamaño la figura se escala en proporción
    // y se recorta a los muros para que no quede nada fuera
    var sx = w / saved.w, sy = h / saved.h;
    var n = saved.p.length;
    ropeAlloc(r, n);
    for (var i = 0; i < n; i++) {
      var x = Math.min(Math.max(saved.p[i][0] * sx, WALL), w - WALL);
      var y = Math.min(Math.max(saved.p[i][1] * sy, WALL), h - WALL);
      r.px[i] = r.ox[i] = x;
      r.py[i] = r.oy[i] = y;
    }
    retarget(r);
    return true;
  }

  function ropeStep(r, bw, bh) {
    var n = r.n, px = r.px, py = r.py, ox = r.ox, oy = r.oy;

    // integración Verlet con amortiguación fuerte y umbral de sueño:
    // la cinta quiere estar quieta, no un columpio eterno
    for (var i = 0; i < n; i++) {
      var vx = (px[i] - ox[i]) * 0.90, vy = (py[i] - oy[i]) * 0.90;
      if (vx * vx + vy * vy < 0.0009) { vx = 0; vy = 0; }
      ox[i] = px[i]; oy[i] = py[i];
      px[i] += vx; py[i] += vy;
    }

    // agarre: el punto arrastrado sigue el puntero
    if (r.grab >= 0) {
      px[r.grab] = r.gx; py[r.grab] = r.gy;
      ox[r.grab] = r.gx; oy[r.grab] = r.gy;
    }

    // restricciones de distancia entre vecinos (anillos cerrados)
    for (var it = 0; it < 4; it++) {
      for (var j = 0; j < n; j++) {
        var k = (j + 1) % n;
        var dx = px[k] - px[j], dy = py[k] - py[j];
        var d = Math.hypot(dx, dy) || 1e-6;
        var diff = (d - r.segLen[j]) / d * 0.5;
        dx *= diff; dy *= diff;
        px[j] += dx; py[j] += dy;
        px[k] -= dx; py[k] -= dy;
      }
      if (r.grab >= 0) {
        // radio mínimo de curvatura mientras se arrastra: la cinta no se
        // dobla más cerrada que un arco de BEND_RADIUS. Se revisa en varias
        // escalas (spans de k segmentos) para que el doblez se reparta en
        // una curva amplia en vez de concentrarse en un pico. Solo durante
        // el arrastre: en reposo deformaría sola la figura guardada
        var kmax = Math.min(BEND_SPAN, (n >> 1) - 1);
        for (var c = 0; c < n; c++) {
          var arc = 0;
          for (var k = 1; k <= kmax; k++) {
            arc += r.segLen[(c + n - k) % n] + r.segLen[(c + k - 1) % n];
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
              if (i0 === r.grab) {
                px[i2] += cx0 * push; py[i2] += cy0 * push;
              } else if (i2 === r.grab) {
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
          var minD = 0.85 * (r.segLen[i0] + r.segLen[c]) * 0.5;
          if (cd < minD) {
            var push = (minD - cd) / cd * 0.5;
            px[i0] -= cx0 * push; py[i0] -= cy0 * push;
            px[i2] += cx0 * push; py[i2] += cy0 * push;
          }
        }
      }
      if (r.grab >= 0) { px[r.grab] = r.gx; py[r.grab] = r.gy; }
    }

    // rigidez de cinta solo mientras se arrastra: suaviza la forma que se
    // está creando sin volver al óvalo (si actuara en reposo parecería un
    // elástico que tira para atrás). También mueve la posición previa
    // para no inyectar velocidad.
    if (r.grab >= 0) {
      for (var s = 0; s < n; s++) {
        var p0 = (s + n - 1) % n, p1 = (s + 1) % n;
        if (s === r.grab) continue;
        var sx = ((px[p0] + px[p1]) / 2 - px[s]) * 0.16;
        var sy = ((py[p0] + py[p1]) / 2 - py[s]) * 0.16;
        px[s] += sx; ox[s] += sx;
        py[s] += sy; oy[s] += sy;
      }
    }

    // muros invisibles
    var m = WALL;
    for (var w = 0; w < n; w++) {
      if (px[w] < m) px[w] = m; else if (px[w] > bw - m) px[w] = bw - m;
      if (py[w] < m) py[w] = m; else if (py[w] > bh - m) py[w] = bh - m;
    }
  }

  // Catmull-Rom cerrado → curvas suaves de río
  function ropeD(r) {
    var n = r.n, px = r.px, py = r.py;
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

  function distToRope(r, x, y) {
    var n = r.n, best = Infinity;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var ax = r.px[i], ay = r.py[i];
      var bx = r.px[j], by = r.py[j];
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
    pageWorld = { kind: 'page', w: docW, h: docH,
                  rope: rope, path: path };
    if (!inLab) world = pageWorld;
  }

  function toWorld(lx, ly) {
    var c = Math.cos(bot_.th), s = Math.sin(bot_.th);
    return { x: bot_.x - lx * s - ly * c, y: bot_.y + lx * c - ly * s };
  }

  // oscuridad continua 0..1: 1 dentro de la línea y cae a 0 en SPOT px;
  // el spot imita la lectura gradual del TCRT5000 al borde de la cinta
  function oscuridad(wx, wy) {
    if (!world) return 0;
    // los sensores solo ven la cinta; texto, fotos y el lab-bar son blanco
    var d = distToRope(world.rope, wx, wy) - LINE_HALF;
    if (d <= 0) return 1;
    if (d >= SPOT) return 0;
    return 1 - d / SPOT;
  }

  // =====================================================================
  // Control: traducción directa del algoritmo del .ino
  // =====================================================================
  function negrura(i) {
    var n = (lecturas[i] - calMin[i]) / (calMax[i] - calMin[i]);
    return n < 0 ? 0 : (n > 1 ? 1 : n);
  }

  // lee los 5 canales y expande calMin/calMax con cada extremo nuevo
  function leerSensores() {
    for (var i = 0; i < 5; i++) {
      var w = toWorld(SENS[i].x, SENS[i].y);
      var v = oscuridad(w.x, w.y);
      lecturas[i] = v;
      if (v < calMin[i]) calMin[i] = v;
      if (v > calMax[i]) calMax[i] = v;
      senDots[i].classList.toggle('hit', v > 0.5);
    }
  }

  // al apoyarlo sobre la línea, la posición de salida siembra la pista:
  // canal sobre negro → su calMax, sobre blanco → su calMin
  function sembrarPista() {
    for (var i = 0; i < 5; i++) {
      var medio = (calMin[i] + calMax[i]) / 2;
      if (lecturas[i] > medio) calMax[i] = lecturas[i];
      else calMin[i] = lecturas[i];
    }
  }

  function control(now) {
    leerSensores();

    // compuerta de arranque: quieto hasta la «largada» — en el firmware
    // es el pulsador; acá, sostenerlo quieto y centrado sobre la línea
    if (!arrancado) {
      if (negrura(2) > N_ON && negrura(0) < N_OFF && negrura(4) < N_OFF) {
        if (!lineaDesde) lineaDesde = now;
        if (now - lineaDesde >= LARGADA_MS) {
          sembrarPista();
          arrancado = true;
          posF = posPrev = 0;
          perdidaDesde = 0;
        }
      } else {
        lineaDesde = 0;
      }
      pwmL = pwmR = 0;
      return;
    }

    // cruce comprometido: recto sin leer hasta que venza el tramo
    if (cruceHasta) {
      if (now < cruceHasta) { pwmL = pwmR = VEL_CRUCE; return; }
      cruceHasta = 0;
    }

    var suma = 0, sumaP = 0, todoNegro = true;
    for (var i = 0; i < 5; i++) {
      var n = negrura(i);
      suma += n;
      sumaP += PESO[i] * n;
      if (n < 0.7) todoNegro = false;
    }

    // cruce o bifurcación: armar el avance recto temporizado; ultimoLado
    // se conserva por si era una esquina cerrada y no un cruce
    if (todoNegro) {
      cruceHasta = now + AVANCE_CRUCE_MS;
      posF = posPrev = 0;
      perdidaDesde = 0;
      pwmL = pwmR = VEL_CRUCE;
      return;
    }

    // línea a la vista: PD sobre la posición filtrada
    if (suma > 0.3) {
      var pos = sumaP / suma;
      posF += ALPHA * (pos - posF);        // EMA: corta los saltos
      var deriv = posF - posPrev;
      posPrev = posF;

      if (posF > 0.5) ultimoLado = 1;
      else if (posF < -0.5) ultimoLado = -1;
      perdidaDesde = 0;

      var base = Math.max(VEL_MIN, VEL_MAX - KS * Math.abs(posF));
      var corr = KP * posF + KD * deriv;
      pwmL = Math.max(-REV_MAX, Math.min(255, (base + corr) * TRIM_IZQ));
      pwmR = Math.max(-REV_MAX, Math.min(255, (base - corr) * TRIM_DER));
      return;
    }

    // línea perdida: buscar hacia el último lado visto
    if (!perdidaDesde) perdidaDesde = now;
    var perdidaMs = now - perdidaDesde;
    if (perdidaMs < GIRO_BUSQUEDA_MS) {
      var giro = ultimoLado >= 0 ? VEL_BUSQUEDA : -VEL_BUSQUEDA;
      pwmL = giro; pwmR = -giro;
    } else {
      var g = ultimoLado >= 0 ? VEL_REBOBINADO : -VEL_REBOBINADO;
      pwmL = -VEL_REBOBINADO + g / 2;
      pwmR = -VEL_REBOBINADO - g / 2;
    }
  }

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

    if (world && world.rope) {
      ropeStep(world.rope, world.w, world.h);
      var d = ropeD(world.rope);
      world.path.setAttribute('d', d);
      if (world.hitPath) world.hitPath.setAttribute('d', d);
    }

    if (drag.held) {
      dragStep(dt);
    } else if (drag.fallT > 0) {
      fallStep(dt);
    } else if (running) {
      control(t);
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

  var TOP_HALF = 55;              // la caja del carrito mide 110×110
  function place() {
    var deg = bot_.th * 180 / Math.PI + 90;
    if (inLab) {
      // en el probador el svg es a pantalla completa: el grupo se mueve
      bot.setAttribute('transform',
        'translate(' + bot_.x + ' ' + bot_.y + ') rotate(' + deg + ') scale(' + botScale + ')');
    } else {
      // en la página la caja sigue al carrito y el grupo va centrado
      svgTop.style.transform =
        'translate(' + (bot_.x - TOP_HALF) + 'px,' + (bot_.y - TOP_HALF) + 'px)';
      bot.setAttribute('transform',
        'translate(' + TOP_HALF + ' ' + TOP_HALF + ') rotate(' + deg + ') scale(' + botScale + ')');
    }
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
    if (running) {
      // encendido en la mano: espera la línea de salida como el real
      arrancado = false;
      posF = posPrev = 0;
      ultimoLado = 0;
      perdidaDesde = 0;
      cruceHasta = 0;
      lineaDesde = 0;
      for (var i = 0; i < 5; i++) { calMin[i] = CAL_MIN_INI; calMax[i] = CAL_MAX_INI; }
    }
    else { pwmL = pwmR = 0; }
  }

  // =====================================================================
  // Agarrar la cinta: el punto más cercano sigue al puntero. La misma
  // mecánica sirve para la cinta de la página y la del probador
  // =====================================================================
  function svgPointAt(el, e) {
    var r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function ropeGrab(r, hit, p) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < r.n; i++) {
      var dd = (r.px[i] - p.x) * (r.px[i] - p.x) + (r.py[i] - p.y) * (r.py[i] - p.y);
      if (dd < bd) { bd = dd; best = i; }
    }
    r.grab = best; r.gx = p.x; r.gy = p.y;
    if (hit) hit.classList.add('rope-drag');
  }

  function ropeDrop(r, hit, key, w, h) {
    if (r.grab >= 0) {
      retarget(r);                    // la figura nueva se queda
      for (var i = 0; i < r.n; i++) {    // y parada en seco, sin rebote
        r.ox[i] = r.px[i];
        r.oy[i] = r.py[i];
      }
      ropeSave(r, key, w, h);
    }
    r.grab = -1;
    if (hit) hit.classList.remove('rope-drag');
  }

  // Agarrar la cinta de la página: sin elemento sobre el texto (taparía
  // titulares y robaría clicks). Se reclama el gesto a nivel documento
  // solo cuando el pointerdown cae dentro de la banda de la cinta y el
  // objetivo no es un control — un link bajo la cinta siempre gana.
  var GRAB_TOL = 20;                 // semi-ancho de la banda de agarre, px
  var tapeGrabbed = false;

  function sobreControl(e) {
    return e.target.closest(
      'a, button, input, select, textarea, summary, [role="button"], ' +
      '#menu, #lab, #visor');
  }

  document.addEventListener('pointerdown', function (e) {
    if (inLab || tapeGrabbed) return;
    var p = { x: e.clientX, y: e.clientY + window.scrollY };
    if (distToRope(rope, p.x, p.y) > GRAB_TOL) return;
    if (sobreControl(e)) return;
    e.preventDefault();
    tapeGrabbed = true;
    ropeGrab(rope, null, p);
    document.body.style.cursor = 'grabbing';
  });

  document.addEventListener('pointermove', function (e) {
    if (rope.grab < 0) return;
    rope.gx = e.clientX; rope.gy = e.clientY + window.scrollY;
  });

  function tapeRelease() {
    if (!tapeGrabbed) return;
    tapeGrabbed = false;
    document.body.style.cursor = '';
    ropeDrop(rope, null, ROPE_KEY, docW, docH);
  }
  document.addEventListener('pointerup', tapeRelease);
  document.addEventListener('pointercancel', tapeRelease);

  // cursor «grab» cuando el mouse está sobre la banda y no hay control:
  // es la pista visual de que ahí la cinta se puede agarrar
  var cursorT = 0;
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || tapeGrabbed || inLab) return;
    var now = performance.now();
    if (now - cursorT < 60) return;
    cursorT = now;
    var near = !sobreControl(e) &&
      distToRope(rope, e.clientX, e.clientY + window.scrollY) <= GRAB_TOL;
    document.body.style.cursor = near ? 'grab' : '';
  });

  // En táctil, cancelar el scroll dentro de la banda es lo que reclama
  // el gesto para la cinta: el pointerdown solo no basta, porque el
  // browser empieza a scrollear con el primer touchmove. Equivale al
  // touch-action:none que llevaba el trazo invisible anterior.
  var tapeTouch = false;
  document.addEventListener('touchstart', function (e) {
    tapeTouch = !inLab && !tapeGrabbed &&
      !sobreControl(e) &&
      distToRope(rope,
        e.touches[0].clientX,
        e.touches[0].clientY + window.scrollY) <= GRAB_TOL;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (tapeTouch) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', function () { tapeTouch = false; });
  document.addEventListener('touchcancel', function () { tapeTouch = false; });

  // =====================================================================
  // Probador (lab)
  // =====================================================================
  var lab = document.getElementById('lab');
  var labSvg = document.getElementById('labTrack');
  var labPath = document.getElementById('labPath');
  var labHit = document.getElementById('labHit');
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
    } else {
      var b = rx * 0.52;
      d = 'M ' + cx + ' ' + cy +
          ' C ' + (cx - b * 0.55) + ' ' + (cy - ry * 1.25) + ', ' + (cx - 2 * b) + ' ' + (cy - ry) + ', ' + (cx - 2 * b) + ' ' + cy +
          ' C ' + (cx - 2 * b) + ' ' + (cy + ry) + ', ' + (cx - b * 0.55) + ' ' + (cy + ry * 1.25) + ', ' + cx + ' ' + cy +
          ' C ' + (cx + b * 0.55) + ' ' + (cy + ry * 1.25) + ', ' + (cx + 2 * b) + ' ' + (cy + ry) + ', ' + (cx + 2 * b) + ' ' + cy +
          ' C ' + (cx + 2 * b) + ' ' + (cy - ry) + ', ' + (cx + b * 0.55) + ' ' + (cy - ry * 1.25) + ', ' + cx + ' ' + cy + ' Z';
    }

    labWorld = { kind: 'lab', w: W, h: H,
                 rope: labRope, path: labPath, hitPath: labHit };

    // con figura guardada se restaura; si no, el circuito en ocho de
    // práctica se muestrea a puntos de la cadena
    if (!ropeRestore(labRope, ROPE_LAB_KEY, W, H)) {
      labPath.setAttribute('d', d);
      var len = labPath.getTotalLength();
      var n = Math.max(64, Math.min(180, Math.round(len / 42)));
      ropeAlloc(labRope, n);
      for (var i = 0; i < n; i++) {
        var p = labPath.getPointAtLength(i * len / n);
        labRope.px[i] = labRope.ox[i] = p.x;
        labRope.py[i] = labRope.oy[i] = p.y;
      }
      retarget(labRope);
    }

    // el carrito arranca sobre el primer nodo de la cinta, mirando hacia
    // el tramo que sigue: así cae sobre la línea aunque la figura sea una
    // que dejó el usuario y no el ocho por defecto
    labStart = {
      x: labRope.px[0], y: labRope.py[0],
      th: Math.atan2(labRope.py[1] - labRope.py[0],
                     labRope.px[1] - labRope.px[0])
    };
    var rd = ropeD(labRope);
    labPath.setAttribute('d', rd);
    labHit.setAttribute('d', rd);
    if (inLab) world = labWorld;
  }

  labHit.addEventListener('pointerdown', function (e) {
    if (!inLab) return;
    e.preventDefault();
    labHit.setPointerCapture(e.pointerId);
    ropeGrab(labRope, labHit, svgPointAt(labSvg, e));
  });

  labHit.addEventListener('pointermove', function (e) {
    if (labRope.grab < 0) return;
    var p = svgPointAt(labSvg, e);
    labRope.gx = p.x; labRope.gy = p.y;
  });

  function labRelease() {
    ropeDrop(labRope, labHit, ROPE_LAB_KEY,
             window.innerWidth, window.innerHeight);
  }
  labHit.addEventListener('pointerup', labRelease);
  labHit.addEventListener('pointercancel', labRelease);

  function openLab() {
    lab.hidden = false;                 // visible para medir la figura
    buildLab();
    savedPose = { x: bot_.x, y: bot_.y, th: bot_.th };
    document.body.style.overflow = 'hidden';
    labSvg.appendChild(bot);
    world = labWorld; inLab = true;
    bot_.x = labStart.x; bot_.y = labStart.y; bot_.th = labStart.th;
    place();
  }

  function closeLab() {
    inLab = false; world = pageWorld;
    svgTop.appendChild(bot);
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

  window.__art = { bot_, SENS, toWorld, oscuridad, leerSensores, rope: rope,
                   labRope: labRope, path: path, build: build, drag: drag };

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
