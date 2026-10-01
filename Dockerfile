# syntax=docker/dockerfile:1
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
RUN bun build --compile src/index.ts --outfile /app/dockge-mcp

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl libstdc++6 && rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 10001 dockge-mcp && useradd --uid 10001 --gid 10001 --no-create-home dockge-mcp && \
    mkdir /data && chown 10001:10001 /data
COPY --from=build /app/dockge-mcp /usr/local/bin/dockge-mcp
COPY LICENSE /usr/share/licenses/dockge-mcp/LICENSE
ARG BUILD_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG BUILD_VERSION=0.1.0
LABEL org.opencontainers.image.source="https://github.com/RealBeepMcJeep/dockge-mcp" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision="${BUILD_COMMIT}" \
      org.opencontainers.image.created="${BUILD_TIME}" \
      org.opencontainers.image.version="${BUILD_VERSION}"
ENV HOST=0.0.0.0 PORT=3000 STATE_DIR=/data
USER 10001:10001
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl --fail --silent http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/dockge-mcp"]
