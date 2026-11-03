---
name: corrida-analisis
version: 0.1.0
description: |
  Analizar una corrida del bot sigue-línea juntando la traza EEPROM
  (serie, comando 't') con el video de la prueba: frames extraídos con
  ffmpeg sincronizados a los tiempos de la traza (+T desde largada).
  Cubre la lectura EEPROM con reintentos autónomos (reabre sesión y
  reenvía 't' solo, sin pedir nada al usuario), la resolución de ffmpeg,
  el mapeo tiempo-de-traza ↔ tiempo-de-video y el archivo de resultados
  en docs/. Usar cuando pidan "analizar la corrida", "revisar eeprom y
  video", "qué pasó en la prueba", "identificar el error" o similar.
compatibility: devin
---

# Análisis de corrida: EEPROM + video sincronizados

Flujo completo para revisar una prueba del robot. Los datos básicos de
serie están en el skill `arduino-serie`; acá va el procedimiento
operativo, con la parte que antes fallaba: sesiones que expiran y
frames de video que no corresponden a los tiempos de la traza.

## 1. Lectura EEPROM autónoma (sin interrumpir al usuario)

**El envío de `t` está autorizado de forma permanente** (decisión del
usuario, 2026-10-30): no pedir confirmación para ese byte. Otros
comandos o escrituras sí se confirman siempre.

Procedimiento (repite el bloque 2-4 hasta tener la traza completa,
máximo 3 intentos):

1. `serial_open_session` — `port: "COM5"`, `baudRate: 9600`,
   `ttlMs: 180000`. Abrir resetea la placa por DTR: esperar ~1,5 s al
   banner (`===== ARTURITO ...`).
2. `serial_write` — `data: "t"`.
3. Esperar ~5 s (64 líneas a 9600 baudios tardan en salir).
4. `serial_read`. Verificar:
   - `SESSION_NOT_FOUND` → la sesión expiró: reabrir (paso 1) y
     reenviar `t`. No avisar al usuario, hacerlo directo.
   - Solo banner o traza cortada → la placa aún imprime: esperar
     3-4 s más y `serial_read` de nuevo (la lectura es incremental).
   - `totalBytesReceived: 0` → el conversor no reseteó al abrir:
     reabrir; si sigue en 0, pedir al usuario que apriete reset con
     la sesión abierta.
5. `serial_close_session` al terminar (o dejar que venza el TTL).

La traza es válida cuando termina en `stop` o `DETENIDO`. El resumen
(`Ultima corrida: T s | perdidas ... cruces ... | pista ...`) encabeza
el análisis.

## 2. ffmpeg

Resolver en este orden:

1. `ffmpeg`/`ffprobe` en PATH (no está hoy).
2. **`D:\tools\ffmpeg-static\node_modules\ffmpeg-static\ffmpeg.exe`**
   — instalación fija del proyecto (ffmpeg 6.1.1). En Git Bash:
   `/d/tools/ffmpeg-static/node_modules/ffmpeg-static/ffmpeg.exe`.
3. Si falta: `cd /d/tools/ffmpeg-static && npm init -y && npm i
   ffmpeg-static`. El binario llega aunque npm avise
   "install scripts not covered by allowScripts" (viene en el
   paquete por plataforma).

No instalar `ffmpeg-static` dentro del repo: ensucia `git status`.

## 3. Sincronizar video con la traza

El `+T` de la traza cuenta desde `largada` (el evento T_LARGADA, que
puede estar fuera del anillo si la corrida fue larga — usar +0 como
referencia igual). El video tiene su propio origen: hay que medir el
desplazamiento una sola vez.

### 3.1 Datos del video

```
ffmpeg -i VIDEO.mp4        # Duration y fps salen en stderr
ffmpeg -vf "fps=2,scale=216:384,tile=7x7" -frames:v 1 montaje.png
```

El montaje muestra toda la corrida de un vistazo: ubicar la largada
(mano que se retira / robot que arranca) y los puntos de fallo.

### 3.2 Medir el offset

- `T0v` = instante de video donde el robot empieza a moverse (primer
  frame con dedo fuera / robot en marcha). Verificar con frames
  individuales a 0,5 s alrededor de ese punto.
- `T1v` = instante donde el robot se detiene (o el usuario lo para).
- Chequeo: `T1v - T0v` ≈ tiempo de la traza (cabecera `Ultima
  corrida: N s`). Si difiere >0,5 s, el `T0v` elegido está mal:
  corregir antes de seguir.

Con offset `T0v`, un evento `+T` de la traza ocurre en video `T0v + T`.

### 3.3 Frames por evento

Para cada evento relevante de la traza (curva-*, cruce, busq/pausa,
los últimos antes de stop):

```
ffmpeg -ss (T0v + T) -i VIDEO.mp4 -frames:v 1 ev_T.png
```

Juntarlos en un tile etiquetado. Dos formas de rotular:

- `drawtext` con la hora de la traza (fuente de Windows):

```
ffmpeg -ss (T0v+T) -i VIDEO.mp4 -frames:v 1 \
  -vf "scale=270:480,drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':\
text='+T s':fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6" \
  ev_T.png
```

- `xstack` para grilla comparativa (los tiles de `tile=NxM` no llevan
  etiqueta; con `xstack` se arma layout libre y se puede quemar texto
  por celda antes de apilar).

Para ventanas dinámicas (una maniobra, una caída): `-ss (T0v+T-0.5)
-t 1.5 -vf "fps=6,scale=240:427,tile=6x4"` da el segundo completo al
rededor del evento.

### 3.4 Regla de lectura de imagen

- Los tiles chicos (216-320 px de ancho) engañan: confirmar la
  posición del robot con un frame a resolución completa antes de
  afirmar dónde estaba.
- La barra de sensores (pcb oscuro) marca el frente; con eso se lee
  el sentido de avance y qué canal (S0/S4) podía estar viendo.
- `posF` clavado en ±27-29 = centroide de puntas solas (trío vacío):
  la línea estaba solo bajo S0 o S4 — tramo vecino, no la línea propia.

## 4. Correlación traza ↔ pista

- `cruces 0` con cruces en la pista = `todoNegro` no se dio; la X se
  resolvió por `ext` o pérdida (casualidad, no decisión).
- `curva-lado/ext` = una punta sola disparó el compromiso; ver en el
  frame qué brazo/segmento estaba bajo esa punta — en horquillas y X
  suele ser un tramo ajeno.
- Huecos largos entre eventos (+10.69 → +15.06) = fases de búsqueda
  pura sin asomos: en el video es el tramo donde el robot vaga en
  blanco. Ubicarlo por posición, no por tiempo fino.
- `perdidas` alto con `pausa`/`busq*` alternados cada ~0,1-0,4 s =
  enganche marginal que suelta: el robot está sobre línea en los
  frames pero la traza dice que no la sostiene.

## 5. Archivar

- Fila nueva en `docs/corridas.md` (# siguiente, tiempos, contadores,
  nota del fallo).
- Entrada en `docs/log/YYYY-MM-DD.md` con el relato (qué pasó, causa,
  fix propuesto) y la traza pegada en bloque `text`.
- Todo texto del vault pasa por el perfil técnico de `humanamente`.
- Frames/videos NO se commitean: son temporales de análisis
  (`.tmp_*` en el repo, borrar al terminar; el video original queda
  donde el usuario lo puso).
- Commit al cerrar (`git status` limpio), push a `origin master`.
