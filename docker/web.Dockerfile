# ESG Hub web image.
#
# The release directory is a Next.js standalone build (`server.js`, `.next/`,
# `public/`, `node_modules/`), exactly what the systemd unit runs. The image
# carries that tree and nothing else; the SurrealDB credentials stay on the node
# in /etc/esg-hub/esg-hub.env and are passed at run time, never baked in.
#
#   docker build -f docker/web.Dockerfile -t esg-hub:<stamp> .
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3210 \
    HOSTNAME=0.0.0.0

# One COPY --chown layer, not COPY followed by `RUN chown -R`: the second form
# stores the whole tree twice (326 MB of image for a 115 MB release). `.next/cache`
# is excluded by the build context — see the note in the release directory.
COPY --chown=994:994 current/ /app/
RUN mkdir -p /app/.next/cache && chown 994:994 /app/.next/cache

# 994 is the `esghub` uid on the nodes; the container never runs as root.
USER 994:994

EXPOSE 3210

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3210/api/health || exit 1

CMD ["node", "server.js"]
