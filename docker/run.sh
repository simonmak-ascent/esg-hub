#!/bin/bash
#
# The one place that says how the web container runs. Previously this lived in an ad-hoc script under
# /tmp, so the production container had no declarative source and could not be reproduced.
#
#   ./docker/run.sh <image-tag>            # start on this node
#   ./docker/run.sh <image-tag> --dry-run  # print the command
#
# `--init` is not optional. It puts tini at PID 1 so orphaned children are reaped. Without it, PID 1 is
# node, which never calls wait(), and every healthcheck that hits its timeout leaves a zombie: 26/29/26
# of them were measured on ecs-02/03/04 after 35 hours.
set -euo pipefail

IMAGE_TAG="${1:?usage: docker/run.sh <image-tag> [--dry-run]}"
NAME=esg-hub
PORT=3210
ENV_FILE="${ESG_HUB_ENV:-/etc/esg-hub/esg-hub.env}"

ARGS=(run -d --init --name "$NAME" --restart unless-stopped
      -p "${PORT}:${PORT}" --user 994:994)
[ -f "$ENV_FILE" ] && ARGS+=(--env-file "$ENV_FILE")
ARGS+=("esg-hub:${IMAGE_TAG}")

if [ "${2:-}" = "--dry-run" ]; then
  printf 'docker'; printf ' %q' "${ARGS[@]}"; printf '\n'
  exit 0
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker "${ARGS[@]}" >/dev/null

for _ in $(seq 1 45); do
  [ "$(docker inspect "$NAME" --format '{{.State.Health.Status}}')" = healthy ] && break
  sleep 2
done
curl -sf -m 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null
docker inspect "$NAME" --format '  {{.Name}} init={{.HostConfig.Init}} health={{.State.Health.Status}}'
