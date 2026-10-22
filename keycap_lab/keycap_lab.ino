/*
 * Keycap Lab v4: eight solenoid keycaps that push the fingers resting on
 * them (push), and raise keys and wait for a finger to push them down (INPUT)
 * Board: Raspberry Pi Pico / Pico 2 W (Arduino-Pico core)
 *   Tools > USB Stack: "Pico SDK" (the default). The board is then a USB
 *   serial port and a USB keyboard at the same time.
 * Protocol: KEYCAP-LAB-v4, USB Serial (115200), one text command per line
 *
 * keycap_lab/index.html drives it. Wiring as v10 / v2:
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
 *   push   P / F: the board drives the key (a strike or a tremble), always at
 *          full strength (no PWM, so the coils do not whine). Any duty above 0
 *          means full, 0 releases. A key that stops is braked for 5 ms.
 *   knock  K key: a short push (150 ms) on a key that is not raised: the
 *          waiting screen's heartbeat. From the current during the push the
 *          board tells whether a finger holds the key down (the plunger cannot
 *          rise): then it types the key on the USB keyboard, as a press.
 *   INPUT  U mask: the keys in mask rise (80 ms apart) and stay up. A finger
 *          pushing a raised key down is typed as that key on the USB keyboard
 *          (a s d f j k l ;, lower case: no Shift) and reported as DOWN on the
 *          serial port. The page sends U again every 200 ms (a heartbeat);
 *          after 500 ms without U, every raised key drops (TIMEOUT).
 * A push on a raised key takes over: the key is not read while it is pushed
 * and for 150 ms after, so the board never types its own strikes.
 * At most 3 keys are raised at once (the supply cannot hold more): U with more
 * keys raises the first 3 and prints ERROR.
 *
 * Knock: is the key held down?
 *   The mean current of the knocked key in four windows after it is switched
 *   on (2-10, 10-25, 25-50, 50-100 ms) is compared with the same key's usual
 *   (free) knocks. The first 3 knocks of each key after power-on (or KLEARN)
 *   are taken as free and learned; later free knocks keep updating it.
 *   held = some window is off by more than KSIGMAS x its usual spread, and by
 *   at least KMINMA mA (5 and 6.0 mA; set with KSIGMAS / KMINMA).
 *
 * INPUT: how a press is read (CFI_sdf_press_test, for any of the 8 keys)
 *   Only the current is read; the coil is simply on (no braking, no pulses).
 *   bump = fast average (3 ms) - slow average (300 ms) of the current: while
 *   the plunger moves, the current bumps up a little.
 *   Each key goes through these phases (the number is what STREAM prints):
 *     0 OFF       not raised
 *     1 RISING    the key has just risen: nothing is read for 300 ms
 *     2 LEARN     first rise after power-on (or LEARN) only: the noise of the
 *                 bump (sigma) is learned for 1.5 s. Do not push the key then.
 *     3 WAIT_CALM the bump must stay under threshold / 2 for 100 ms
 *     4 READY     the bump over the threshold for 2 ms = a press -> PRESSED
 *     5 PRESSED   the bump at -threshold / 2 (let go), or 600 ms quiet -> WAIT_CALM
 *   threshold = SIGMAS x sigma, and at least MIN_MA (6 and 1.0 mA; set with
 *   SIGMAS / MINMA). sigma keeps learning slowly while the key is calm, and
 *   is kept while the key is down (the next rise starts at WAIT_CALM).
 *   While pressed, the slow average follows ten times more slowly, so the
 *   press itself is not swallowed.
 *   Whenever any coil switches (another key rises or drops, a push, a rest),
 *   every raised key stops reading for 40 ms and takes the current as its new
 *   level, so the switching is not read as a press.
 *
 * Host -> board (one line each; key = 0..7 or a s d f j k l ;)
 *   P key ms [duty=100] [kick=0] [hz=0]
 *       push one key for ms (max 5000). hz: on/off at hz after kick ms.
 *   F ms kick d0 d1 d2 d3 d4 d5 d6 d7
 *       push all eight at once: d > 0 keeps a key going ms more, 0 releases.
 *   K key [ms]  knock: push the key for ms (default 150) and tell whether it is held
 *   KSIGMAS x / KMINMA x / KLEARN   knock: how far off counts as held / learn again
 *   U mask      INPUT: raise the keys in mask (hex, bit 0 = A) and read them
 *               (3 keys at most). Send it every 200 ms. U 0 drops them.
 *   X           stop: every key down
 *   SIGMAS x [key]   threshold = x sigma (2..30, default 6), all keys or one
 *   MINMA x [key]    threshold at least x mA (0.1..50, default 1.0)
 *   LEARN [key]      learn the noise again at the next rise (do not touch)
 *   HID 0|1          type presses on the USB keyboard (default 1)
 *   STREAM 0|1       print the readings every 10 ms (press_viewer.html)
 *   SENSE / ?        print noise, threshold and the largest bump since last time
 *   V                print the version
 * Board -> host
 *   READY KEYCAP-LAB-v4 (at boot) / VERSION KEYCAP-LAB-v4
 *   MODE INPUT | MODE PLAY           some keys raised for input / none
 *   RAISED mask                      keys up and read now (hex)
 *   LEARNED key sigma threshold      noise learned (mA)
 *   ARMED key                        calm: a press now counts
 *   DOWN key bump threshold          pushed down (also typed on the keyboard)
 *   UP key                           let go (UP key -1: the key dropped meanwhile)
 *   KNOCK key LEARN|FREE|HELD score f1 f2 f3 f4   a knock (score >= 1 = held; f = mean mA)
 *   KNOCK key REST                   the key is resting (heat guard): no knock
 *   REST key / AWAKE key             heat guard (below)
 *   TIMEOUT                          no U for 500 ms: raised keys dropped
 *   SENSE key phase sigma threshold peak mA
 *   S mask  bump threshold phase mA  (x8, STREAM)
 *
 * Heat guard: each key collects heat while driven and loses it five times as
 * fast while off. At 6 s of heat the key rests until it has cooled (6 s on ->
 * 1.2 s off), printing REST and AWAKE. A raised key comes back up by itself.
 * (The solenoid's datasheet allows 10 s; the page keeps an input window at 5 s.)
 *
 * KEYCAP-LAB-v2's tau sensing and calibration (AUTO, MANUAL, DEPTH, PROFILE)
 * are gone: the current alone is read, and nothing has to be calibrated.
 *
 * Requires the Adafruit NeoPixel library.
 */

#include <Adafruit_NeoPixel.h>
#include <Keyboard.h>
#include <SPI.h>
#include <hardware/gpio.h>
#include <math.h>
#include <stdlib.h>

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
constexpr uint32_t MAX_DRIVE_MS = 5000;
constexpr uint32_t VOICE_BRAKE_US = 5000;
constexpr uint32_t AFTER_PUSH_MS = 150;     // a pushed key is not read this long after

// Heat guard
constexpr float HEAT_LIMIT_MS = 6000.0f;   // datasheet: under 10 s. An input window is 5 s
constexpr float COOL_RATE = 5.0f;

// INPUT: raising
constexpr uint32_t STAGGER_MS = 80;         // raised keys rise this far apart
constexpr uint32_t BRAKE_MS = 5;            // a raised key that drops is braked this long
constexpr uint32_t LISTEN_TIMEOUT_MS = 500; // no U this long: every raised key drops
constexpr uint8_t MAX_RAISED = 3;           // the supply cannot hold more keys up at once

// Knock: is the key held down? (the waiting screen's heartbeat)
constexpr uint32_t DEFAULT_KNOCK_MS = 150;
constexpr uint8_t KNOCK_WINDOWS = 4;
const float KNOCK_EDGE_MS[KNOCK_WINDOWS + 1] = {2, 10, 25, 50, 100};
constexpr uint8_t KNOCK_LEARN = 3;          // the first knocks are taken as free
constexpr float KNOCK_FOLLOW = 0.2f;        // free knocks keep the usual shape up to date
constexpr float DEFAULT_KNOCK_SIGMAS = 5.0f;
constexpr float DEFAULT_KNOCK_MIN_MA = 6.0f;
constexpr float MIN_KNOCK_DEV_MA = 0.3f;

// INPUT: reading a press (CFI_sdf_press_test)
constexpr float MA_PER_COUNT = 3.3f / 4095.0f * 2.0f / 1.0f * 1000.0f;  // divider x2, 1 ohm
constexpr float FAST_MS = 3.0f;
constexpr float SLOW_MS = 300.0f;
constexpr float DEFAULT_SIGMAS = 6.0f;      // threshold = 6 x noise (smaller = more sensitive)
constexpr float DEFAULT_MIN_MA = 1.0f;      // and at least this
constexpr float MIN_NOISE_SQ = 0.01f;       // sigma at least 0.1 mA
constexpr float CONFIRM_MS = 2.0f;          // over the threshold this long = a press
constexpr uint32_t QUIET_RELEASE_MS = 600;  // pressed and still this long = let go
constexpr uint32_t CALM_MS = 100;           // calm this long before the next press
constexpr uint32_t RISE_MS = 300;           // after a key rises, nothing is read
constexpr uint32_t LEARN_MS = 1500;         // first rise: the noise is learned this long
constexpr uint32_t DISTURB_MS = 40;         // after any coil switches, nothing is read
constexpr uint32_t STREAM_US = 10000;

// =====================================================================
// Types (all before any function, for the Arduino IDE's prototypes)
// =====================================================================
enum Drive : uint8_t { DRIVE_OFF = 0, DRIVE_ON = 1, DRIVE_BRAKE = 3 };

struct Voice {  // a push
  bool active;
  bool braking;
  uint8_t duty;     // 100 while pushing (kept for the heat guard)
  uint32_t startUs;
  uint32_t durUs;
  uint32_t kickUs;
  uint32_t halfUs;  // half period of the tremble, 0 = none
  uint32_t brakeUntilUs;
  uint32_t endMs;   // when it last stopped, 0 = never
};

enum class Coil : uint8_t { Off, On, Braking };
struct CoilState {  // a raised key
  Coil state;
  bool wanted;
  uint32_t sinceMs;
};

enum class Sense : uint8_t { Off, Rising, Learn, WaitCalm, Ready, Pressed };
struct Sensor {
  Sense phase;
  bool init;
  bool learned;
  float fast, slow, bump, peak, ma;
  float sumSq;      // LEARN
  uint32_t count;
  float noiseSq;    // kept while the key is down
  uint32_t lastUs, overSinceUs, calmSinceMs, phaseMs;
};

struct Knock {
  bool active;
  uint8_t key;
  uint32_t startUs;
  float sum[KNOCK_WINDOWS];
  uint16_t n[KNOCK_WINDOWS];
};
struct KnockBase {
  uint8_t count;
  float mean[KNOCK_WINDOWS];
  float dev[KNOCK_WINDOWS];
};

Adafruit_NeoPixel statusLed(1, LED_PIN, NEO_GRB + NEO_KHZ800);

uint8_t bitOf(uint8_t i) { return static_cast<uint8_t>(1U << i); }
bool hasSense(uint8_t i) { return ADC_CHANNEL[i] >= 0; }

// =====================================================================
// Outputs: pushes and raised keys -> shift registers
// =====================================================================
Voice voices[KEY_COUNT] = {};
CoilState coils[KEY_COUNT] = {};
float heatMs[KEY_COUNT] = {};
uint8_t restingKeys = 0;
uint32_t lastOut = 0xFFFFFFFFUL;
uint32_t lastSwitchMs = 0;  // when any coil last switched (INPUT ignores it for DISTURB_MS)
bool ledOn = true;
uint32_t lastTurnOnMs = 0;
uint32_t lastHeatMs = 0;

inline void settle() {
  for (uint8_t i = 0; i < 8; ++i) asm volatile("nop");
}

// Fast bit-banged shiftOut.
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
  return v.active || v.braking || (v.endMs && millis() - v.endMs < AFTER_PUSH_MS);
}

Drive driveOf(uint8_t i, uint32_t nowUs) {
  Voice &v = voices[i];
  if (v.active) {
    const uint32_t elapsed = nowUs - v.startUs;
    if (elapsed >= v.durUs) {
      releaseVoice(i, nowUs);
    } else {
      bool on = true;
      if (elapsed >= v.kickUs && v.halfUs) on = ((elapsed - v.kickUs) / v.halfUs) % 2 == 0;
      return on ? DRIVE_ON : DRIVE_BRAKE;
    }
  }
  if (coils[i].state == Coil::On) {  // a raised key goes straight back up after a push
    v.braking = false;
    return DRIVE_ON;
  }
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
    lastSwitchMs = millis();
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
  v.duty = 100;  // any duty above 0 is full strength (no PWM)
  v.active = true;
  v.braking = false;
}

// ---- raised keys (the time limit is the heat guard) ----
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
// INPUT: reading a press from the current of a raised key
// =====================================================================
Sensor sensors[KEY_COUNT] = {};
float sigmas[KEY_COUNT];
float minMa[KEY_COUNT];
bool hidOn = true;
bool streaming = false;
uint32_t nextStreamUs = 0;
uint8_t listenMask = 0;
uint32_t lastListenMs = 0;
uint8_t reportedRaised = 0;

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

float thresholdOf(uint8_t i) {
  const float t = sigmas[i] * sqrtf(sensors[i].noiseSq);
  return t < minMa[i] ? minMa[i] : t;
}

void enterSense(uint8_t i, Sense p) {
  sensors[i].phase = p;
  sensors[i].phaseMs = millis();
}

// A key that is up for input, and not being pushed.
bool reading(uint8_t i) {
  return hasSense(i) && (listenMask & bitOf(i)) && coils[i].state == Coil::On && !voiceBusy(i);
}

void reportPress(uint8_t i, float thr) {
  if (hidOn) Keyboard.write(KEY_CHAR[i]);  // lower case: no Shift
  Serial.print(F("DOWN "));
  Serial.print(i);
  Serial.print(' ');
  Serial.print(sensors[i].bump, 2);
  Serial.print(' ');
  Serial.println(thr, 2);
}

void reportRelease(uint8_t i, bool dropped) {
  Serial.print(F("UP "));
  Serial.print(i);
  Serial.println(dropped ? F(" -1") : F(""));
}

void stopReading(uint8_t i) {
  Sensor &s = sensors[i];
  if (s.phase == Sense::Pressed) reportRelease(i, true);
  s.phase = Sense::Off;  // an interrupted LEARN is done again at the next rise
  s.init = false;
}

void sampleKey(uint8_t i) {
  Sensor &s = sensors[i];
  const uint32_t nowUs = micros();
  const uint32_t nowMs = millis();
  const float ma = mcpRead(static_cast<uint8_t>(ADC_CHANNEL[i])) * MA_PER_COUNT;
  s.ma = ma;
  if (s.phase == Sense::Off) {
    enterSense(i, Sense::Rising);
    s.init = false;
  }
  if (!s.init) {
    s.fast = s.slow = ma;
    s.bump = 0;
    s.lastUs = nowUs;
    s.overSinceUs = 0;
    s.calmSinceMs = nowMs;
    s.init = true;
    return;
  }
  const float dtMs = (nowUs - s.lastUs) / 1000.0f;
  s.lastUs = nowUs;
  const float a = dtMs / FAST_MS;
  s.fast += (ma - s.fast) * (a > 1 ? 1 : a);

  if (s.phase == Sense::Rising) {               // still rising: no bump
    s.slow = s.fast;
    s.bump = 0;
    s.calmSinceMs = nowMs;
    if (nowMs - s.phaseMs >= RISE_MS) {
      if (s.learned) {
        enterSense(i, Sense::WaitCalm);
      } else {
        s.sumSq = 0;
        s.count = 0;
        enterSense(i, Sense::Learn);
      }
    }
    return;
  }
  if (nowMs - lastSwitchMs < DISTURB_MS) {      // a coil just switched: take the new level
    s.slow = s.fast;
    s.bump = 0;
    s.overSinceUs = 0;
    s.calmSinceMs = nowMs;
    return;
  }

  const bool pushing = s.phase == Sense::Pressed || s.overSinceUs;
  const float b = dtMs / (pushing ? SLOW_MS * 10 : SLOW_MS);
  s.slow += (ma - s.slow) * (b > 1 ? 1 : b);
  s.bump = s.fast - s.slow;
  if (fabsf(s.bump) > s.peak) s.peak = fabsf(s.bump);

  if (s.phase == Sense::Learn) {                // first rise only
    s.sumSq += s.bump * s.bump;
    s.count++;
    if (nowMs - s.phaseMs >= LEARN_MS) {
      s.noiseSq = s.count ? s.sumSq / s.count : MIN_NOISE_SQ;
      if (s.noiseSq < MIN_NOISE_SQ) s.noiseSq = MIN_NOISE_SQ;
      s.learned = true;
      Serial.print(F("LEARNED "));
      Serial.print(i);
      Serial.print(' ');
      Serial.print(sqrtf(s.noiseSq), 2);
      Serial.print(' ');
      Serial.println(thresholdOf(i), 2);
      enterSense(i, Sense::WaitCalm);
      s.calmSinceMs = nowMs;
    }
    return;
  }

  const float thr = thresholdOf(i);
  const bool calm = fabsf(s.bump) < thr / 2;
  if (!calm) s.calmSinceMs = nowMs;
  if (calm && s.phase != Sense::Pressed) {      // keep learning the noise
    s.noiseSq += (s.bump * s.bump - s.noiseSq) * (dtMs / 2000.0f);
    if (s.noiseSq < MIN_NOISE_SQ) s.noiseSq = MIN_NOISE_SQ;
  }

  switch (s.phase) {
    case Sense::WaitCalm:
      if (nowMs - s.calmSinceMs >= CALM_MS) {
        enterSense(i, Sense::Ready);
        Serial.print(F("ARMED "));
        Serial.println(i);
      }
      break;
    case Sense::Ready:
      if (s.bump >= thr) {
        if (!s.overSinceUs) s.overSinceUs = nowUs | 1U;
        if ((nowUs - s.overSinceUs) / 1000.0f >= CONFIRM_MS) {
          s.overSinceUs = 0;
          enterSense(i, Sense::Pressed);
          reportPress(i, thr);
        }
      } else {
        s.overSinceUs = 0;
      }
      break;
    case Sense::Pressed:
      if (s.bump <= -thr / 2 || nowMs - s.calmSinceMs >= QUIET_RELEASE_MS) {
        enterSense(i, Sense::WaitCalm);
        s.calmSinceMs = nowMs;
        reportRelease(i, false);
      }
      break;
    default:
      break;
  }
}

void printStream(uint8_t raised) {
  Serial.print(F("S "));
  Serial.print(raised, HEX);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    const Sensor &s = sensors[i];
    const bool live = raised & bitOf(i);
    Serial.print(' ');
    Serial.print(live ? s.bump : 0.0f, 2);
    Serial.print(' ');
    Serial.print(thresholdOf(i), 2);
    Serial.print(' ');
    Serial.print(static_cast<int>(s.phase));
    Serial.print(' ');
    Serial.print(live ? static_cast<int>(s.ma + 0.5f) : 0);
  }
  Serial.println();
}

void updateInput() {
  uint8_t raised = 0;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    if (reading(i)) {
      sampleKey(i);
      raised |= bitOf(i);
    } else if (sensors[i].phase != Sense::Off) {
      stopReading(i);
    }
  }
  if (raised != reportedRaised) {
    reportedRaised = raised;
    Serial.print(F("RAISED "));
    Serial.println(raised, HEX);
  }
  if (streaming && static_cast<int32_t>(micros() - nextStreamUs) >= 0) {
    nextStreamUs = micros() + STREAM_US;
    printStream(raised);
  }
}

void reportSense() {
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    Sensor &s = sensors[i];
    Serial.print(F("SENSE "));
    Serial.print(i);
    Serial.print(' ');
    Serial.print(static_cast<int>(s.phase));
    Serial.print(' ');
    Serial.print(s.learned ? sqrtf(s.noiseSq) : 0.0f, 2);
    Serial.print(' ');
    Serial.print(thresholdOf(i), 2);
    Serial.print(' ');
    Serial.print(s.peak, 2);
    Serial.print(' ');
    Serial.println(reportedRaised & bitOf(i) ? static_cast<int>(s.ma + 0.5f) : 0);
    s.peak = 0;
  }
}

// =====================================================================
// Knock: a short push on a key that is not raised. Held down = a press
// =====================================================================
Knock knock = {};
KnockBase knockBase[KEY_COUNT] = {};
float knockSigmas = DEFAULT_KNOCK_SIGMAS;
float knockMinMa = DEFAULT_KNOCK_MIN_MA;

void startKnock(uint8_t i, uint32_t ms) {
  if (knock.active || !hasSense(i)) return;
  if (listenMask & bitOf(i)) {
    Serial.println(F("ERROR knock: the key is raised"));
    return;
  }
  if (ms < KNOCK_EDGE_MS[KNOCK_WINDOWS]) ms = static_cast<uint32_t>(KNOCK_EDGE_MS[KNOCK_WINDOWS]);
  startVoice(i, ms, 100, 0, 0, true);
  if (!voices[i].active) {
    Serial.print(F("KNOCK "));
    Serial.print(i);
    Serial.println(F(" REST"));
    return;
  }
  writeOutputs();
  knock = {};
  knock.active = true;
  knock.key = i;
  knock.startUs = micros();
}

void printKnock(uint8_t i, const __FlashStringHelper *verdict, float score, const float *f) {
  Serial.print(F("KNOCK "));
  Serial.print(i);
  Serial.print(' ');
  Serial.print(verdict);
  Serial.print(' ');
  Serial.print(score, 2);
  for (uint8_t w = 0; w < KNOCK_WINDOWS; ++w) {
    Serial.print(' ');
    Serial.print(f[w], 1);
  }
  Serial.println();
}

void finishKnock() {
  const uint8_t i = knock.key;
  knock.active = false;
  float f[KNOCK_WINDOWS];
  for (uint8_t w = 0; w < KNOCK_WINDOWS; ++w) {
    if (!knock.n[w]) return;  // cut short (stopped, or the key rested): no verdict
    f[w] = knock.sum[w] / knock.n[w];
  }
  KnockBase &b = knockBase[i];
  if (b.count < KNOCK_LEARN) {  // learn the usual (free) shape
    ++b.count;
    for (uint8_t w = 0; w < KNOCK_WINDOWS; ++w) {
      if (b.count == 1) {
        b.mean[w] = f[w];
        b.dev[w] = MIN_KNOCK_DEV_MA;
        continue;
      }
      const float d = f[w] - b.mean[w];
      b.mean[w] += d / b.count;
      b.dev[w] += (fabsf(d) - b.dev[w]) / (b.count - 1);
      if (b.dev[w] < MIN_KNOCK_DEV_MA) b.dev[w] = MIN_KNOCK_DEV_MA;
    }
    printKnock(i, F("LEARN"), 0, f);
    return;
  }
  float score = 0;
  for (uint8_t w = 0; w < KNOCK_WINDOWS; ++w) {
    float limit = knockSigmas * b.dev[w];
    if (limit < knockMinMa) limit = knockMinMa;
    const float sc = fabsf(f[w] - b.mean[w]) / limit;
    if (sc > score) score = sc;
  }
  if (score >= 1.0f) {
    if (hidOn) Keyboard.write(KEY_CHAR[i]);  // held down: a press
    printKnock(i, F("HELD"), score, f);
    return;
  }
  for (uint8_t w = 0; w < KNOCK_WINDOWS; ++w) {
    const float d = f[w] - b.mean[w];
    b.mean[w] += KNOCK_FOLLOW * d;
    b.dev[w] += KNOCK_FOLLOW * (fabsf(d) - b.dev[w]);
    if (b.dev[w] < MIN_KNOCK_DEV_MA) b.dev[w] = MIN_KNOCK_DEV_MA;
  }
  printKnock(i, F("FREE"), score, f);
}

void updateKnock() {
  if (!knock.active) return;
  const float el = (micros() - knock.startUs) / 1000.0f;
  if (el >= KNOCK_EDGE_MS[KNOCK_WINDOWS] || !voices[knock.key].active) {
    finishKnock();
    return;
  }
  if (el < KNOCK_EDGE_MS[0]) return;
  uint8_t w = 0;
  while (w < KNOCK_WINDOWS - 1 && el >= KNOCK_EDGE_MS[w + 1]) ++w;
  knock.sum[w] += mcpRead(static_cast<uint8_t>(ADC_CHANNEL[knock.key])) * MA_PER_COUNT;
  ++knock.n[w];
}

// =====================================================================
// Modes: PLAY (pushes only) / INPUT (some keys raised for input)
// =====================================================================
uint8_t firstKeys(uint8_t mask, uint8_t n) {
  uint8_t out = 0;
  for (uint8_t i = 0; i < KEY_COUNT && n; ++i) if (mask & bitOf(i)) { out |= bitOf(i); --n; }
  return out;
}

void setListen(uint8_t mask) {
  lastListenMs = millis();
  if (__builtin_popcount(mask) > MAX_RAISED) {
    mask = firstKeys(mask, MAX_RAISED);
    static uint32_t lastWarnMs = 0;
    if (millis() - lastWarnMs > 2000) { lastWarnMs = millis(); Serial.println(F("ERROR max 3 keys")); }
  }
  if (mask == listenMask) return;
  const bool wasInput = listenMask != 0;
  listenMask = mask;
  wantCoils(mask);
  if (wasInput != (mask != 0)) Serial.println(mask ? F("MODE INPUT") : F("MODE PLAY"));
}

void stopAll() {
  knock.active = false;
  releaseAllVoices();
  setListen(0);
}

void checkListenTimeout() {
  if (listenMask && millis() - lastListenMs >= LISTEN_TIMEOUT_MS) {
    Serial.println(F("TIMEOUT"));
    setListen(0);
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

float nextFloat(char *&p, float fallback) {
  while (*p == ' ' || *p == ',') ++p;
  if (*p == '\0') return fallback;
  char *end;
  const float value = strtof(p, &end);
  if (end == p) return fallback;
  p = end;
  return value;
}

int keyIndex(const char *token) {
  if (token[0] >= '0' && token[0] <= '7' && token[1] == '\0') return token[0] - '0';
  char c = token[0];
  if (c >= 'A' && c <= 'Z') c += 32;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) if (c == KEY_CHAR[i]) return i;
  return -1;
}

// "x [key]": the value for every key, or for one.
void setPerKey(char *&p, float *values, float lo, float hi, const __FlashStringHelper *name) {
  float v = nextFloat(p, -1);
  if (v < 0) {
    Serial.print(F("ERROR "));
    Serial.println(name);
    return;
  }
  if (v < lo) v = lo;
  if (v > hi) v = hi;
  char token[4];
  nextWord(p, token, sizeof(token), false);
  const int key = token[0] ? keyIndex(token) : -1;
  for (uint8_t i = 0; i < KEY_COUNT; ++i) if (key < 0 || key == i) values[i] = v;
  Serial.print(name);
  Serial.print(' ');
  Serial.print(v, 2);
  if (key >= 0) {
    Serial.print(' ');
    Serial.print(key);
  }
  Serial.println();
}

void runCommand(char *p) {
  char word[10];
  nextWord(p, word, sizeof(word), true);
  if (word[0] == '\0') return;

  if (!strcmp(word, "X")) {
    stopAll();
  } else if (!strcmp(word, "V")) {
    Serial.println(F("VERSION KEYCAP-LAB-v4"));
  } else if (!strcmp(word, "SENSE") || !strcmp(word, "?")) {
    reportSense();
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
  } else if (!strcmp(word, "K")) {
    char token[4];
    nextWord(p, token, sizeof(token), false);
    const int i = keyIndex(token);
    if (i < 0) {
      Serial.println(F("ERROR key"));
      return;
    }
    startKnock(i, nextNumber(p, DEFAULT_KNOCK_MS, 10));
  } else if (!strcmp(word, "KSIGMAS")) {
    float v = nextFloat(p, DEFAULT_KNOCK_SIGMAS);
    knockSigmas = v < 1 ? 1 : v > 50 ? 50 : v;
    Serial.print(F("KSIGMAS "));
    Serial.println(knockSigmas, 2);
  } else if (!strcmp(word, "KMINMA")) {
    float v = nextFloat(p, DEFAULT_KNOCK_MIN_MA);
    knockMinMa = v < 0.5f ? 0.5f : v > 200 ? 200 : v;
    Serial.print(F("KMINMA "));
    Serial.println(knockMinMa, 2);
  } else if (!strcmp(word, "KLEARN")) {
    for (uint8_t i = 0; i < KEY_COUNT; ++i) knockBase[i] = {};
    Serial.println(F("KLEARN"));
  } else if (!strcmp(word, "U")) {
    setListen(static_cast<uint8_t>(nextNumber(p, 0, 16) & 0xFF));
  } else if (!strcmp(word, "SIGMAS")) {
    setPerKey(p, sigmas, 2.0f, 30.0f, F("SIGMAS"));
  } else if (!strcmp(word, "MINMA")) {
    setPerKey(p, minMa, 0.1f, 50.0f, F("MINMA"));
  } else if (!strcmp(word, "LEARN")) {
    char token[4];
    nextWord(p, token, sizeof(token), false);
    const int key = token[0] ? keyIndex(token) : -1;
    for (uint8_t i = 0; i < KEY_COUNT; ++i) {
      if (key >= 0 && key != i) continue;
      sensors[i].learned = false;
      if (sensors[i].phase != Sense::Off) stopReading(i);  // learns at the next reading
    }
    Serial.println(F("LEARN"));
  } else if (!strcmp(word, "HID")) {
    hidOn = nextNumber(p, 1, 10) != 0;
    Serial.println(hidOn ? F("HID 1") : F("HID 0"));
  } else if (!strcmp(word, "STREAM")) {
    streaming = nextNumber(p, 1, 10) != 0;
    nextStreamUs = micros();
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
  Keyboard.begin();
  statusLed.begin();
  statusLed.setBrightness(32);
  for (uint8_t i = 0; i < KEY_COUNT; ++i) {
    enterCoil(i, Coil::Off);
    sensors[i] = {};
    sensors[i].noiseSq = MIN_NOISE_SQ;
    sigmas[i] = DEFAULT_SIGMAS;
    minMa[i] = DEFAULT_MIN_MA;
  }
  lastHeatMs = millis();
  writeOutputs();

  delay(250);
  Serial.println(F("READY KEYCAP-LAB-v4"));
  Serial.println(F("MODE PLAY"));
}

void loop() {
  readHost();
  updateHeat();
  serviceCoils();
  writeOutputs();
  updateInput();
  updateKnock();
  serviceCoils();
  writeOutputs();
  checkListenTimeout();
}
