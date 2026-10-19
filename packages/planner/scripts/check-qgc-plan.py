# /// script
# requires-python = ">=3.10"
# dependencies = ["mavsdk==4.0.6"]
# ///
"""Reads a QGroundControl .plan with MAVSDK's QGroundControl importer and checks it reads back every mission item.

MAVSDK (BSD-3-Clause, mavlink/MAVSDK) implements QGroundControl's plan format in
`cpp/src/mavsdk/plugins/mission_raw/mission_import.cpp`; `MissionRaw.import_qgroundcontrol_mission` returns the
MISSION_ITEM_INT list a vehicle upload would carry. This script fails unless that list has one item per file item, in
order, with the file's command, frame, autoContinue and all seven params (after the float32 / 1e7 int32 conversion the
importer applies), and no geofence or rally items. It prints a JSON summary.

The importer needs a MAVSDK `System`. A second in-process MAVSDK instance, typed as an autopilot and joined over
MAVSDK's `raw://` connection, provides one. It is generic (not ArduPilot), so the importer adds no home item, as for
PX4.

Usage: uv run --script packages/planner/scripts/check-qgc-plan.py <file.plan>
"""

import json
import math
import queue
import struct
import sys
import threading
from collections import Counter

from mavsdk import ComponentType, Configuration, Mavsdk
from mavsdk.plugins.mission_raw import MissionRaw

MAV_FRAME_MISSION = 2


def as_float32(value):
    return math.nan if value is None else struct.unpack("f", struct.pack("f", value))[0]


def as_int32(value, frame):
    if value is None:
        return 0
    return int(as_float32(value)) if frame == MAV_FRAME_MISSION else round(value * 1e7)


def same(a, b):
    return (math.isnan(a) and math.isnan(b)) or a == b


def import_with_mavsdk(path):
    gcs = Mavsdk(Configuration.create_with_component_type(ComponentType.GROUND_STATION))
    vehicle = Mavsdk(Configuration.create_with_component_type(ComponentType.AUTOPILOT))
    # Bytes cross through a queue so neither instance re-enters the other from its own send callback.
    wire = queue.Queue()
    stop = threading.Event()

    def pump():
        while not stop.is_set():
            try:
                target, data = wire.get(timeout=0.05)
            except queue.Empty:
                continue
            target.pass_received_raw_bytes(data)

    # Subscribing first means each instance's first heartbeat already has somewhere to go. MAVSDK warns that the
    # subscription receives bytes only once the connection exists, which is what follows.
    gcs.subscribe_raw_bytes_to_be_sent(lambda data: wire.put((vehicle, data)))
    vehicle.subscribe_raw_bytes_to_be_sent(lambda data: wire.put((gcs, data)))
    for instance in (gcs, vehicle):
        result = instance.add_any_connection("raw://")
        if result.name != "SUCCESS":
            raise SystemExit(f"raw:// connection failed: {result}")
    thread = threading.Thread(target=pump, daemon=True)
    thread.start()
    system = gcs.first_autopilot(10.0)
    if system is None:
        raise SystemExit("no autopilot discovered over the in-memory link within 10 s")
    data = MissionRaw(system).import_qgroundcontrol_mission(path)
    stop.set()
    thread.join()
    return data


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: check-qgc-plan.py <file.plan>")
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        file_items = json.load(f)["mission"]["items"]
    data = import_with_mavsdk(path)
    read = data.mission_items

    errors = []
    if len(read) != len(file_items):
        errors.append(f"MAVSDK read {len(read)} mission items, the file has {len(file_items)}")
    for i, (want, got) in enumerate(zip(file_items, read)):
        frame = want["frame"]
        p = want["params"]
        expected = {
            "seq": i,
            "command": want["command"],
            "frame": frame,
            "autocontinue": 1 if want["autoContinue"] else 0,
            "param1": as_float32(p[0]),
            "param2": as_float32(p[1]),
            "param3": as_float32(p[2]),
            "param4": as_float32(p[3]),
            "x": as_int32(p[4], frame),
            "y": as_int32(p[5], frame),
            "z": as_float32(p[6]),
        }
        for field, value in expected.items():
            if not same(float(getattr(got, field)), float(value)):
                errors.append(f"item {i} ({want['command']}): {field} is {getattr(got, field)}, expected {value}")
    if data.geofence_items or data.rally_items:
        errors.append(f"MAVSDK read {len(data.geofence_items)} geofence and {len(data.rally_items)} rally items")

    summary = {
        "file": path,
        "missionItems": len(read),
        "commands": dict(sorted(Counter(item.command for item in read).items())),
        "geofenceItems": len(data.geofence_items),
        "rallyItems": len(data.rally_items),
        "mismatches": len(errors),
    }
    print(json.dumps(summary))
    if errors:
        print("\n".join(errors[:20]), file=sys.stderr)
        sys.exit(1)


main()
