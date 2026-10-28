---
type: toolchain
status: verificado
created: 2026-10-28
---
# Toolchain

- `arduino-cli` 1.5.1: `C:\Program Files\Arduino CLI\arduino-cli.exe`
  (winget `ArduinoSA.CLI`)
- Arduino IDE 2.3.10: `C:\Users\asosa\AppData\Local\Programs\arduino-ide\`
- Core instalado: `arduino:avr@1.8.8` → FQBN `arduino:avr:uno`
- MCP `arduino` (arduino-mcp-server) envuelve el CLI para Devin;
  `ARDUINO_SKETCH_ROOT` apunta a `firmware/`

## Comandos

```bash
# compilar
arduino-cli compile --fqbn arduino:avr:uno firmware/arturito

# placa y puerto
arduino-cli board list

# subir (pide confirmación — hardware real)
arduino-cli upload -p COMx --fqbn arduino:avr:uno firmware/arturito
```
