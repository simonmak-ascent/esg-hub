#!/bin/bash
# Alias kept because the estate's compliance contract names `deploy/container/rollout.sh` as the
# deploy entry point. This repository's deploy is pull-based (the node converges on a timer), so the
# entry point is convergence, not a push.
exec "$(dirname "$0")/converge.sh" "$@"
