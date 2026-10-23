<!--
SPDX-FileCopyrightText: 2026 Elouan Martinet <exa@elou.world>

SPDX-License-Identifier: MIT
-->

# AGENTS.md

Build, test, lint and format through `make`; the targets delegate to the
matching `package.json` scripts, so the scripts stay the single source of truth.

- `make build` — typecheck the host and client halves, then bundle the browser
  client with esbuild into `dist/client/index.js`
- `make typecheck` — `tsc --noEmit` for both halves
- `make lint` — oxlint over the TypeScript sources
- `make test` — build, then run the unit tests from `dist/`
- `make fmt` / `make fmt-check` — format / verify Markdown and TypeScript
- `make clean` — remove `dist/` and `node_modules/`

`pnpm test` runs against `dist/`, so run `pnpm build` first (or `make test`).
The Makefile exports `DPRINT_CACHE_DIR` because dprint's default cache is not
accessible when using dsh-podman.

## Manifest

The profile loads the bundle through `package.json`: `dsh.bundle.patch` points
at `cordis.patch.yml`, whose row `name` must equal the package name, and
`dsh.client.inject` lists only packages the checkout installs. The browser half
is published from the `./client` export.

The page is registered with `multiple: false` and `keepMounted: true` in the
session scope, and reads the catalog from that session's projection snapshot:
keep it per session.

## Documentation

User-facing docs live in `README.md` and `README.zh.md`; development
instructions live only here. Users install the published package from npm — the
local build is for development only.

Markdown and TypeScript share one formatter — `dprint`, configured by
`dprint.json` (line width, wrapped-prose policy, pinned plugin versions, and the
formatted file set); run `make fmt`, and `make fmt-check` or the `js` CI job
verifies it. TypeScript is linted with `oxlint`, configured by `.oxlintrc.json`
and pinned in `devDependencies`: run `make lint`, which the `js` CI job also
runs.

## Conventions

- Commit after each change, in small focused commits (one per logical change),
  with a single-line Conventional Commit message.
- Files carry SPDX headers; validate compliance with
  `REUSE_ENCODING_MODULE=chardet reuse lint` (the `REUSE_ENCODING_MODULE`
  variable works around a reuse bug that otherwise false-positives certain UTF-8
  files, e.g. the Chinese `.zh.md` docs). JSON, the lockfile and artwork are
  annotated in `REUSE.toml` instead.
- Every `@deepseek-ai/*` specifier is a caret range; none is an exact pin. The
  `@deepseek-ai/dsh-*` set follows a caret range anchored on `engines.dsh`, and
  `@deepseek-ai/cordis` sits outside that release set but still takes a caret
  range. Bump the whole set together with the harness, never individually
  (Dependabot ignores the scope for this reason). The version itself lives only
  in the package files, and `src/package-deps.test.ts` derives the shared range
  from `engines.dsh` to enforce it.

Releasing: run `pnpm bump-version x.y.z`, which bumps `package.json`, commits
the bump and creates the tag. It requires a clean tree on `master`; nothing is
pushed. `pnpm bump-version --dry-run x.y.z` validates without changing anything.
The same script is reachable as `make bump-version VERSION=x.y.z`.
