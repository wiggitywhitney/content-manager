# Research: sharp — Node.js image resize and format conversion

**Project:** content-manager
**Last Updated:** 2026-06-18

## Update Log
| Date | Summary |
|------|---------|
| 2026-06-18 | Initial research — evaluating for PNG→JPEG conversion and resize in fetch-thumbnail.js |

## Findings

### Summary

sharp is the right choice for PNG→JPEG conversion and resize in this project. CJS works via `require('sharp')`. The resize+convert pipeline is a single async chain. One installation gotcha on macOS when `libvips` is globally installed via Homebrew.

### Surprises & Gotchas

**macOS Homebrew libvips triggers source build** 🟢 high — If `brew install vips` is present globally, `npm install sharp` tries to build from source instead of using prebuilt binaries and may fail. Fix: `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install sharp`.

**Node.js >= 20.9.0 required** 🟢 high — sharp 0.35.x requires Node-API v9, meaning Node >= 20.9.0. The project's `engines` field says `>=18.14.0` — this is now incorrect. CI uses Node 22, local uses Node 25, so no practical issue, but the field is stale.

**Cross-platform package-lock.json** 🟡 medium — npm bug #4828 can cause issues when a lock file generated on macOS is used in Linux CI via `npm ci`. sharp uses optional dependencies for platform-specific prebuilt binaries. In practice, `npm ci` on ubuntu-latest with Node 22 resolves this correctly as long as optional deps are enabled (the default).

**`fit: 'inside'` is NOT the default** 🟢 high — The default `fit` is `'cover'` (crops to fill both dimensions). For proportional resize without cropping, `fit: 'inside'` must be specified explicitly.

### Findings

**Current version:** 0.35.1 (published June 11, 2026). 🟢 high
**Source says:** "Node.js >= 20.9.0" ([Installation docs](https://sharp.pixelplumbing.com/install/))

**CJS usage:**
```javascript
const sharp = require('sharp'); // works in "type": "commonjs" projects
```

**Resize + JPEG conversion from a Buffer:**
```javascript
const jpegBuffer = await sharp(inputBuffer)
  .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 90 })
  .toBuffer();
```

- `fit: 'inside'` — preserves aspect ratio, output fits within the bounding box
- `withoutEnlargement: true` — never upscales; small images pass through at original size
- `.jpeg({ quality: 90 })` — convert to JPEG regardless of input format
- `.toBuffer()` — returns `Promise<Buffer>`
- Accepts Buffer directly as input (not just file paths)

**Source says:** "Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified." ([Resize API](https://sharp.pixelplumbing.com/api-resize/))

### Recommendation

Use sharp. The API is stable, prebuilt binaries handle macOS ARM64 and Linux x64 automatically, and the Buffer→Buffer pipeline requires no filesystem I/O.

## Sources

- [sharp Installation](https://sharp.pixelplumbing.com/install/) — Node.js version requirements, platform gotchas
- [sharp Resize API](https://sharp.pixelplumbing.com/api-resize/) — fit options, withoutEnlargement
- [sharp npm](https://www.npmjs.com/package/sharp) — version 0.35.1 confirmed
