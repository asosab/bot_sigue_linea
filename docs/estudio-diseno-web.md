---
type: estudio
status: vigente
created: 2026-10-29
---
# Estudio de diseño del sitio web

Auditoría de `web/` hecha con los skills de diseño instalados el
2026-10-29. Método: la puerta de `design-taste-frontend`
(`lint.mjs` sobre las fuentes, `inspect.mjs` en Chromium real a 1440 /
768 / 390, screenshots en `.taste-skill/before/`), la crítica de 14
pasadas de `references/critique.md`, y los chequeos de
`redesign-existing-projects`, `emil-design-eng`,
`find-animation-opportunities`, `mobile-native` y `break-ui`. El plan de
trabajo sale en [[plan-mejoras-web]].

## Lo que ya está bien

- **La idea aguanta la prueba del competidor**: la página es la pista.
  Una cinta negra real (cadena Verlet) cruza el sitio y el carrito la
  sigue; se puede agarrar y deformar. Ningún otro sitio de equipo
  escolar hace esto. Es el activo principal y hay que protegerlo, no
  recargarlo.
- **El live thing es doble**: la cinta arrastrable en la página y el
  probador (`#lab`) que corre el algoritmo del firmware sobre un
  circuito de práctica. Contenido real del proyecto, funciona con el
  pulgar, no bloquea la lectura.
- **El texto es específico**: la sección «Cuando no quiso andar» cuenta
  fallos reales con nombres de pines y valores; nada de relleno.
- **Fotos propias**: 10 imágenes reales del proyecto (3 retratos, 7 de
  construcción, 1 diagrama). Pasa el piso de cuatro con holgura.
- Menú compacto con hamburguesa que muta a X, foco visible en la
  galería, visor con teclado/swipe y `aria-pressed`, `scroll-margin`
  correcto en las anclas.

## Mediciones de la puerta

`lint.mjs` → 10 FAIL, 4 WARN. `inspect.mjs` → 2 FAIL, 4 WARN.

| Hallazgo | Dato | Lectura |
|---|---|---|
| covered-text (FAIL) | «Arturito», «El equipo», «El robot», «Cuando no quiso andar» quedan 100 % tapados por la cinta en algún scroll, a los tres anchos | La cinta (z-10) pinta sobre el contenido (z-1). Es la firma del sitio, pero tapar titulares es la regla más dura del estudio de 247 sitios |
| still-page (FAIL) | 0 elementos en movimiento durante carga y scroll | Sin capa de movimiento: ni entradas, ni feedback en controles, ni imagen en movimiento |
| emoji (FAIL, lint) | `Cerrar ✕` y `⏮ ▶ ⏭` en el visor | Texto solo o SVG |
| shadow (FAIL, lint) | drop-shadow del sprite (3), sombra del menú desplegable, `.hero-bot` (clase muerta) | El sprite es un objeto físico, se defiende; el menú desplegable sí flota; `.hero-bot` no se usa |
| hairline (FAIL) | `border-bottom` del menú, del desplegable y `border-top` del lab | Separar con tono, no con línea |
| card-rows (WARN) | Dos filas de tarjetas idénticas (equipo, premios) | Misma composición dos veces |
| no-footage (WARN) | Sin video | El mejor clip posible es real: Arturito corriendo la pista de prueba |
| first-action (WARN @390) | Ningún botón visible en la primera pantalla del teléfono | «Testear código» queda dentro del menú hamburguesa |
| glass / outlined-box (WARN) | `backdrop-filter` del menú; bordes 1px en hamburguesa, pills y visor | Una barra pegajosa con blur se admite; los 1px van a relleno |

## Crítica por las 14 pasadas (ronda 1)

- **Un segundo / cinco**: el ojo va al lazo de la cinta y al sprite;
  «Arturito» se entiende rápido. Falta una acción visible en el primer
  cuadro.
- **Squint**: dos masas claras (lazo + columna de texto). Bien.
- **Tapa el logo**: no pasa por otro sitio. La cinta lo hace propio.
- **Bordes**: un solo borde izquierdo, disciplinado.
- **Marco**: columna de 720 px centrada a 1440 px; el campo vacío lo
  ocupa la cinta, así que no lee como hueco muerto. Defendible.
- **Tipo**: 9 tamaños en uso (13–51 px), techo cinco. H1/cuerpo = 3.2,
  bajo la mediana 4.3 de los sitios top; los h2 a 26 px no separan del
  cuerpo. Fuente única Segoe UI: correcta pero anónima.
- **Color**: acento `#f4c91f` en subrayados de h2, bordes de fotos,
  pills y tarjetas de premio — aparece en diez sitios y no significa
  nada. El azul `#0f7fae` de los enlaces compite como segundo acento.
- **Imágenes**: suficientes y propias; los tres retratos tienen tres
  luces distintas (amarillenta, fondo celeste, interior). Falta un clip
  en movimiento.
- **Sameness**: `card grid` aparece dos veces (equipo, premios).
- **Teléfono**: composición propia y legible; la hamburguesa esconde la
  única acción.
- **Fullness**: «Cuando no quiso andar» son ~5 pantallas de corrido;
  denso pero real, no es hueco.
- **Sustancia**: cada sección entrega su información completa.
- **Colisiones**: la cinta tapa titulares (el FAIL medido).
- **Live thing**: existe y es fuerte.

## Puntaje de jurado

Diseño 5.5 · Usabilidad 6.5 · Creatividad 8 · Contenido 8 → **6.55**,
tope **6.0** por `covered-text` (y diseño ≤7 por `still-page`).

Caps que aplican hoy: covered-text (global 6.0), still-page (diseño
≤7), first-action (usabilidad ≤7). La creatividad y el contenido ya
puntúan alto: el trabajo de mejora es casi todo de superficie.

## Conclusión

El sitio tiene lo más difícil —idea propia, live thing real y texto
honesto— y le falla lo más barato: jerarquía tipográfica, disciplina de
acento, una acción en la primera pantalla, la capa de movimiento y la
colisión cinta-titulares. Nada pide cambiar de stack ni reescribir:
son pasadas de CSS y detalles de HTML, verificables con la misma
puerta. Orden y detalle en [[plan-mejoras-web]].
