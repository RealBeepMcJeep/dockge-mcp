# Dockge MCP

A proposed MCP server for managing Dockge stacks. Research and a design interview
are in progress; this repository does not yet contain a working server.

## Project notes

- [Dockge source and UI review](docs/research/dockge.md)
- [MCP server guidance](docs/research/mcp.md)
- [Rust and TypeScript comparison](docs/research/runtime.md)
- [Selected TypeScript/Bun runtime](docs/research/bun.md)
- [Initial tool contract](docs/contract.md)
- [Design interview and open decisions](docs/design.md)
- [Unsupported-operation examples](docs/unsupported-scenarios.md)
- [Deferred work](docs/TODO.md)
- [Domain glossary](GLOSSARY.md)

The selected runtime is TypeScript with Bun. The initial scope follows Dockge
1.5.0 operational behavior: discovery, stack lifecycle, YAML editing, creation,
status, bounded logs, and separately authorized `.env` retrieval/modification.
Shells are deferred. The design interview is settling recovery and packaging.

## Reference source

Dockge is cloned locally at `reference/dockge` and excluded from this repository.
The reviewed revision is recorded in [reference/README.md](reference/README.md).
Upstream source remains under its own MIT license. This project has not selected
its own distribution license yet.

No commands have been sent to a live Dockge instance during this research.
