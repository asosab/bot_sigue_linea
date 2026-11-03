// colegios.html: el toggle «por dependencia / por distrito» recolorea
// las barras por colegio. Sin script queda la vista por dependencia.
(function () {
  var chart = document.getElementById('chartEscuelas');
  var btns = document.querySelectorAll('.chart-toggle button');
  if (!chart || !btns.length) return;

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.classList.toggle('on', x === b); });
      chart.classList.toggle('dist', b.dataset.mode === 'dist');
    });
  });
})();

// Gráficas vivas: un tooltip que sigue al puntero en todas las barras y
// una torta interactiva que reemplaza al conic-gradient estático (sin
// JS la página queda como antes). En táctil, un toque fija el dato y otro
// toque fuera lo quita.
(function () {
  var tip = document.createElement('div');
  tip.id = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  function show(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    var r = tip.getBoundingClientRect();
    var left = x + 14, top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 12;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 12;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  }
  function hide() { tip.hidden = true; }

  window.addEventListener('scroll', function () { hide(); pieReset(); }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest('.chart') && !e.target.closest('.pie-wrap')) {
      hide();
      pieReset();
    }
  });

  /* ---------- barras ---------- */

  document.querySelectorAll('.chart .bar').forEach(function (bar) {
    var html = barTip(bar);
    if (!html) return;
    bar.addEventListener('pointerenter', function (e) { show(html, e.clientX, e.clientY); });
    bar.addEventListener('pointermove', function (e) { show(html, e.clientX, e.clientY); });
    bar.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'touch') hide();
    });
  });

  function barTip(bar) {
    var name = bar.querySelector('.bar-name');
    if (!name) return '';
    var title = name.firstChild.textContent.trim();
    var sub = name.querySelector('i');
    var val = bar.querySelector('.bar-val');
    var b = bar.querySelector('.bar-fill b');
    var info = '';
    if (val) {
      info = val.textContent.trim();
      if (b && info.indexOf(b.textContent.trim())) info = b.textContent.trim() + ' · ' + info;
    } else if (b) {
      info = b.textContent.trim();
      var ch = bar.closest('.chart');
      var unit = ch ? ch.getAttribute('data-unit') : '';
      var total = ch ? +ch.getAttribute('data-total') : 0;
      if (total) {
        var pct = Math.round(parseFloat(info.replace(',', '.')) / total * 1000) / 10;
        info += ' de ' + total + (unit ? ' ' + unit : '') + ' · ' + ('' + pct).replace('.', ',') + '%';
      } else if (unit) {
        info += ' ' + unit;
      }
    }
    if (bar.closest('#chartEscuelas') && bar.classList.contains('fuera')) {
      info += (info ? ' · ' : '') + 'fuera del distrito SCZ-1';
    }
    if (!info && !sub) return '';
    return '<b>' + title + '</b><br>' + (sub ? '<i>' + sub.textContent.trim() + '</i><br>' : '') + info;
  }

  /* ---------- torta ---------- */

  // una tajada por nivel de participación: el ancho son las
  // inscripciones que llevaba un alumno (×1 la más fina, ×8 la más
  // gorda) y la etiqueta cuenta cuántos estudiantes hay en cada una
  var GRUPOS = [
    { insc: 1, col: '#2a2a2a', lbl: '58 alumnos',
      centro: ['1', 'inscripción', '58 alumnos'],
      tip: '<b>58 alumnos</b><br>1 inscripción cada uno · 58 de las 99 · 150 Bs c/u en seguidor' },
    { insc: 2, col: '#a89f86', lbl: '9 alumnos',
      centro: ['2', 'inscripciones', '9 alumnos'],
      tip: '<b>9 alumnos</b><br>2 inscripciones cada uno · 18 de las 99 · ≈ 300 Bs' },
    { insc: 3, col: '#8a7a3d', lbl: '3 alumnos',
      centro: ['3', 'inscripciones', '3 alumnos'],
      tip: '<b>3 alumnos</b><br>3 inscripciones cada uno · 9 de las 99 · ≈ 450 Bs' },
    { insc: 6, col: '#b78f00', lbl: '1 alumno',
      centro: ['6', 'inscripciones', 'Un alumno'],
      tip: '<b>Un alumno del colegio sede</b><br>6 inscripciones · 3 sumo + 3 seguidor · ≈ 900 Bs' },
    { insc: 8, col: '#f4c91f', lbl: '1 alumno',
      centro: ['8', 'inscripciones', 'Un alumno'],
      tip: '<b>Otro alumno del colegio sede</b><br>8 inscripciones · 3 sumo + 3 seguidor + 2 insectos · ≈ 1.200 Bs' }
  ];

  var pie = document.querySelector('.pie-insc');
  var svg = null, cBig, cSmall, cTiny;
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // anillo: r0 interior, r1 exterior; a en grados desde las 12 en punto
  function wedge(a0, a1, r0, r1) {
    var P = function (a, r) {
      var t = (a - 90) * Math.PI / 180;
      return (120 + r * Math.cos(t)).toFixed(2) + ' ' + (120 + r * Math.sin(t)).toFixed(2);
    };
    var large = a1 - a0 > 180 ? 1 : 0;
    return 'M' + P(a0, r1) + ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + P(a1, r1) +
           ' L' + P(a1, r0) + ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + P(a0, r0) + 'Z';
  }

  function pick(paths, txt) {
    svg.querySelectorAll('path.on').forEach(function (p) {
      p.classList.remove('on');
      p.style.transform = '';
    });
    svg.classList.add('sel');
    paths.forEach(function (p) {
      p.classList.add('on');
      var a = (+p.dataset.mid - 90) * Math.PI / 180;
      p.style.transform = 'translate(' + (Math.cos(a) * 5).toFixed(1) + 'px,' + (Math.sin(a) * 5).toFixed(1) + 'px)';
    });
    cBig.textContent = txt[0];
    cSmall.textContent = txt[1];
    cTiny.textContent = txt[2] || '';
    document.querySelectorAll('.pie-leyenda li.on').forEach(function (l) { l.classList.remove('on'); });
    var li = document.querySelector('.pie-leyenda li[data-g="' + paths[0].dataset.g + '"]');
    if (li) li.classList.add('on');
  }

  function pieReset() {
    if (!svg) return;
    svg.classList.remove('sel');
    svg.querySelectorAll('path.on').forEach(function (p) {
      p.classList.remove('on');
      p.style.transform = '';
    });
    document.querySelectorAll('.pie-leyenda li.on').forEach(function (l) { l.classList.remove('on'); });
    cBig.textContent = '99';
    cSmall.textContent = 'inscripciones';
    cTiny.textContent = '72 alumnos';
  }

  if (pie) {
    svg = el('svg', { viewBox: '-10 -10 260 260', 'class': 'pie-svg', 'aria-hidden': 'true' });
    var ang = 0;
    GRUPOS.forEach(function (g, gi) {
      var span = g.insc * 18;   // 360° repartidos en 1+2+3+6+8 = 20 unidades
      var p = el('path', { d: wedge(ang, ang + span, 50, 96), fill: g.col }, svg);
      p.dataset.g = gi;
      p.dataset.mid = ang + span / 2;
      var t = (p.dataset.mid - 90) * Math.PI / 180;
      var lbl = el('text', { x: 120 + 105 * Math.cos(t), y: 120 + 105 * Math.sin(t), dy: '.35em', 'class': 'pie-lbl' }, svg);
      lbl.textContent = g.lbl;
      ang += span;
    });
    cBig = el('text', { x: 120, y: 114, 'class': 'pie-big' }, svg);
    cSmall = el('text', { x: 120, y: 136, 'class': 'pie-small' }, svg);
    cTiny = el('text', { x: 120, y: 152, 'class': 'pie-tiny' }, svg);
    pie.style.background = 'none';
    pie.appendChild(svg);
    pieReset();

    svg.addEventListener('pointerover', function (e) {
      if (e.target.tagName !== 'path') return;
      var g = GRUPOS[+e.target.dataset.g];
      pick([e.target], g.centro);
      show(g.tip, e.clientX, e.clientY);
    });
    svg.addEventListener('pointermove', function (e) {
      if (e.target.tagName === 'path' && !tip.hidden) show(tip.innerHTML, e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      pieReset();
      hide();
    });

    document.querySelectorAll('.pie-leyenda li[data-g]').forEach(function (li) {
      li.addEventListener('pointerenter', function () {
        pick(svg.querySelectorAll('path[data-g="' + li.dataset.g + '"]'), GRUPOS[+li.dataset.g].centro);
      });
      li.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'touch') pieReset();
      });
    });
  }
})();
