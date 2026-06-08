# Local Development & Testing Guide

This document explains how to develop, build, and test `react-tree-inspector` locally
using the **Practice App** as the consumer project — the exact setup that is already
in use in this repository.

---

## Repository Layout

```
Practice App/                        ← consumer / host application
├── src/
│   └── index.tsx                    ← mounts <TreeInspector> in non-production envs
├── webpack.config.js
├── package.json                     ← depends on react-tree-inspector via "file:" link
└── react-tree-inspector/            ← the package (nested workspace)
    ├── src/
    │   ├── index.ts
    │   ├── fiberCrawler.ts
    │   ├── types.ts
    │   ├── components/
    │   └── hoc/
    ├── dist/                        ← compiled output (not committed)
    ├── tsup.config.ts
    └── package.json
```

---

## How the Local Link Works

The Practice App's `package.json` references the package using a **`file:` path**:

```json
// Practice App/package.json
"dependencies": {
  "react-tree-inspector": "file:./react-tree-inspector"
}
```

npm resolves this by symlinking (or copying) `react-tree-inspector/` into
`node_modules/react-tree-inspector` of the consumer project.

> **Key point:** Every time you run `npm install` inside `Practice App/`, npm re-reads
> the `file:` reference and updates `node_modules/react-tree-inspector` to reflect
> the current state of the `dist/` folder inside the package.

---

## Step-by-Step: First-Time Setup

### 1 — Install package dependencies

```bash
cd "Practice App/react-tree-inspector"
npm install
```

### 2 — Build the package

```bash
npm run build
# Produces: dist/index.cjs.js  dist/index.esm.js  dist/index.d.ts
```

### 3 — Install consumer app dependencies

```bash
cd ..   # back to Practice App/
npm install
# npm reads "file:./react-tree-inspector" and links the freshly-built dist/
```

### 4 — Start the consumer app

```bash
npm start
# Webpack dev server starts on http://localhost:3000
```

The `<TreeInspector>` overlay button (`⬡`) should now be visible in the
bottom-right corner of the app (it is gated to non-production environments).

---

## Iterating on the Package

### Watch mode (recommended for active development)

Open **two terminals**:

**Terminal 1 — package watcher**

```bash
cd "Practice App/react-tree-inspector"
npm run dev          # tsup --watch rebuilds dist/ on every source change
```

**Terminal 2 — consumer app**

```bash
cd "Practice App"
npm start            # webpack-dev-server with HMR
```

Because the consumer's `package.json` uses `file:./react-tree-inspector`, Webpack
resolves the package directly from the local `dist/` folder.

> **Tip:** The Webpack alias in `webpack.config.js` pins `react` and `react-dom` to
> the consumer's own copies, preventing the "multiple React instances" error that
> commonly occurs with local package development:
>
> ```js
> // webpack.config.js
> resolve: {
>   alias: {
>     react: path.resolve(__dirname, "node_modules/react"),
>     "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
>   },
> },
> ```
>
> This is already configured and **you do not need to change it**.

### Typecheck only (no emit)

```bash
cd "Practice App/react-tree-inspector"
npm run typecheck
```

---

## How the Package is Consumed in the App

### `src/index.tsx` — standalone component usage

```tsx
import { TreeInspector } from "react-tree-inspector";

root.render(
  <StrictMode>
    <Provider store={store}>
      <App />
      {__APP_ENV__ !== "production" && (
        <TreeInspector buttonPosition="bottom-right" />
      )}
    </Provider>
  </StrictMode>,
);
```

The `__APP_ENV__` global is injected by Webpack's `DefinePlugin` from the active
`.env.*` file, so the inspector is automatically excluded from production builds.

### Switching to the HOC pattern

If you want to test `withTreeInspector` instead, update `src/App.tsx`:

```tsx
import { withTreeInspector } from "react-tree-inspector";

const App = () => { /* ... */ };

export default process.env.NODE_ENV === "development"
  ? withTreeInspector(App, { buttonPosition: "bottom-right", maxDepth: 40 })
  : App;
```

### Headless crawler (for scripted checks)

```ts
import { crawlFiberTree } from "react-tree-inspector";

const { tree, error } = crawlFiberTree(document.getElementById("root")!, {
  maxDepth: 20,
});
console.log(JSON.stringify(tree, null, 2));
```

---

## Rebuilding After Source Changes

When you change files in `react-tree-inspector/src/`:

| Scenario                   | What to do                                          |
| -------------------------- | --------------------------------------------------- |
| **Watch mode running**     | Nothing — `tsup --watch` rebuilds automatically     |
| **No watch mode**          | `npm run build` inside `react-tree-inspector/`      |
| **Added a new export**     | Also update `src/index.ts` to re-export it          |
| **Changed `package.json`** | Re-run `npm install` in `Practice App/` to re-link  |

---

## Verifying the Build Artifacts

After a successful build, `dist/` should contain:

```
dist/
├── index.cjs.js       ← CommonJS bundle
├── index.cjs.js.map
├── index.esm.js       ← ESM bundle
├── index.esm.js.map
└── index.d.ts         ← TypeScript declarations
```

Quick sanity check — confirm the exports are present:

```bash
node -e "const pkg = require('./react-tree-inspector/dist/index.cjs.js'); console.log(Object.keys(pkg))"
# Expected: [ 'withTreeInspector', 'TreeInspector', 'crawlFiberTree' ]
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `Module not found: react-tree-inspector` | `dist/` is missing or stale | Run `npm run build` in the package, then `npm install` in the app |
| "Invalid hook call" / "multiple React" error | Two copies of React loaded | Verify the `resolve.alias` in `webpack.config.js` is present |
| Type errors in the consumer | Stale `dist/index.d.ts` | Run `npm run typecheck && npm run build` in the package |
| Overlay button not visible | `__APP_ENV__` is `"production"` | Use `npm start` (development mode) instead of `npm run build` |
| `tsup` not found | Package deps not installed | Run `npm install` inside `react-tree-inspector/` |

---

## Available Scripts

### Inside `react-tree-inspector/`

| Script | Description |
| ------ | ----------- |
| `npm run build` | One-shot compile to `dist/` |
| `npm run dev` | Watch mode — rebuilds on every save |
| `npm run typecheck` | TypeScript check without emitting files |

### Inside `Practice App/`

| Script | Description |
| ------ | ----------- |
| `npm start` | Webpack dev server (development env) |
| `npm run start:qa` | Webpack dev server (QA env) |
| `npm run build` | Production bundle |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
