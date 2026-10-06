# louietyj/phomymo

Louie's fork of [transcriptionstream/phomymo](https://github.com/transcriptionstream/phomymo), a
browser label designer that prints to Phomemo printers over Web Bluetooth. His printer is an **M110**
(BLE name `Q468E6917560038`) with 50 x 40 mm labels, designed as 48 x 40 because the head is 48 mm.

## Deploy

Every push to `master` deploys `src/web/` to GitHub Pages (`.github/workflows/pages.yml`) at
**https://phomymo.louietyj.me** (Cloudflare CNAME, DNS-only). There is no build step: files are served as
they are, so bump the `?v=` cache-busters on any changed module (`app.js` imports in `index.html`, other
modules' imports in `app.js`), as upstream does.

## Fork-only features

- `#design=v1.<base64url(deflate-raw(design JSON))>` links open a whole design (`loadDesignFromHash` in
  `app.js`). The `phomymo-link` skill in Louie's claude-skills repo generates them.
- `window.phomymoPrintPreview(model)` returns the exact print bitmap as a PNG data URL, built by
  `buildPrintRaster()`, the same function every print path uses. The skill's `preview.mjs` calls it from
  headless Chromium.
- `src/web/docs/design-format.md`: the design JSON, reverse-engineered from this code. Keep it in step
  when element fields or rendering change.
- Cherry-picked upstream PR #49 (Windows/Android notification failures dropping the link).

## Bluetooth facts (M110, measured 2026-10-05/06)

- **The protocol is an unframed byte stream.** A status query written while a job is sending lands
  inside the raster and shifts every following row. All writes go through `BLETransport.exclusive()`
  (print jobs, density test, `queryAll`); anything new that writes to the printer must too.
- **An unpaired link dies ~28.8 s after it opens**, whatever is sent; keepalives don't help, a fresh
  connection resets it, and pairing at the OS level removes it (then that device holds the printer and
  locks others out). Most likely an unanswered SMP security request hitting the spec's 30 s timeout.
  `ensureFreshLink()` reconnects before any job on a link older than 22 s. Reconnecting takes ~5 s on
  Windows, because Windows keeps the old link ~3 s after `gatt.disconnect()`.
- The printer answers the `1f 11 xx` status queries (battery `08`, paper `11`, firmware `07`, serial
  `09`); firmware is 2.2.3. `M110` vs `M110S` in Print Settings differ only in alignment, which makes no
  difference to a full-width 48 mm design.

## Testing locally

- Serve `src/web` on localhost (Web Bluetooth needs https or localhost). Port 8080 is blocked on Louie's
  Windows machine; use another, e.g. `python -m http.server 8765 --bind 127.0.0.1`.
- Chrome's device picker only opens on a real user gesture: a CDP or pinchtab click is refused, so a
  person (or an OS-level click tool) has to press Connect and pick the printer. Reconnecting to a known
  device needs no gesture.
- Attaching to Louie's own Chrome over CDP shows him an "Allow remote debugging" prompt on every
  connection, so keep connections few and don't poll.
- Byte-level debugging: branch `debug-ble-capture` (local to Louie's Windows checkout, not pushed) adds `?log=1` (hex log of every write,
  `phomymoDebug.download()`), `?noquery=1`, `?nonotify=1` and `?reset=1`. A label with a tick every 8
  dots shows any shift in bytes from a photo.
