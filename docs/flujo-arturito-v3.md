---
type: referencia
status: vigente
created: 2026-10-30
---

# Flujo de Arturito v3 en pista

Máquina de estados del firmware tal como corre hoy, generada desde
`firmware/arturito_v3/arturito_v3.ino` (commit `2ddf01b`). El loop
completo tarda ~5 ms; en cada pasada decide una sola cosa y manda
un solo par de comandos de motor.

```mermaid
flowchart TD
    BTN(["pulsador D8"]) --> WAIT["700 ms de espera<br/>y avance recto de largada"]
    WAIT --> SENS{{"ciclo ~5 ms<br/>leerSensores → negrura 0..1 por canal"}}

    SENS --> CRUCEQ{"¿cruce<br/>comprometido?"}
    SENS --> CURVAQ{"¿curva<br/>comprometida?"}
    SENS --> PROC["suma, pos, masa,<br/>todo-negro"]

    CRUCEQ -- "sí" --> CRS["recto a VEL_CRUCE"]
    CRS --> CRSQ{"S2 vuelve a ver cinta<br/>sin saturar los 5,<br/>o techo 500 ms"}
    CRSQ -- "no aún" --> CRS
    CRSQ -- "sale" --> SENS

    CURVAQ -- "sí" --> CVM["externa 150 · interna 0<br/>tras 250 ms: interna −110<br/>(pivote en reversa)"]
    CVM --> OUTQ{"salida, mínimo 60 ms"}
    OUTQ -- "trío interno >0,6<br/>y S2 >0,4" --> COK["curva-ok → PD"]
    OUTQ -- "cola supera al líder" --> CBA["curva-barrida → PD"]
    OUTQ -- "700 ms" --> CTO["curva-timeout<br/>→ búsqueda"]

    PROC --> NEGQ{"todo-negro:<br/>5 canales ≥ 0,7"}
    NEGQ -- "sí" --> REFQ{"posRef = histGet(12)<br/>posición ~3 cm atrás"}
    REFQ -- "> +8 mm" --> ENC["entrarCurva"]
    REFQ -- "< −8 mm" --> ENC
    REFQ -- "centrado" --> ECX["entrarCruce"]

    NEGQ -- "no" --> EXTQ{"un extremo solo ve cinta:<br/>n>0,45 · S2<0,4 · resto<0,6<br/>persiste 2 ciclos"}
    EXTQ -- "sí" --> ENC
    EXTQ -- "no" --> POSQ{"|pos| > 16 mm<br/>persiste 2 ciclos"}
    POSQ -- "sí" --> ENC
    POSQ -- "no" --> LINQ{"enLinea<br/>histéresis 0,3 / 0,15"}

    GUARD[["guardias que bloquean ext y posf:<br/>· S2 sobre cinta → veto<br/>· borrón reciente (extremo+interior, suma>2,0) → 200 ms<br/>· post-recuperación (pausa, curva, cruce) → 400 ms<br/>· lockout tras salir de curva → 300 ms"]]
    GUARD -.-> EXTQ
    GUARD -.-> POSQ

    LINQ -- "sí" --> PD["PD:<br/>base = 200 − 5·|posF| (mín 80)<br/>corr = 7·posF + 10·Δ + 40·(n1−n3)<br/>× confianza = suma/0,7<br/>rueda interna piso 40, 0 si |posF|>15"]
    LINQ -- "3 ciclos sin línea" --> FIND["arrancarBusqueda<br/>lado = prom(hist 0..2) o ultimoLado"]
    FIND --> FASES["fases cíclicas:<br/>pivote 280 ms → arco 400 ms<br/>→ pivote contrario 560 → arco 500"]
    FASES -- "línea a la vista" --> PAUSA["pausa → PD<br/>asiento 250 ms a velocidad baja"]

    COK --> SENS
    CBA --> SENS
    CTO --> FIND
    ECX --> SENS
    ENC --> CVM
    PD --> SENS
    PAUSA --> SENS
```

## Lectura del flujo

El programa tiene cuatro modos: **PD** (el normal), **curva
comprometida** (giro fijo con tres salidas), **cruce comprometido**
(recto ciego acotado) y **búsqueda** (patrón de barbijo: pivote,
arco, pivote contrario, arco). Todo compromiso se toma una sola vez
por evento y no se repite hasta probar línea.

### Qué sostiene el diseño

- El PD es la respuesta por defecto; los giros comprometidos solo se
  disparan con evidencia específica (extremo solo, centroide corrido,
  todo-negro con memoria). El resto del tiempo la corrección es
  proporcional y guiada.
- La memoria `hist` congela la posición de la línea antes de cada
  evento — es lo que distingue esquina de cruce en el todo-negro y
  el lado por el que arranca la búsqueda.
- Las guardias apilan contexto sobre los disparos: veto si la punta
  ve cinta (brazos de la X), veto si acaba de ver un borrón (extremo
  + interior a la vez), pausa post-recuperación de 400 ms y lockout
  de 300 ms entre curvas.
- La curva comprometida ya no es ciega del todo: sale por `curva-ok`
  cuando la línea vuelve al trío y por `curva-barrida` cuando la masa
  cruza al lado contrario — esa segunda salida es la que evita que un
  giro equivocado se convierta en reversa.

### Las costuras donde falla

- **Todo giro comprometido apuesta a oscuras.** `ext` y `posf` se
  disparan con dos ciclos de evidencia y no hay forma local de saber
  si un extremo solo es la línea yéndose o un borde de cinta ajena —
  las guardias acotan los casos conocidos pero un contexto nuevo
  siempre puede gatillar uno falso.
- **`posf` dispara con `suma > 0,3`.** En rescate o con masa
  marginal, una negrura de ~0,35 en un extremo ya empuja el
  centroide más allá de ±16 mm (corrida #19). La candidata pendiente
  es exigir masa mínima en el lado del disparo.
- **La búsqueda no tiene techo.** Las fases de pivote y arco se
  repiten para siempre; en un piso blanco grande el robot deriva
  hasta salir del tablero. No hay "rindiéndose" ni límite de
  desplazamiento.
- **`curva-ok` pide trío + S2.** Si la línea vuelve por el borde
  equivocado o queda flaca, la única salida es `barrida` (necesita
  masa del lado contrario) o el timeout de 700 ms — el segundo
  siempre termina en búsqueda.
- **La banda de confianza corta la corrección por la mitad con
  `suma` ≈ 0,35.** En una curva real donde la cinta se adelgaza al
  salir por un extremo, el PD responde más suave justo cuando el
  compromiso aún no disparó — puede pasarse de largo una esquina
  tímida.

### Ideas abiertas para la próxima revisión

1. **Masa mínima en el lado del disparo** para `posf` (y quizá
   `ext`): el par de canales del lado que gatilla debe superar
   ~0,5 — los asomos de 0,3-0,4 no comprometen.
2. **Centroide del trío interno durante masa ancha**: si un cruce
   desvía el PD hacia el brazo, excluir los extremos del cómputo de
   posición mientras dure la ventana de masa.
3. **Límite de deriva en búsqueda**: si ninguna fase encuentra línea
   en ~3-4 s, detener o ralentizar el patrón en vez de seguir
   barriendo.
4. **Salida adicional de curva por "línea vista al frente"**: hoy
   solo hay ok / barrida / timeout; una salida si S2 vuelve a ver
   cinta sin exigir el trío completo podría cortar giros que
   funcionaron pero no completan la confirmación.
