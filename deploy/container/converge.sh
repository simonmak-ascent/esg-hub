#!/bin/bash
#
# Node-side convergence: make the running container match the published image, and prove it did.
#
#   ./deploy/container/converge.sh            # converge if the digest moved
#   ./deploy/container/converge.sh --dry-run  # report only
#   ./deploy/container/converge.sh --force    # redeploy the same digest
#
# Run by esg-hub-converge.timer every five minutes. Deliberately pull-based: the nodes are private,
# no runner is registered for this repository, and a push-based deploy would need credentials and
# inbound access the estate does not have.
set -euo pipefail

IMAGE="${ESG_HUB_IMAGE:-ghcr.io/simonmak-ascent/esg-hub:latest}"
NAME=esg-hub
PORT=3210
STATE=/var/lib/esg-hub/deployed.digest
DRY_RUN=0
FORCE=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  --force) FORCE=1 ;;
esac

log() { printf '  %s\n' "$*"; }

# A public package needs no credential to pull; log in only if one is provided.
if [ -n "${GHCR_TOKEN:-}" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-x}" --password-stdin >/dev/null 2>&1 || true
fi

log "pulling $IMAGE"
docker pull -q "$IMAGE" >/dev/null

DIGEST=$(docker inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null | cut -d@ -f2)
RUNNING=$(docker inspect "$NAME" --format '{{.Image}}' 2>/dev/null || echo none)
log "published digest ${DIGEST:0:19}…  running image ${RUNNING:0:19}…"

PREVIOUS=""
[ -f "$STATE" ] && PREVIOUS=$(cat "$STATE")

if [ "$DRY_RUN" = 0 ] && [ "$FORCE" = 0 ] && [ "$PREVIOUS" = "$DIGEST" ]; then
  log "already converged; nothing to do"
  exit 0
fi

# Create-then-swap: the replacement must answer before the old container is removed.
log "starting the replacement"
set +e
docker rm -f "${NAME}-next" >/dev/null 2>&1
docker run -d --init --name "${NAME}-next" --restart unless-stopped \
  -p "${PORT}:${PORT}" --user 994:994 \
  ${ESG_HUB_ENV:+--env-file "$ESG_HUB_ENV"} "$IMAGE" >/dev/null
RC=$?
set -e

ok=0
for _ in $(seq 1 45); do
  H=$(docker inspect "${NAME}-next" --format '{{.State.Health.Status}}' 2>/dev/null || echo unknown)
  [ "$H" = healthy ] && { ok=1; break; }
  sleep 2
done

if [ "$ok" = 1 ] && curl -sf -m 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  # Only now does the old container go: a failed start leaves production untouched.
  docker stop "$NAME" >/dev/null 2>&1 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker rename "${NAME}-next" "$NAME"
  install -d "$(dirname "$STATE")"
  printf '%s' "$DIGEST" > "$STATE"
  log "converged to ${DIGEST:0:19}…  zombies=$(ps -eo stat | grep -c '^Z')"
else
  log "replacement failed its health gate — production untouched"
  docker logs --tail 20 "${NAME}-next" 2>&1 | sed 's/^/    /' || true
  docker rm -f "${NAME}-next" >/dev/null 2>&1 || true
  exit 1
fi
