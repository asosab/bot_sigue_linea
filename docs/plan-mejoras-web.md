---
type: plan
status: propuesto
created: 2026-10-29
---
# Plan de mejoras del sitio web

Ordenado por mayor efecto con menor riesgo, como manda la crítica
(jerarquía → composición → tipo → imágenes → color → detalle →
movimiento). El diagnóstico está en [[estudio-diseno-web]]. Cada ítem
lleva el skill que lo respalda y cómo se verifica.

Alcance: mismo stack (HTML + CSS + JS vanilla en `web/`), mismo
contenido, sin librerías nuevas salvo una fuente web. La cinta
arrastrable y el probador no se tocan en comportamiento.

Verificación tras cada fase:

```
node .devin/skills/design-taste-frontend/scripts/lint.mjs web/
node .devin/skills/design-taste-frontend/scripts/inspect.mjs web/index.html --out .taste-skill/after
```

y una pasada visual sobre los screenshots. Meta: 0 FAIL en ambos.

## Fase 1 — La cinta deja de tapar texto ✔ hecha (2026-10-29)

Implementado distinto a lo previsto, mejor:

- `main` z-20 sobre `#track` z-10: la cinta visible corre por debajo y
  se intuye tenue bajo las secciones translúcidas.
- El agarre se resolvió **a nivel documento**, sin elemento sobre el
  texto: `pointerdown` dentro de la banda (±20 px de la cuerda) reclama
  el gesto solo si el objetivo no es control (`a`, `button`, …) — un
  link bajo la cinta siempre gana su click. En táctil se cancela el
  `touchmove` dentro de la banda (equivale al `touch-action:none` del
  trazo anterior). Cursor `grab` al pasar el mouse por la banda.
- Una primera versión con segunda cinta invisible (`#trackHit` sobre el
  texto) falló: el inspector fuerza `pointer-events:auto` al medir y el
  trazo invisible contaba como elemento que tapa. Se descartó.
- El carrito va en `#trackTop`, un svg de 110×110 que lo sigue (no una
  capa de página completa, que también cuenta como cubierta): sigue la
  línea por encima del texto, se enciende y se arrastra igual.
- `inspect.mjs` ya no reporta `covered-text` a 1440/768/390.
  Verificado con Playwright: agarre sobre el hero, links del menú
  intactos, click real enciende el carrito.

## Fase 2 — Tipografía

- Cambiar Segoe UI por una cara con carácter, una sola familia:
  candidatas Outfit, Bricolage Grotesque o Geist (Google Fonts, un
  `<link>` con `display=swap`; pesos 400/600/700).
  `redesign-existing-projects` (font swap = mayor mejora por menor
  riesgo).
- Consolidar a cinco tamaños: display `clamp(3rem, 8vw, 5rem)` con
  tracking −0.02em para el h1; h2 ~1.9–2.1rem; lede 1.15rem; cuerpo
  16–17px (leading 1.55–1.6, medida ≤70 caracteres); un tamaño chico
  (0.85rem) para notas y pies. Fuera los intermedios sueltos.
  `design-taste-frontend` (leyes de tipo: contraste ≥3×, ≤5 tamaños).
- `text-wrap: balance` en h1–h3 y captions para cortar palabras
  huérfanas. `redesign-existing-projects`.
- Solo el hero centrado; captions de tarjetas, premios y footer van a
  la izquierda. `design-taste-frontend` (centro: un momento).

## Fase 3 — Color y acento

- Un acento: el amarillo `#f4c91f` (es el color real de las ruedas).
  Queda en el subrayado de h2 y, como mucho, un detalle más. Fuera el
  borde amarillo de fotos de equipo, tarjetas de premio y pills: las
  fotos respiran sin marco; las pills pasan a relleno `#fff6d6` sin
  borde o a texto plano.
- Enlaces: el azul `#0f7fae` pasa a tinta `#1a1a1a` con subrayado, o se
  conserva como color funcional único documentado; decidir viendo el
  render. `design-taste-frontend` (un suelo, una tinta, un acento).
- Quitar `border-bottom` del `#menu` y `border-top` del `.lab-bar`:
  separar por tono (fondo sólido `#fff` ya lo hace, sin línea).
  `lint.mjs` hairline.

## Fase 4 — Composición de secciones

- **Premios → podio real**: en vez de tres tarjetas iguales, tres
  bloques con alturas de podio (1.º más alto y ancho, 2.º y 3.º a los
  lados). Es la metáfora del deporte y rompe la fila de tarjetas
  clónicas. `design-taste-frontend` (card-rows).
- **Equipo**: misma fila pero sin marcos idénticos — fotos sin borde,
  captions a la izquierda, tamaños ligeramente distintos entre las
  tres. O una alternativa más editorial si se prefiere.
- `diagnostico` queda como texto corrido (es crónica y así funciona);
  opcionalmente una foto del cableado rompiendo la columna a media
  sección, si hay material.

## Fase 5 — Acción en la primera pantalla

- Botón real en el hero: «Probar el simulador», pill negro como
  `#openLab`, abre el lab. Aparece también dentro del primer cuadro del
  teléfono. `inspect.mjs` (first-action), `design-taste-frontend`
  (acción primaria real en el primer screen).
- En móvil, valorar una fila de enlaces con scroll horizontal en vez de
  hamburguesa, o mantener el menú y que el botón del hero cargue la
  acción. `mobile-native` + render a 390 px.

## Fase 6 — Capa de movimiento

Regla del filtro: la cinta ya es el movimiento de firma; el resto es
feedback y puentes, nada decorativo. Todo en `transform`/`opacity`,
con `prefers-reduced-motion` que conserva el contenido.

- Entrada del hero: lede y hint suben 16px + fade, una vez, ~400ms
  `ease-out`. `animate` / `references/motion.md`.
- Equipo: las tres fotos entran con escalonado 60–80ms la primera vez
  que la sección entra en viewport (IntersectionObserver, una vez).
  `find-animation-opportunities` (grupo, frecuencia rara).
- Visor y lab: aparecen con fade + `scale(.97→1)` ~250ms `ease-out`,
  salida simétrica. El visor idealmente crece desde la miniatura;
  versión simple primero. `emil-design-eng` (consistencia espacial),
  `animate`.
- Menú desplegable: de `display` a transición de
  `opacity`+`translateY(-8px→0)` 150–200ms. `emil-design-eng`
  (@starting-style o transición).
- Feedback de pulsado en todo control: `:active { transform:
  scale(.97) }` 100–160ms `ease-out`, en botones del menú, lab, visor,
  tarjetas y enlaces de galería. `find-animation-opportunities`.
- Clip en movimiento: video real de Arturito en la pista de pruebas,
  5–10 s en loop mudo con `poster`, dentro de «Así lo armamos» o el
  robot. **Depende del usuario: grabar el clip.**
  `design-taste-frontend` (no-footage, imagen en movimiento).
- Rechazado por el filtro: parallax, scroll-spy animado, subrayado que
  se dibuja en cada h2 (decoración repetida), animación al hacer hover
  en el menú más allá del cambio de fondo.

## Fase 7 — Teléfono (`mobile-native`)

- `-webkit-tap-highlight-color: transparent` global + `:active` en todo
  lo tocable (al quitar el flash hace falta el feedback propio).
- `#menu a:hover` y hovers de galería dentro de
  `@media (hover:hover) and (pointer:fine)` — el hover no queda pegado
  tras un tap.
- `viewport-fit=cover` en el meta viewport + `env(safe-area-inset-*)`
  en `#menu` (top) y en `.lab-bar`/`.visor-barra` (bottom) — la barra
  del lab y del visor no quedan bajo el indicador del iPhone.
- `user-select:none` en los botones del visor, menú y `.lab-bar` —
  long-press no selecciona el texto.
- `overscroll-behavior-y:none` en `html` — el pull-to-refresh no
  secuestra el gesto al arrastrar cosas.
- `theme-color` meta acorde a la página.
- Probar en hardware real, no solo emulación.

## Fase 8 — Limpieza y remates

- `Cerrar ✕`, `⏮`, `▶`, `⏭`: quitar los símbolos — «Anterior /
  Pase automático / Siguiente / Cerrar» a secas o SVG inline
  (las flechas ‹ › de los lados se quedan, son texto).
  `lint.mjs` (emoji).
- `.hero-bot` (clase sin uso) fuera. `redesign-existing-projects`.
- Sombras justificadas con comentario `taste-skill-ignore`: sprite del
  carrito (objeto físico) y desplegable del menú (overlay real).
- Enlaces rotos / `#` muertos: ninguno hoy; re-chequear al final.
- Metas: `og:title`, `og:description`, `og:image`
  (`bot_linea_prueba.jpg`), `theme-color`, apple-touch-icon.
  `redesign-existing-projects` (code quality).
- Skip-link «Saltar al contenido» oculto hasta el foco; estilos de
  `focus-visible` uniformes en todos los controles (hoy solo la
  galería los tiene).
- ids de anclas `t2b`/`t5b` vs menú: revisar que ningún enlace del menú
  apunte a una ancla inexistente tras los cambios.

## Fase 9 — Ronda de cierre

- `lint.mjs` e `inspect.mjs` → 0 FAIL a los tres anchos; screenshots
  `after` comparados con `before`.
- Crítica ronda 2 en el formato de `critique.md` y arreglo de los tres
  problemas principales; máximo tres rondas.
- Pasada `break-ui` ligera: nombre largo extra, una foto rota
  (`src` inválido), viewport 320px. Sin toggle de demo: el sitio es
  contenido fijo.
- Pasada Playwright: cinta arrastrable, lab abre/cierra, visor con
  teclado y swipe, menú en móvil.

## Fuera de alcance

Frameworks, Tailwind, modo oscuro, internacionalización, reescritura
del simulador. Y por decisión de diseño: la cinta sigue siendo la idea;
nada de gradientes, glass extra ni tarjetas con iconos.
