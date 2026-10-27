# Handover — esg-hub

**Repo:** `simonmak-ascent/esg-hub` · **Handed over:** 2026-10-27 · **Platform contact:** apg-infra owner
**What it is:** Ascent Partners Foundation ESG Hub — Next.js 16 App Router, React 19,
`output: "standalone"`, SurrealDB as the only datastore, five locales, ~1,000 prerendered routes.

This note records the state of the estate wiring at handover and the application work that belongs
to the repository owner. Platform facts (nodes, ALB, certificates, container contract) live in
`apg-infra/docs/standards.md`; this file does not restate them, it points at them.

---

## 1. Who owns what

| Area | Owner |
|---|---|
| The webapp: pages, data model, SurrealDB schema, content pipeline, health semantics, tests, docs | **Repository owner** |
| The estate: nodes, ALB, TLS, certificates, security groups, firewall, container contract, image delivery | Platform (apg-infra) |
| `container.json` platform fields — `port`, `image`, `run.*` | Platform; propose changes with them |
| `container.json` app fields — `health.path`, `health.host`, `hosts` | Repository owner, in coordination — the ALB probe and rule are generated from them |

---

## 2. Production shape at handover

| | |
|---|---|
| Runtime | **container** `esg-hub` on ecs-01/02/03, `0.0.0.0:3210`, uid **994**, `mounts=0`, `--restart unless-stopped` |
| Image | `ghcr.io/simonmak-ascent/esg-hub@sha256:ccd68555…` — **115 MB**, published and pinned by digest in `container.json` |
| Ingress | ALB rule priority 59 → `apg-esg-hub-3210`, 30 s connection drain |
| Health | `GET /api/health` with `Host: esg-hub.ascent-partners.com` |
| Public hosts | `esg-hub.ascent-partners.com`, `esg-hub.ascent.partners` |
| Config | `/etc/esg-hub/esg-hub.env` on each node (root:esghub, 640), passed to the container with `--env-file` after normalising quotes into `/run` |
| Old unit | `esg-hub.service` is **disabled** — re-enabling it collides with the container on 3210 |
| Gate | `apg-infra/scripts/parity.py` asserts status, canonical and a content marker for both hosts |

**Deployment is by digest.** `image.yml` pushes a node-built image to GHCR with the job's own
short-lived token (no registry credential on a host); `deploy.yml` then runs on the node and starts
that digest. Both are `workflow_dispatch`:

```bash
gh workflow run image.yml  -f image=esg-hub:<stamp> -f runner=apg-ecs-01
gh workflow run deploy.yml -f digest=sha256:<digest> -f runner=apg-ecs-01
```

Pin the digest in `container.json` in the same commit that changes what runs.

---

## 3. What changed on 2026-10-27

1. **Vercel is gone from the codebase.** `vercel.json`, `.vercel/`, `scripts/load-vercel-env.mjs`
   and `VERCEL_PROTECTION_FIX.md` are deleted. `deploy.yml` was *replaced* (not deleted) by the
   fleet deployment in #119; `image.yml` (#125) publishes the image.
2. **`PRODUCTION_ENV` repository secret** supplies the runtime environment to CI. `nightly.yml`,
   `km-ingestion.yml` and `km-rd-loop.yml` write it to `.env.production.local` instead of pulling
   from Vercel.
3. **`esg-hub.vercel.app` is not ours.** The Vercel project no longer exists; that subdomain is
   served by an unrelated account's project of the same name ("African ESG Hub", a Vite SPA). Do not
   treat it as a deployment, do not point DNS at it, do not try to reclaim it.
4. `AGENTS.md` describes the container deployment. `constitution.md` was left untouched (archival).
   Note: **`AGENTS.md` is gitignored in this repository**, so those instructions are local to a
   checkout and are not part of the handover for anyone who clones it — this file is the durable
   record.

---

## 4. Application-level issues to fix

Ordered by risk to production.

| # | Issue | Why it matters |
|---|---|---|
| 1 | **Verify the three scheduled workflows run.** `nightly` (18:17 UTC), `km-ingestion` (06/18:17 UTC), `km-rd-loop` (04:13 UTC) each write `PRODUCTION_ENV` first. | They previously depended on the removed Vercel project; this is the first time they run from a secret. |
| 2 | **Stale `SURREAL_*` repository secrets.** The old workflow comments record them as `InvalidAuth`; they are now shadowed by `PRODUCTION_ENV` but still exist. | Two sources of truth. Delete or refresh, then document which wins. |
| 3 | **The health endpoint conflates liveness with content.** `GET /api/health` returns **503** when the database is unreachable *or* the corpus has fewer than `MIN_PAGES = 200` pages, and the ALB probes exactly this path. | A legitimate corpus change below 200 would drain the whole site. Split liveness from readiness, or parameterise the threshold — and tell the platform, because the probe follows the declaration. |
| 4 | **The prerender cache is container-local.** `revalidate = 300`, cache in `.next/cache` inside the image. | It resets on restart and differs per node. Acceptable or not is a design decision; if not, it needs an external cache. |
| 5 | **Secrets live in `/etc/esg-hub/esg-hub.env` on three nodes.** No rotation owner, no record of who changed them. | The repository owner owns those values; decide a rotation and storage story and keep `PRODUCTION_ENV` in step. |
| 6 | **`opencode.json` is modified and uncommitted** in the working tree. | Commit it or discard it so the next contributor starts clean. |
| 7 | **Docs sweep.** `README.md` still describes Vercel deployment. | A newcomer following it will look for a deployment that no longer exists. |
| 8 | **`verify:db` needs live SurrealDB credentials**, and `ci.yml` runs the gates on every PR. | Confirm the database step passes with the secret, or is explicitly allowed to warn. |

---

## 5. The container contract to keep

`container.json` in the repository root, validated by
`apg-infra/scripts/container-contract-check.sh`:

- one TCP port (`3210`), never `80`/`443` — the balancer terminates TLS
- bind `0.0.0.0`; loopback is unreachable from the ALB
- non-root uid (currently **994**, the `esghub` user); no `privileged`, no host networking
- exec-form entrypoint, so `SIGTERM` reaches the process and draining works
- `health.host` is the application's own host, never `$SERVER_IP`
- no secret in the manifest or in the image

Build as a **standalone** release (`pnpm build`) and keep `container.json` in step with the app.

---

## 6. Platform items still open

| Item | Effect on this repository |
|---|---|
| Certificate import | the wildcard renews 23 Dec and expires 21 Jan; the platform owns the import (console-only until then) |
| Health probe behaviour | the balancer does not measurably gate traffic on a failing health path — do not rely on the probe alone |
| ActionTrail holds no ALB events | edge changes on this host are not auditable |

The GHCR push and the digest pinning this file used to list as missing are **done**, as are the
CloudMonitor alarms (per-node CPU/memory/disk plus `apg-alb-5xx` and `apg-alb-unhealthy`) and the
15-minute public-host probe on ecs-02.

---

## 7. Do not

1. Do not re-add Vercel, a `vercel.json`, or a Vercel deploy workflow.
2. Do not re-enable `esg-hub.service`; it collides with the container on 3210.
3. Do not publish on `127.0.0.1` or on a node-specific port.
4. Do not put a token, key or password in the repository, a manifest or a compose file.
5. Do not edit ALB rules, security groups, `ufw` or the `DOCKER-USER` filter — the balancer is the
   only way in, by design.
6. Do not change `health.path` or `hosts` without telling the platform: the ALB rule and its probe
   are generated from the declaration.
7. Do not `kill -9` a service to free its port — `systemctl disable --now` first, or the unit's
   restart policy re-takes it.

---

## 8. First week

1. Run all three scheduled workflows manually once and read the logs end to end.
2. Decide the `SURREAL_*` secrets question (delete or refresh).
3. Split or parameterise the health endpoint, then tell the platform the new probe.
4. Sweep `README.md` and `docs/` for Vercel and the retired topology.
5. Get a clean working tree (`opencode.json`).
6. Agree with the platform what "deploy" means: today it is `deploy.yml` with a pinned digest.
