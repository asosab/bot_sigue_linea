/* Arturito — simulador del firmware real (firmware/arturito_v2/arturito_v2.ino).
   La pista es UNA sola cinta que recorre todas las páginas del sitio: entra
   por un portal fijo desde la página anterior y sale por otro hacia la
   siguiente. Dentro de cada página la cinta es una cadena Verlet abierta
   que se puede agarrar y deformar — salvo sus dos puntas, que son los
   portales y no se mueven. Arturito es uno solo por sesión: al llegar al
   portal de salida pasa a la página siguiente, y hay que ir a buscarlo
   para verlo andar. El probador (lab) usa otra cadena, cerrada, con la
   figura de la pista de práctica. */
(function () {
  var svg = document.getElementById('track');       // cinta visible, bajo el contenido
  var svgTop = document.getElementById('trackTop'); // carrito sobre el contenido
  var path = document.getElementById('trackPath');
  var bot = document.getElementById('bot');
  var senDots = bot.querySelectorAll('.sen');

  var docW = 0, docH = 0;
  var WALL = 30;                       // muro invisible: la cinta llega a 30 px del borde

  // --- El circuito entre páginas ----------------------------------------
  // Orden de la historia: portada, el proyecto con su diario, el concurso
  // con sus dos anexos de evidencia y el método. Después vuelve a la
  // portada.
  var PAGES = [
    { id: 'index',    file: 'index.html',    name: 'Inicio' },
    { id: 'proyecto', file: 'proyecto.html', name: 'El proyecto' },
    { id: 'diario',   file: 'diario.html',   name: 'El diario' },
    { id: 'concurso', file: 'concurso.html', name: 'El concurso' },
    { id: 'premios',  file: 'premios.html',  name: 'Los premios' },
    { id: 'colegios', file: 'colegios.html', name: 'Los colegios' },
    { id: 'metodo',   file: 'metodo.html',   name: 'El método' }
  ];
  var PAGE_ID = document.body.getAttribute('data-page') || 'index';
  var pageIx = 0;
  for (var pi = 0; pi < PAGES.length; pi++) {
    if (PAGES[pi].id === PAGE_ID) pageIx = pi;
  }
  var PREV_PAGE = PAGES[(pageIx + PAGES.length - 1) % PAGES.length];
  var NEXT_PAGE = PAGES[(pageIx + 1) % PAGES.length];

  // dónde anda Arturito en esta sesión: una sola copia para todo el sitio
  var LOC_KEY = 'arturito-loc-v1';
  function getLoc() {
    try { return sessionStorage.getItem(LOC_KEY) || 'index'; }
    catch (e) { return 'index'; }
  }
  function setLoc(v) {
    try { sessionStorage.setItem(LOC_KEY, v); } catch (e) { /* sin storage */ }
  }
  var botHere = getLoc() === PAGE_ID;

  // por qué punta entró en esta página: 'in' (vino de la anterior) u
  // 'out' (volvió de la siguiente). El carrito corre en ambos
  // sentidos: sale por una punta y entra por la del mismo lado
  var ARR_KEY = 'arturito-arr-v1';
  function getArr() {
    try { return sessionStorage.getItem(ARR_KEY) || 'in'; }
    catch (e) { return 'in'; }
  }
  function setArr(v) {
    try { sessionStorage.setItem(ARR_KEY, v); } catch (e) { /* sin storage */ }
  }

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
  var rope = { px: [], py: [], ox: [], oy: [], segLen: [], n: 0, grab: -1,
               settle: 0, closed: false };
  var labRope = { px: [], py: [], ox: [], oy: [], segLen: [], n: 0, grab: -1,
                  settle: 0, closed: true };
  // cada página guarda solo su tramo del circuito
  var ROPE_KEY = 'arturito-rope-v4-' + PAGE_ID;
  var ROPE_LAB_KEY = 'arturito-rope-lab-v2';
  var BEND_RADIUS = 100;               // radio mínimo de curvatura de la cinta, px
  var BEND_SPAN = 6;                   // segmentos por lado que revisa el límite
  var TAPE_GAP = 22;                   // separación mínima entre tramos paralelos, px
  var CROSS_COS = 0.7;                 // tangentes más alineadas que esto cuentan como paralelas
  var SELF_SEP = 6;                    // vecinos en la cadena que no son «otro tramo»

  function ropeAlloc(r, n) {
    r.n = n;
    r.px = new Float64Array(n); r.py = new Float64Array(n);
    r.ox = new Float64Array(n); r.oy = new Float64Array(n);
    r.segLen = new Float64Array(n);
  }

  function ropeInit() {
    if (ropeRestore(rope, ROPE_KEY, docW, docH)) {   // la figura guardada gana
      // una figura guardada puede traer tramos montados — venir de una
      // versión vieja o encogerse al escalarla a otra ventana — y se
      // separan en caliente durante los primeros frames
      askSettle(rope, ROPE_KEY, docW, docH);
      return;
    }
    ropeDefault(rope);
  }

  // la figura inicial: la cinta entra por el borde izquierdo a la
  // altura del primer ancla, baja en zigzag por los huecos entre
  // secciones (los divs .track-anchor) y sale por el borde derecho
  // pasado el último. Los dos extremos son los portales: fijos, no
  // se pueden agarrar ni deformar
  function ropeDefault(r) {
    var W = docW, H = docH;
    var m = WALL;
    var R = W - m;

    var anchors = [];
    document.querySelectorAll('.track-anchor').forEach(function (a) {
      var rc = a.getBoundingClientRect();
      anchors.push(rc.top + window.scrollY + rc.height / 2);
    });
    if (!anchors.length) for (var i = 1; i <= 6; i++) anchors.push(m + (H - 2 * m) * i / 7);
    var Yin = anchors[0];
    var Yout = Math.min(anchors[anchors.length - 1] + 90, H - m);

    var LI = m + Math.min(90, (R - m) * 0.12);   // riel interior izquierdo
    var wps = [[0, Yin]];
    var side = 1;                    // 1 = riel derecho, -1 = interior
    for (i = 0; i < anchors.length; i++) {
      wps.push([side > 0 ? R : LI, anchors[i]]);
      side = -side;
    }
    wps.push([side > 0 ? R : LI, Yout]);
    wps.push([W, Yout]);

    // muestreo uniforme del recorrido
    var segs = [], per = 0;
    for (i = 0; i < wps.length - 1; i++) {
      var len = Math.hypot(wps[i + 1][0] - wps[i][0], wps[i + 1][1] - wps[i][1]) || 1;
      segs.push(len);
      per += len;
    }
    var n = Math.max(96, Math.min(480, Math.round(per / 45)));
    ropeAlloc(r, n);
    var idx = 0, acc = segs[0];
    for (i = 0; i < n; i++) {
      var s = i * per / n;
      while (s > acc && idx < segs.length - 1) { idx++; acc += segs[idx]; }
      var u = (s - (acc - segs[idx])) / segs[idx];
      r.px[i] = r.ox[i] = wps[idx][0] + (wps[idx + 1][0] - wps[idx][0]) * u;
      r.py[i] = r.oy[i] = wps[idx][1] + (wps[idx + 1][1] - wps[idx][1]) * u;
    }
    setPins(r);
    retarget(r);
  }

  // los portales son las dos puntas de la cadena: se graban una vez y
  // la física las deja clavadas aunque el usuario deforme el tramo
  function setPins(r) {
    r.p0x = r.px[0]; r.p0y = r.py[0];
    r.p1x = r.px[r.n - 1]; r.p1y = r.py[r.n - 1];
  }

  // longitudes de reposo = distancias actuales: la figura queda plástica,
  // no elástica — sin holgura, la cinta se queda quieta donde la dejes
  function retarget(r) {
    var n = r.n, last = r.closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
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
    setPins(r);
    retarget(r);
    return true;
  }

  // muros invisibles: la cinta llega hasta WALL px del borde
  function clampRope(r, bw, bh) {
    var m = WALL;
    for (var i = 0; i < r.n; i++) {
      if (r.px[i] < m) r.px[i] = m; else if (r.px[i] > bw - m) r.px[i] = bw - m;
      if (r.py[i] < m) r.py[i] = m; else if (r.py[i] > bh - m) r.py[i] = bh - m;
    }
  }

  // La cinta no puede correr un tramo montada sobre otro: dos
  // segmentos casi paralelos cuyas rectas quedan a menos de TAPE_GAP
  // de costado y se solapan en longitud se empujan lateralmente hasta
  // separarse. Un cruce de verdad — direcciones que difieren más de
  // ~45° — no se toca, porque cruzarse sí vale. La fuerza se reparte
  // en los extremos según caigan dentro del tramo solapado, así solo
  // se mueve la parte montada. Devuelve cuántos pares separó.
  var tanX = null, tanY = null;               // dir unitaria por segmento, scratch
  var boxX0 = null, boxX1 = null, boxY0 = null, boxY1 = null;
  function repelOverlap(r) {
    var n = r.n, px = r.px, py = r.py, ox = r.ox, oy = r.oy;
    var segN = r.closed ? n : n - 1;         // segmentos = puntos, o uno menos
    if (!tanX || tanX.length < n) {
      tanX = new Float64Array(n); tanY = new Float64Array(n);
      boxX0 = new Float64Array(n); boxX1 = new Float64Array(n);
      boxY0 = new Float64Array(n); boxY1 = new Float64Array(n);
    }
    for (var i = 0; i < segN; i++) {
      var k = r.closed ? (i + 1) % n : i + 1;
      var vx = px[k] - px[i], vy = py[k] - py[i];
      var l = Math.hypot(vx, vy) || 1e-6;
      tanX[i] = vx / l; tanY[i] = vy / l;
      boxX0[i] = Math.min(px[i], px[k]) - TAPE_GAP;
      boxX1[i] = Math.max(px[i], px[k]) + TAPE_GAP;
      boxY0[i] = Math.min(py[i], py[k]) - TAPE_GAP;
      boxY1[i] = Math.max(py[i], py[k]) + TAPE_GAP;
    }
    // barrido por X: cada segmento solo se compara con los que su caja
    // envolvente toca — con la cinta extendida son unos pocos pares
    var order = new Array(segN);
    for (i = 0; i < segN; i++) order[i] = i;
    order.sort(function (a, b) { return boxX0[a] - boxX0[b]; });
    var moved = 0;
    for (var oi = 0; oi < segN; oi++) {
      i = order[oi];
      var i2 = r.closed ? (i + 1) % n : i + 1;
      for (var oj = oi + 1; oj < segN; oj++) {
        var j = order[oj];
        if (boxX0[j] > boxX1[i]) break;
        var d = i - j; if (d < 0) d = -d;
        if (d <= SELF_SEP || (r.closed && n - d <= SELF_SEP)) continue;
        if (boxY0[j] > boxY1[i] || boxY0[i] > boxY1[j]) continue;
        var j2 = r.closed ? (j + 1) % n : j + 1;
        var s = tanX[i] * tanX[j] + tanY[i] * tanY[j];
        if (s < CROSS_COS && s > -CROSS_COS) continue;   // cruce abierto: legal
        var f = s < 0 ? -1 : 1;
        var mx = tanX[i] + f * tanX[j], my = tanY[i] + f * tanY[j];
        var ml = Math.hypot(mx, my) || 1e-6;
        mx /= ml; my /= ml;
        // intervalos de los dos segmentos proyectados en la dirección
        // media: si no se solapan en longitud no hay tramo montado
        var bi = (px[i2] - px[i]) * mx + (py[i2] - py[i]) * my;
        var aj = (px[j] - px[i]) * mx + (py[j] - py[i]) * my;
        var bj = (px[j2] - px[i]) * mx + (py[j2] - py[i]) * my;
        var lo = Math.max(Math.min(0, bi), Math.min(aj, bj));
        var hi = Math.min(Math.max(0, bi), Math.max(aj, bj));
        var ov = hi - lo;
        if (ov <= 0) continue;
        // separación lateral en los dos bordes del tramo solapado; si
        // cambia de signo ahí dentro los tramos se cruzan, no se montan
        var ti = bi === 0 ? 0 : lo / bi;
        var tj = (bj - aj) === 0 ? 0 : (lo - aj) / (bj - aj);
        var ex = (px[j] + (px[j2] - px[j]) * tj) - (px[i] + (px[i2] - px[i]) * ti);
        var ey = (py[j] + (py[j2] - py[j]) * tj) - (py[i] + (py[i2] - py[i]) * ti);
        var sLo = ex * -my + ey * mx;
        ti = bi === 0 ? 0 : hi / bi;
        tj = (bj - aj) === 0 ? 0 : (hi - aj) / (bj - aj);
        ex = (px[j] + (px[j2] - px[j]) * tj) - (px[i] + (px[i2] - px[i]) * ti);
        ey = (py[j] + (py[j2] - py[j]) * tj) - (py[i] + (py[i2] - py[i]) * ti);
        var sHi = ex * -my + ey * mx;
        if (sLo * sHi < 0) continue;            // cruce dentro del solape
        var ld = Math.min(Math.abs(sLo), Math.abs(sHi));
        if (ld >= TAPE_GAP) continue;
        var side = sLo + sHi < 0 ? -1 : 1;      // de qué lado queda j
        var ux = -my * side, uy = mx * side;
        var push = (TAPE_GAP - ld) * 0.5;
        moved++;
        // cada extremo se mueve en proporción a cuánto cae dentro del
        // tramo solapado: fuera del montado no se empuja
        var edge = Math.min(ov, TAPE_GAP) || 1;
        var ends = [
          [i,  -1, 0], [i2, -1, bi],
          [j,   1, aj], [j2,  1, bj]
        ];
        for (var q = 0; q < 4; q++) {
          var idx = ends[q][0], sgn = ends[q][1], c = ends[q][2];
          var w = c < lo ? Math.max(0, 1 - (lo - c) / edge)
                : c > hi ? Math.max(0, 1 - (c - hi) / edge) : 1;
          if (w <= 0 || idx === r.grab) continue;
          var dxq = ux * push * w * sgn, dyq = uy * push * w * sgn;
          px[idx] += dxq; py[idx] += dyq;
          ox[idx] += dxq; oy[idx] += dyq;
        }
      }
    }
    return moved;
  }

  // al soltar la cinta o al restaurar una figura guardada, los tramos
  // montados se separan en caliente: una pasada por frame hasta que no
  // quede nada que separar — así el desmontado se ve y no congela el
  // hilo como lo haría un bucle de cientos de iteraciones
  function askSettle(r, key, w, h) {
    r.settle = 240;                       // presupuesto de frames
    r.settleKey = key; r.settleW = w; r.settleH = h;
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

    // restricciones de distancia entre vecinos; en la cadena abierta
    // el último punto no se ata de vuelta al primero
    var last = r.closed ? n : n - 1;
    for (var it = 0; it < 4; it++) {
      for (var j = 0; j < last; j++) {
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
            var i0 = c - k, i2 = c + k;
            if (r.closed) { i0 = (i0 + n) % n; i2 = i2 % n; }
            else if (i0 < 0 || i2 >= n) break;
            arc += r.segLen[r.closed ? (c + n - k) % n : c - k] +
                   r.segLen[r.closed ? (c + k - 1) % n : c + k - 1];
            // un arco más largo que media circunferencia puede cerrarse
            // legítimamente: ahí la cuerda corta ya no delata un pliegue
            if (arc >= Math.PI * BEND_RADIUS) break;
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
        var c0 = r.closed ? 0 : 1, c1 = r.closed ? n : n - 1;
        for (var c = c0; c < c1; c++) {
          var i0 = r.closed ? (c + n - 1) % n : c - 1;
          var i2 = r.closed ? (c + 1) % n : c + 1;
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

    // solo mientras se deforma la cinta puede plegarse un tramo sobre
    // otro: la repulsión lateral los separa en caliente. Tras soltarla
    // o restaurarla el desmontado sigue unos frames hasta converger
    if (r.grab >= 0) {
      repelOverlap(r);
    } else if (r.settle > 0) {
      if (--r.settle === 0 || !repelOverlap(r)) {
        r.settle = 0;
        retarget(r);                        // la figura asentada queda plástica
        for (var i = 0; i < n; i++) { ox[i] = px[i]; oy[i] = py[i]; }
        if (r.settleKey) ropeSave(r, r.settleKey, r.settleW, r.settleH);
      } else {
        clampRope(r, r.settleW, r.settleH);
      }
    }

    // los portales quedan clavados: son los puntos fijos de entrada y
    // salida del tramo, el usuario deforma todo lo demás
    if (!r.closed) {
      px[0] = ox[0] = r.p0x; py[0] = oy[0] = r.p0y;
      px[n - 1] = ox[n - 1] = r.p1x; py[n - 1] = oy[n - 1] = r.p1y;
    }

    // muros invisibles
    clampRope(r, bw, bh);
  }

  // Catmull-Rom → curvas suaves de río; en la cadena abierta los
  // extremos se duplican como tangentes y el trazo no se cierra
  function ropeD(r) {
    var n = r.n, px = r.px, py = r.py;
    var last = r.closed ? n : n - 1;
    var d = 'M ' + px[0].toFixed(1) + ' ' + py[0].toFixed(1);
    for (var i = 0; i < last; i++) {
      var i0 = r.closed ? (i + n - 1) % n : Math.max(0, i - 1);
      var i3 = r.closed ? (i + 2) % n : Math.min(n - 1, i + 2);
      var p0 = px[i0], p0y = py[i0];
      var p1 = px[i], p1y = py[i];
      var i1 = r.closed ? (i + 1) % n : i + 1;
      var p2 = px[i1], p2y = py[i1];
      var p3 = px[i3], p3y = py[i3];
      d += ' C ' + (p1 + (p2 - p0) / 6).toFixed(1) + ' ' + (p1y + (p2y - p0y) / 6).toFixed(1) +
           ', ' + (p2 - (p3 - p1) / 6).toFixed(1) + ' ' + (p2y - (p3y - p1y) / 6).toFixed(1) +
           ', ' + p2.toFixed(1) + ' ' + p2y.toFixed(1);
    }
    return r.closed ? d + ' Z' : d;
  }

  function distToRope(r, x, y) {
    var n = r.n, last = r.closed ? n : n - 1, best = Infinity;
    for (var i = 0; i < last; i++) {
      var j = r.closed ? (i + 1) % n : i + 1;
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
    buildPortals();
  }

  // Los letreros de los portales: marcan por dónde viene y por dónde se
  // va Arturito, y enlazan a la página anterior y a la siguiente del
  // circuito. Se crean una vez y se recolocan en cada build
  var signIn = null, signOut = null;
  // los letreros marcan siempre a dónde lleva la punta y enlazan a
  // esa página para seguir el paseo. Cuando Arturito está en la
  // vecina de ese portal, el aviso de su llegada o partida se suma
  // al destino — nunca lo reemplaza
  function refreshSigns() {
    var loc = getLoc();
    signIn.textContent =
      loc === PREV_PAGE.id ? '¡Arturito viene por aquí! ← ' + PREV_PAGE.name
                           : '← ' + PREV_PAGE.name;
    signOut.textContent =
      loc === NEXT_PAGE.id ? '¡Arturito se fue por aquí! ' + NEXT_PAGE.name + ' →'
                           : NEXT_PAGE.name + ' →';
  }
  function buildPortals() {
    if (!signIn) {
      signIn = document.createElement('a');
      signIn.className = 'portal in';
      signIn.href = PREV_PAGE.file;
      signIn.title = 'La cinta viene de la página anterior';
      document.body.appendChild(signIn);
      signOut = document.createElement('a');
      signOut.className = 'portal out';
      signOut.href = NEXT_PAGE.file;
      signOut.title = 'La cinta sigue en la página siguiente';
      document.body.appendChild(signOut);
    }
    refreshSigns();
    signIn.style.transform =
      'translate(12px,' + (rope.p0y - 36) + 'px)';
    signOut.style.transform =
      'translate(' + (rope.p1x - 12) + 'px,' + (rope.p1y - 36) + 'px) translateX(-100%)';
  }

  // el mapa del circuito vive en la portada (#circuito): marca en qué
  // página anda Arturito ahora mismo
  function updateMap() {
    var mb = document.getElementById('mapBot');
    if (!mb) return;
    var node = document.querySelector('.map-node[data-page="' + getLoc() + '"]');
    if (node) {
      mb.setAttribute('transform',
        node.getAttribute('transform') + ' translate(0 -34)');
    }
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
    } else if (exiting) {
      exitStep(dt);
    } else if (running) {
      control(t);
      physics(dt);
    }

    // los portales tragan al carrito por cualquiera de las dos
    // puntas — manejando hacia adelante o hacia atrás, o arrastrado
    // por el usuario hasta el borde
    if (botHere && !exiting) {
      var dxo = bot_.x - rope.p1x, dyo = bot_.y - rope.p1y;
      var dxi = bot_.x - rope.p0x, dyi = bot_.y - rope.p0y;
      if (dxo * dxo + dyo * dyo < 45 * 45) startExit('out');
      else if (dxi * dxi + dyi * dyi < 45 * 45) startExit('in');
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

  // salida por cualquiera de los portales: suelta el control y sale
  // derechito por el borde de esa punta, como si la cinta siguiera
  // fuera de la página. 'out' lleva a la página siguiente, 'in' a
  // la anterior — el carrito corre en ambos sentidos
  var exiting = false;
  var exitPage = null;
  function startExit(end) {
    if (!end) end = 'out';
    exiting = true;
    var tx = end === 'out' ? rope.p1x : rope.p0x;
    var ty = end === 'out' ? rope.p1y : rope.p0y;
    var ox = 0, oy = 0;
    if (tx > docW - 60) ox = 1;
    else if (tx < 60) ox = -1;
    else if (ty > docH - 60) oy = 1;
    else oy = -1;
    bot_.th = Math.atan2(oy, ox);
    bot.style.transition = 'opacity .6s';
    bot.style.opacity = '0';
    exitPage = end === 'out' ? NEXT_PAGE : PREV_PAGE;
    // del otro lado aparece por la punta del mismo lado: salir por la
    // de adelante es llegar a la siguiente por la de atrás
    setArr(end === 'out' ? 'in' : 'out');
    var sign = end === 'out' ? signOut : signIn;
    if (sign) sign.classList.add('flash');
  }
  function exitStep(dt) {
    bot_.x += Math.cos(bot_.th) * 240 * dt;
    bot_.y += Math.sin(bot_.th) * 240 * dt;
    if (bot_.x > docW + 80 || bot_.x < -80 ||
        bot_.y > docH + 80 || bot_.y < -80) {
      // ya está del otro lado: la posición pasa a la página vecina
      // y el encendido queda guardado para que entre corriendo allá
      setLoc(exitPage.id);
      exiting = false;
      running = false;
      arrancado = false;
      botHere = false;
      bot.style.display = 'none';
      refreshSigns();               // ya se fue: los letreros vuelven a marcar destinos
      updateMap();                  // el mapa de la portada lo marca ya en la página vecina
    }
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
    try { bot.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }
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

  // el encendido se recuerda entre páginas: si corre en una, corre en todas
  var ON_KEY = 'arturito-on-v1';
  function savedOn() {
    try { return localStorage.getItem(ON_KEY) === '1'; }
    catch (e) { return false; }
  }
  function saveOn() {
    try { localStorage.setItem(ON_KEY, running ? '1' : '0'); }
    catch (e) { /* sin storage */ }
  }

  function powerOn() {
    // encendido en la mano: espera la línea de salida como el real
    running = true;
    bot.classList.add('on');
    arrancado = false;
    posF = posPrev = 0;
    ultimoLado = 0;
    perdidaDesde = 0;
    cruceHasta = 0;
    lineaDesde = 0;
    for (var i = 0; i < 5; i++) { calMin[i] = CAL_MIN_INI; calMax[i] = CAL_MAX_INI; }
  }

  function powerOff() {
    running = false;
    bot.classList.remove('on');
    pwmL = pwmR = 0;
  }

  function toggle() {
    // en carrera el click es el pulsador real: detiene y deja
    // esperando la largada (encendido pero quieto, como el firmware)
    if (running && arrancado) {
      arrancado = false;
      pwmL = pwmR = 0;
      lineaDesde = 0;
      return;
    }
    if (running) powerOff(); else powerOn();
    saveOn();
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
    // en la cadena abierta las puntas no se agarran: son los portales
    var i0 = r.closed ? 0 : 1, i1 = r.closed ? r.n : r.n - 1;
    var best = -1, bd = Infinity;
    for (var i = i0; i < i1; i++) {
      var dd = (r.px[i] - p.x) * (r.px[i] - p.x) + (r.py[i] - p.y) * (r.py[i] - p.y);
      if (dd < bd) { bd = dd; best = i; }
    }
    r.grab = best; r.gx = p.x; r.gy = p.y;
    if (hit) hit.classList.add('rope-drag');
  }

  function ropeDrop(r, hit, key, w, h) {
    if (r.grab >= 0) {
      r.grab = -1;
      // si quedó algún tramo montado se separa en caliente y la figura
      // se guarda cuando converge — nunca se persiste solapada
      askSettle(r, key, w, h);
    }
    r.grab = -1;
    if (hit) hit.classList.remove('rope-drag');
  }

  // Agarrar la cinta de la página: sin elemento sobre el texto (taparía
  // titulares y robaría clicks). Se reclama el gesto a nivel documento
  // solo cuando el pointerdown cae dentro de la banda de la cinta y el
  // objetivo no es un control — un link bajo la cinta siempre gana.
  // semi-ancho de la banda de agarre: en táctil la banda es más
  // generosa porque el dedo tapa más que el puntero
  var GRAB_TOL = window.matchMedia &&
    matchMedia('(pointer: coarse)').matches ? 34 : 20;
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
    // la cinta reclamada no mueve la página ni dispara recarga: si hay
    // agarre en curso (pointer) o el gesto empezó sobre la banda, el
    // movimiento es de la cinta, no del documento
    if (tapeTouch || rope.grab >= 0) e.preventDefault();
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
    } else {
      askSettle(labRope, ROPE_LAB_KEY, W, H);   // una figura vieja puede traer montados
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

  if (labHit) {
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
  }

  function openLab() {
    lab.hidden = false;                 // visible para medir la figura
    buildLab();
    savedPose = { x: bot_.x, y: bot_.y, th: bot_.th };
    document.body.style.overflow = 'hidden';
    labSvg.appendChild(bot);
    // en el probador siempre hay carrito, aunque el del circuito ande
    // por otra página: es una simulación aparte
    bot.style.display = '';
    bot.style.opacity = '1';
    bot.style.transition = '';
    world = labWorld; inLab = true;
    bot_.x = labStart.x; bot_.y = labStart.y; bot_.th = labStart.th;
    place();
  }

  function closeLab() {
    inLab = false; world = pageWorld;
    svgTop.appendChild(bot);
    if (savedPose) { bot_.x = savedPose.x; bot_.y = savedPose.y; bot_.th = savedPose.th; }
    if (!botHere) bot.style.display = 'none';
    lab.hidden = true;
    document.body.style.overflow = '';
    place();
  }

  // las páginas de lectura no traen todos los controles: se ata solo
  // el que existe
  function onClick(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }
  onClick('openLab', openLab);
  onClick('closeLab', closeLab);

  // «Restaurar la cinta»: borra la figura guardada de TODAS las
  // páginas y repone el tramo de esta. El carrito se queda donde está
  onClick('resetCinta', function () {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('arturito-rope-v4-') === 0) keys.push(k);
      }
      for (i = 0; i < keys.length; i++) localStorage.removeItem(keys[i]);
    } catch (e) { /* sin storage */ }
    rope.grab = -1;
    rope.settle = 0;
    tapeGrabbed = false;
    document.body.style.cursor = '';
    build();
  });

  // «Reiniciar el carrito»: devuelve a Arturito al portal de entrada
  // de esta página — esté donde esté en el circuito — y lo deja
  // esperando la largada. La cinta no se toca
  onClick('resetCarrito', function () {
    try {
      setLoc(PAGE_ID);
      setArr('in');
    } catch (e) { /* sin storage */ }
    exiting = false;
    drag.held = false;
    drag.fallT = 0;
    botHere = true;
    bot.style.display = '';
    bot.style.opacity = '1';
    bot.style.transition = '';
    bot.classList.remove('drag', 'lift');
    if (savedOn()) powerOn(); else powerOff();
    spawn();
    refreshSigns();
    updateMap();
    place();
  });
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
    if (!botHere) return;                     // anda por otra página
    // espera en el portal por el que entró, mirando adentro del
    // tramo: vino de la página anterior → punta de atrás mirando
    // hacia adelante; volvió de la siguiente → punta de adelante
    // mirando hacia atrás. Apagado queda ahí, encendido larga solo
    var arr = getArr();
    var k, dir;
    if (arr === 'out') { k = Math.max(1, rope.n - 9); dir = -1; }
    else               { k = Math.min(8, rope.n - 2); dir = 1; }
    bot_.x = rope.px[k];
    bot_.y = rope.py[k];
    bot_.th = Math.atan2(rope.py[k + dir] - rope.py[k],
                         rope.px[k + dir] - rope.px[k]);
  }

  // Si el usuario pidió menos movimiento, el clip queda en su poster y
  // se maneja a mano con los controles nativos
  var clip = document.querySelector('.clip video');
  if (clip && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clip.removeAttribute('autoplay');
    clip.pause();
    clip.controls = true;
  }

  function boot() {
    build();
    world = pageWorld;
    if (!botHere) {
      bot.style.display = 'none';
    } else if (savedOn()) {
      powerOn();
    }
    spawn();
    place();
    updateMap();
  }
  window.addEventListener('load', boot);

  window.__art = { bot_, SENS, toWorld, oscuridad, leerSensores, rope: rope,
                   labRope: labRope, path: path, build: build, drag: drag,
                   repelOverlap: repelOverlap,
                   getLoc: getLoc, botHere: function () { return botHere; },
                   NEXT_PAGE: NEXT_PAGE, PREV_PAGE: PREV_PAGE,
                   startExit: startExit, exiting: function () { return exiting; } };

  // =====================================================================
  // Menú hamburguesa: cuando los enlaces no caben en la barra se agrupan
  // en un desplegable. No hay breakpoint fijo: se mide el desborde real
  // =====================================================================
  var menu = document.getElementById('menu');
  var menuToggle = document.getElementById('menuToggle');
  var menuLinks = document.getElementById('menuLinks');

  if (!menu || !menuToggle || !menuLinks) return;

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

  boot();
})();
