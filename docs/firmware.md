---
type: firmware
status: compilado
created: 2026-10-28
---
# Firmware

Sketch actual: `firmware/arturito_v3/arturito_v3.ino` — el que corre el
robot. `firmware/arturito_v2/` (control continuo, v2) y
`firmware/arturito/` (v1, tabla de casos) quedan como respaldo.

- Placa: `arduino:avr:uno`
- Tamaño: 7416 B flash (22 %), 498 B RAM (24 %)
- `setup`: pines, despierta el DRV8833 (`SLEEP_DRV` = D4 en HIGH, ver
  [[componente-drv8833]]) y Serial a 9600 baudios. Sin prueba de motores
  ni ventana de calibración: encendido en la mano espera quieto y larga
  con el pulsador de D8 una vez apoyado sobre la línea ([[esquema]])
- `loop`: compuerta de arranque → cruce comprometido → curva
  comprometida → PD con zona muerta sobre posición en mm → búsqueda por
  fases. La estrategia completa está en [[algoritmo]]
- Calibración adaptativa en marcha con siembra al apoyarlo: [[calibracion]]
- Diagnóstico del driver: `firmware/prueba_drv8833/` — barrido de pines
  con toggle de sleep por serie
- Diagnóstico de sensores: `firmware/prueba_sensores/` — solo lectura,
  driver dormido por EEP en LOW
- Calibración de velocidad: `firmware/calibra_velocidad/` — tramo de 3 s
  a velocidad constante por pulsada (recta o pivote), marca con el LED;
  sirve `MM_S_A_CRUCE` y `PIVOTE_MS`, ver [[calibracion]]
- `#define DEBUG 1` imprime `posF`, `base` y `corr` cada 100 ms por
  serie, para afinar en la pista

## Parámetros en código

| Constante | Valor |
|---|---|
| VEL_MAX / VEL_MIN | 200 / 80 |
| KP / KD / KS | 6.0 / 10.0 / 5.0 |
| ALPHA / DB_MM / RUEDA_MIN | 0.55 / 6 / 40 |
| N_ON / N_OFF | 0.6 / 0.4 |
| VEL_CRUCE / AVANCE_CRUCE_MM | 140 / 30 mm |
| MM_S_A_CRUCE | 264 mm/s (medida) |
| VEL_CURVA_EXT / INT | 150 / 0 |
| VEL_ARCO_EXT / INT | 140 / 40 |
| VEL_BUSQUEDA / PIVOTE_MS | 110 / 280 ms |
| ASIENTO_MS / VEL_ASIENTO | 250 / 120 |
| TRIM_IZQ / TRIM_DER | 1.0 / 0.93 |

Compilar y subir: [[toolchain]]. La subida a la placa siempre pide
confirmación.
