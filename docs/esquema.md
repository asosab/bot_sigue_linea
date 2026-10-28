---
type: esquema
status: registrado
created: 2026-10-28
---
# Esquema de cableado

Extraído de `firmware/arturito/arturito.ino`. Falta confirmar la alimentación
(VCC de sensores, VMOT del driver, masa común) sobre el montaje físico.

## Sensores → UNO

| Señal | Pin |
|---|---|
| S0 (extremo izq.) | A0 |
| S1 (centro izq.) | A1 |
| S2 (centro) | A2 |
| S3 (centro der.) | A3 |
| S4 (extremo der.) | A4 |

## UNO → DRV8833

| Señal | Pin |
|---|---|
| IN1 (motor izq. adelante) | D5 |
| IN2 (motor izq. atrás) | D6 |
| IN3 (motor der. adelante) | D9 |
| IN4 (motor der. atrás) | D10 |

## DRV8833 → motores

- OUT1/OUT2 → [[componente-hc02-48|motor izquierdo]]
- OUT3/OUT4 → motor derecho

## Relacionado

- [[hardware]] · [[componentes]]
