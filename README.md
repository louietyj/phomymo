# Phomymo

## This fork

[louietyj/phomymo](https://github.com/louietyj/phomymo) is a fork of
[transcriptionstream/phomymo](https://github.com/transcriptionstream/phomymo), live at
**https://phomymo.louietyj.me**. It is used with a Phomemo **M110** (BLE name `Q468E6917560038`) and
50 x 40 mm labels, designed as 48 x 40 because the print head is 48 mm. Everything below this section is
upstream's README.

**Deploying.** Every push to `master` publishes `src/web/` to GitHub Pages (`.github/workflows/pages.yml`;
Cloudflare CNAME, DNS-only). There is no build step, so bump the `?v=` cache-busters on any module you
change (`app.js` in `index.html`, the other modules in `app.js`), as upstream does.

**What the fork adds**

- `#design=v1.<base64url(deflate-raw(design JSON))>` links open a whole design (`loadDesignFromHash` in
  `app.js`), so a script can hand over a ready-to-print label.
- `window.phomymoPrintPreview(model)` returns the exact print bitmap as a PNG data URL. It is built by
  `buildPrintRaster()`, the function every print path uses, so a preview can't drift from a print.
- [`src/web/docs/design-format.md`](src/web/docs/design-format.md) documents the design JSON, reverse-engineered
  from this code; update it when element fields or rendering change.
- Upstream PR #49, which stops Windows and Android notification failures from dropping the link.
- Fixes for the M110 Bluetooth behaviour below.

**M110 Bluetooth notes** (measured 2026-10-05/06)

- The protocol is an unframed byte stream. A status query written while a job is sending lands inside the
  raster and shifts every following row. All writes therefore go through `BLETransport.exclusive()` (print
  jobs, the density test, `queryAll`); anything new that writes to the printer must too.
- An unpaired link dies about 28.8 s after it opens, whatever is sent: keepalives don't help, a fresh
  connection resets the clock, and pairing at the OS level removes the limit (but then that device holds the
  printer and locks others out). The likely cause is an unanswered SMP security request hitting the spec's
  30 s timeout. `ensureFreshLink()` reconnects before any job on a link older than 22 s. Reconnecting takes
  about 5 s on Windows, which keeps the old link for ~3 s after `gatt.disconnect()`.
- The printer answers the `1f 11 xx` status queries (battery `08`, paper `11`, firmware `07`, serial `09`);
  firmware is 2.2.3. `M110` and `M110S` in Print Settings differ only in alignment, which makes no
  difference to a full-width 48 mm design.

**Testing locally**

- Serve `src/web` on localhost, since Web Bluetooth needs https or localhost, e.g.
  `python -m http.server 8765 --bind 127.0.0.1` (port 8080 is blocked on the maintainer's Windows machine).
- Chrome opens the device picker only on a real user gesture, so a script's click is refused: a person has
  to press Connect and pick the printer. Reconnecting to an already known device needs no gesture.
- Driving a normal Chrome over CDP pops an "Allow remote debugging" prompt on every connection, so keep
  connections few and don't poll.
- For byte-level debugging, the unpushed local branch `debug-ble-capture` adds `?log=1` (a hex log of every
  write, saved with `phomymoDebug.download()`), `?noquery=1`, `?nonotify=1` and `?reset=1`. A label with a
  tick every 8 dots turns any shift into a byte count you can read off a photo.

---

A free, browser-based label designer for Phomemo thermal printers. No drivers needed - connects via Bluetooth or USB.

**Try it now: https://phomymo.affordablemagic.net**

<p>
  <img src="screenshot.png" alt="Phomymo Label Designer" width="600" />
  <img src="screenshot-mobile.png" alt="Mobile UI" width="200" />
</p>

## Quick Start

1. Open https://phomymo.affordablemagic.net in Chrome (or any Chromium-based browser)
2. Click **Connect** to pair with your printer via Bluetooth (or **USB** for PM-241)
3. Design your label and click **Print**

To run locally (Web Bluetooth requires HTTPS or localhost):

```bash
cd src/web
python3 -m http.server 8080
# Open http://localhost:8080 in Chrome
```

**Requires:** Chrome, Edge, or another Chromium-based browser. Web Bluetooth is not available in Firefox or Safari. Android Chrome is supported with full touch UI; iOS is not supported. PM-241 printers require USB (WebUSB).

## Features

**Design Elements** - Text (multiple fonts including local system fonts, sizes, styles, alignment, background colors), images with scale/aspect lock, barcodes (Code128, EAN-13, UPC-A, Code39), QR codes, and shapes (rectangle, ellipse, triangle, line) with solid, dithered grayscale, and stroke fills.

**Editing** - Drag to move, corner/edge resize handles, rotation. Multi-select (Shift+click), grouping (Ctrl/Cmd+G), undo/redo, keyboard nudge, layer ordering, clipboard image paste (Ctrl/Cmd+V).

**Label Sizes** - Preset sizes for each printer type, round labels, custom dimensions. Auto-switches based on connected printer. Multi-label rolls with clone or individual zone modes.

**Templates & Batch Printing** - Variable fields with `{{FieldName}}` syntax, CSV import, preview grid, and batch printing with progress tracking.

**Instant Expressions** - Dynamic values at print time using `[[expression]]` syntax: `[[date]]`, `[[time]]`, `[[datetime]]`, or custom formats like `[[date|MM/DD/YYYY]]`. Works in text, barcodes, and QR codes.

**Print Preview** - Toggle dither preview to see exact thermal print output before printing.

**Export** - Save/load designs to browser storage, export/import as JSON, export to PDF or PNG.

**Mobile** - Full-featured touch UI with pinch-to-zoom, two-finger pan, slide-up property panels, and complete feature parity with desktop.

**Printer Status** - Live battery level, paper status, firmware version, and serial number with auto-query on connect.

## Supported Printers

| Model | Width | Notes |
|-------|-------|-------|
| P12 / P12 Pro | 12mm | Continuous tape label maker |
| A30 | 12-15mm | Continuous tape, faster print speed |
| M02 / M02S / M02X | 48mm (384px) | Mini pocket printers, continuous paper |
| M02 Pro | 53mm (626px) | 300 DPI high-resolution mini printer |
| M03 | 53mm (432px) | Mini sticker printer |
| T02 | 48mm (384px) | Mini sticker printer |
| M04S / M04AS | 53/80/110mm | 300 DPI multi-width printer (select paper size in settings) |
| M110 / M120 | 48mm (384px) | Narrow label makers |
| M200 / M250 | 75mm (608px) | Mid-size labels |
| M220 / M221 | 72mm (576px) | Wide labels |
| M260 | 72mm (576px) | Wide label maker |
| D30 / D35 / D50 / D110 | 12-15mm | Smart mini label makers (rotated protocol) |
| Q30 / Q30S | 12-15mm | Similar to D30 |
| PM-241 / PM-241-BT | 102mm (4") | Shipping labels, USB only (TSPL protocol) |

The app auto-detects your printer model from the Bluetooth device name and configures the correct protocol, print width, DPI, and label presets. If auto-detection fails, you can manually select your model in Print Settings, or the app will prompt you on first connection.

D-series printers print labels rotated 90° - the app handles this automatically. PM-241 printers use Bluetooth Classic (not BLE), so use the USB connection instead.

## Custom Printer Definitions

You can add, edit, and override printer definitions through **Print Settings > Manage Printers**. This lets you:

- **Add new printers** not yet in the built-in list with your own protocol, width, DPI, and alignment settings
- **Override built-in printers** to adjust settings like alignment or width for your specific hardware
- **Set auto-detect patterns** so your custom definitions are recognized automatically by BLE device name

Custom definitions are saved in your browser's localStorage and take priority over built-ins. Modified built-in printers can be reset to defaults at any time.

Built-in definitions are loaded from `printers.json` at startup.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + D` | Duplicate selected |
| `Ctrl/Cmd + G` | Group selected |
| `Ctrl/Cmd + Shift + G` | Ungroup |
| `Ctrl/Cmd + V` | Paste image from clipboard |
| `Delete / Backspace` | Delete selected |
| `Arrow keys` | Nudge by 1px |
| `Shift + Arrow keys` | Nudge by 10px |
| `Shift + Click` | Add to selection |

## Connection Tips

When the Bluetooth device picker appears, select the device showing a **signal strength indicator**. Devices listed without signal strength may be cached/ghost entries that won't connect properly.

## Project Structure

```
phomymo/
├── src/
│   └── web/
│       ├── index.html     # Main UI
│       ├── app.js         # Application logic
│       ├── canvas.js      # Canvas rendering & dithering
│       ├── elements.js    # Element management
│       ├── handles.js     # Selection handles
│       ├── storage.js     # localStorage persistence
│       ├── templates.js   # Variable substitution & CSV
│       ├── ble.js         # Web Bluetooth transport
│       ├── usb.js         # WebUSB transport
│       ├── printer.js     # Print protocols
│       ├── printers.json  # Built-in printer definitions
│       ├── constants.js   # Shared constants
│       └── utils/
│           ├── bindings.js   # Event binding helpers
│           ├── errors.js     # Error handling
│           └── validation.js # Input validation
└── README.md
```

## Acknowledgments

Protocol research and inspiration:

- [vivier/phomemo-tools](https://github.com/vivier/phomemo-tools) - CUPS driver with reverse-engineered protocol
- [yaddran/thermal-print](https://github.com/yaddran/thermal-print) - Printer status query commands
- [ooki1jp](https://github.com/vivier/phomemo-tools/issues/27#issuecomment-3850158579) - M04AS/M04S protocol reverse-engineering

Libraries: [JsBarcode](https://github.com/lindell/JsBarcode), [QRCode.js](https://github.com/davidshimjs/qrcodejs), [jsPDF](https://github.com/parallax/jsPDF)

## Support the Project

If Phomymo is useful to you, consider [making a donation](https://donate.stripe.com/7sY7sMese0182tXgn8eAg00) to support ongoing development.

## License

MIT License - see LICENSE file for details.
