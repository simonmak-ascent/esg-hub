# ESG Hub MCP server — stdio image for self-hosting / Glama builds.
FROM node:22-alpine AS build
WORKDIR /app
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci
COPY mcp-server/tsconfig.json ./
COPY mcp-server/src ./src
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY mcp-server/package.json mcp-server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENTRYPOINT ["node", "dist/index.js"]
