/*
 * ==========================================================
 * PRUEBA DRV8833 - DIAGNÓSTICO DEL DRIVER DE MOTORES
 * ==========================================================
 * Cableado:
 * - IN1..IN4 del modulo a D5, D6, D9, D10 (igual que arturito)
 * - EEP del modulo a D4 (sleep del chip: HIGH = despierto)
 * - ULT del modulo a D2 (opcional: nFAULT, LOW = el driver falla)
 * - VCC del modulo a la bateria, GND comun con el Arduino
 *
 * IMPORTANTE: la bateria debe estar conectada y el interruptor
 * encendido. Con solo USB el driver no tiene energia de motores.
 *
 * La secuencia corre sola y se repite. Por monitor serie (9600):
 *   s = duerme/despierta el driver (toggle de EEP)
 *   r = reinicia la secuencia
 *
 * Que mirar: que rueda gira en cada paso. Si al mandar 's' el motor
 * se detiene al instante y al repetir 's' vuelve, el chip esta sano
 * y el problema era el pin de sleep.
 */

#define IN1 5  // motor izquierdo adelante
#define IN2 6  // motor izquierdo atras
#define IN3 9  // motor derecho adelante
#define IN4 10 // motor derecho atras

#define SLEEP_DRV 4  // cable a EEP del modulo
#define FAULT_PIN 2  // cable a ULT del modulo (opcional)

const int PASO_MS = 3000;

bool despierto = true;
bool reiniciar = false;

void todosLOW() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

void estadoULT() {
  if (digitalRead(FAULT_PIN) == LOW) {
    Serial.println("   !! ULT en LOW: el driver reporta FALLA (corto o temperatura)");
  }
}

void atiendeSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 's') {
      despierto = !despierto;
      digitalWrite(SLEEP_DRV, despierto ? HIGH : LOW);
      Serial.println(despierto
        ? ">> driver DESPIERTO (EEP en HIGH)"
        : ">> driver DORMIDO (EEP en LOW): los motores no responden");
    } else if (c == 'r') {
      reiniciar = true;
      Serial.println(">> reiniciando secuencia");
    }
  }
}

// delay fragmentado para atender serie durante cada paso
bool espera(int ms) {
  for (int t = 0; t < ms && !reiniciar; t += 50) {
    atiendeSerie();
    delay(50);
  }
  return reiniciar;
}

void anuncia(int paso, const char* que) {
  Serial.print("PASO ");
  Serial.print(paso);
  Serial.print("/7 - ");
  Serial.println(que);
  estadoULT();
}

bool pasoPin(int paso, int pin, const char* que) {
  anuncia(paso, que);
  todosLOW();
  digitalWrite(pin, HIGH);
  espera(PASO_MS);
  todosLOW();
  return reiniciar;
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  todosLOW();

  pinMode(SLEEP_DRV, OUTPUT);
  digitalWrite(SLEEP_DRV, HIGH); // despertar el driver

  pinMode(FAULT_PIN, INPUT_PULLUP);

  Serial.begin(9600);
  Serial.println();
  Serial.println("===== PRUEBA DRV8833 =====");
  Serial.println("Pines: IN1=D5 IN2=D6 IN3=D9 IN4=D10 | EEP=D4 | ULT=D2");
  Serial.println("Comandos: s = sleep/wake del driver, r = reiniciar");
  Serial.println("Bateria conectada e interruptor ENCENDIDO.");
  Serial.println("==========================");
  delay(2000);
}

void loop() {
  reiniciar = false;

  // Pasos 1-4: un pin IN en HIGH a la vez. Revela el cableado real
  // aunque los dupont hayan quedado en otro orden.
  if (pasoPin(1, IN1, "IN1 (D5) HIGH -> motor IZQUIERDO adelante")) return;
  if (pasoPin(2, IN2, "IN2 (D6) HIGH -> motor IZQUIERDO atras")) return;
  if (pasoPin(3, IN3, "IN3 (D9) HIGH -> motor DERECHO adelante")) return;
  if (pasoPin(4, IN4, "IN4 (D10) HIGH -> motor DERECHO atras")) return;

  // Paso 5: ambos motores adelante y luego atras, a fondo.
  anuncia(5, "AMBOS motores ADELANTE y despues ATRAS");
  digitalWrite(IN1, HIGH); digitalWrite(IN3, HIGH);
  if (espera(PASO_MS)) { todosLOW(); return; }
  digitalWrite(IN1, LOW); digitalWrite(IN3, LOW);
  digitalWrite(IN2, HIGH); digitalWrite(IN4, HIGH);
  if (espera(PASO_MS)) { todosLOW(); return; }
  todosLOW();

  // Paso 6: rampa PWM en el motor izquierdo (verifica analogWrite).
  anuncia(6, "RAMPA PWM 0->255->0 en motor izquierdo (IN1)");
  for (int v = 0; v <= 255 && !reiniciar; v += 15) {
    analogWrite(IN1, v);
    atiendeSerie();
    delay(60);
  }
  for (int v = 255; v >= 0 && !reiniciar; v -= 15) {
    analogWrite(IN1, v);
    atiendeSerie();
    delay(60);
  }
  todosLOW();
  if (reiniciar) return;

  // Paso 7: pausa antes de repetir.
  anuncia(7, "pausa - la secuencia se repite");
  espera(4000);
}
