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

El módulo montado es la variante **MJKDZ**: cabecera de entradas
`IN4, IN3, GND, VCC, IN2, IN1` y de salidas `EEP, OUT1..OUT4, ULT`, con el
jumper de soldadura J2 sin puentear.

## Pines y cableado

| Pin del driver | Pin del Arduino | Función |
|---|---|---|
| IN1 | D5 | motor izquierdo adelante (PWM) |
| IN2 | D6 | motor izquierdo atrás (PWM) |
| IN3 | D9 | motor derecho adelante (PWM) |
| IN4 | D10 | motor derecho atrás (PWM) |
| EEP | D4 | nSLEEP: HIGH despierta el chip |
| ULT | D2 | nFAULT (opcional, se lee con `INPUT_PULLUP`) |

Patrón de uso en el código: `analogWrite` en el pin de dirección activa y
`digitalWrite LOW` en la opuesta.

## El pin de sleep (falla encontrada el 2026-10-28)

`EEP` es el nSLEEP del chip. Si queda flotando (sin cable ni J2 soldado) el
driver duerme: el LED del módulo enciende igual, las entradas llegan, pero
las salidas nunca conducen. Fue la causa de que el bot no se moviera.

Solución aplicada: cable D4→EEP y `digitalWrite(SLEEP_DRV, HIGH)` al inicio
de `setup()` en `arturito.ino`. Alternativa permanente: soldar el jumper J2
y quitar el cable.

## Diagnóstico

`firmware/prueba_drv8833/` barre IN1–IN4 un pin a la vez (3 s por paso,
narrado por serie a 9600), prueba ambos motores juntos y una rampa PWM.
Comandos por serie: `s` duerme/despierta el driver en vivo, `r` reinicia.
Con ULT cableado a D2 avisa si el chip reporta falla (LOW = falla por
corriente o temperatura).

## Relacionado

- [[componentes]] · [[hardware]] · [[esquema]]
