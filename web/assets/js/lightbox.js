/* Visor de fotos de la galería: click en una foto la abre a pantalla
   completa, con flechas laterales, botones de anterior/siguiente, un
   pase automático que avanza cada cuatro segundos y el pie tomado del
   alt de cada imagen. Funciona con flechas de teclado, Esc, espacio y
   swipe horizontal en pantallas táctiles. */
(function () {
  var links = document.querySelectorAll('.gallery a');
  if (!links.length) return;

  var visor = document.getElementById('visor');
  var img = document.getElementById('visorImg');
  var cap = document.getElementById('visorCap');
  var btnPrev = document.getElementById('visorPrev');
  var btnNext = document.getElementById('visorNext');
  var btnAnt = document.getElementById('visorAnt');
  var btnSig = document.getElementById('visorSig');
  var btnPlay = document.getElementById('visorPlay');
  var btnCerrar = document.getElementById('visorCerrar');

  var actual = 0;
  var timer = null;
  var PASE_MS = 4000;
  var origen = null;              // enlace que abrió el visor, para devolver el foco

  function mostrar(i) {
    var n = links.length;
    actual = ((i % n) + n) % n;   // la última enlaza de vuelta con la primera
    var thumb = links[actual].querySelector('img');
    img.src = links[actual].href;
    img.alt = thumb.alt;
    cap.textContent = thumb.alt;
  }

  function paso(delta) {
    mostrar(actual + delta);
    if (timer) reiniciarPase();   // navegar a mano no corta el pase, solo lo retrasa
  }

  function abrir(i, link) {
    origen = link;
    mostrar(i);
    visor.hidden = false;
    document.body.style.overflow = 'hidden';
    btnCerrar.focus();
  }

  function cerrar() {
    pararPase();
    visor.hidden = true;
    document.body.style.overflow = '';
    if (origen) origen.focus();
  }

  function reiniciarPase() {
    clearInterval(timer);
    timer = setInterval(function () { mostrar(actual + 1); }, PASE_MS);
  }

  function alternarPase() {
    if (timer) { pararPase(); return; }
    reiniciarPase();
    btnPlay.textContent = '⏸ Pausa';
    btnPlay.setAttribute('aria-pressed', 'true');
  }

  function pararPase() {
    clearInterval(timer);
    timer = null;
    btnPlay.textContent = '▶ Pase automático';
    btnPlay.setAttribute('aria-pressed', 'false');
  }

  for (var i = 0; i < links.length; i++) {
    (function (idx, link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        abrir(idx, link);
      });
    })(i, links[i]);
  }

  btnPrev.addEventListener('click', function () { paso(-1); });
  btnNext.addEventListener('click', function () { paso(1); });
  btnAnt.addEventListener('click', function () { paso(-1); });
  btnSig.addEventListener('click', function () { paso(1); });
  btnPlay.addEventListener('click', alternarPase);
  btnCerrar.addEventListener('click', cerrar);

  // clic en el fondo oscuro cierra; en la foto o los controles, no
  visor.addEventListener('click', function (e) {
    if (e.target === visor) cerrar();
  });

  window.addEventListener('keydown', function (e) {
    if (visor.hidden) return;
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowLeft') paso(-1);
    else if (e.key === 'ArrowRight') paso(1);
    else if (e.key === ' ') { e.preventDefault(); alternarPase(); }
  });

  // swipe horizontal sobre la foto
  var swipeX = null;
  img.addEventListener('dragstart', function (e) { e.preventDefault(); });
  img.addEventListener('pointerdown', function (e) { swipeX = e.clientX; });
  img.addEventListener('pointerup', function (e) {
    if (swipeX === null) return;
    var dx = e.clientX - swipeX;
    swipeX = null;
    if (dx <= -40) paso(1);
    else if (dx >= 40) paso(-1);
  });
  img.addEventListener('pointercancel', function () { swipeX = null; });
})();
