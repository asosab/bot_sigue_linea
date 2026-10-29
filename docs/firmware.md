---
type: firmware
status: compilado
created: 2026-10-28
---
# Firmware

Sketch actual: `firmware/arturito_v2/arturito_v2.ino` — el que corre el
robot. `firmware/arturito/arturito.ino` (v1, tabla de casos con prueba de
motores al encender) queda como respaldo histórico.

- Placa: `arduino:avr:uno`
- Tamaño: 5768 B flash (17 %), 369 B RAM (18 %)
- `setup`: pines, despierta el DRV8833 (`SLEEP_DRV` = D4 en HIGH, ver
  [[componente-drv8833]]) y Serial a 9600 baudios. Sin prueba de motores
  ni ventana de calibración: encendido en la mano espera quieto
- `loop`: compuerta de arranque → cruce comprometido → PD sobre posición
  filtrada → recuperación. La estrategia completa está en [[algoritmo]]
- Calibración adaptativa en marcha con siembra al apoyarlo: [[calibracion]]
- Diagnóstico del driver: `firmware/prueba_drv8833/` — barrido de pines
  con toggle de sleep por serie
- Diagnóstico de sensores: `firmware/prueba_sensores/` — solo lectura,
  driver dormido por EEP en LOW

## Parámetros en código

| Constante | Valor |
|---|---|
| VEL_MAX / VEL_MIN | 180 / 70 |
| KP / KD / KS | 40 / 25 / 70 |
| ALPHA | 0.4 |
| REV_MAX | 60 |
| N_ON / N_OFF | 0.6 / 0.4 |
| VEL_CRUCE / AVANCE_CRUCE_MS | 140 / 200 ms |
| GIRO_BUSQUEDA_MS | 1500 ms |
| VEL_BUSQUEDA / VEL_REBOBINADO | 130 / 90 |
| TRIM_IZQ / TRIM_DER | 1.0 / 1.0 |

Compilar y subir: [[toolchain]]. La subida a la placa siempre pide
confirmación.
