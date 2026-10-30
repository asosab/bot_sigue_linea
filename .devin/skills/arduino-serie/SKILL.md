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

# Serie del Arduino UNO (arturito_v3)

Lo que hay que saber sin investigar de nuevo cada vez.

## Datos fijos

- **Puerto**: COM5, placa `arduino:avr:uno`. Si cambia de COM, detectarlo
  con `mcp__arduino__list_connected_boards`.
- **Baud**: 9600 (`Serial.begin(9600)` en `setup()`).
- **Sketch activo**: `firmware/arturito_v3/`. Arranca quieto esperando
  el pulsador de largada; no imprime nada más hasta que se pulsa.

## Leer la tabla EEPROM de corridas

El sketch imprime la tabla **solo al arrancar**. Abrir el puerto resetea
el UNO por DTR, así que basta abrir una sesión: la tabla sale sola, sin
tocar la placa.

1. `serial_open_session` — `port: "COM5"`, `baudRate: 9600`,
   `ttlMs: 60000`. Devuelve un `sessionId`.
2. Esperar ~3 s (el boot tarda un poco).
3. `serial_read` — `sessionId`. Devuelve todo lo del boot.
4. `serial_close_session` — `sessionId`. Si da `SESSION_NOT_FOUND` es
   que el TTL venció solo y el puerto ya quedó libre; no es error grave.

**No usar `read_serial_snapshot` para esto**: el monitor de arduino-cli
a veces sale antes de capturar el arranque y devuelve vacío. El camino
fiable es la sesión.

### Formato de la tabla

```
===== ARTURITO v3 =====
Esperando: apoyar sobre la linea y pulsar largada.
Corridas guardadas: 5
  #1: 6.14 s | perdidas 11 esquinas 1 cruces 0
```

- `tiempos`: de la largada a la parada con el pulsador, en segundos.
- `perdidas`: **entradas** a la búsqueda, no pérdidas discretas — una
  misma pérdida que flapie cuenta varias (ver la corrida #5 del
  2026-10-30: 117 entradas por un reinicio de fase que hoy está
  corregido).
- `esquinas`: curvas comprometidas disparadas.
- `cruces`: todo-negro resuelto como cruce.
- Son 8 slots que rotan (`corridas % 8`); `Corridas guardadas` es el
  total acumulado, no el de slots libres.

## Escribir al puerto

- **Pide confirmación del usuario siempre** (regla del proyecto: la
  placa es hardware real). Igual que `upload_sketch`.
- `serial_write` corre un `safety_preflight`; no usar
  `unsafeSkipPreflight` salvo que el usuario lo pida en texto.

## Orden con compilar y subir

- Compilar es libre: `compile_sketch` con
  `sketchPath: "D:\\proyectos\\arduino\\bot_sigue_linea\\firmware\\arturito_v3"`,
  `fqbn: "arduino:avr:uno"`.
- Subir (`upload_sketch`, `upload_and_wait_ready`) pide confirmación
  explícita del usuario, siempre.
- Antes de subir, cerrar cualquier sesión serie abierta: tiene el lock
  del puerto. Si venció el TTL no hace falta cerrarla.
- Tras subir, la placa se resetea y vuelve a imprimir la tabla: una
  sesión nueva sirve para verificar el boot.

## Si no llega nada

- `serial_read` con 0 bytes: la placa ya había imprimido antes de abrir
  (algunos conversores no resetean al abrir). Reabrir la sesión, o pedir
  al usuario que apriete el reset de la placa con la sesión abierta.
- Puerto ocupado o sesión que no abre: `serial_list_sessions` muestra
  quién tiene el lock; cerrar la que moleste.
