---
type: análisis
status: vigente
created: 2026-10-30
---

# Análisis v2 vs v3 y diseño de la v2.5

Estudio comparativo del firmware antes de crear `arturito_v2_5`.
La hipótesis de diseño queda acá para cotejarla con las corridas de
prueba ([[corridas]]).

## Qué hace cada versión

| Aspecto | v2 (292 líneas, ~20 constantes) | v3 (904 líneas, ~45 constantes) |
|---|---|---|
| Posición | Media ponderada con pesos {-2..+2} | Pesos en mm reales {-30..+30}, geometría medida de la flecha |
| Control | PD: `corr = KP·posF + KD·deriv`, la base baja con el error | PD con zona muerta ±6 mm, sesgo `K_SESGO·(n1−n3)`, atenuación por confianza y `FRENO_RETORNO` al converger |
| Ruedas | La interna puede ir en reversa (−60) dentro del propio PD | Piso 40 en el PD; la reversa solo existe dentro de maniobras comprometidas |
| Intersección | Todo-negro → avance recto ciego de 200 ms fijo | Todo-negro → el historial decide cruce o esquina; el avance sale cuando S2 reencuentra la línea (techo 500 ms) |
| Curva cerrada | No existe; la resuelve el PD o la recuperación | Maniobra comprometida con 3 disparadores (extremo solo, posF >16 mm, todo-negro con historial corrido) y 3 salidas (ok, barrida, timeout→búsqueda) |
| Línea perdida | Pivote 1,5 s al último lado, luego rebobina marcha atrás | Patrón acotado en 4 fases (pivote→arco→pivote contrario→arco), pausable, sin quedar a 180° |
| Memoria | Solo `ultimoLado` | Anillo de 16 posiciones + guardas temporales (post-recuperación, masa ancha, lockout entre curvas) |
| Diagnóstico | Nada | Traza EEPROM de 64 eventos con canales crudos, posF y comandos; calibración persistida |
| Largada | Click → arranca | Click → 700 ms para retirar el dedo → arranca |

## Por qué v3 acumuló tantos errores

El archivo de corridas muestra el patrón: 22 corridas y casi cada
arreglo generó el fallo siguiente. Tres causas de fondo:

1. **Las maniobras comprometidas apuestan a ciegas con evidencia
   mínima.** `entrarCurva` se dispara con 2 ciclos (~10 ms) de
   lectura y luego gira hasta 700 ms en lazo abierto. Si el disparo
   fue falso, el daño es grande (#9: ~180° de error acumulado). Con
   5 sensores y línea de 20 mm, «la línea se va» y «asoma el borde
   de un cruce» son ambiguos desde una lectura instantánea. La
   respuesta fue apilar guardias (`NEG_CENTRO_VETO`, `MASA_ANCHA`,
   `POSF_GUARDIA`, lockout): cada una tapa un contexto ya visto y
   abrió regresiones nuevas (#16: el veto de masa tapó la horquilla
   entera, 0 esquinas).

2. **El PD de base nunca quedó estable, y todo se construyó encima.**
   Las corridas #17–#21 muestran el lazo principal oscilando en
   ciclo límite (S3→S1→S3, cruzaba la cinta al recentrar). Se parchó
   con sesgo, confianza y freno de retorno. Un seguidor cuyo lazo
   proporcional oscila produce los síntomas que luego parecen
   errores de decisión y gatillan más guardias.

3. **Más grados de libertad que datos.** ~45 constantes, ~25
   variables de estado y tres disparadores superpuestos para la
   misma maniobra. Cada corrida da 10–30 s de pista: no alcanza
   para ajustar ese espacio, así que cada cambio fue un sobreajuste
   al último fallo observado. En una pista de concurso con contextos
   nuevos, el catálogo de guardias no cubre.

## Veredicto sobre el camino de v3

Las buenas piezas son ortogonales a lo que falla:

- Posición en mm + zona muerta: turbo de recta sin bamboleo.
- Traza EEPROM: permitió diagnosticar las 22 corridas.
- Búsqueda acotada sin 180°: más segura que el pivote de 1,5 s.
- Decidir cruce/esquina con el historial: ambigüedad real que solo
  la memoria resuelve.
- Largada por suelta del pulsador (nuevo en las tres versiones):
  el dedo ya está fuera cuando el robot arranca.

Lo que falló fue la estrategia: en vez de fortalecer el PD —que
corre el 95% del tiempo— v3 creció un árbol de maniobras
comprometidas con guardias, sobreajustado a la pista de práctica.

## Diseño de la v2.5

Criterio: una maniobra comprometida solo se justifica cuando el PD
ya no tiene señal para actuar.

Conserva de v3:

- Posición en mm, zona muerta y `FRENO_RETORNO` (único
  estabilizador; cortó el ciclo límite en #22).
- Traza EEPROM con el mismo formato (el histórico sigue siendo
  legible con el mismo procedimiento).
- Búsqueda por fases acotadas con pausa y retoma.
- Cruce con salida al reencontrar S2; discriminación cruce/esquina
  por historial.
- Curva comprometida solo por dos vías: extremo solo (la línea se
  salió del arreglo) y todo-negro con historial corrido (cuadrado
  de esquina). Salidas ok / barrida / timeout como en v3.
- Histéresis `enLinea`, `posF` y `deriv` reiniciados al reenganchar,
  asiento tras recuperar, trim 1.0/1.02.
- Una sola guardia de rearmado (`GUARDIA_MS` = 400 ms) tras curva,
  cruce o pausa de búsqueda. Reemplaza al lockout entre curvas y a
  la guardia post-recuperación.

Quita de v3:

- Disparo de curva por centroide (`posF > 16 mm`): si la línea está
  bajo el arreglo, corregirla es trabajo del PD. El disparo existía
  porque el PD no daba abasto; se arregla el PD, no el síntoma.
- `K_SESGO` y la atenuación por confianza: ambos nacieron de
  parchar el ciclo límite y meten oscilación propia.
- Vetos de masa ancha y la segunda guardia temporal.
- Espera de 700 ms tras el click: con largada por suelta del
  pulsador el dedo ya está fuera.

Nuevo en las tres versiones (v2, v3 y v2.5): el pulsador arma al
apretar y larga al soltar, evaluando la compuerta en ese instante.
Apretar en carrera detiene; ese mismo apretado no arma, así que
soltar no relanza.

Resultado: ~580 líneas, ~35 constantes, un solo camino a la curva
comprometida por evento y un PD responsable de todo lo que puede
medir.

## Hipótesis a verificar en pista

- Rectas: posF clavado cerca de 0 con VEL_MAX pleno y sin bamboleo
  (la zona muerta hace el turbo sola).
- Curvas medias: el PD las resuelve sin compromiso; las esquinas
  cerradas caen en curva por extremo solo o todo-negro.
- La X se cruza con un solo `cruce` y sin curvas falsas (queda el
  veto de S2 y la persistencia, sin veto de masa).
- Menos entradas a búsqueda que en las corridas #11–#22 y, cuando
  entra, retoma en la misma vuelta sin derivar fuera del tablero.

## Relacionado

- [[algoritmo]] — estrategia de control vigente
- [[flujo-arturito-v3]] — máquina de estados de v3 con sus costuras
- [[corridas]] — archivo de pruebas en pista
- [[calibracion]] — umbrales y ganancias
