# MagicHome LED controller in QuizNote

QuizNote controls a MagicHome LED-strip controller over the local network. This started as a
handoff from a Claude Code session in another repo (2026-10-29).

Built as the plug-in **MagicHome-licht** (`magichome`, PR #10). It's off by default and switched
on per Mac under Instellingen.

- **Light per part of the quiz:** a color, an effect or off per quiz, round or slide, resolved as
  slide ⊕ round ⊕ quiz. Nothing set means the app leaves the lights alone.
- **Choosing by hand during the show:** from the Licht button in the show toolbar, or from the
  phone remote. A light chosen by hand holds until the show itself picks a different light. "Volg
  de show" goes back straight away.
- **Before the show:** the controller's IP address is entered under Instellingen or in Show
  starten. The app remembers the last one.

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
| Color, saved | `31 R G B 00 00 F0 0F <sum>` (red: `31 FF 00 00 00 00 F0 0F 2F`) | yes |
| Color, not saved | `41 R G B 00 00 F0 0F <sum>` | yes |
| Built-in effect | `61 <hi> <lo> <speed> 0F <sum>`, where `hi lo` = 16-bit `effect + 99` | no |

- Effects are numbered 1–300. Names are in `flux_led/pattern.py` →
  `ORIGINAL_ADDRESSABLE_EFFECT_ID_NAME`. Effect 1 at speed 50: `61 00 64 32 0F 06`.
- There's no separate brightness byte. `flux_led` scales the RGB values.
- `F0` is the write mode for "colors only", which `flux_led` uses for RGB-only devices.
- `31` stores the color in the controller's memory, `41` doesn't. The app uses `41`; see the
  lessons below.
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

## Lessons from the real controller (2026-10-29)

Measured on the A1 with Remco's permission:

1. **Closing a connection right after writing loses commands.** The controller drops whatever it
   hasn't processed yet.
2. **Too many connections lock it up.** After about 15 short connections in a row it stopped
   answering locally until it was powered off and on. The MagicHome app then showed it as
   "offline".
3. **`31` is slow.** After `31` (saved color) the controller is busy for about 3 s and answers
   nothing. `41` (not saved) keeps up with one change per second.

That's why the app keeps one connection open and sends `41` (commit ec5f7ff).

## Where it lives in QuizNote

- `src/shared/magichome.ts` and `magichome-effects.ts`: building messages, the checksum and
  parsing the state.
- `src/shared/light.ts`: the light model and how it's resolved.
- `src/shared/light-effects.ts`: effect names and groups.
- `src/main/magichome.ts`: the plug-in in main, with the TCP connection and manual choices.
- `src/renderer/src/plugins/magichome/`: the parts in the app, such as the light picker in the
  editor and the panel in the show toolbar. The phone uses the same panel.
- `e2e/fake-magichome.ts`: a fake controller on localhost for the tests. Never the real device.

## Careful with the real device

It hangs in the Guts & Gusto office, so colleagues see every color change. Ask Remco before
sending anything other than the status query (`81 8A 8B 96`) to `192.168.14.133`.
