/*
 * Keycap Lab v2: eight solenoid keycaps that push the fingers resting on
 * them, and sense a finger pushing a raised key down
 * Board: Raspberry Pi Pico / Pico 2 W (Arduino-Pico core)
 * Protocol: KEYCAP-LAB-v2, USB Serial, one text command per line
 *
 * keycap_lab/index.html drives it. Built on CFI_8solenoid_current_serial_v10:
 * the same wiring, press sensing and calibration (saved in the same format,
 * so a calibration made with v10 is used here and the other way round), but
 * no USB keyboard, and a text protocol with key numbers 0..7.
 *
 *   key          A0  S1  D2  F3  J4  K5  L6  ;7
 *   driver       13  14  15  16   9  10  11  12   (motor drivers 01..16)
 *   MCP3208     CH0 CH1 CH2 CH3 CH4 CH5 CH6 CH7
 * MCP3208 (hardware SPI0): CLK <- GP2, DIN <- GP3, DOUT -> GP4, CS <- GP5,
 *   VDD and VREF 3.3 V. Current sense on every key: driver output B --[1 ohm]--
 *   solenoid, the solenoid side --[10 k]-- CHn --[10 k || 1 nF]-- GND.
 * Solenoid drive (four daisy-chained 74HC595s):
 *   GP19 -> first 74HC595 SER, GP18 -> shift clocks, GP17 -> latch clocks
 *   GP22 -> SK6812 DIN (green while a key is driven)
 *   Driver N uses outputs (2N-2, 2N-1): ON=(1,0), BRAKE=(1,1), OFF=(0,0).
 *
 * Two ways to move a key:
 *   push    P / F: the board drives the key (a strike, a tremble, a PWM
 *           level). Partial strength is PWM between ON and BRAKE; a key that
 *           stops is braked for 5 ms before it is released.
 *   listen  U: the key is kept up, and a finger pushing it down is reported
 *           (DOWN / UP). A key that has just risen must first read as
 *           released, so a finger resting on it does not count. Listening
 *           keys rise one after another, 80 ms apart.
 * A push on a listening key takes over; the key listens again 150 ms after
 * the push ends (and must read as released again).
 *
 * Host -> board (one line each; key = 0..7 or a s d f j k l ;)
 *   P key ms [duty=100] [kick=0] [hz=0]
 *       push one key for ms (max 5000) at duty 0..100 %. The first kick ms
 *       are full strength; hz: on/off at hz after the kick (a tremble).
 *   F ms kick d0 d1 d2 d3 d4 d5 d6 d7
 *       push all eight at once (a frame, for continuous motion): d > 0 keeps
 *       a key going for ms more at duty d (no new kick), d = 0 releases it.
 *   U mask      listen to the keys in mask (hex, bit 0 = A). Send it again at
 *               least every second, or the keys drop (TIMEOUT). U 0 drops them.
 *   X           stop: every key down, calibration cancelled
 *   AUTO        auto calibration (each key rises and drops by itself, ~25 s)
 *   MANUAL      manual calibration; NEXT captures the pushed key, SKIP skips
 *   CANCEL      cancel the calibration
 *   DEPTH pct [key]   press depth 5..90 % (all keys, or one), saved
 *   PROFILE     print the calibration    SENSE   print the readings
 *   V           print the version
 * Board -> host
 *   READY KEYCAP-LAB-v2 (at boot) / VERSION KEYCAP-LAB-v2
 *   RAISED mask                      listening keys actually up now (hex)
 *   ARMED key tau threshold          read as released: a press now counts
 *   DOWN key tau raised threshold    pushed down
 *   UP key tau                       let go (-1: the key dropped meanwhile)
 *   REST key / AWAKE key             heat guard (below)
 *   TIMEOUT                          no U for 1 s: listening keys dropped
 *   LISTEN ERROR: calibration profile missing
 *   SENSE tau/threshold x8 (0/0 = not listening)
 *   MODE PLAY|AUTO_CAL|MANUAL_CAL, AUTO ..., CAL ...  (as v10, key numbers)
 *
 * Heat guard: each key collects heat while driven (duty-weighted; a
 * listening key counts as full) and loses it five times as fast while off.
 * At 5 s of heat the key rests until it has cooled (5 s on -> 1 s off, as
 * v10), printing REST and AWAKE. A listening key comes back up by itself.
 *
 * Calibration and sensing are v10's: see CFI_8solenoid_current_serial_v10
 * for how tau is read and how the thresholds are chosen.
 *
 * Requires the Adafruit NeoPixel library.
 */

#include <Adafruit_NeoPixel.h>
#include <EEPROM.h>
#include <SPI.h>
#include <hardware/gpio.h>

// =====================================================================
// Configuration
// =====================================================================
constexpr uint8_t KEY_COUNT = 8;
const uint8_t DRIVER[KEY_COUNT] = {13, 14, 15, 16, 9, 10, 11, 12};
const int8_t ADC_CHANNEL[KEY_COUNT] = {0, 1, 2, 3, 4, 5, 6, 7};  // -1 = no sense
const char KEY_CHAR[KEY_COUNT] = {'a', 's', 'd', 'f', 'j', 'k', 'l', ';'};

constexpr uint8_t MCP_SCK_PIN = 2;
constexpr uint8_t MCP_MOSI_PIN = 3;   // -> MCP3208 DIN
constexpr uint8_t MCP_MISO_PIN = 4;   // <- MCP3208 DOUT
constexpr uint8_t MCP_CS_PIN = 5;
constexpr uint32_t MCP_SPI_HZ = 1000000;

constexpr uint8_t LED_PIN = 22;
constexpr uint8_t SER_PIN = 19;
constexpr uint8_t SHIFT_CLOCK_PIN = 18;
constexpr uint8_t LATCH_CLOCK_PIN = 17;

// Push
constexpr uint32_t PWM_PERIOD_US = 1000;  // 1 kHz; the keys are staggered
constexpr uint32_t MAX_DRIVE_MS = 5000;
constexpr uint32_t VOICE_BRAKE_US = 5000;

// Heat guard
constexpr float HEAT_LIMIT_MS = 5000.0f;
constexpr float COOL_RATE = 5.0f;

// Listen
constexpr uint32_t BRAKE_MS = 5;
constexpr uint32_t SETTLE_MS = 150;        // a key is up this long after its coil turns on
constexpr uint32_t STAGGER_MS = 80;        // listening keys rise this far apart
constexpr uint32_t LISTEN_TIMEOUT_MS = 1000;

// Sensing (v10)
constexpr float SHUNT_OHMS = 1.0f;
constexpr float DIVIDER = 2.0f;
constexpr float ADC_VREF = 3.3f;
constexpr uint32_t CYCLE_US = 20000;
constexpr uint32_t DECAY_WINDOW_US = 650;
constexpr uint32_t FIT_FROM_US = 30;
constexpr float MIN_FIT_MA = 10.0f;
constexpr int MAX_SAMPLES = 80;
constexpr float MIN_ON_MA = 30.0f;
constexpr uint16_t PROBE_PULSE_US = 1200;
constexpr uint16_t REST_PULSE_MIN_US = 300;
constexpr uint16_t REST_PULSE_MAX_US = 4000;
constexpr float REST_PULSE_TARGET = 0.5f;
constexpr bool COMPENSATE_HEATING = true;

// Keys (v10)
constexpr uint8_t PRESS_CONFIRMATION_COUNT = 2;
constexpr uint8_t RELEASE_CONFIRMATION_COUNT = 3;

// Calibration (v10; the storage format must stay the same as v10)
constexpr uint8_t AUTO_SAMPLE_COUNT = 15;
constexpr uint8_t MANUAL_SAMPLE_COUNT = 30;
constexpr uint8_t AUTO_CYCLES = 3;
constexpr uint8_t POOL_MAX = AUTO_SAMPLE_COUNT * AUTO_CYCLES;
constexpr uint32_t CAL_SETTLE_MS = 200;
constexpr uint32_t DOWN_SETTLE_MS = 250;
constexpr uint32_t CAPTURE_WINDOW_MS = 700;
constexpr uint32_t CAL_BETWEEN_MS = 100;
constexpr uint32_t MANUAL_TIMEOUT_MS = 30000;
constexpr uint32_t AUTO_TIMEOUT_MS = 60000;
constexpr float PRESS_SIGMAS = 4.0f;
constexpr float MIN_MARGIN_US = 8.0f;
constexpr float MIN_MARGIN_FRACTION = 0.03f;
constexpr float NOISY_FRACTION = 0.15f;
constexpr uint16_t EEPROM_SIZE = 512;
constexpr uint32_t CALIBRATION_MAGIC = 0x43464938UL;  // "CFI8"
constexpr uint16_t CALIBRATION_VERSION = 3;
constexpr uint16_t DEPTH_ADDRESS = 384;
constexpr uint32_t DEPTH_MAGIC = 0x44505431UL;  // "DPT1"
constexpr uint8_t DEFAULT_DEPTH_PERCENT = 30;
constexpr uint8_t MIN_DEPTH_PERCENT = 5;
constexpr uint8_t MAX_DEPTH_PERCENT = 90;
constexpr float GUESS_SPAN = 0.2f;

// =====================================================================
// Types (all before any function, for the Arduino IDE's prototypes)
// =====================================================================
enum Drive : uint8_t { DRIVE_OFF = 0, DRIVE_ON = 1, DRIVE_BRAKE = 3 };

struct Voice {  // a push
  bool active;
  bool braking;
  uint8_t duty;
  uint32_t startUs;
  uint32_t durUs;
  uint32_t kickUs;
  uint32_t halfUs;  // half period of the tremble, 0 = none
  uint32_t brakeUntilUs;
  uint32_t endMs;   // when it last stopped, 0 = never
};

enum class Coil : uint8_t { Off, On, Braking };
struct CoilState {  // a listening key (and calibration)
  Coil state;
  bool wanted;
  uint32_t sinceMs;
};

struct CalibrationProfile {
  uint16_t offMedianUs;
  uint16_t offHighUs;
  uint16_t floatMedianUs;
  uint16_t floatHighUs;
  uint16_t contactMedianUs;
  uint16_t noiseTenthsUs;
  uint16_t thresholdUs;
  uint16_t onMilliamps;
};
struct DepthStorage {
  uint32_t magic;
  uint8_t percent[KEY_COUNT];
  uint32_t checksum;
};
struct CalibrationStorage {
  uint32_t magic;
  uint16_t version;
  uint16_t reserved;  // low byte: unused keys, high byte: keys whose tau falls when pushed
  CalibrationProfile profiles[KEY_COUNT];
  uint32_t checksum;
};

enum class Detect : uint8_t { Down, WaitRelease, Ready, Pressed };
struct KeyState {
  Detect state;
  uint8_t count;
  float onFiltMa;
  float tauUs;
};

struct Robust {
  float median;
  float sigma;
  float p10;
  float p90;
  uint8_t n;
};

enum class Mode : uint8_t { Play, AutoCal, ManualCal };
enum class AutoStep : uint8_t { Settle, Up, Down };
enum class ManualStep : uint8_t { Settle, Up, Push, Next };

Adafruit_NeoPixel statusLed(1, LED_PIN, NEO_GRB + NEO_KHZ800);

uint8_t bitOf(uint8_t i) { return static_cast<uint8_t>(1U << i); }
bool hasSense(uint8_t i) { return ADC_CHANNEL[i] >= 0; }

// =====================================================================
// Outputs: pushes, listening coils and sensing overrides -> shift registers
// =====================================================================
Voice voices[KEY_COUNT] = {};
CoilState coils[KEY_COUNT] = {};
float heatMs[KEY_COUNT] = {};
uint8_t restingKeys = 0;
uint8_t forceBrake = 0;  // sensing: brake a key for a reading
uint8_t forceOn = 0;     //   or pulse it, whatever else it is doing
uint32_t lastOut = 0xFFFFFFFFUL;
bool ledOn = true;
uint32_t lastTurnOnMs = 0;
uint32_t lastHeatMs = 0;

inline void settle() {
  for (uint8_t i = 0; i < 8; ++i) asm volatile("nop");
}

// Fast bit-banged shiftOut (PWM edges come up to 16 times per ms).
void writeShiftRegisters(uint32_t value) {
  gpio_put(LATCH_CLOCK_PIN, 0);
  for (int8_t bit = 31; bit >= 0; --bit) {
    gpio_put(SER_PIN, (value >> bit) & 1U);
    settle();
    gpio_put(SHIFT_CLOCK_PIN, 1);
    settle();
    gpio_put(SHIFT_CLOCK_PIN, 0);
  }
  settle();
  gpio_put(LATCH_CLOCK_PIN, 1);
}

void releaseVoice(uint8_t i, uint32_t nowUs) {
  Voice &v = voices[i];
  if (!v.active) return;
  v.active = false;
  v.braking = true;
  v.brakeUntilUs = nowUs + VOICE_BRAKE_US;
  v.endMs = millis() | 1U;
}

void releaseAllVoices() {
  const uint32_t nowUs = micros();
  for (uint8_t i = 0; i < KEY_COUNT; ++i) releaseVoice(i, nowUs);
}

// A push is on the key, or ended too recently for a reading.
bool voiceBusy(uint8_t i) {
  const Voice &v = voices[i];
  return v.active || v.braking || (v.endMs && millis() - v.endMs < SETTLE_MS);
}

Drive driveOf(uint8_t i, uint32_t nowUs) {
  if (forceBrake & bitOf(i)) return DRIVE_BRAKE;
  if (forceOn & bitOf(i)) return DRIVE_ON;
  Voice &v = voices[i];
  if (v.active) {
    const uint32_t elapsed = nowUs - v.startUs;
    if (elapsed >= v.durUs) {
      releaseVoice(i, nowUs);
    } else {
      bool on = true;
      if (elapsed >= v.kickUs) {
        if (v.halfUs) on = ((elapsed - v.kickUs) / v.halfUs) % 2 == 0;
        if (on && v.duty < 100) {
          const uint32_t phase = (nowUs + i * (PWM_PERIOD_US / KEY_COUNT)) % PWM_PERIOD_US;
          on = phase < v.duty * PWM_PERIOD_US / 100;
        }
      }
      return on ? DRIVE_ON : DRIVE_BRAKE;
    }
  }
  if (coils[i].state == Coil::On) return DRIVE_ON;
  if (coils[i].state == Coil::Braking) return DRIVE_BRAKE;
  if (v.braking) {
    if (static_cast<int32_t>(nowUs - v.brakeUntilUs) < 0) return DRIVE_BRAKE;
    v.braking = false;
  }
  return DRIVE_OFF;
}

void writeOutputs() {
  const uint32_t nowUs = micros();
  uint32_t out = 0;
  bool any = false;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    const Drive d = driveOf(i, nowUs);
    out |= static_cast<uint32_t>(d) << ((DRIVER[i] - 1) * 2);
    any |= d == DRIVE_ON || voices[i].active;
  }
  if (out != lastOut) {
    writeShiftRegisters(out);
    lastOut = out;
  }
  if (any != ledOn) {
    ledOn = any;
    statusLed.setPixelColor(0, any ? statusLed.Color(0, 32, 0) : statusLed.Color(8, 0, 0));
    statusLed.show();
  }
}

void startVoice(uint8_t i, uint32_t ms, uint32_t duty, uint32_t kickMs, uint32_t hz,
                bool restart) {
  Voice &v = voices[i];
  if (restingKeys & bitOf(i)) return;
  const uint32_t nowUs = micros();
  if (ms > MAX_DRIVE_MS) ms = MAX_DRIVE_MS;
  if (kickMs > ms) kickMs = ms;
  if (ms == 0 || duty == 0) {
    releaseVoice(i, nowUs);
    return;
  }
  if (restart || !v.active) {
    v.startUs = nowUs;
    v.kickUs = kickMs * 1000UL;
    v.halfUs = hz ? 500000UL / hz : 0;
    v.durUs = ms * 1000UL;
  } else {
    v.durUs = (nowUs - v.startUs) + ms * 1000UL;
  }
  v.duty = duty > 100 ? 100 : duty;
  v.active = true;
  v.braking = false;
}

// ---- listening coils (v10's coil layer; the time limit is the heat guard) ----
void enterCoil(uint8_t i, Coil state) {
  coils[i].state = state;
  coils[i].sinceMs = millis();
}

void serviceCoils() {
  bool changed = false;
  const uint32_t now = millis();
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    CoilState &c = coils[i];
    const bool allowed = c.wanted && !(restingKeys & bitOf(i));
    switch (c.state) {
      case Coil::Off:
        if (allowed && now - lastTurnOnMs >= STAGGER_MS) {
          enterCoil(i, Coil::On);
          lastTurnOnMs = now;
          changed = true;
        }
        break;
      case Coil::On:
        if (!allowed) {
          enterCoil(i, Coil::Braking);
          changed = true;
        }
        break;
      case Coil::Braking:
        if (allowed) {
          enterCoil(i, Coil::On);
          changed = true;
        } else if (now - c.sinceMs >= BRAKE_MS) {
          enterCoil(i, Coil::Off);
          changed = true;
        }
        break;
    }
  }
  if (changed) writeOutputs();
}

void wantCoils(uint8_t keys) {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) coils[i].wanted = (keys & bitOf(i)) != 0;
  serviceCoils();
}

bool coilOnFor(uint8_t i, uint32_t ms) {
  return coils[i].state == Coil::On && millis() - coils[i].sinceMs >= ms;
}
bool coilUp(uint8_t i) { return coilOnFor(i, SETTLE_MS); }
bool coilOffFor(uint8_t i, uint32_t ms) {
  return coils[i].state == Coil::Off && millis() - coils[i].sinceMs >= ms;
}
uint32_t coilOnLeftMs(uint8_t i) {  // until the heat guard rests it
  if (coils[i].state != Coil::On || heatMs[i] >= HEAT_LIMIT_MS) return 0;
  return static_cast<uint32_t>(HEAT_LIMIT_MS - heatMs[i]);
}

void updateHeat() {
  const uint32_t nowMs = millis();
  const uint32_t dt = nowMs - lastHeatMs;
  if (dt == 0) return;
  lastHeatMs = nowMs;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    float level = 0;
    if (voices[i].active) level = voices[i].duty / 100.0f;
    else if (coils[i].state == Coil::On) level = 1.0f;
    if (level > 0) {
      heatMs[i] += dt * level;
      if (heatMs[i] >= HEAT_LIMIT_MS && !(restingKeys & bitOf(i))) {
        restingKeys |= bitOf(i);
        releaseVoice(i, micros());
        Serial.print(F("REST "));
        Serial.println(i);
      }
    } else {
      heatMs[i] -= dt * COOL_RATE;
      if (heatMs[i] < 0) heatMs[i] = 0;
      if ((restingKeys & bitOf(i)) && heatMs[i] == 0) {
        restingKeys &= static_cast<uint8_t>(~bitOf(i));
        Serial.print(F("AWAKE "));
        Serial.println(i);
      }
    }
  }
}

// =====================================================================
// Sensing (v10)
// =====================================================================
float zeroAdc[KEY_COUNT] = {};
float decayT[KEY_COUNT][MAX_SAMPLES];
float decayI[KEY_COUNT][MAX_SAMPLES];
int decayCount[KEY_COUNT];
float fitTau[KEY_COUNT];
float fitOnMa[KEY_COUNT];

uint16_t mcpRead(uint8_t channel) {
  SPI.beginTransaction(SPISettings(MCP_SPI_HZ, MSBFIRST, SPI_MODE0));
  digitalWrite(MCP_CS_PIN, LOW);
  SPI.transfer(static_cast<uint8_t>(0x06 | (channel >> 2)));
  const uint8_t hi = SPI.transfer(static_cast<uint8_t>((channel & 0x03) << 6));
  const uint8_t lo = SPI.transfer(0x00);
  digitalWrite(MCP_CS_PIN, HIGH);
  SPI.endTransaction();
  return static_cast<uint16_t>(((hi & 0x0F) << 8) | lo);
}

uint16_t readRaw(uint8_t i) { return mcpRead(static_cast<uint8_t>(ADC_CHANNEL[i])); }

float readAdc(uint8_t i, uint8_t count) {
  uint32_t sum = 0;
  for (uint8_t k = 0; k < count; ++k) sum += readRaw(i);
  return static_cast<float>(sum) / count;
}

float toMilliamps(uint8_t i, float adc) {
  return (adc - zeroAdc[i]) * (ADC_VREF / 4095.0f) * DIVIDER / SHUNT_OHMS * 1000.0f;
}

void measureZeros() {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (hasSense(i) && coilOffFor(i, 20) && !(forceOn & bitOf(i)) && !voiceBusy(i)) {
      zeroAdc[i] = readAdc(i, 64);
    }
  }
}

void measureDecay(uint8_t mask, bool keepBraking) {
  for (uint8_t c = 0; c < KEY_COUNT; ++c) {
    if (!(mask & bitOf(c))) continue;
    decayCount[c] = 0;
    fitOnMa[c] = toMilliamps(c, readAdc(c, 4));
    forceBrake |= bitOf(c);
    writeOutputs();
    const uint32_t t0 = micros();
    while (micros() - t0 < DECAY_WINDOW_US && decayCount[c] < MAX_SAMPLES) {
      decayT[c][decayCount[c]] = static_cast<float>(micros() - t0);
      decayI[c][decayCount[c]] = toMilliamps(c, readRaw(c));
      ++decayCount[c];
    }
    if (!keepBraking) {
      forceBrake &= static_cast<uint8_t>(~bitOf(c));
      writeOutputs();
    }
  }
  for (uint8_t c = 0; c < KEY_COUNT; ++c) {
    if (!(mask & bitOf(c))) continue;
    float sx = 0, sy = 0, sxx = 0, sxy = 0;
    int m = 0;
    for (int k = 0; k < decayCount[c]; ++k) {
      if (decayT[c][k] < FIT_FROM_US || decayI[c][k] < MIN_FIT_MA) continue;
      const float x = decayT[c][k], y = logf(decayI[c][k]);
      sx += x; sy += y; sxx += x * x; sxy += x * y; ++m;
    }
    const float den = m * sxx - sx * sx;
    const float slope = (m >= 5 && den != 0) ? (m * sxy - sx * sy) / den : 0;
    fitTau[c] = slope < 0 ? -1.0f / slope : -1.0f;
  }
}

float measureDownTau(uint8_t i, float targetMa) {
  forceOn |= bitOf(i);
  writeOutputs();
  const uint32_t t0 = micros();
  for (;;) {
    const uint32_t elapsed = micros() - t0;
    if (elapsed >= REST_PULSE_MAX_US) break;
    if (targetMa <= 0) {
      if (elapsed >= PROBE_PULSE_US) break;
    } else if (elapsed >= REST_PULSE_MIN_US &&
               toMilliamps(i, readRaw(i)) >= targetMa) {
      break;
    }
  }
  measureDecay(bitOf(i), true);
  forceOn &= static_cast<uint8_t>(~bitOf(i));
  delay(BRAKE_MS);
  forceBrake &= static_cast<uint8_t>(~bitOf(i));
  writeOutputs();
  return fitTau[i];
}

// =====================================================================
// Calibration data (v10)
// =====================================================================
CalibrationProfile profiles[KEY_COUNT] = {};
uint8_t depthPercent[KEY_COUNT];
bool profilesValid = false;
uint8_t disabledKeys = 0;
uint8_t invertedKeys = 0;

uint32_t calibrationChecksum(const CalibrationStorage &storage) {
  const uint8_t *bytes = reinterpret_cast<const uint8_t *>(&storage);
  const size_t length = sizeof(CalibrationStorage) - sizeof(storage.checksum);
  uint32_t hash = 2166136261UL;
  for (size_t i = 0; i < length; ++i) {
    hash ^= bytes[i];
    hash *= 16777619UL;
  }
  return hash;
}

bool loadCalibration() {
  CalibrationStorage storage = {};
  EEPROM.get(0, storage);
  if (storage.magic != CALIBRATION_MAGIC || storage.version != CALIBRATION_VERSION ||
      storage.checksum != calibrationChecksum(storage)) {
    return false;
  }
  const uint8_t disabled = static_cast<uint8_t>(storage.reserved & 0xFFU);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (!(disabled & bitOf(i)) &&
        (storage.profiles[i].thresholdUs == 0 || storage.profiles[i].onMilliamps == 0)) {
      return false;
    }
  }
  for (uint8_t i = 0; i < KEY_COUNT; ++i) profiles[i] = storage.profiles[i];
  disabledKeys = disabled;
  invertedKeys = static_cast<uint8_t>(storage.reserved >> 8);
  return true;
}

void saveCalibration() {
  CalibrationStorage storage = {};
  storage.magic = CALIBRATION_MAGIC;
  storage.version = CALIBRATION_VERSION;
  storage.reserved = static_cast<uint16_t>(disabledKeys | (invertedKeys << 8));
  for (uint8_t i = 0; i < KEY_COUNT; ++i) storage.profiles[i] = profiles[i];
  storage.checksum = calibrationChecksum(storage);
  EEPROM.put(0, storage);
  EEPROM.commit();
}

void reportCalibration() {
  if (!profilesValid) {
    Serial.println(F("CAL PROFILE MISSING: start calibration"));
    return;
  }
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    const CalibrationProfile &p = profiles[i];
    Serial.print(F("CAL DATA "));
    Serial.print(i);
    Serial.print(' ');
    Serial.print(p.offMedianUs);
    Serial.print(' ');
    Serial.print(p.floatMedianUs);
    Serial.print(' ');
    Serial.print(p.contactMedianUs);
    Serial.print(' ');
    Serial.print(p.thresholdUs);
    Serial.print((disabledKeys & bitOf(i))   ? F(" SKIPPED")
                 : (invertedKeys & bitOf(i)) ? F(" INVERTED")
                                              : F(""));
    Serial.print(F(" ON_MA "));
    Serial.print(p.onMilliamps);
    Serial.print(F(" SIGMA "));
    Serial.print(p.noiseTenthsUs / 10.0f, 1);
    Serial.print(F(" DEPTH "));
    Serial.println(depthPercent[i]);
  }
}

bool keyUsable(uint8_t i) {
  return profilesValid && hasSense(i) && !(disabledKeys & bitOf(i));
}

uint32_t depthChecksum(const DepthStorage &d) {
  uint32_t h = 2166136261UL;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) { h ^= d.percent[i]; h *= 16777619UL; }
  return h;
}

void loadDepths() {
  DepthStorage d = {};
  EEPROM.get(DEPTH_ADDRESS, d);
  const bool ok = d.magic == DEPTH_MAGIC && d.checksum == depthChecksum(d);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    const uint8_t v = d.percent[i];
    depthPercent[i] = (ok && v >= MIN_DEPTH_PERCENT && v <= MAX_DEPTH_PERCENT) ? v : DEFAULT_DEPTH_PERCENT;
  }
}

void saveDepths() {
  DepthStorage d = {};
  d.magic = DEPTH_MAGIC;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) d.percent[i] = depthPercent[i];
  d.checksum = depthChecksum(d);
  EEPROM.put(DEPTH_ADDRESS, d);
  EEPROM.commit();
}

uint16_t thresholdFor(const CalibrationProfile &p, bool falls, uint8_t depth) {
  const float up = p.floatMedianUs;
  float margin = PRESS_SIGMAS * p.noiseTenthsUs / 10.0f;
  if (margin < MIN_MARGIN_US) margin = MIN_MARGIN_US;
  if (margin < MIN_MARGIN_FRACTION * up) margin = MIN_MARGIN_FRACTION * up;
  float offset = depth / 100.0f * fabsf(static_cast<float>(p.contactMedianUs) - up);
  if (offset < margin) offset = margin;
  return static_cast<uint16_t>(up + (falls ? -offset : offset) + 0.5f);
}

void applyDepths() {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (disabledKeys & bitOf(i)) continue;
    profiles[i].thresholdUs = thresholdFor(profiles[i], (invertedKeys & bitOf(i)) != 0, depthPercent[i]);
  }
}

// =====================================================================
// Keys (press detection of listening keys, v10)
// =====================================================================
KeyState keyStates[KEY_COUNT] = {};
uint32_t nextCycleUs = 0;
uint8_t reportedRaised = 0;

void printKeyEvent(const __FlashStringHelper *tag, uint8_t i, bool withProfile) {
  Serial.print(tag);
  Serial.print(i);
  Serial.print(' ');
  Serial.print(static_cast<int>(keyStates[i].tauUs + 0.5f));
  if (withProfile) {
    Serial.print(' ');
    Serial.print(profiles[i].floatMedianUs);
  }
  Serial.print(' ');
  Serial.println(profiles[i].thresholdUs);
}

void resetKey(uint8_t i) {
  KeyState &k = keyStates[i];
  if (k.state == Detect::Pressed) {
    Serial.print(F("UP "));
    Serial.print(i);
    Serial.println(F(" -1"));
  }
  k = {};
  k.tauUs = -1;
}

void keyReading(uint8_t i, float tau, float onMa) {
  KeyState &k = keyStates[i];
  if (tau <= 0 || onMa < MIN_ON_MA) return;
  if (k.state == Detect::Down) {
    k.state = Detect::WaitRelease;
    k.count = 0;
    k.onFiltMa = onMa;
  } else {
    k.onFiltMa += (onMa - k.onFiltMa) / 16.0f;
  }
  k.tauUs = tau;
  if (COMPENSATE_HEATING && profilesValid && profiles[i].onMilliamps > 0) {
    k.tauUs = tau * profiles[i].onMilliamps / k.onFiltMa;
  }
  if (!keyUsable(i)) return;

  const float up = profiles[i].floatHighUs;
  const float reach = fabsf(static_cast<float>(profiles[i].thresholdUs) - up);
  const float away = fabsf(k.tauUs - up);
  const bool pressed = away >= reach;
  const bool released = away <= reach / 2;
  switch (k.state) {
    case Detect::WaitRelease:
      k.count = released ? k.count + 1 : 0;
      if (k.count >= RELEASE_CONFIRMATION_COUNT) {
        k.state = Detect::Ready;
        k.count = 0;
        printKeyEvent(F("ARMED "), i, false);
      }
      break;
    case Detect::Ready:
      k.count = pressed ? k.count + 1 : 0;
      if (k.count >= PRESS_CONFIRMATION_COUNT) {
        k.state = Detect::Pressed;
        k.count = 0;
        printKeyEvent(F("DOWN "), i, true);
      }
      break;
    case Detect::Pressed:
      k.count = released ? k.count + 1 : 0;
      if (k.count >= RELEASE_CONFIRMATION_COUNT) {
        k.state = Detect::Ready;
        k.count = 0;
        Serial.print(F("UP "));
        Serial.print(i);
        Serial.print(' ');
        Serial.println(static_cast<int>(k.tauUs + 0.5f));
      }
      break;
    case Detect::Down:
      break;
  }
}

void resetAllKeys() {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) resetKey(i);
  reportedRaised = 0;
}

// A listening key that is up and not being pushed.
bool listening(uint8_t i) { return coilUp(i) && !voiceBusy(i); }

void updateKeys() {
  uint8_t raised = 0;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (listening(i)) {
      raised |= bitOf(i);
    } else if (keyStates[i].state != Detect::Down) {
      resetKey(i);
    }
  }
  if (raised != reportedRaised) {
    reportedRaised = raised;
    Serial.print(F("RAISED "));
    Serial.println(raised, HEX);
  }
  if (static_cast<int32_t>(micros() - nextCycleUs) < 0) return;
  nextCycleUs = micros() + CYCLE_US;
  uint8_t mask = 0;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) if ((raised & bitOf(i)) && hasSense(i)) mask |= bitOf(i);
  if (!mask) return;
  measureDecay(mask, false);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (mask & bitOf(i)) keyReading(i, fitTau[i], fitOnMa[i]);
  }
}

// =====================================================================
// Statistics for calibration (v10)
// =====================================================================
float sortScratch[POOL_MAX];

void sortFloats(float *values, uint8_t count) {
  for (uint8_t a = 1; a < count; ++a) {
    const float v = values[a];
    int8_t b = a - 1;
    while (b >= 0 && values[b] > v) { values[b + 1] = values[b]; --b; }
    values[b + 1] = v;
  }
}

Robust robustOf(const float *values, uint8_t n) {
  Robust r = {0, 0, 0, 0, n};
  if (n == 0) return r;
  for (uint8_t k = 0; k < n; ++k) sortScratch[k] = values[k];
  sortFloats(sortScratch, n);
  r.median = sortScratch[n / 2];
  r.p10 = sortScratch[n / 10];
  r.p90 = sortScratch[n - 1 - n / 10];
  for (uint8_t k = 0; k < n; ++k) sortScratch[k] = fabsf(values[k] - r.median);
  sortFloats(sortScratch, n);
  r.sigma = 1.4826f * sortScratch[n / 2];
  if (r.sigma < 0.5f) r.sigma = 0.5f;
  return r;
}

float raisedMargin(const Robust &up) {
  float m = PRESS_SIGMAS * up.sigma;
  if (m < MIN_MARGIN_US) m = MIN_MARGIN_US;
  if (m < MIN_MARGIN_FRACTION * up.median) m = MIN_MARGIN_FRACTION * up.median;
  return m;
}

void printRobust(const Robust &r) {
  Serial.print(static_cast<int>(r.median + 0.5f));
  Serial.print(' ');
  Serial.print(static_cast<int>(r.p10 + 0.5f));
  Serial.print(' ');
  Serial.print(static_cast<int>(r.p90 + 0.5f));
}

uint16_t roundUs(float us) { return static_cast<uint16_t>(us + 0.5f); }

void sampleUp(uint8_t i, float *buf, uint8_t &n, float &maSum, uint8_t count) {
  for (uint8_t k = 0; k < count; ++k) {
    if (!coilUp(i) || coilOnLeftMs(i) < 50) break;
    measureDecay(bitOf(i), false);
    if (fitTau[i] > 0 && fitOnMa[i] >= MIN_ON_MA && n < POOL_MAX) {
      buf[n++] = fitTau[i];
      maSum += fitOnMa[i];
    }
    delay(5);
  }
}

void sampleDown(uint8_t i, float *buf, uint8_t &n, float targetMa, uint8_t count) {
  for (uint8_t k = 0; k < count; ++k) {
    const float tau = measureDownTau(i, targetMa);
    if (tau > 0 && n < POOL_MAX) buf[n++] = tau;
    delay(20);
  }
}

// =====================================================================
// Modes
// =====================================================================
Mode mode = Mode::Play;
uint8_t listenMask = 0;
uint32_t lastListenMs = 0;
bool listenRefused = false;

const __FlashStringHelper *modeName(Mode m) {
  switch (m) {
    case Mode::AutoCal: return F("AUTO_CAL");
    case Mode::ManualCal: return F("MANUAL_CAL");
    default: return F("PLAY");
  }
}

bool calibrating() { return mode != Mode::Play; }

// Every mode starts with all keys down.
void setMode(Mode next) {
  if (next == mode) return;
  if (mode == Mode::Play) resetAllKeys();
  releaseAllVoices();
  listenMask = 0;
  wantCoils(0);
  mode = next;
  Serial.print(F("MODE "));
  Serial.println(modeName(mode));
}

void setListen(uint8_t mask) {
  lastListenMs = millis();
  if (mask && !profilesValid) {
    if (!listenRefused) Serial.println(F("LISTEN ERROR: calibration profile missing"));
    listenRefused = true;
    mask = 0;
  }
  if (mask == listenMask) return;
  if (mask & ~listenMask) measureZeros();
  if (!listenMask) nextCycleUs = micros();
  listenMask = mask;
  wantCoils(mask);
}

void stopAll() {
  releaseAllVoices();
  listenMask = 0;
  wantCoils(0);
}

// ---- calibration shared ----
CalibrationProfile working[KEY_COUNT] = {};
uint8_t workingDisabled = 0;
uint8_t workingInverted = 0;
float poolUp[POOL_MAX], poolDown[POOL_MAX];
uint8_t poolUpCount = 0, poolDownCount = 0;
float poolUpMaSum = 0;

void clearPools() {
  poolUpCount = poolDownCount = 0;
  poolUpMaSum = 0;
}

void beginCalibration(Mode calMode) {
  setMode(calMode);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) working[i] = {};
  workingDisabled = 0;
  workingInverted = 0;
  clearPools();
}

void finishCalibration() {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) profiles[i] = working[i];
  disabledKeys = workingDisabled;
  invertedKeys = workingInverted;
  profilesValid = true;
  listenRefused = false;
  applyDepths();
  saveCalibration();
  Serial.println(F("CAL SAVED"));
  reportCalibration();
  setMode(Mode::Play);
}

void cancelCalibration(const __FlashStringHelper *message) {
  if (!calibrating()) return;
  Serial.println(message);
  setMode(Mode::Play);
}

// ---- auto calibration ----
struct {
  AutoStep step;
  uint8_t key;
  uint8_t cycle;
  uint32_t startedMs;
} autoCal;

void finalizeAutoKey(uint8_t i) {
  const Robust up = robustOf(poolUp, poolUpCount);
  const Robust down = robustOf(poolDown, poolDownCount);
  CalibrationProfile &p = working[i];
  p.offMedianUs = roundUs(down.median);
  p.offHighUs = roundUs(down.p90);
  p.floatMedianUs = roundUs(up.median);
  p.floatHighUs = p.floatMedianUs;
  p.contactMedianUs = p.offMedianUs;
  p.noiseTenthsUs = roundUs(up.sigma * 10.0f);
  p.onMilliamps = poolUpCount ? roundUs(poolUpMaSum / poolUpCount) : 0;

  const __FlashStringHelper *reason = nullptr;
  if (!hasSense(i)) reason = F(" NOSENSE");
  else if (up.n < 10 || p.onMilliamps < MIN_ON_MA) reason = F(" NOCURRENT");
  else if (up.sigma > NOISY_FRACTION * up.median) reason = F(" NOISY");

  bool guess = false, falls = true;
  if (!reason) {
    const float margin = raisedMargin(up);
    float downMargin = 2.0f * down.sigma;
    if (downMargin < 4.0f) downMargin = 4.0f;
    const float delta = down.median - up.median;
    if (down.n >= 10 && fabsf(delta) >= margin + downMargin) {
      falls = delta < 0;
    } else {
      guess = true;
      p.contactMedianUs = roundUs(up.median * (1.0f - GUESS_SPAN));
    }
    if (down.n >= 10 && fabsf(delta) > downMargin && margin >= fabsf(delta)) reason = F(" NOISY");
  }
  if (!reason) {
    if (falls) workingInverted |= bitOf(i);
    p.thresholdUs = thresholdFor(p, falls, depthPercent[i]);
  } else {
    workingDisabled |= bitOf(i);
    p.thresholdUs = 0;
  }

  Serial.print(reason ? F("AUTO SKIP ") : F("AUTO KEY "));
  Serial.print(i);
  Serial.print(F(" OFF "));
  printRobust(down);
  Serial.print(F(" FLOAT "));
  printRobust(up);
  if (reason) {
    Serial.println(reason);
    return;
  }
  Serial.print(F(" THRESHOLD "));
  Serial.print(p.thresholdUs);
  Serial.print(falls ? F(" DOWN") : F(" UP"));
  Serial.print(F(" ON_MA "));
  Serial.print(p.onMilliamps);
  Serial.print(F(" SIGMA "));
  Serial.print(up.sigma, 1);
  Serial.println(guess ? F(" GUESS") : F(""));
}

void beginAutoKey(uint8_t i) {
  while (i < KEY_COUNT && !hasSense(i)) {
    clearPools();
    finalizeAutoKey(i);
    ++i;
  }
  if (i >= KEY_COUNT) {
    finishCalibration();
    return;
  }
  autoCal.key = i;
  autoCal.cycle = 0;
  clearPools();
  wantCoils(bitOf(i));
  autoCal.step = AutoStep::Up;
}

void startAutoCalibration() {
  beginCalibration(Mode::AutoCal);
  autoCal.step = AutoStep::Settle;
  autoCal.startedMs = millis();
  Serial.println(F("AUTO START: do not touch the keys"));
}

void updateAutoCalibration() {
  if (millis() - autoCal.startedMs >= AUTO_TIMEOUT_MS) {
    cancelCalibration(F("CAL TIMEOUT: all outputs LOW"));
    return;
  }
  const uint8_t i = autoCal.key;
  switch (autoCal.step) {
    case AutoStep::Settle:
      if (millis() - autoCal.startedMs < DOWN_SETTLE_MS) return;
      measureZeros();
      beginAutoKey(0);
      return;
    case AutoStep::Up:
      if (!coilOnFor(i, CAL_SETTLE_MS)) return;
      sampleUp(i, poolUp, poolUpCount, poolUpMaSum, AUTO_SAMPLE_COUNT);
      wantCoils(0);
      autoCal.step = AutoStep::Down;
      return;
    case AutoStep::Down: {
      if (!coilOffFor(i, DOWN_SETTLE_MS)) return;
      const float target = poolUpCount ? REST_PULSE_TARGET * poolUpMaSum / poolUpCount : 0;
      sampleDown(i, poolDown, poolDownCount, target, AUTO_SAMPLE_COUNT);
      if (++autoCal.cycle < AUTO_CYCLES) {
        wantCoils(bitOf(i));
        autoCal.step = AutoStep::Up;
        return;
      }
      finalizeAutoKey(i);
      beginAutoKey(i + 1);
      return;
    }
  }
}

// ---- manual calibration ----
struct {
  ManualStep step;
  uint8_t key;
  bool captureAsked;
  uint32_t stepMs;
  uint32_t deadlineMs;
} manualCal;
Robust upReadings[KEY_COUNT] = {};
float upMilliamps[KEY_COUNT] = {};

void setManualStep(ManualStep step) {
  manualCal.step = step;
  manualCal.stepMs = millis();
}

void beginManualKey(uint8_t i) {
  while (i < KEY_COUNT && !hasSense(i)) {
    workingDisabled |= bitOf(i);
    Serial.print(F("CAL SKIP "));
    Serial.print(i);
    Serial.println(F(" NOSENSE"));
    ++i;
  }
  if (i >= KEY_COUNT) {
    finishCalibration();
    return;
  }
  manualCal.key = i;
  manualCal.captureAsked = false;
  manualCal.deadlineMs = millis() + MANUAL_TIMEOUT_MS;
  wantCoils(bitOf(i));
  setManualStep(ManualStep::Up);
  Serial.print(F("CAL EXTEND "));
  Serial.println(i);
}

void startManualCalibration() {
  beginCalibration(Mode::ManualCal);
  manualCal.deadlineMs = millis() + MANUAL_TIMEOUT_MS;
  setManualStep(ManualStep::Settle);
  Serial.println(F("CAL MODE START"));
  Serial.println(F("CAL KEEP CLEAR: measuring every key down"));
}

void endManualKey() {
  wantCoils(0);
  setManualStep(ManualStep::Next);
}

void captureManualKey() {
  const uint8_t i = manualCal.key;
  manualCal.captureAsked = false;
  float maSum = 0;
  clearPools();
  sampleUp(i, poolDown, poolDownCount, maSum, MANUAL_SAMPLE_COUNT);
  const Robust pushed = robustOf(poolDown, poolDownCount);
  const Robust &up = upReadings[i];
  const float delta = pushed.median - up.median;
  float pushedMargin = pushed.sigma;
  if (pushedMargin < 4.0f) pushedMargin = 4.0f;
  const float need = raisedMargin(up) + pushedMargin;
  if (up.n < 5 || pushed.n < 5 || fabsf(delta) < need) {
    manualCal.deadlineMs = millis() + MANUAL_TIMEOUT_MS;
    Serial.print(F("CAL RETRY "));
    Serial.print(i);
    Serial.print(F(" FLOAT_HIGH "));
    Serial.print(roundUs(up.median));
    Serial.print(F(" CONTACT_LOW "));
    Serial.print(roundUs(pushed.median));
    Serial.print(F(" NEED "));
    Serial.println(roundUs(need));
    Serial.print(F("CAL PRESS "));
    Serial.println(i);
    return;
  }
  CalibrationProfile &p = working[i];
  if (delta < 0) workingInverted |= bitOf(i);
  p.floatMedianUs = roundUs(up.median);
  p.floatHighUs = p.floatMedianUs;
  p.contactMedianUs = roundUs(pushed.median);
  p.noiseTenthsUs = roundUs(up.sigma * 10.0f);
  p.thresholdUs = thresholdFor(p, delta < 0, depthPercent[i]);
  p.onMilliamps = roundUs(upMilliamps[i]);
  Serial.print(F("CAL CONTACT "));
  Serial.print(i);
  Serial.print(' ');
  printRobust(pushed);
  Serial.print(F(" THRESHOLD "));
  Serial.println(p.thresholdUs);
  endManualKey();
}

void updateManualCalibration() {
  if (static_cast<int32_t>(millis() - manualCal.deadlineMs) >= 0) {
    cancelCalibration(F("CAL TIMEOUT: all outputs LOW"));
    return;
  }
  const uint8_t i = manualCal.key;
  switch (manualCal.step) {
    case ManualStep::Settle:
      if (millis() - manualCal.stepMs < DOWN_SETTLE_MS) return;
      measureZeros();
      for (uint8_t k = 0; k < KEY_COUNT; ++k) {
        clearPools();
        if (hasSense(k)) sampleDown(k, poolDown, poolDownCount, 0, AUTO_SAMPLE_COUNT);
        const Robust down = robustOf(poolDown, poolDownCount);
        working[k].offMedianUs = roundUs(down.median);
        working[k].offHighUs = roundUs(down.p90);
        Serial.print(F("CAL OFF "));
        Serial.print(k);
        Serial.print(' ');
        printRobust(down);
        Serial.println();
      }
      beginManualKey(0);
      return;
    case ManualStep::Up: {
      if (!coilOnFor(i, CAL_SETTLE_MS)) return;
      float maSum = 0;
      clearPools();
      sampleUp(i, poolUp, poolUpCount, maSum, MANUAL_SAMPLE_COUNT);
      upReadings[i] = robustOf(poolUp, poolUpCount);
      upMilliamps[i] = poolUpCount ? maSum / poolUpCount : 0;
      working[i].floatMedianUs = roundUs(upReadings[i].median);
      working[i].floatHighUs = working[i].floatMedianUs;
      Serial.print(F("CAL FLOAT "));
      Serial.print(i);
      Serial.print(' ');
      printRobust(upReadings[i]);
      Serial.println(upReadings[i].n < 5 ? F(" NOCURRENT") : F(""));
      Serial.print(F("CAL PRESS "));
      Serial.println(i);
      setManualStep(ManualStep::Push);
      return;
    }
    case ManualStep::Push:
      if (manualCal.captureAsked && coilOnFor(i, CAL_SETTLE_MS) &&
          coilOnLeftMs(i) >= CAPTURE_WINDOW_MS) {
        captureManualKey();
      }
      return;
    case ManualStep::Next:
      if (millis() - manualCal.stepMs >= CAL_BETWEEN_MS) beginManualKey(i + 1);
      return;
  }
}

// =====================================================================
// Host link
// =====================================================================
char line[96];
uint8_t lineLength = 0;

// The next word of *p into out (upper-cased if asked).
void nextWord(char *&p, char *out, uint8_t size, bool upper) {
  while (*p == ' ' || *p == ',') ++p;
  uint8_t n = 0;
  while (*p && *p != ' ' && *p != ',') {
    char c = *p++;
    if (upper && c >= 'a' && c <= 'z') c -= 32;
    if (n < size - 1) out[n++] = c;
  }
  out[n] = '\0';
}

long nextNumber(char *&p, long fallback, int base) {
  while (*p == ' ' || *p == ',') ++p;
  if (*p == '\0') return fallback;
  char *end;
  const long value = strtol(p, &end, base);
  if (end == p) return fallback;
  p = end;
  return value < 0 ? 0 : value;
}

int keyIndex(const char *token) {
  if (token[0] >= '0' && token[0] <= '7' && token[1] == '\0') return token[0] - '0';
  char c = token[0];
  if (c >= 'A' && c <= 'Z') c += 32;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) if (c == KEY_CHAR[i]) return i;
  return -1;
}

void reportSense() {
  Serial.print(F("SENSE"));
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    const KeyState &k = keyStates[i];
    const bool live = listening(i) && k.state != Detect::Down && k.tauUs > 0;
    Serial.print(' ');
    Serial.print(live ? static_cast<int>(k.tauUs + 0.5f) : 0);
    Serial.print('/');
    Serial.print(keyUsable(i) ? profiles[i].thresholdUs : 0);
  }
  Serial.println();
}

void onDepth(long percent, int key) {
  if (percent < MIN_DEPTH_PERCENT) percent = MIN_DEPTH_PERCENT;
  if (percent > MAX_DEPTH_PERCENT) percent = MAX_DEPTH_PERCENT;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (key < 0 || key == i) depthPercent[i] = static_cast<uint8_t>(percent);
  }
  saveDepths();
  if (profilesValid) {
    applyDepths();
    saveCalibration();
  }
  Serial.print(F("DEPTH "));
  Serial.println(percent);
  reportCalibration();
}

void runCommand(char *p) {
  char word[10];
  nextWord(p, word, sizeof(word), true);
  if (word[0] == '\0') return;

  if (!strcmp(word, "X")) {
    if (calibrating()) cancelCalibration(F("CAL CANCELLED"));
    else stopAll();
  } else if (!strcmp(word, "V")) {
    Serial.println(F("VERSION KEYCAP-LAB-v2"));
  } else if (!strcmp(word, "SENSE") || !strcmp(word, "?")) {
    reportSense();
  } else if (!strcmp(word, "PROFILE")) {
    reportCalibration();
  } else if (!strcmp(word, "CANCEL")) {
    cancelCalibration(F("CAL CANCELLED"));
  } else if (!strcmp(word, "NEXT") || !strcmp(word, "SKIP")) {
    if (mode != Mode::ManualCal || manualCal.step != ManualStep::Push) {
      Serial.println(F("CAL NOT READY"));
    } else if (word[0] == 'N') {
      manualCal.captureAsked = true;
      manualCal.deadlineMs = millis() + MANUAL_TIMEOUT_MS;
    } else {
      workingDisabled |= bitOf(manualCal.key);
      working[manualCal.key].thresholdUs = 0;
      Serial.print(F("CAL SKIP "));
      Serial.println(manualCal.key);
      endManualKey();
    }
  } else if (calibrating()) {
    Serial.println(F("CAL BUSY"));  // pushes, listening and new calibrations wait
  } else if (!strcmp(word, "AUTO")) {
    startAutoCalibration();
  } else if (!strcmp(word, "MANUAL")) {
    startManualCalibration();
  } else if (!strcmp(word, "DEPTH")) {
    const long pct = nextNumber(p, DEFAULT_DEPTH_PERCENT, 10);
    char token[4];
    nextWord(p, token, sizeof(token), false);
    onDepth(pct, token[0] ? keyIndex(token) : -1);
  } else if (!strcmp(word, "P")) {
    char token[4];
    nextWord(p, token, sizeof(token), false);
    const int i = keyIndex(token);
    if (i < 0) {
      Serial.println(F("ERROR key"));
      return;
    }
    const long ms = nextNumber(p, 80, 10);
    const long duty = nextNumber(p, 100, 10);
    const long kick = nextNumber(p, 0, 10);
    const long hz = nextNumber(p, 0, 10);
    startVoice(i, ms, duty, kick, hz, true);
  } else if (!strcmp(word, "F")) {
    const long ms = nextNumber(p, 150, 10);
    const long kick = nextNumber(p, 0, 10);
    for (uint8_t i = 0; i < KEY_COUNT; ++i) {
      const long duty = nextNumber(p, 0, 10);
      if (duty > 0) startVoice(i, ms, duty, kick, 0, false);
      else releaseVoice(i, micros());
    }
  } else if (!strcmp(word, "U")) {
    setListen(static_cast<uint8_t>(nextNumber(p, 0, 16) & 0xFF));
  } else {
    Serial.println(F("ERROR command"));
  }
}

void readHost() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n' || c == '\r') {
      line[lineLength] = '\0';
      if (lineLength) runCommand(line);
      lineLength = 0;
    } else if (lineLength < sizeof(line) - 1) {
      line[lineLength++] = c;
    }
  }
}

void checkListenTimeout() {
  if (mode == Mode::Play && listenMask && millis() - lastListenMs >= LISTEN_TIMEOUT_MS) {
    Serial.println(F("TIMEOUT"));
    listenMask = 0;
    wantCoils(0);
  }
}

// =====================================================================
// setup / loop
// =====================================================================
void setup() {
  pinMode(SER_PIN, OUTPUT);
  pinMode(SHIFT_CLOCK_PIN, OUTPUT);
  pinMode(LATCH_CLOCK_PIN, OUTPUT);
  gpio_put(SER_PIN, 0);
  gpio_put(SHIFT_CLOCK_PIN, 0);
  gpio_put(LATCH_CLOCK_PIN, 0);
  writeShiftRegisters(0);  // everything off
  lastOut = 0;
  pinMode(MCP_CS_PIN, OUTPUT);
  digitalWrite(MCP_CS_PIN, HIGH);
  SPI.setRX(MCP_MISO_PIN);
  SPI.setTX(MCP_MOSI_PIN);
  SPI.setSCK(MCP_SCK_PIN);
  SPI.begin(false);  // CS is driven by hand

  Serial.begin(115200);
  EEPROM.begin(EEPROM_SIZE);
  loadDepths();
  profilesValid = loadCalibration();
  if (profilesValid) applyDepths();
  statusLed.begin();
  statusLed.setBrightness(32);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    enterCoil(i, Coil::Off);
    keyStates[i].tauUs = -1;
  }
  lastHeatMs = millis();
  writeOutputs();

  delay(250);
  measureZeros();
  Serial.println(F("READY KEYCAP-LAB-v2"));
  Serial.println(F("MODE PLAY"));
  reportCalibration();
}

void loop() {
  readHost();
  updateHeat();
  serviceCoils();
  switch (mode) {
    case Mode::Play: updateKeys(); break;
    case Mode::AutoCal: updateAutoCalibration(); break;
    case Mode::ManualCal: updateManualCalibration(); break;
  }
  serviceCoils();
  writeOutputs();
  checkListenTimeout();
}
