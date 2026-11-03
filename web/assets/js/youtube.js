/* Videos de YouTube: la página solo carga las miniaturas locales. Al
   hacer clic en una, se cambia por el reproductor de youtube-nocookie
   con autoplay y el cuadro se estira a todo el ancho de la grilla.
   Solo suena uno a la vez: al pedir otro, el que estaba en marcha
   vuelve a su miniatura. */
(function () {
  var botones = document.querySelectorAll('.yt');
  if (!botones.length) return;

  for (var i = 0; i < botones.length; i++) {
    botones[i]._fachada = botones[i].innerHTML;   // miniatura, play y rótulo
    botones[i].addEventListener('click', function () {
      var b = this;
      if (b.classList.contains('playing')) return;
      for (var j = 0; j < botones.length; j++) {
        var o = botones[j];
        if (o !== b && o.classList.contains('playing')) {
          o.innerHTML = o._fachada;
          o.classList.remove('playing');
        }
      }
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.id +
              '?autoplay=1&rel=0';
      f.title = b.getAttribute('aria-label');
      f.allow = 'accelerometer; autoplay; clipboard-write; ' +
                'encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      b.innerHTML = '';
      b.appendChild(f);
      b.classList.add('playing');
    });
  }
})();
