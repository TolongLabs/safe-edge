# Mission exports in vendor tools

On 19 October 2026 the demo exports from `bun run export:mission <dir>` were run through the vendors' own loaders. QGroundControl 5.1.5 (the official Linux build, driven in a virtual display) opened the `.plan`, drew the route and re-saved all 704 items unchanged. MAVSDK 4.0.6's QGroundControl importer reads all 704 items back. DJI's own WPML validator from Mobile SDK v5 (`com.dji:wpmzsdk` 1.0.5.1, run in an Android emulator) finds no errors in the KMZ. Nobody has opened the KMZ in DJI FlightHub 2 or DJI Pilot 2; that needs a person with a DJI account or a DJI controller.

Contents:

1.  [Exports under test](#exports-under-test)
1.  [QGroundControl](#qgroundcontrol)
    1.  [QGroundControl on macOS](#qgroundcontrol-on-macos)
    1.  [QGroundControl on Linux](#qgroundcontrol-on-linux)
    1.  [What QGroundControl shows](#what-qgroundcontrol-shows)
    1.  [QGroundControl re-save](#qgroundcontrol-re-save)
1.  [MAVSDK importer](#mavsdk-importer)
1.  [DJI WPML validator](#dji-wpml-validator)
1.  [Steps that need a person](#steps-that-need-a-person)
    1.  [QGroundControl on a Mac](#qgroundcontrol-on-a-mac)
    1.  [DJI FlightHub 2](#dji-flighthub-2)
    1.  [DJI Pilot 2](#dji-pilot-2)
1.  [See also](#see-also)

## Exports under test

- `bun run export:mission <dir>` at `feat/platform-planner-ai` `b27999d` plans the 90 Wh seed drone over the Elmina lake and writes `plan_demo-NOT-FLIGHT-READY.plan` and `plan_demo-NOT-FLIGHT-READY.kmz`: 179 waypoints (take-off, 2 transits, 175 stations, landing).
- The `.plan` has SHA-256 `396e6404d6027d60b36dc59e26f00d8e31f6cec00645d8373fb555651c92a35e`, the same on every run. It holds 704 mission items: 1 `NAV_TAKEOFF` (22), 177 `NAV_WAYPOINT` (16), 175 each of `DO_MOUNT_CONTROL` (205), `SET_CAMERA_ZOOM` (531) and `IMAGE_START_CAPTURE` (2000), and 1 `NAV_LAND` (21). It has no geofence or rally points.
- The `.kmz` entries have SHA-256 `e7bed8103724de9407aaaec767a63ef8ebe687298e9aa4ebe18d8c0024f13481` (`wpmz/template.kml`) and `3d2a2e38251c3c4e36c0860f8d0b96965fffedffe49f3e8101c74e828992cff4` (`wpmz/waylines.wpml`). The zip's own bytes depend on the time zone, the entries don't. It holds 177 placemarks and 175 station action groups for the Matrice 3TD (91/1) with payload 81.

## QGroundControl

QGroundControl 5.1.5 (released 1 October 2026) comes from the project's [GitHub release][qgc-release] and is dual-licensed Apache 2.0 or GPL v3. Release builds have no command-line loader: the `--unittest` options exist only in test builds (`QGC_UNITTEST_BUILD`), and there is no auto-load setting or file-open handler. The `.plan` was therefore opened through the Plan view, as a user would.

[qgc-release]: https://github.com/mavlink/qgroundcontrol/releases/tag/v5.1.5

### QGroundControl on macOS

`brew install --cask qgroundcontrol` installed the release DMG, signed with Developer ID "Donald Gagne" and notarized (`spctl` accepted it). It launched, and `screencapture -l` could capture its window, but macOS does not trust the agent's process for Accessibility (`AXIsProcessTrusted()` is false). Its synthetic clicks were dropped and the first-run dialog never closed, so the `.plan` was not opened on macOS.

### QGroundControl on Linux

The same release's `QGroundControl-aarch64.AppImage` (SHA-256 `ddd92fe3a1cd1c1c21a3028052e9f9b4d4a68cb80689552d3f34727ed2c91e03`) ran in an Ubuntu 24.04 container under Xvfb, with the packages QGroundControl's Linux install guide lists plus Mesa, unpacked with `--appimage-extract`. `xdotool` clicked through the UI and ImageMagick's `import` took the screenshots.

1.  Start QGroundControl with `--logging:PlanManager.MissionController,PlanManager.PlanMasterController --log-output`.
2.  Close the first-run Preferences dialog with Ok, then pick Plan from the Q menu and click Open.
3.  Copy the export unchanged (same SHA-256) into the dialog's folder `~/Documents/QGroundControl/Missions`, select it and click Open.

QGroundControl's loader logged:

```text
MissionController::_loadJsonMissionFileV2 itemCount: 704
plannedHomePosition QGeoCoordinate(3.178393, 101.513484, 42)
```

No error message appeared. When a load fails, QGroundControl shows "Error loading Plan file" with the reason. The map is QGroundControl's default Bing hybrid imagery.

![QGroundControl 5.1.5 Plan view with the demo plan drawn over the Elmina lake; Plan Info names plan_demo-NOT-FLIGHT-READY and Mission Items shows 529 items](/docs/images/mission-exports/qgc-plan-loaded.jpg)

### What QGroundControl shows

- **529 mission items, not 704.** QGroundControl folds each station's `DO_MOUNT_CONTROL` into the waypoint's camera section as its gimbal pitch. `CameraSection::scanForSection` stops at the first item it can't fold, which is `SET_CAMERA_ZOOM`. So the zoom shows as "Unknown: 531" in the raw editor (its narrow fields cut the values off), and the photo shows as a separate "Start image capture" item. #73 noted that QGroundControl shows the photo on the waypoint; since #125 put the zoom between the two, it no longer does. Nothing is dropped.
- **A station.** It shows altitude 3.0 m relative to home (9 m above ground, with the dock 6 m above ground), a 3 s hold, yaw 18.2° and gimbal pitch 37. The file has −36.87°; QGroundControl shows downward pitch as a positive number (`FactMetaData::_mavlinkGimbalDegreesToUserGimbalDegrees`).

![First station in QGroundControl: the camera tab with Gimbal on and pitch 37 deg, and the hold tab with 3 secs and yaw 18.2 deg](/docs/images/mission-exports/qgc-station-camera-hold.jpg)

![The zoom command in QGroundControl's raw editor: Unknown: 531 in MAV_FRAME_MISSION](/docs/images/mission-exports/qgc-zoom-raw-item.jpg)

### QGroundControl re-save

Save as… in the Plan menu wrote `qgc-resaved.plan` through QGroundControl's own writer. Compared item by item with the export, it has the same 704 items, and every item has the same command, frame, autoContinue and seven params (within 1e-6, with NaN kept). Only these changed:

- `groundStation` is now `QGroundControl` and the top-level `notice` is gone, so after a QGroundControl save the "not flight-ready" stamp survives only in the file name.
- The `plannedHomePosition` altitude is 35 m instead of 42 m, because QGroundControl replaces the planned home altitude with its own terrain lookup (`MissionSettingsItem::_setHomeAltFromTerrain`). The items fly relative to home (frame 3), so their heights don't change.

## MAVSDK importer

MAVSDK 4.0.6 (BSD-3-Clause, the native binding on PyPI as `mavsdk`) provides `MissionRaw.import_qgroundcontrol_mission`. It implements QGroundControl's plan format in [`mission_import.cpp`][mavsdk-import] and returns the `MISSION_ITEM_INT` list an upload would carry. It needs a MAVSDK `System`. A second in-process MAVSDK instance, typed as an autopilot and joined over MAVSDK's `raw://` connection, provides one. It doesn't identify as ArduPilot, so the importer adds no home item, as for PX4; the item count below confirms it.

It read 704 mission items, no geofence and no rally items, with commands 16 ×177, 21 ×1, 22 ×1, 205 ×175, 531 ×175 and 2000 ×175. For every item, the command, frame, autocontinue, param1–4, x, y and z match the file after the float32 and 1e7 conversions MAVSDK applies. A copy with `mission.version` 3 fails in MAVSDK's loader.

This check is committed. `bun run check:qgc-plan` exports into a temporary folder and runs [`check-qgc-plan.py`](/packages/planner/scripts/check-qgc-plan.py), which pins `mavsdk==4.0.6` in its inline script metadata, with `uv run --script`. CI runs it after the tests and installs uv with `astral-sh/setup-uv` v10.3.0. It takes a few seconds plus a 7 MB wheel download, and it passed on macOS arm64 and in a linux/amd64 container.

[mavsdk-import]: https://github.com/mavlink/MAVSDK/blob/v4.0.6/cpp/src/mavsdk/plugins/mission_raw/mission_import.cpp

## DJI WPML validator

DJI publishes no XSD for WPML; the format exists only as prose in [Cloud-API-Doc][dji-wpml]. The only DJI code that validates a WPML KMZ is Mobile SDK v5's `WPMZManager` in [`com.dji:wpmzsdk`][wpmzsdk] on Maven Central. Its native libraries ship for Android `arm64-v8a` only, so it can't run on macOS directly. It ran in an Android 14 arm64 emulator on the Mac.

- **Version.** It used 1.0.5.1, the version DJI's MSDK v5 sample app pins. The AAR's SHA-1 `a0682a87a4491053bf739a07f9403c485193d635` matches Maven Central's. The newer 1.0.5.2 swaps in a reworked internal layer, so it was not used.
- **Licence.** The SDK falls under DJI's SDK EULA, which allows using it to develop and test apps for DJI products. It was called only through its public API.
- **Harness.** A small Java `main` calls `WPMZManager.getInstance().checkValidation(path)` and `getKMZInfo(path)`. `d8` dexed it together with the SDK's classes, `kotlin-stdlib` 1.9.24 and `dom4j` 2.1.1 (as DJI's sample does), and `app_process` ran it with the SDK's `.so` files on `LD_LIBRARY_PATH`. These calls go straight to the SDK's native parser, with no App Key and no aircraft.

| KMZ                               | `checkValidation`                                                                  | Config parse error | Waylines parse error |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------ | -------------------- |
| The demo export                   | `[]`                                                                               | 0                  | 0                    |
| Control: no `waylines.wpml`       | `[FileNotExist]`                                                                   | 0                  | 4                    |
| Control: all speeds set to 99 m/s | `[InvalidTransitionalSpeed, TransitionalSpeedOutOfRange, WaypointSpeedOutOfRange]` | 0                  | 0                    |
| Control: a path with no file      | `[FileNotExist]`                                                                   | 4                  | 4                    |

From the demo export, DJI's parser read one wayline with 177 waypoints and 175 action groups, `autoFlightSpeed` 10 and heights relative to the start point; drone 91/1 with payload 81 at position 0; and `securityTakeOffHeight` 8. It read the template with no parse error and 177 waypoints.

- `checkValidation` checks fields and ranges (speeds, heights, turn and heading modes, action types, gimbal range, take-off security height). It is not a schema check, and it is not Pilot 2 or FlightHub 2, so a pass doesn't prove those apps will import the file.
- The mission config that `getKMZInfo` returns has `globalRTHHeight` unset, although `waylines.wpml` sets it to 3 m. `template.kml` doesn't carry it, and DJI doesn't document which file that config comes from.

[dji-wpml]: https://github.com/dji-sdk/Cloud-API-Doc/tree/master/docs/en/60.api-reference/00.dji-wpml
[wpmzsdk]: https://repo1.maven.org/maven2/com/dji/wpmzsdk/1.0.5.1/

## Steps that need a person

Issue [#126][issue-126] tracks these; the steps below are what a person runs for it.

[issue-126]: https://github.com/TolongLabs/sdp-hack/issues/126

### QGroundControl on a Mac

This is optional, because the Linux build of the same release loaded the file. The macOS build needs someone at the screen, since the agent can't click it.

1.  Run `bun run export:mission ~/Desktop/safe-edge-exports`.
2.  Open QGroundControl 5.1.5 and close the first-run Preferences dialog.
3.  Pick Plan from the Q menu, click Open, and choose `plan_demo-NOT-FLIGHT-READY.plan`.
4.  Expect the route over the Elmina lake, "Mission Items 529 items" and no error. Take a screenshot (Shift-Command-4) for this page.

### DJI FlightHub 2

The target aircraft is the Matrice 3TD, a DJI Dock 2 aircraft, and the [Dock 2 manual][dock2] describes importing routes in FlightHub 2's Flight Route Library. This needs a DJI account with a FlightHub 2 organisation and project.

1.  Run `bun run export:mission <dir>`.
2.  On fh.dji.com, open the project and go to Flight Route Library. Click the import icon, choose Import KMZ File, and pick `plan_demo-NOT-FLIGHT-READY.kmz`. [FlightHub 2 requires][fh-import] `wpmz/template.kml` and `wpmz/waylines.wpml`, and the KMZ has both.
3.  Record whether it imports and copy any error word for word. Open the route and note the aircraft it lists and the waypoint and action counts. Expect 177 waypoints, and at each station a gimbal rotation, a zoom where it is above 1×, a 3 s hover and a photo. Screenshot the route list and the route editor.
4.  Don't create a task plan from it or send it to a dock: it is not flight-ready.

[dock2]: https://dl.djicdn.com/downloads/DJI_Dock_2/User_Manual/20240814/DJI_Dock_2_User_Manual_V2.01_en.pdf
[fh-import]: https://fh.dji.com/user-manual/en/flight-route-library/import-flight-routes.html

### DJI Pilot 2

Pilot 2 runs only on DJI's Android controllers. With a Dock 2 aircraft it is used for dock setup and manual takeover, so importing routes in Pilot 2 applies to an aircraft flown from the controller.

1.  When an aircraft is chosen, set `AIRCRAFT` in [`wpml.ts`](/packages/planner/src/export/wpml.ts) to its WPML enum values and re-export.
2.  Copy the KMZ to the controller over USB file transfer or a microSD card.
3.  In Pilot 2, tap Flight Route, then Import Route (KMZ/KML), and pick the file. These labels come from a user guide ([TERN's DJI protocol][tern]), not from a DJI manual.
4.  Record the result and take screenshots as for FlightHub 2.

[tern]: https://www.tern.org.au/wp-content/uploads/20230829_drone_data_collection.pdf

## See also

- [Mission export code](/packages/planner/src/export/) and its [format tests](/packages/planner/test/mission-export.test.ts)
- [QGroundControl plan file format](https://docs.qgroundcontrol.com/master/en/qgc-dev-guide/file_formats/plan.html)
- [MAVSDK Python migration guide](https://mavsdk.mavlink.io/main/en/python/migration.html)
- [DJI IWPMZManager reference](https://developer.dji.com/api-reference-v5/android-api/Components/IWaypointMissionManager/IWPMZManager.html)
