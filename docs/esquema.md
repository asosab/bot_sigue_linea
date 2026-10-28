---
type: esquema
status: registrado
created: 2026-10-28
---
# Esquema de cableado

Extraído de `firmware/arturito/arturito.ino` y verificado sobre el montaje
físico el 2026-10-28. Falta documentar la alimentación (VCC de sensores,
VMOT del driver, masa común).

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
| EEP (nSLEEP, HIGH = despierto) | D4 |
| ULT (nFAULT, opcional) | D2 |

## DRV8833 → motores

- OUT1/OUT2 → [[componente-hc02-48|motor izquierdo]]
- OUT3/OUT4 → motor derecho

Motor izquierdo: los cables llegaron invertidos y se corrigieron en el
conector (2026-10-28). Si un motor rueda al revés, se intercambian sus dos
cables en OUT o sus dos entradas IN; da igual por dónde.

## Relacionado

- [[hardware]] · [[componentes]]
