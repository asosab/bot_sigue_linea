# Bot sigue-línea — Arduino

Robot con Arduino que sigue una línea. El proyecto se desarrolla con Devin:
firmware, documentación en un vault Obsidian y manuales exportados a PDF.

## Layout

| Path | Purpose |
|------|---------|
| `firmware/` | Sketches de Arduino (`.ino`, un sketch por carpeta) |
| `docs/` | Vault Obsidian — conocimiento del proyecto (`docs/index.md` es el MOC) |
| `docs/templates/` | Plantillas de notas (session-log, componente, decisión) |
| `docs/log/` | Session log diario |
| `.devin/` | Config de Devin: `mcp_config.json`, `config.json`, `skills/` |

## Environment notes

- The agent shell is **Git Bash (MSYS2/MINGW64)** — paths `/d/proyectos/...`.
- File tools and spawned MCP servers use **Windows paths**: `D:\proyectos\...`.
- `node`/`npm` are Windows binaries on PATH (Node v24).
- Devin CLI (no está en PATH):
  `C:\Users\asosa\AppData\Local\Programs\Devin\resources\app\extensions\windsurf\devin\bin\devin.exe`
- Remote git: `origin` → `github.com/asosab/bot_sigue_linea` (público,
  rama `master`). `gh` autenticado como `asosab`; commit + push al cerrar
  cada trabajo.

## MCP servers

Configurados a nivel de proyecto en `.devin/mcp_config.json`:

- `arduino` — `npx -y arduino-mcp-server`: detecta placas, compila, sube y
  monitoriza el puerto serie envolviendo `arduino-cli`
  (`C:\Program Files\Arduino CLI\arduino-cli.exe`, instalado con winget
  `ArduinoSA.CLI`; core `arduino:avr` preinstalado). El Arduino IDE 2.3.10
  está en `C:\Users\asosa\AppData\Local\Programs\arduino-ide\` (lleva su
  propio cli interno; comparten cores/librerías vía
  `%LOCALAPPDATA%\Arduino15`). Los sketches viven en
  `ARDUINO_SKETCH_ROOT=firmware/`. **Subir firmware a la placa pide
  confirmación del usuario** (`upload_sketch`, `upload_and_wait_ready` en
  `ask`): la placa es hardware real.
- `pdf-it` — `npx -y pdf-it-mcp`: markdown → PDF diseñado (portada, TOC,
  footer). Herramientas `generate_pdf` y `list_templates`. Es la vía para
  toda documentación entregable en PDF — no usar Chrome headless, pandoc ni
  LaTeX.
- `context7` — documentación al día de librerías (Arduino cores,
  QTRSensors, AFMotor, PID, etc.).
- `playwright` y `shadcn` — verificación visual del sitio web del proyecto
  y catálogo de componentes UI. `rea` existe a nivel usuario.

## Plugins instalados (nivel usuario)

`devin plugins install` exige `devin.exe auth login` (pendiente). Mientras
tanto están cableados a mano con el mismo resultado: clones en
`D:\tools\devin-plugins\`, skills enlazados (junctions) en
`%APPDATA%\devin\skills\` y el MCP de context-mode en
`%APPDATA%\devin\mcp_config.json`. Tras hacer login, instalarlos bien con:

```
devin plugins install DietrichGebert/ponytail
devin plugins install mksglu/context-mode
```

- `ponytail` — modo "senior dev vago": el cambio mínimo que resuelve.
  Skills `/ponytail`, `/ponytail-review`, `/ponytail-audit`,
  `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.
- `context-mode` — sandbox de salida de tools y memoria de sesión (FTS5)
  para ahorrar contexto. MCP `context-mode` + skills `/context-mode`,
  `/ctx-stats`, `/ctx-doctor`, `/ctx-index`, `/ctx-search`,
  `/ctx-upgrade`, `/ctx-purge`, `/ctx-insight`.

## Documentation vault (Obsidian)

`docs/` es un **vault Obsidian** — la raíz del repo se abre directamente en
Obsidian (`.obsidian/` commiteado; el estado personal, gitignored).

- `docs/index.md` es el **MOC** — empezar ahí y seguir `[[wikilinks]]`.
- Conocimiento nuevo en **notas atómicas** con frontmatter YAML (`type`,
  `status`, `created`); plantillas en `docs/templates/`.
- Las notas de componente llevan `status` (`por-verificar`/`verificado`)
  y enlazan al sketch y a `[[componentes]]`.
- **Session log**: al cerrar una sesión de trabajo, crear/actualizar
  `docs/log/YYYY-MM-DD.md` — qué se hizo, qué se decidió, mediciones,
  pendientes y commits.
- Mantener `docs/index.md` al día al añadir áreas nuevas.

## Rules

- **Idioma: español** — respuestas al usuario, docs y session logs se
  redactan en español.
- **Todo texto generado por IA pasa por `humanamente`** — absolutamente
  todo texto para superficies legibles (docs del vault, markdown que luego
  se exporta a PDF con pdf-it, README, comentarios extensos) pasa por el
  skill `humanamente` (`.devin/skills/humanamente/`), sin excepciones. En
  documentación técnica usar el perfil de voz «técnico»: preciso, neutro,
  sin adornos.
- **Documentación en PDF vía pdf-it** — los entregables se escriben en
  markdown (en `docs/`), se humanizan y se exportan con
  `mcp__pdf-it__generate_pdf`.
- **Hardware real pide confirmación** — compilar y listar placas es libre;
  `upload_sketch` y escrituras al puerto serie se confirman con el usuario
  antes de ejecutarse.
- **Commit al cerrar cada trabajo** — ninguna tarea queda con cambios
  pendientes: cada trabajo concluye con su commit. Revisar `git status` al
  final de cada sesión.
