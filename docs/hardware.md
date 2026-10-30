---
type: hardware
status: montado
created: 2026-10-28
---
# Hardware de Arturito

Configuración registrada desde `firmware/arturito/arturito.ino`.

| Parte | Cantidad | Conexión | Nota |
|---|---|---|---|
| [[componente-arduino-uno|Arduino UNO]] | 1 | — | placa del robot |
| [[componente-tcrt5000|TCRT5000]] | 5 | A0–A4 | lectura analógica, línea IR |
| [[componente-drv8833|DRV8833]] | 1 | D5, D6, D9, D10 | driver dual de motores |
| [[componente-hc02-48|Motor HC02-48]] | 2 | salidas del DRV8833 | reductora 1:48 |
| Pulsador de largada | 1 | D8 | botón momentáneo a GND, pull-up interno, ver [[esquema]] |
| Rueda loca (bola) | 1 | chasis | apoyo trasero, ver `imagen/bola_trasera.jpg` |

## Medidas del chasis (2026-10-29)

- Ancho de vía `w` = **131 mm** (centro a centro de rueda): 156 mm entre
  bordes exteriores menos 2 × 25 mm de ancho de rueda.
- Sensores: arreglo en flecha con S2 a 47 mm del eje, ver
  [[componente-tcrt5000]] para la tabla de coordenadas.

## Mapa de pines

| Pin | Uso |
|---|---|
| A0 | sensor extremo izquierdo (S0) |
| A1 | sensor centro izquierdo (S1) |
| A2 | sensor centro (S2) |
| A3 | sensor centro derecho (S3) |
| A4 | sensor extremo derecho (S4) |
| D2 | ULT — nFAULT del driver (opcional) |
| D4 | EEP — nSLEEP del driver (HIGH = habilitado) |
| D5 | IN1 — motor izquierdo adelante |
| D6 | IN2 — motor izquierdo atrás |
| D8 | pulsador de largada |
| D9 | IN3 — motor derecho adelante |
| D10 | IN4 — motor derecho atrás |

Detalle de cableado en [[esquema]]. Lógica de control en [[algoritmo]].
Precios de lo comprado en [[precios]].
