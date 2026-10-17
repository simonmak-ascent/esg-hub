# Design token provenance

These files are **vendored verbatim** from the APF design system. They are the
single source of truth for colour, type, spacing, radius, motion and layout in
this app. Do not hand-edit them.

| File | Source |
| --- | --- |
| `tokens.v2.json` | `apf-website/client/src/styles/tokens.v2.json` |
| `tokens-dark.json` | `apf-website/client/src/styles/tokens-dark.json` |
| `tokens.status.json` | `apf-website/client/src/styles/tokens.status.json` |

- Source commit: `1fa581d86f7082d19ff730bf558464af4941327a` (2026-10-16)
- Upstream architecture doc: `apf-website/docs/design-tokens.md`
- Upstream note: `apf-website/UNIFIED_DESIGN_SYSTEM.md` is **superseded** by
  these token files; where the two disagree, the tokens win.

## How they are consumed

`scripts/generate-tokens.mjs` resolves the `{a.b.c}` references and emits
`src/styles/tokens.generated.css` — the `--apf-*` custom-property layer plus
the primitive scales. Run `pnpm tokens:generate` after changing a token file,
and `pnpm tokens:guard` to prove no hex colour escaped the token layer.

## Local extension

`src/styles/esg-overlay.css` maps the ESG pillar/section accents onto APF
primitives. It is the only local design decision, kept separate from the
vendored files so upstream updates remain a clean copy.
