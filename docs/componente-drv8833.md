---
type: componente
part: DRV8833
status: verificado
created: 2026-10-28
---
# DRV8833

## Qué es y para qué va en el bot

Driver dual puente-H. Mueve los dos [[componente-hc02-48|motores]] en los dos
sentidos con PWM.

## Pines y cableado

| Pin del driver | Pin del Arduino | Función |
|---|---|---|
| IN1 | D5 | motor izquierdo adelante (PWM) |
| IN2 | D6 | motor izquierdo atrás (PWM) |
| IN3 | D9 | motor derecho adelante (PWM) |
| IN4 | D10 | motor derecho atrás (PWM) |

Patrón de uso en el código: `analogWrite` en el pin de dirección activa y
`digitalWrite LOW` en la opuesta.

## Librería y código

- Sin librería; funciones `avanzar`/`retroceder`/`girar*`/`detener` en
  `firmware/arturito/arturito.ino`

## Relacionado

- [[componentes]] · [[hardware]]
