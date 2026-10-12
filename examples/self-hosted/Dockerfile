# Self-hosted draw.io with draw.hmi: the official jgraph/drawio image with the
# plugin in plugins/draw.hmi. Build the plugin first (npm run build in the
# repository root), then: docker compose up --build
ARG DRAWIO_VERSION=32.4.1
FROM jgraph/drawio:${DRAWIO_VERSION}

COPY --chown=tomcat:tomcat dist/draw.hmi /usr/local/tomcat/webapps/draw/plugins/draw.hmi
COPY --chmod=755 examples/self-hosted/entrypoint.sh /draw.hmi-entrypoint.sh

ENTRYPOINT ["/draw.hmi-entrypoint.sh"]
CMD ["catalina.sh", "run"]
