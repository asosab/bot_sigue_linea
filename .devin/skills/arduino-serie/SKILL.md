---
name: arduino-serie
version: 0.1.0
description: |
  Leer y escribir el puerto serie del Arduino UNO de este proyecto por
  el MCP `arduino`. Cubre la lectura de la tabla EEPROM de corridas
  (la imprime el sketch al arrancar), sesiones de monitor, escritura al
  puerto y el orden correcto con compilar/subir. Usar cuando pidan
  "leer la tabla", "abrir el monitor serie", "corridas EEPROM",
  "monitor serie", "ver qué dice el Arduino" o cualquier diálogo por
  serie con la placa.
compatibility: devin
---

# Serie del Arduino UNO (arturito_v2_5)

Lo que hay que saber sin investigar de nuevo cada vez.

## Datos fijos

- **Puerto**: COM5, placa `arduino:avr:uno`. Si cambia de COM, detectarlo
  con `mcp__arduino__list_connected_boards`.
- **Baud**: 9600 (`Serial.begin(9600)` en `setup()`).
- **Sketch activo**: `firmware/arturito_v2_5/` (desde 2026-10-30).
  Arranca quieto esperando el pulsador de largada; la traza NO se
  imprime al boot, se pide con el comando `t` por serie.

## Leer la traza EEPROM de la última corrida

Desde el 2026-10-30 la EEPROM entera es la traza de la **última**
corrida (ya no hay tabla de historial: se archiva en
`docs/corridas.md` al leerla). En v2.5 la traza se imprime **solo al
enviar `t` por serie** (el boot solo imprime el banner): pedir
confirmación al usuario antes de escribir al puerto.

1. `serial_open_session` — `port: "COM5"`, `baudRate: 9600`,
   `ttlMs: 120000`. Devuelve un `sessionId`. Abrir resetea el UNO por
   DTR: esperar ~1 s a que salga el banner.
2. `serial_write` — `sessionId`, `data: "t"` (pedir confirmación
   primero: es escritura al puerto).
3. Esperar ~4-5 s (la traza son hasta 64 líneas).
4. `serial_read` — `sessionId`. Devuelve banner + traza.
5. `serial_close_session` — `sessionId`. Si da `SESSION_NOT_FOUND` es
   que el TTL venció solo y el puerto ya quedó libre; no es error
   grave, pero habrá que reabrir para escribir.

**No usar `read_serial_snapshot` para esto**: el monitor de arduino-cli
a veces sale antes de capturar el arranque y devuelve vacío. El camino
fiable es la sesión.

### Formato de salida

```
===== ARTURITO v2.5 =====
Esperando: apoyar sobre la linea, apretar y soltar.
Enviar 't' para ver la traza de la ultima corrida.
Ultima corrida: 19.57 s | perdidas 30 esquinas 4 cruces 0 | pista 16-811 (vistos 0-915)
Traza (t | evento | posF | velI velD | s0..s4):
  +0.00 largada | p0 | v0 0 | 30 30 850 30 30
  +0.10 mue | p3 | v200 200 | 40 820 860 35 28
  +1.23 curva-izq/ext | p-24 | v150 0 | 760 60 40 30 30
  ...
```

- Resumen: tiempo largada→parada, `perdidas` = entradas a la búsqueda
  (incluye reentradas del mismo episodio), `esquinas` = curvas
  comprometidas, `cruces` = todo-negro resuelto como cruce,
  `pista` = blanco/negro de la pose de largada y `(vistos)` = los
  extremos de todos los canales en carrera.
- Eventos: `mue` = muestra periódica (cada 100 ms); `curva-lado/via`
  con via `ext` (extremo solo) o `negro` (todo-negro con historial
  corrido); `curva-ok`/`curva-timeout`/`curva-barrida`; `cruce`;
  `busq-`/`busq*-` (arranque nuevo / retoma de pausa); `pausa`;
  `largada`; `stop`.
- `s0..s4` son los ADC ×4 (reconstruidos, ±2 LSB). `velI velD` son los
  comandos a ruedas (±255).
- El anillo guarda los **últimos 64 eventos**: en corridas largas se
  pierde el principio, queda la cola donde pasan los problemas.

### Al leer resultados

Archivar la corrida: nueva fila en `docs/corridas.md` y la traza en la
entrada del día de `docs/log/` (o `docs/trazas/` si es larga). La
siguiente corrida pisa la EEPROM sola — no hay que borrar nada.

## Escribir al puerto

- **Pide confirmación del usuario siempre** (regla del proyecto: la
  placa es hardware real). Igual que `upload_sketch`.
- `serial_write` corre un `safety_preflight`; no usar
  `unsafeSkipPreflight` salvo que el usuario lo pida en texto.

## Orden con compilar y subir

- Compilar es libre: `compile_sketch` con
  `sketchPath: "D:\\proyectos\\arduino\\bot_sigue_linea\\firmware\\arturito_v2_5"`,
  `fqbn: "arduino:avr:uno"`.
- Subir (`upload_sketch`, `upload_and_wait_ready`) pide confirmación
  explícita del usuario, siempre.
- Antes de subir, cerrar cualquier sesión serie abierta: tiene el lock
  del puerto. Si venció el TTL no hace falta cerrarla.
- Tras subir, la placa se resetea e imprime el banner: una sesión
  nueva sirve para verificar el boot.

## Si no llega nada

- `serial_read` con 0 bytes: la placa ya había imprimido antes de abrir
  (algunos conversores no resetean al abrir). Reabrir la sesión, o pedir
  al usuario que apriete el reset de la placa con la sesión abierta.
- Puerto ocupado o sesión que no abre: `serial_list_sessions` muestra
  quién tiene el lock; cerrar la que moleste.
