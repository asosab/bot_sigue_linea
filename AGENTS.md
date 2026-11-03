# Bot sigue-línea — Arduino

Robot con Arduino que sigue una línea. Este repo es **público** y solo
contiene el firmware y el sitio web. La documentación del vault
Obsidian, la evidencia del concurso y todo dato personal vive en el
repo **privado** `bot_sigue_linea-privado` (carpeta hermana
`D:\proyectos\arduino\bot_sigue_linea-privado`, mismo owner).

## Layout

| Path | Purpose |
|------|---------|
| `firmware/` | Sketches de Arduino (`.ino`, un sketch por carpeta) |
| `web/` | Sitio público (Jekyll, GitHub Pages vía Actions) |
| `tools/` | Utilidades de apoyo |
| `.devin/` | Config de Devin: `mcp_config.json`, `config.json`, `skills/` |

## Environment notes

- The agent shell is **Git Bash (MSYS2/MINGW64)** — paths `/d/proyectos/...`.
- File tools and spawned MCP servers use **Windows paths**: `D:\proyectos\...`.
- `node`/`npm` are Windows binaries on PATH (Node v24).
- Devin CLI (no está en PATH):
  `C:\Users\asosa\AppData\Local\Programs\Devin\resources\app\extensions\windsurf\devin\bin\devin.exe`
- Remote git: `origin` → `github.com/asosab/bot_sigue_linea` (público,
  rama `master`, historia reiniciada el 3 nov 2026 al separar datos
  privados). `gh` autenticado como `asosab`; commit + push al cerrar
  cada trabajo.
- El sitio se despliega con `.github/workflows/pages.yml` (push a
  `master` tocando `web/**`). URL: `asosab.github.io/bot_sigue_linea`.

## Regla de datos (importante)

- **Nada de datos personales en este repo**: ni nombres de menores de
  terceros, teléfonos, CI ni correos en HTML, JS, PDFs, imágenes ni
  nombres de archivo. Nombres de menores de terceros se escriben como
  «Participante A», «[nombre omitido]» o descripciones de rol.
- Se conservan nombres de adultos en cargo público, la marca «Team
  Wang Jallaza» (nombre de equipo en logos oficiales) y los datos del
  propio equipo Arturito.
- La evidencia sin anonimizar vive en `bot_sigue_linea-privado`
  (`docs/`, `documentos_concurso/`, `pdfs/`, `entrega-dde/`, `imagen/`).

## MCP servers

Los MCP de Arduino, pdf-it, context7, playwright y shadcn están
configurados en `.devin/mcp_config.json` (ver el AGENTS.md completo
en el repo privado para notas de uso y plugins).

## Rules

- **Idioma: español** — respuestas, docs y logs en español.
- **Todo texto generado por IA pasa por `humanamente`** — superficies
  legibles (web, docs, README) pasan por el skill
  `.devin/skills/humanamente/` (perfil «técnico»).
- **Documentación en PDF vía pdf-it** — no usar Chrome headless,
  pandoc ni LaTeX.
- **Hardware real pide confirmación** — compilar y listar placas es
  libre; subir firmware y escribir al puerto serie se confirma antes.
- **Commit al cerrar cada trabajo** — ninguna tarea queda con cambios
  pendientes.
