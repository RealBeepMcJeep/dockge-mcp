# Dockge MCP

A proposed MCP server for managing Dockge stacks. Research and a design interview
are in progress; this repository does not yet contain a working server.

## Project notes

- [Dockge source and UI review](docs/research/dockge.md)
- [MCP server guidance](docs/research/mcp.md)
- [Design interview and open decisions](docs/design.md)
- [Domain glossary](GLOSSARY.md)

The intended capabilities include stack discovery, lifecycle actions, editing,
creation, status, logs, and container-related operations. Exact scope, deployment,
and execution semantics are being decided with the project owner.

## Reference source

Dockge is cloned locally at `reference/dockge` and excluded from this repository.
The reviewed revision is recorded in [reference/README.md](reference/README.md).
Upstream source remains under its own MIT license. This project has not selected
its own distribution license yet.

No commands have been sent to a live Dockge instance during this research.
