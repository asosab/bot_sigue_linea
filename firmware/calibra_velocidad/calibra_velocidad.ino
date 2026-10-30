/*
 * ==========================================================
 * CALIBRACION DE VELOCIDAD - MEDICION EN PISO, SIN USB
 * ==========================================================
 * Sirve para dos constantes de arturito_v3:
 *
 * - MM_S_A_CRUCE (mm/s a VEL_CRUCE): con MODO_PIVOTE en 0, cada
 *   pulsada corre recto a VEL_PRUEBA durante CORRIDA_MS y para.
 *   Se filma con una cinta metrica a lo largo de la ruta; el
 *   tiempo del primer, segundo y tercer tercio del recorrido da
 *   la velocidad media y cuanto tarda en tomar velocidad.
 *
 * - PIVOTE_MS (tiempo de girar 90° a VEL_BUSQUEDA): con
 *   MODO_PIVOTE en 1, cada pulsada pivotea en el sitio
 *   CORRIDA_MS milisegundos. En el video se cuentan los cuartos
 *   de vuelta y se reparten los milisegundos entre ellos.
 *
 * Marcas para el video: el LED integrado (D13) se enciende
 * mientras el robot corre, y hay una pausa previa de
 * PREVIO_MS tras la pulsada para sacar la mano.
 *
 * Cada pulsada es una corrida nueva: repetir varias veces y
 * promediar. Otro valor de VEL_PRUEBA pide recompilar.
 *
 * Hardware: UNO + DRV8833 (IN1..IN4 en D5/D6/D9/D10, EEP en D4),
 * pulsador en D8 a GND (pull-up interno).
 */

// --- PINES ---
#define IN1 5   // motor izquierdo adelante (PWM)
#define IN2 6   // motor izquierdo atras (PWM)
#define IN3 9   // motor derecho adelante (PWM)
#define IN4 10  // motor derecho atras (PWM)
#define SLEEP_DRV 4
#define BTN 8       // pulsador a GND, pull-up interno (LOW = presionado)
#define LED 13      // marca del tramo de carrera en el video

// --- PARAMETROS DE LA PRUEBA ---
// Corrida de lateralidad: el izquierdo fisico (visto de arriba, al
// frente) va a potencia plena y el derecho queda recortado por el
// calculo del derrape (v_izq/v_der = 0.876 medido). Diagnostico:
// - va recto o curva suave a la derecha -> el izquierdo era el lento
//   y el canal del esquema esta bien
// - sigue curvando a la izquierda -> los canales estan cruzados o el
//   derrape original venia de la pose inicial, no del balance
const int VEL_IZQ = 255;             // izquierdo a maxima potencia
const int VEL_DER = (int)(VEL_IZQ * 0.876); // derecho controlado

const unsigned long CORRIDA_MS = 3000;  // duracion exacta de la corrida
const unsigned long PREVIO_MS = 400;    // pausa tras la pulsada (sacar la mano)
const int MODO_PIVOTE = 0;           // 0 = recta, 1 = pivote en el sitio
const int VEL_BUSQUEDA = 110;        // PWM del pivote (el de la busqueda)
const int LADO_PIVOTE = 1;           // +1 derecha, -1 izquierda

const unsigned long BTN_DEBOUNCE_MS = 50;

bool btnPrev = HIGH;
unsigned long btnUltimo = 0;
unsigned long correDesde = 0;   // 0 = parado; si no, momento de arranque
bool enPrevio = false;

void motorIzq(int vel) {
  vel = constrain(vel, -255, 255);
  if (vel >= 0) {
    analogWrite(IN1, vel);
    digitalWrite(IN2, LOW);
  } else {
    digitalWrite(IN1, LOW);
    analogWrite(IN2, -vel);
  }
}

void motorDer(int vel) {
  vel = constrain(vel, -255, 255);
  if (vel >= 0) {
    analogWrite(IN3, vel);
    digitalWrite(IN4, LOW);
  } else {
    digitalWrite(IN3, LOW);
    analogWrite(IN4, -vel);
  }
}

void detener() {
  motorIzq(0); motorDer(0);
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  detener();

  pinMode(SLEEP_DRV, OUTPUT);
  digitalWrite(SLEEP_DRV, HIGH);
  pinMode(BTN, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  digitalWrite(LED, LOW);

  Serial.begin(9600);
#if MODO_PIVOTE
  Serial.println("Calibracion: pivote en el sitio, 3 s por pulsada.");
#else
  Serial.println("Calibracion: corrida recta de 3 s por pulsada.");
#endif
}

void loop() {
  // Flanco de pulsado con antirrebote: arranca una corrida nueva
  bool btn = digitalRead(BTN);
  if (btn != btnPrev && millis() - btnUltimo > BTN_DEBOUNCE_MS) {
    btnUltimo = millis();
    btnPrev = btn;
    if (btn == LOW && correDesde == 0) {
      correDesde = millis();
      enPrevio = true;
    }
  }

  if (correDesde == 0) {
    detener();
    delay(5);
    return;
  }

  unsigned long t = millis() - correDesde;

  // Pausa previa: mano fuera antes de que se mueva
  if (enPrevio) {
    if (t < PREVIO_MS) {
      detener();
      delay(5);
      return;
    }
    enPrevio = false;
    digitalWrite(LED, HIGH);    // marca de inicio en el video
  }

  // Tramo cronometrado: CORRIDA_MS exactos desde que prendio el LED
  if (t - PREVIO_MS < CORRIDA_MS) {
#if MODO_PIVOTE
    motorIzq(LADO_PIVOTE * VEL_BUSQUEDA);
    motorDer(-LADO_PIVOTE * VEL_BUSQUEDA);
#else
    motorIzq(VEL_IZQ);
    motorDer(VEL_DER);
#endif
  } else {
    detener();
    digitalWrite(LED, LOW);     // marca de fin
    correDesde = 0;
  }
  delay(5);
}
