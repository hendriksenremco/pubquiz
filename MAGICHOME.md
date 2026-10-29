# MagicHome LED controller in QuizNote

Handoff from a Claude Code session in another repo (2026-10-29). Goal: let QuizNote control a
MagicHome LED-strip controller over the local network.

**Not decided yet:** what the lights should do during a quiz. Ask Remco before designing.
Options to put to him:

- a color or effect per round, like the other per-round overrides
- a flash or effect at specific moments (round start, answers, fragment)
- following the `B` (all black) key

## The device

| | |
|---|---|
| IP | `192.168.14.133` on the Guts & Gusto office Wi-Fi (DHCP, not yet a fixed IP in UniFi) |
| MAC | `2C:F4:32:CE:4E:37` (Espressif) |
| Model code | `0xA1`: "Addressable v1" in `flux_led` (strip with individually controllable LEDs) |
| Firmware | 3 |
| Wi-Fi | 2.4 GHz only |

The IP only applies to the office. At a quiz venue the controller has to join that venue's Wi-Fi
and will get a different IP.

## Network lessons

- The Mac and the controller must be on the same network, and wireless clients must be able to
  reach each other. With Client Device Isolation on, it fails silently. The MagicHome Pro app
  shows "cloud" instead of local when it can't reach the device directly.
- The controller was first stuck on another network and only showed up after a factory reset
  and re-pairing via MagicHome Pro.
- **Discovery didn't work.** A UDP broadcast of `HF-A11ASSISTHREAD` to port 48899 (subnet
  broadcast) got no reply from this device. Plan on the user entering the IP, with a
  "test connection" step. Unicast discovery was not tested.
- TCP port 5577 accepts connections and answers status queries from the Mac (tested).

## Protocol (LEDENET over TCP 5577)

Source: `flux_led` 1.2.0 (Python, MIT), `protocol.py` → `ProtocolLEDENETAddressableA1`. Use it
as a reference only. Port the few commands to TypeScript instead of shipping Python.

Every message ends with a checksum byte: `sum(bytes) & 0xFF`.

| Action | Bytes (checksum included) | Tested on device |
|---|---|---|
| Query state | `81 8A 8B 96` | yes |
| Power on | `71 23 0F A3` | no |
| Power off | `71 24 0F A4` | no |
| Color, saved | `31 R G B 00 00 F0 0F <sum>` (red: `31 FF 00 00 00 00 F0 0F 2F`) | no |
| Color, not saved | `41 R G B 00 00 F0 0F <sum>` | no |
| Built-in effect | `61 <hi> <lo> <speed> 0F <sum>`, where `hi lo` = 16-bit `effect + 99` | no |

- Effects are numbered 1–300. Names are in `flux_led/pattern.py` →
  `ORIGINAL_ADDRESSABLE_EFFECT_ID_NAME`. Effect 1 at speed 50: `61 00 64 32 0F 06`.
- There's no separate brightness byte. `flux_led` scales the RGB values.
- `F0` is the write mode for "colors only", which `flux_led` uses for RGB-only devices.
- `31` stores the color in the controller's memory, `41` doesn't. For changes during a show, `41`
  is probably better (less wear), but it's untested on this model.
- A1 pushes state messages on its own when it's controlled from the app or a remote. Frame the
  incoming bytes by message type and length, and don't assume one response per request.

State response, 14 bytes. This one was received on 2026-10-29:

```
81 A1 23 00 61 64 00 FF 00 00 03 00 FA 06
|  |  |  |  |  |  R  G  B  WW fw CW  ?  checksum
|  |  |  |  |  speed (100)
|  |  |  preset pattern + mode: effect id = (byte3 << 8) + byte4 - 99; 00 61 = static color
|  |  power: 23 on, 24 off
|  model code
head
```

Manual check from the terminal:

```sh
printf '\x81\x8a\x8b\x96' | nc -w 2 192.168.14.133 5577 | xxd
```

## Where it fits in QuizNote

Follow the AirPlay integration (`src/main/airplay.ts` + `src/shared/airplay.ts`):

- **`src/shared/`**: pure functions for building messages, the checksum and parsing the state,
  with vitest tests. The bytes above make good fixtures.
- **`src/main/`**: the TCP connection via Node `net`. The renderer can't open sockets. Use short
  timeouts, and an unreachable controller must never block or break the show (`NoticeStack`
  exists for notices).
- **IPC**: `src/shared/ipc.ts` and the preload bridge, like the other main ↔ renderer features.
- **Per-round behavior**: goes through the quiz schema (`src/shared/quiz-schema.ts`, with a
  migration in `migrate.ts`) and `resolve(quiz, showState)`, the same "default ⊕ round override"
  model as screens and music.
- **Controller address**: settings (`src/main/settings.ts`), the way the Show remembers displays
  and audio outputs by name.
- **Tests**: an env var for a fake device, like `PUBQUIZ_FAKE_AIRPLAY`, or a small fake TCP
  server in e2e. Never the real device.

## Careful with the real device

It hangs in the Guts & Gusto office, so colleagues see every color change. Ask Remco before
sending anything other than the status query (`81 8A 8B 96`) to `192.168.14.133`.
