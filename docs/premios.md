---
type: contexto
status: por-revisar
created: 2026-10-28
---
# Premios del concurso

La organización lleva la lista en una hoja de cálculo que sigue en
movimiento:
[hoja de premios](https://docs.google.com/spreadsheets/d/1v668F8H_tW4PmcqcF7VmiRZiuO-SWr6V/edit?usp=sharing).
Última revisión: **2026-10-28**. Releerla cada tanto y actualizar esta
nota.

## Seguidor de línea

| Lugar | Premios |
|---|---|
| 1.º | Trofeo de campeón, medalla, certificado, 1 beca completa de estudio en la U.E. España B, 1 beca de cursos de robótica de Tech Home, participación en Infomatrix y Robomatrix |
| 2.º | Trofeo de subcampeón, medalla, certificado, 1 sesión de terapia psicológica (Lic. Oscar Urgazagasti) |
| 3.º | Trofeo, medalla, certificado |

Además hay una impresora 3D Ender que se sortea entre los tres ganadores
de cada categoría.

## Cómo releer la hoja

El link de Drive apunta a un `.xlsx`; se descarga directo con la URL de
exportación:

```
curl -L "https://docs.google.com/spreadsheets/d/1v668F8H_tW4PmcqcF7VmiRZiuO-SWr6V/export?format=xlsx" -o premios.xlsx
```

y se lee con `unzip -p premios.xlsx xl/sharedStrings.xml` o con Python +
openpyxl.
