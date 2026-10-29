// Genera arturito-esquema.pdf: cableado + fotos con pines señalados.
// Uso: node tools/make_esquema.js   (necesita pdfkit: npm i pdfkit)
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const R = 'D:/proyectos/arduino/bot_sigue_linea';
const DRV_IMG = `${R}/imagen/drv8833.jpg`;   // el módulo soldado en la protoboard
const UNO_IMG = process.env.UNO_IMG || 'D:/proyectos/arduino/bot_sigue_linea/imagen/Arduino-UNO-Parts-Marking.jpg';
const OUT = `${R}/web/assets/pdf/arturito-esquema.pdf`;

const AMBER = '#b78f00', INK = '#222222', MUTE = '#666666', PAPER = '#fff6d6', HAIR = '#e5e5e5';
const M = 50, W = 595.28 - M * 2; // A4 ancho útil

const doc = new PDFDocument({ size: 'A4', margin: M, info: { Title: 'Arturito — esquema de conexión', Author: 'Equipo Arturito' } });
doc.pipe(fs.createWriteStream(OUT));

// Segoe UI (la fuente del sitio) para que rindan →, tildes y ñ
doc.registerFont('body', 'C:/Windows/Fonts/segoeui.ttf');
doc.registerFont('bold', 'C:/Windows/Fonts/segoeuib.ttf');

let y = M;
function h1(t) { doc.font('bold').fontSize(20).fillColor(INK).text(t, M, y); y = doc.y + 4; }
function h2(t) { doc.font('bold').fontSize(13).fillColor(INK).text(t, M, y); y = doc.y + 2; }
function para(t, opts = {}) { doc.font('body').fontSize(9.5).fillColor(INK).text(t, M, y, { width: W, ...opts }); y = doc.y + 6; }
function gap(n = 8) { y += n; }
function need(h) { if (y + h > 842 - M) { doc.addPage(); y = M; } }
function rule() { doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(HAIR).stroke(); y += 6; }

function table(rows, col1 = 220, col2 = 120) {
  for (const [a, b] of rows) {
    doc.font('bold').fontSize(9).fillColor(INK).text(a, M + 4, y, { width: col1 });
    doc.font('body').fontSize(9).text(b, M + 4 + col1, y, { width: col2 });
    y = doc.y + 2;
    rule();
  }
  gap(4);
}

// --- pines flanqueando una foto: lado L/R, fracción vertical fy, etiqueta ---
function pinLabels(ix, iy, iw, ih, labels) {
  for (const l of labels) {
    const py = iy + l.fy * ih;
    const left = l.side === 'L';
    const x0 = left ? ix : ix + iw;
    const x1 = left ? x0 - 10 : x0 + 10;
    doc.moveTo(x0, py).lineTo(x1, py).lineWidth(0.8).strokeColor(AMBER).stroke();
    doc.circle(x0, py, 1.6).fill(AMBER);
    doc.font('bold').fontSize(7.5).fillColor(INK);
    const tw = 88;
    if (left) doc.text(l.t, x1 - tw, py - 4, { width: tw, align: 'right' });
    else doc.text(l.t, x1 + 2, py - 4, { width: tw });
  }
}

// ===================== CONTENIDO =====================
h1('Arturito — esquema de conexión');
doc.font('body').fontSize(9).fillColor(MUTE)
  .text('Robot seguidor de línea · Gaby Leryn Ayala Chambi, Christopher Darius Valero Lima y Maximiliano Sosa Useche · U.E. Jaime Alfonso Escalante Gutierrez A, Santa Cruz de la Sierra · 2026', M, y, { width: W });
y = doc.y + 10;

h2('Sensores → Arduino UNO');
para('Los cinco sensores TCRT5000 entran por los pines analógicos. Mirando al robot de frente, S0 queda a la izquierda y S4 a la derecha.');
table([
  ['S0 (extremo izquierdo)', 'A0'],
  ['S1 (centro izquierdo)', 'A1'],
  ['S2 (centro)', 'A2'],
  ['S3 (centro derecho)', 'A3'],
  ['S4 (extremo derecho)', 'A4'],
]);

need(120);
h2('UNO → DRV8833 (driver de motores)');
table([
  ['IN1 (motor izquierdo, adelante)', 'D5'],
  ['IN2 (motor izquierdo, atrás)', 'D6'],
  ['IN3 (motor derecho, adelante)', 'D9'],
  ['IN4 (motor derecho, atrás)', 'D10'],
  ['EEP (nSLEEP; HIGH = despierto)', 'D4'],
  ['ULT (nFAULT, opcional)', 'D2'],
]);
para('Sin el cable a EEP el chip queda dormido: enciende su LED pero las salidas no conducen.');

h2('DRV8833 → motores · alimentación');
para('OUT1/OUT2 al motor izquierdo y OUT3/OUT4 al derecho. Si un motor gira al revés, se intercambian sus dos cables en OUT o sus dos entradas IN; da igual por dónde. Cuatro pilas AA alimentan el conjunto y la masa es común entre sensores, driver y UNO.');

// ---- Foto UNO (llega del usuario; si no existe aún, se omite el bloque)
if (fs.existsSync(UNO_IMG)) {
  need(320);
  h2('Arduino UNO — vista desde arriba');
  const iw = Math.min(W - 200, 300);
  const meta = doc.openImage(UNO_IMG);
  const ih = iw * meta.height / meta.width;
  const ix = M + (W - iw) / 2;
  need(ih + 20);
  doc.image(UNO_IMG, ix, y, { width: iw });
  y += ih + 6;
  doc.font('body').fontSize(8).fillColor(MUTE)
    .text('La UNO vista desde arriba con el nombre de cada pin. Arturito usa A0–A4 para los sensores, D5/D6/D9/D10 para los IN1–IN4 del driver, D4 para EEP, D2 para ULT y 5V/GND para la alimentación.', M, y, { width: W, align: 'center' });
  y = doc.y + 8;
}

// ---- Foto DRV8833
if (fs.existsSync(DRV_IMG)) {
  need(320);
  h2('DRV8833 — soldado en la protoboard');
  const iw = Math.min(W - 210, 285);
  const meta = doc.openImage(DRV_IMG);
  const ih = iw * meta.height / meta.width;
  const ix = M + (W - iw) / 2;
  need(ih + 20);
  doc.image(DRV_IMG, ix, y, { width: iw });
  // Visto montado como queda en el robot (chip arriba):
  // columna izquierda (arriba→abajo): IN1 IN2 VCC GND IN3 IN4
  // columna derecha: ULT OUT4 OUT3 OUT2 OUT1 EEP
  pinLabels(ix, y, iw, ih, [
    { side: 'L', fy: 0.13, t: 'IN1 → D5' },
    { side: 'L', fy: 0.26, t: 'IN2 → D6' },
    { side: 'L', fy: 0.40, t: 'VCC → 5V' },
    { side: 'L', fy: 0.54, t: 'GND → masa' },
    { side: 'L', fy: 0.67, t: 'IN3 → D9' },
    { side: 'L', fy: 0.80, t: 'IN4 → D10' },
    { side: 'R', fy: 0.08, t: 'ULT → D2' },
    { side: 'R', fy: 0.22, t: 'OUT4 → motor der.' },
    { side: 'R', fy: 0.36, t: 'OUT3 → motor der.' },
    { side: 'R', fy: 0.50, t: 'OUT2 → motor izq.' },
    { side: 'R', fy: 0.64, t: 'OUT1 → motor izq.' },
    { side: 'R', fy: 0.78, t: 'EEP → D4' },
  ]);
  y += ih + 6;
  doc.font('body').fontSize(8).fillColor(MUTE)
    .text('El módulo tal como queda montado en el robot: EEP abajo a la derecha, IN1 arriba a la izquierda.', M, y, { width: W, align: 'center' });
  y = doc.y + 8;
}

doc.font('body').fontSize(8).fillColor(MUTE)
  .text('El código no se publica hasta después del concurso; las versiones se imprimen aparte.', M, 842 - M - 14, { width: W, align: 'center' });

doc.end();
console.log('OK ->', OUT);
