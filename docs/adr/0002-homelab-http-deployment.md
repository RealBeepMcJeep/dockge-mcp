# Deploy through the homelab MCP hub

The first deployment will be a container exposing Streamable HTTP through the
homelab MCP hub, rather than a client-launched stdio bridge. The project should
remain reusable, with the homelab as its first deployment; protocol compatibility
and authentication details still need to be checked against the actual hub and
clients before implementation.
