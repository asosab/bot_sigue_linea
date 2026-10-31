---
type: ficha técnica
status: vigente
created: 2026-10-30
---

# Ficha técnica de Arturito

Documento para entregar junto al sketch
`firmware/arturito_v2_6/arturito_v2_6.ino` (vigente; v2.5 queda de
respaldo): la geometría, las
medidas en piso y las decisiones mecánicas que el código asume.
Sirve para que un revisor — persona o IA — evalúe la estrategia de
control con los datos reales y no con supuestos.

## Plataforma

- Arduino UNO + driver de motores DRV8833 (IN1–IN4 en D5/D6/D9/D10,
  EEP en D4, ULT en D2 sin usar).
- Dos motores DC con caja reductora 1:48 (HC02-48), una por rueda.
- Apoyo trasero: bola loca. Chasis liviano sobre base de cartón.
- Sensores: 5 módulos TCRT5000 en fila frontal (A0–A4, lectura
  analógica 0–1023, valor alto = oscuro).
- Largada: pulsador a GND en D8 con pull-up interno. Apretar arma,
  soltar larga; apretar en carrera detiene.
- Pista de referencia: línea negra de 20 mm sobre fondo blanco,
  con al menos una intersección en X y esquinas de 90°.

## Geometría de ruedas

- **Ancho de vía `w` = 131 mm** (centro a centro de rueda): 156 mm
  entre bordes exteriores menos 2 × 25 mm de ancho de rueda.
  **VERIFICAR: medir centro a centro con calibre** — la cuenta escrita
  da 106 mm, no 131; `w` entra en las estimaciones de giro
  (`PIVOTE_MS`, curvas).
- Tracción diferencial: cada rueda tiene su canal PWM del driver;
  girar se hace por diferencia de velocidad, no por dirección.
- Diámetro de rueda sin registrar: la velocidad se midió en piso,
  no por odometría (ver abajo).

## Geometría del arreglo de sensores

Coordenadas del centro de cada módulo (10 × 5 mm) al punto medio
del eje de las ruedas. `x` lateral (+ derecha del bot), `y` hacia
adelante:

| Sensor | Pin | x (mm) | y (mm) | Rol |
|---|---|---|---|---|
| S0 | A0 | −30 | +28 | punta trasera izquierda |
| S1 | A1 | −15 | +38 | medio izquierdo |
| S2 | A2 | 0 | +47 | punta delantera, centro |
| S3 | A3 | +15 | +38 | medio derecho |
| S4 | A4 | +30 | +28 | punta trasera derecha |

Consecuencias que el firmware usa:

- **Zona muerta real**: con la línea de 20 mm centrada solo S2 la
  ve (S1/S3 a ±15 mm quedan fuera de los ±10 mm de media línea).
  Hasta ~5-6 mm de desvío no hay señal de posición: el código la
  trata como turbo de recta (`DB_MM = 6`), no como error.
- **Posición continua hasta ±30 mm**: el paso lateral entre
  vecinos es 15 mm < 20 mm de línea, así que fuera de la zona
  muerta siempre hay al menos un canal pisando cinta. Los pesos
  del centroide son las propias coordenadas `X_MM = {−30, −15, 0,
  +15, +30}`.
- **El centroide excluye las puntas cuando el trío tiene línea**:
  con la línea bajo S1/S2/S3 las lecturas de S0/S4 no votan. Un
  brazo de la X bajo una punta arrastraba la posición a ±30 mm y
  el PD giraba hacia el brazo (corrida #25). Las puntas cuentan
  solo cuando el trío quedó vacío.
- **La punta S2 va 47 mm delante del eje**: ve la línea antes de
  que el eje la cruce — el robot corrige mirando ~2 radii de rueda
  por delante, y en el avance ciego del cruce es la primera en
  encontrar la salida.
- **Las filas traseras caben en la banda de 20 mm**: S1/S3 y
  S0/S4 (10 mm entre filas) pueden saturar todas en un cruce o en
  el cuadrado de una esquina de 90°. Por eso «todo negro» es
  ambiguo y el firmware lo discrimina con historial de posición.

## Velocidades medidas en piso

Corridas filmadas sobre cinta métrica (ver [[medicion-velocidad]]):

- PWM 140 → **~264 mm/s** de arco real.
- PWM 255 → **~340 mm/s** de arco (~95 cm proyectados en 3 s).
- En el sketch: `VEL_MAX = 200` en recta, `VEL_MIN = 80` en
  corrección fuerte, `VEL_CRUCE = 140` en el avance ciego.

## Deriva en marcha recta («tendencia de cruce»)

A potencia plena el robot **vira ~15° a la derecha de forma
constante**: ~24 cm de lateral por cada ~93 cm de avance, medido
en tres tandas con distinto balance de ruedas:

| PWM izq/der | Lateral en ~93 cm | Lectura |
|---|---|---|
| 255 / 224 | ~23 cm a la derecha | el recorte de 12 % fue excesivo |
| 255 / 238 | ~25 cm a la derecha | igual o peor |
| 255 / 255 | ~25 cm a la derecha | igual |

El viraje es **insensible al balance PWM**: no viene de ruedas
desparejas sino de algo mecánico — convergencia de rueda (toe),
bola trasera descentrada o rozamiento del chasis. La primera
tanda a PWM 140 medía derrape a la izquierda porque la pose de
salida no estaba controlada; con pose controlada el sesgo es a la
derecha y constante.

Consecuencias en el firmware:

- `TRIM_IZQ = 1.0`, `TRIM_DER = 1.02`: compensación suave y
  parcial. Valores mayores sobre-corrigen (posF queda clavado en
  +7/+9 en recta, corrida #8).
- El viraje mueve **~8 mm laterales por cada 30 mm de avance
  ciego**: afecta la salida del tramo de cruce y los giros
  comprometidos. Candidato medido a parte de las pérdidas en
  pista.
- `PIVOTE_MS` (~90° de giro a `VEL_BUSQUEDA`) sigue **sin medir**:
  el valor 280 ms es estimado.

## Decisiones de control que dependen de esta geometría

- **Escala por corrida, sin calibración persistente**: la pose de
  largada garantiza S2 sobre negro y S0/S4 sobre blanco; ese
  rango medido fija los umbrales de «hay línea» (blanco +
  rango/3), saturación (+2/3) e histéresis (+1/6). Sobrevive a
  cualquier superficie; las corridas #23-#24 fallaron por
  calibración heredada o inflada.
- **PD sobre posición en mm** con zona muerta, freno de retorno
  al converger (`FRENO_RETORNO = 0.4`) y rueda interna con piso
  40 (0 en error grande).
- **Maniobras comprometidas solo sin señal**: cruce recto al
  todo-negro con historial centrado; curva con rueda interna
  quieta → pivote cuando la línea se salió del arreglo (extremo
  solo) o el todo-negro llegó con historial corrido.
- **Búsqueda acotada en fases** (pivote ~90°, arco, contrapivote,
  contraarco) que no puede dejar al robot mirando para atrás.
- **Traza EEPROM** de 64 eventos con lecturas crudas, posF y
  comandos de rueda; se vuelca al detener y se lee por serie con
  el comando `t`.

## Lo que la ficha no mide todavía

- Giro real por ms en pivote (`PIVOTE_MS` es estimado).
- Diámetro de rueda y respuesta inercial del chasis.
- Dispersión entre módulos TCRT5000 (el firmware la absorbe con
  la escala por pose, sin caracterizarla).

## Relacionado

- [[hardware]] — lista de materiales y pines
- [[componente-tcrt5000]] — montaje del arreglo con fotos
- [[medicion-velocidad]] — tandas crudas de velocidad y deriva
- [[algoritmo]] — estrategia de control vigente
- [[corridas]] — archivo de pruebas con trazas EEPROM
- [[analisis-v2-v3]] — por qué existe la v2.5
