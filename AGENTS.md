# AGENTS.md

## Overview

A personal [Raycast](https://www.raycast.com/) extension (`links-bundler`) that stores named bundles of URLs, lets you fuzzy-search them, and opens a whole bundle at once. Two commands are exposed:

- `add-page` (`src/add-page.tsx`) - add a bundle
- `search-page` (`src/search-page.tsx`) - search / manage bundles

Raycast requires each command's `name` in `package.json` to have a matching `src/<name>.tsx` entry point. Renaming a command file means renaming it in `package.json` too.

## Commands

```bash
npm install        # install deps (node_modules is not committed)
npm run build      # ray build
npm run dev        # ray develop (live-reloading dev server in Raycast)
npm run lint       # ray lint
npm run fix-lint   # ray lint --fix
npm test           # vitest run (pure unit tests, works off-Raycast)
npm run test:watch # vitest (watch mode)
npm run publish    # npx @raycast/api@latest publish
```

Important: `build`/`dev`/`lint` all shell out to the `ray` CLI, which only runs on macOS/Windows; `npx ray lint` does run on Linux and is a cheaper check than a full build. `npm test` (vitest) runs anywhere and is the way to verify logic without Raycast; test files live next to the module as `*.test.ts` / `*.test.tsx`. `tsconfig.json` excludes tests and `src/ui/testUtils.ts` because the project is `module: commonjs` and vitest transpiles tests itself.

## Architecture

- `src/utils/schema.ts` - zod v4 schemas and the codec (see below).
- `src/utils/data.ts` - all persistence CRUD against Raycast `LocalStorage`.
- `src/utils/constants.ts` - storage key, the pin-threshold preference, and Fuse.js options.
- `src/ui/form.tsx` - shared add/edit form (`mode: "ADD" | "EDIT"`).
- `src/ui/listEntry.tsx` - a single search-result row plus its action panel.
- `src/utils/search.ts` - `groupBundles(bundles, searchText)`: the Fuse search plus pinned/unpinned split used by `search-page.tsx`.

Storage key is `bundle_all` (see `BUNDLE_KEY` in `src/utils/constants.ts`). Bundles are persisted as a JSON string via Raycast's `LocalStorage`; there is no database. `getBundles()` `.parse`s the stored JSON on read, and `save()` (private) validates via `BundleStoreSchema` before writing.

### Two representations of a bundle

This is the central non-obvious pattern. A bundle exists in two shapes and is converted with `SingleBundleCodec`:

- `SingleBundleSchema` (storage): `urls: string[]`, always has a numeric `lastUpdated`.
- `FormInputSchema` (form): `urls` is a single newline-separated `string`; `lastUpdated` optional.

`SingleBundleCodec.encode` splits `urls` on `\n` and injects `lastUpdated: 0`; `decode` joins `urls` with `\n`. The search page works with both: it holds decoded (storage) objects in state and `decode`s them again to feed Fuse, then `encode`s matches back for rendering. When touching URL handling, change the codec rather than splitting/joining at call sites.

### Ordering and pinning

- `save()` sorts the stored list by `lastUpdated` descending. Display order therefore derives from `lastUpdated`, not array position.
- `moveTop`/`moveBottom` (`src/utils/data.ts`) reorder by rewriting `lastUpdated`. `moveBottom` passes `overrideLastUpdated = false` and sets `lastUpdated` to `bottomBundle.lastUpdated - 1000` to force the item last. `onSubmitBundle` otherwise stamps `Date.now()`.
- Pinned items are **not** stored separately; they are partitioned at render time in `search-page.tsx` into "Pinned Bundles" / "Bundles" sections.
- `IGNORE_PIN_THRESHOLD` in `constants.ts` is evaluated once at module load from the `ignore_pin_threshold` preference and is stored as `value - 1`. When `searchText.length > IGNORE_PIN_THRESHOLD`, the search page drops the pinned/unpinned split and renders one flat list. To change this behavior you must edit both the constant computation and the two branches in `search-page.tsx`.
- Duplicate bundle names are rejected at save time by the `.refine` in `BundleStoreSchema` (message: "Bundle already exist, please use another name."). There is no separate uniqueness check elsewhere.
- List selection is **controlled**, not left to Raycast. Each `List.Item` gets `id={item.name}`, and the `List` gets `selectedItemId` + `onSelectionChange`. `resolveSelection` (`src/utils/selection.ts`) selects the first displayed item whenever `searchText` changes, and otherwise keeps the user's choice while it is still in the results. Without this, Raycast's implicit selection sticks to a stale item after the pinned/flat switch and Enter opens the wrong bundle.

### Preferences

`ignore_pin_threshold` (a required text field) is declared in `package.json` under `preferences`. It is read via `getPreferenceValues()` in `constants.ts`. If it is not a number, the code shows an error HUD, opens preferences, and falls back to `4-1`.

## Conventions and gotchas

- Formatting is Prettier with `printWidth: 120` and **double quotes** (`singleQuote: false` in `.prettierrc`). Match this; the codebase uses 2-space indentation.
- ESLint extends `@raycast/eslint-config` with `@typescript-eslint/no-explicit-any` downgraded to `warn`. `any` appears in `form.tsx`'s catch handler, so warnings there are expected.
- TypeScript is `strict`, `jsx: react-jsx`, `module: commonjs`.
- SDK majors are current (`@raycast/api` v2, `@raycast/utils` v2). The v2 `List`/`List.Item`/`Form`/`ActionPanel` props, `LocalStorage`, `getPreferenceValues`, `showToast`, `showHUD`, `open` and `openExtensionPreferences` used here are all unchanged from v1, but `react`, `react-test-renderer` and `@types/react-test-renderer` are now dev dependencies because the SDK no longer vendors React for tooling.
- `ray lint` is clean, so it should stay usable as a gate. Don't blanket-run `ray lint --fix` to silence shortcut warnings: it picks presets by key, not by meaning, and rewrote "Copy Bundle" to `ToggleQuickLook` before. Choose the `Keyboard.Shortcut.Common` preset that matches what the action does.
- Action shortcuts use `Keyboard.Shortcut.Common.*` presets rather than inline `{ modifiers, key }` objects, because inline `cmd`-based shortcuts are flagged as ambiguous across platforms (the extension targets both macOS and Windows). Change a shortcut by picking a preset, not by hand-rolling one.
- `raycast-env.d.ts` is gitignored and generated by the Raycast CLI; a fresh checkout will not have it until `ray build`/`ray develop` runs, which can make typechecking fail locally.
- Form submit errors are caught in `ui/form.tsx` and mapped to per-field messages. Both shapes are handled (`ZodError` and a bare issues array); anything else is rethrown unchanged instead of being reported as a field error, so a storage failure surfaces rather than looking like invalid input.
- Actions in `ui/listEntry.tsx` follow a `.then(showToast).then(refreshCallback)` chain. `refreshCallback` bumps `listKey` in `search-page.tsx`, which re-runs the `getBundles()` effect. Any new mutation should call `refreshCallback` so the list updates.
- There is no CI and no deploy step beyond Raycast's own `publish`; unit tests run with vitest (see Commands).

### Tests

Tests exist to pin behavior that a `@raycast/api` major upgrade could break, so prefer asserting the contract (what storage holds, what preferences resolve to, which actions appear) over implementation details.

- Always mock `@raycast/api`. Importing it unmocked fails because the package has no resolvable entry outside Raycast.
- `constants.ts` evaluates preferences at module load, so tests for it use `vi.resetModules()` plus a dynamic `import()` to re-evaluate per case.
- Pure modules (`schema`, `data`, `selection`, `search`) are tested by calling them directly.
- Components with hooks (`form.tsx`, `listEntry.tsx`) are rendered through `renderWithHooks` in `src/ui/testUtils.ts` using `react-test-renderer`. React itself is a dev dependency only; Raycast supplies it at runtime.
- Raycast actions are passed as an unrendered `actions` element, so `actions` are reached with `actionElements`/`actionTitles` (which walk that element tree), not `findAll`. Use `hostByProp` when a mock component renders the same props onto a host node and you only want one match.
- Behavior pinned by tests should describe what ships. When a test starts failing after a deliberate fix, update the test to the new contract (as opposed to deleting it).
