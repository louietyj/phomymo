# Phomymo design format

The JSON that Import from File, Export as JSON and `#design=` links use. Units are printer dots: 8 per mm
(203 DPI).

**This is reverse-engineered, not a spec.** Upstream Phomymo documents only the editor UI. Everything below
was read off the code in this fork, so where it is silent, vague or wrong, the code wins. The files, as
deployed alongside this page:

- [`elements.js`](../elements.js): the `create…Element()` functions list every field and its default.
- [`canvas.js`](../canvas.js): what the values do: `renderTextElement`, `calculateAutoScaleFontSize`,
  `renderShapeElement` and its fill switch, `renderBarcodeElement`, `renderQRElement`,
  `renderImageElement`, and `_pixelsToRaster` for dithering.
- [`index.html`](../index.html): the option lists the editor offers (fonts, fills, barcode formats).
- [`app.js`](../app.js): `getDitherMode`, `getPrintElements` and `buildPrintRaster`, the path from design to
  printer bitmap.
- [`templates.js`](../templates.js): `{{Field}}` substitution and `[[...]]` expressions.

History and blame: [louietyj/phomymo](https://github.com/louietyj/phomymo), under `src/web/`. The quickest
check of any guess is to render it: `window.phomymoPrintPreview()` returns the exact print bitmap.

```json
{
  "name": "Lunch",
  "version": 3,
  "labelSize": { "width": 48, "height": 40, "round": false, "continuous": false },
  "elements": [ ... ]
}
```

`labelSize` is in **mm**. `width` runs across the print head and `height` along the feed direction. The
M110 head is 48 mm (384 dots) wide, so `width` is at most 48 there even on wider stock (other printers:
`widthBytes` in `printers.json`); a 40 mm tall label is 320 dots. `round: true` clips to a circle.

## Every element

| field | meaning |
|---|---|
| `id` | any unique string |
| `type` | `text`, `shape`, `barcode`, `qr`, `image` |
| `x`, `y` | top-left corner, in dots from the label's top-left |
| `width`, `height` | box size in dots |
| `rotation` | degrees clockwise, around the box centre: the box is laid out unrotated, then turned in place. A vertical line 240 long centred on (248, 184) is `x: 128, y: 182, width: 240, height: 4, rotation: 90` |
| `zone` | `0` (multi-label rolls only use other values) |

Later elements draw on top of earlier ones.

## text

| field | values |
|---|---|
| `text` | `\n` for line breaks; `[[...]]` expressions (below) fill at print time |
| `fontSize` | px (dots); 30 is a bold headline on a 40 mm label, 18-20 is small print |
| `fontFamily` | `"Inter, sans-serif"` (the editor's default). Also Roboto, Open Sans, Lato, Montserrat, Oswald, Playfair Display, Merriweather, Roboto Mono, Source Code Pro |
| `fontWeight` | `normal`, `bold` |
| `fontStyle` | `normal`, `italic` |
| `textDecoration` | `none`, `underline` |
| `align` | `left`, `center`, `right` (4-dot inset from the box edge) |
| `verticalAlign` | `top`, `middle`, `bottom` |
| `color` | `black`, `white` (white on a black background or shape) |
| `background` | `transparent`, `white`, `black` |
| `noWrap` | `true`: only `\n` breaks lines, overflow runs past the box |
| `clipOverflow` | `true`: cut text at the box edge |
| `autoScale` | `true`: ignore `fontSize` and use the **largest** size (6-200) at which the text fits the box. It grows short text as well as shrinking long text, and with wrapping on it will wrap a line to get bigger, so pair it with `noWrap: true` for one item per line |

Lines are `fontSize * 1.2` apart and word-wrap at the box width.

## `[[...]]` expressions

Evaluated in `text`, `barcodeData` and `qrData` when the label is printed or previewed, from the clock of
the device doing it (`templates.js`, `evaluateExpressionsInString`):

| expression | gives |
|---|---|
| `[[date]]`, `[[time]]`, `[[dt]]` (or `datetime`) | `YYYY-MM-DD`, `HH:mm:ss`, `YYYY-MM-DD HH:mm:ss`, or the format after a `\|` |
| `[[year]]`, `[[month]]`, `[[day]]`, `[[hour]]`, `[[minute]]`, `[[second]]` | one zero-padded field; a format is ignored |
| `[[timestamp]]` (or `ts`) | milliseconds since 1970 |

Format tokens: `YYYY YY MM M DD D HH H hh h mm m ss s A a Z` (`A`/`a` = AM/PM, `Z` = UTC offset). The
format is applied as plain letter-by-letter replacements, with no escaping, so **every** one of those
letters in the format is replaced, inside words too: `[[dt|Made YYYY-MM-DD]]` prints "10pmde 2026-10-05".
Keep words outside the brackets: `Made [[date]]`.

There is no date arithmetic and no day or month names: `[[date+3]]` is an unknown expression and stays
exactly as written, and `[[dt|ddd]]` prints "ddd". A date that isn't today has to be written out
literally.

## shape

| field | values |
|---|---|
| `shapeType` | `rectangle`, `ellipse`, `triangle`, `line` (horizontal through the box centre; rotate it for other angles) |
| `fill` | `white`, `black`, or a dither grey: `dither-6`, `-12`, `-25`, `-37`, `-50`, `-62`, `-75`, `-87`, `-94` (% grey) |
| `stroke` | `none`, `black`, `white`. A `line` is drawn in `stroke` (`fill` only if `stroke` is missing), so give it `black` or `white`: `none` is an invalid colour there and the line takes whatever colour was drawn last |
| `strokeWidth` | dots |
| `cornerRadius` | dots, rectangles only |

## barcode

| field | values |
|---|---|
| `barcodeData` | the value; must be valid for the format |
| `barcodeFormat` | `CODE128` (anything), `EAN13` (12-13 digits), `CODE39` |
| `showText` | `true` prints the value under the bars |
| `textFontSize`, `textBold` | readout size (default 12) and weight |

Bars are snapped to whole dots, so a box too narrow for the data shows a red strip in the editor and won't
scan. The strip survives into the print bitmap as a black line along the bottom, so a preview shows it.

## qr

| field | values |
|---|---|
| `qrData` | the text or URL |

Drawn as a square of `min(width, height)`, with a one-module quiet zone.

## image

| field | values |
|---|---|
| `imageData` | `data:` URL (PNG/JPEG) |
| `naturalWidth`, `naturalHeight` | the image's pixel size |
| `dither` | `floyd-steinberg` (default for photos), `atkinson`, `ordered`, `threshold` |
| `brightness`, `contrast` | -100 to 100 |

Avoid images when you can: they make links tens of KB long. A label with an image is dithered as a
whole, which roughens text edges slightly.
