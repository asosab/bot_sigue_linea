/* Contador de espera: tiempo transcurrido desde que la nota de
   petición de informe llegó a la Dirección Departamental (3 nov 2026,
   9:55, por WhatsApp a la cuenta oficial). Muestra años, días y horas
   y se actualiza cada minuto. Si no hay JS el párrafo queda oculto. */
(function () {
  var parrafo = document.getElementById('espera');
  var el = document.getElementById('esperaTiempo');
  if (!parrafo || !el) return;

  var T0 = new Date('2026-11-03T09:55:00-04:00'); // Bolivia, UTC-4

  function plural(n, singular, plurales) {
    return n + ' ' + (n === 1 ? singular : plurales);
  }

  function tick() {
    var ahora = new Date();
    if (ahora < T0) return;

    var anios = ahora.getFullYear() - T0.getFullYear();
    var aniv = new Date(T0);
    aniv.setFullYear(T0.getFullYear() + anios);
    if (aniv > ahora) {
      anios--;
      aniv.setFullYear(T0.getFullYear() + anios);
    }

    var resto = ahora - aniv;
    var dias = Math.floor(resto / 864e5);
    var horas = Math.floor((resto % 864e5) / 36e5);

    el.textContent = plural(anios, 'año', 'años') + ', ' +
      plural(dias, 'día', 'días') + ' y ' +
      plural(horas, 'hora', 'horas');
    parrafo.hidden = false;
  }

  tick();
  setInterval(tick, 60000);
})();
