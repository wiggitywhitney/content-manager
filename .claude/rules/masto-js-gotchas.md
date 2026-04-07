# masto.js Gotchas (v7.x)

Surprises when using masto.js in a CommonJS Node.js project.

## CJS `require()` works — but all docs show ESM

masto.js ships as a dual-package (CJS + ESM via conditional exports). Despite having
`"type": "module"` in its own source, the published package exports:
```json
"exports": { ".": { "require": "./dist/cjs/index.js", "import": "./dist/esm/index.js" } }
```
`require("masto")` in a `"type": "commonjs"` project works without wrappers.
No `import()` shim needed. Official docs only show ESM — convert to `require` destructuring.

## Auth: `createRestAPIClient`, not `login()`

`login()` was removed in v6+. The only auth pattern is:
```javascript
const { createRestAPIClient } = require("masto");
const masto = createRestAPIClient({ url: INSTANCE_URL, accessToken: TOKEN });
```

## Posting a status

```javascript
const status = await masto.v1.statuses.create({
  status: "text here",
  visibility: "public",  // public | unlisted | private | direct
});
// Post URL is at status.url
```

The client uses a proxy-based design — `masto.v1.statuses.create()` builds the
REST path dynamically. CamelCase params are converted to snake_case automatically.

## Jest cannot auto-mock masto — use manual factory

masto.js CJS bundle has transitive ESM-only dependencies (`change-case`). Jest's default
auto-mock (`jest.mock('masto')`) tries to load the module, hits ESM syntax, and crashes.
Fix: provide a manual factory so Jest never loads the real module:
```javascript
jest.mock('masto', () => ({
  createRestAPIClient: jest.fn(),
}));
```

## Node 20+ required (v7+)

v7.0.0 dropped Node 18 support. The GitHub Actions workflow uses Node 22 — no
issue in CI. Local development must use Node 20+.
