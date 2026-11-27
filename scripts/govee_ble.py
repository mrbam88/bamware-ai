#!/usr/bin/env python3
"""The Govee lights that only speak Bluetooth: the H617A strip on the living-room ceiling.

  govee_ble.py off | on              power
  govee_ble.py color <r> <g> <b>     every segment one colour
  govee_ble.py status                on/off and brightness, as the strip reports them

Run it with the smarthome venv (it needs bleak). The strip is not on the Wi-Fi and not in the Govee account,
so govee_lan.py and govee.sh never see it; "Kill" left it on until this existed (2026-11-27). Only one thing
can hold its Bluetooth connection: the party stage has it while a party runs, so stop the party first.
"""
import asyncio
import sys

STRIPS = ["E8:55:02:86:73:73"]      # Govee_H617A_7373
WRITE = "00010203-0405-0607-0809-0a0b0c0d2b11"
NOTIFY = "00010203-0405-0607-0809-0a0b0c0d2b10"


def packet(*body: int) -> bytes:
    """20 bytes, zero-padded, the last one the XOR of the rest."""
    data = bytearray(body) + bytearray(19 - len(body))
    check = 0
    for value in data:
        check ^= value
    return bytes(data + bytes([check]))


async def run(address: str, command: str, args: list[str]) -> int:
    from bleak import BleakClient
    last = None
    for attempt in range(3):          # the first connect after another program let go often fails
        try:
            async with BleakClient(address, timeout=12) as client:
                replies: list[bytes] = []
                await client.start_notify(NOTIFY, lambda _, data: replies.append(bytes(data)))
                if command in ("on", "off"):
                    await client.write_gatt_char(WRITE, packet(0x33, 0x01, 1 if command == "on" else 0), response=False)
                elif command == "color":
                    r, g, b = (max(0, min(255, int(v))) for v in args[:3])
                    await client.write_gatt_char(WRITE, packet(0x33, 0x01, 1), response=False)
                    await client.write_gatt_char(WRITE, packet(0x33, 0x05, 0x15, 0x01, r, g, b, 0, 0, 0, 0, 0, 0xFF, 0xFF), response=False)
                await asyncio.sleep(0.4)
                replies.clear()
                await client.write_gatt_char(WRITE, packet(0xAA, 0x01), response=False)      # power?
                await asyncio.sleep(0.3)
                await client.write_gatt_char(WRITE, packet(0xAA, 0x04), response=False)      # brightness?
                await asyncio.sleep(0.5)
                power = next((r[2] for r in replies if r[:2] == b"\xaa\x01"), None)
                level = next((r[2] for r in replies if r[:2] == b"\xaa\x04"), None)
                state = {1: "on", 0: "off"}.get(power, "unknown")
                print(f"ceiling strip {address[-5:]}: {state}" + (f", {level}%" if level is not None and state == "on" else ""))
                if command in ("on", "off") and state != command:
                    last = f"reported {state} after {command}"
                    continue
                return 0
        except Exception as error:  # noqa: BLE001 - out of range, off at the wall, or another program holds it
            last = f"{type(error).__name__}: {str(error)[:80]}"
            await asyncio.sleep(2)
    print(f"ceiling strip {address[-5:]}: no answer ({last})", file=sys.stderr)
    return 1


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("on", "off", "color", "status") or (argv[0] == "color" and len(argv) < 4):
        print(__doc__.strip())
        return 1
    return max(asyncio.run(run(address, argv[0], argv[1:])) for address in STRIPS)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
