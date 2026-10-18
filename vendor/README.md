# Vendored shared packages

Two tiny packages from `simonmak-ascent/tool_packages` are committed here so the
build does not depend on GitHub Packages credentials:

| Package | Version | Source |
|---|---|---|
| `@simonmak-ascent/utils` | 1.1.1 | `tool_packages/packages/utils` |
| `@simonmak-ascent/validation` | 1.1.1 | `tool_packages/packages/validation` |

Both are `dist`-only tarballs (1–2 KB) with no runtime dependencies
(`clsx`/`react` and `zod` are peer dependencies, already installed at the root).

## Why

The packages are published to `npm.pkg.github.com` under a **user** account and
are linked to the `tool_packages` repository. GitHub Actions' `GITHUB_TOKEN`
cannot read packages linked to another repository, and the long-lived
`SIMONMAK_ASCENT_PAT` repository secret expired — every CI install failed with
`ERR_PNPM_FETCH_401/403`. Vendoring removes the credential dependency entirely.

## Re-syncing

When `tool_packages` publishes a new version:

```bash
npm pack @simonmak-ascent/utils@<version> --registry=https://npm.pkg.github.com
tar -xzf simonmak-ascent-utils-<version>.tgz -C vendor/simonmak-ascent/utils --strip-components=1
# repeat for validation, then update the file: spec in package.json if the path changes
pnpm install
```

`package.json` references these paths with `file:` specs.
