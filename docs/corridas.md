---
type: archivo
status: activo
created: 2026-10-30
---
# Archivo de corridas

Historial de pruebas en pista. Desde el 2026-10-30 la EEPROM del UNO ya
no acumula la tabla: guarda solo la traza de la última corrida (eventos
con los 5 canales, posF, comandos y decisiones), que se archiva acá al
leerla por serie antes de que el próximo test la pise.

Contadores: `pérdidas` = entradas a la búsqueda (incluye reentradas del
mismo episodio), `esquinas` = curvas comprometidas disparadas, `cruces`
= todo-negro resuelto como cruce. Recorrido de la pista en [[pista]].

| # | Tiempo | Pérdidas | Esquinas | Cruces | Nota |
|---|--------|----------|----------|--------|------|
| 1 | 6,14 s | 11 | 1 | 0 | primera en pista de práctica |
| 2 | 4,08 s | 10 | 1 | 0 | |
| 3 | 2,90 s | 8 | 1 | 0 | |
| 4 | 28,50 s | 9 | 19 | 0 | la más larga; 19 curvas comprometidas, ¿reales o detector gatilloso? |
| 5 | 10,75 s | 117 | 4 | 0 | reinicio de fase 0 en la búsqueda → pivote sin tope, rueda fuera de la pista. Fix: pausa/retoma |
| 6 | 6,11 s | 5 | 0 | 0 | pasó de largo la horquilla de 180° sin registrarla (ventana extremo-solo inexistente). Fix: disparo por posF |
| 7 | 3,59 s | 5 | 0 | 0 | perdió la línea a ~100 ms de la largada; buscó a la izq. con la línea a la der. todo el episodio. Fixes: reset de `ultimoLado` en largada + retoma con lado fresco |

Las trazas detalladas de cada corrida se pegan en la entrada del día en
`docs/log/` cuando se leen.
