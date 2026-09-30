# Dockge MCP

A planned MCP server for managing Dockge stacks. Architecture is settled and
awaiting final shared-understanding confirmation; there is no working server yet.

## Project notes

- [Dockge source and UI review](docs/research/dockge.md)
- [MCP server guidance](docs/research/mcp.md)
- [Rust and TypeScript comparison](docs/research/runtime.md)
- [Selected TypeScript/Bun runtime](docs/research/bun.md)
- [Initial tool contract](docs/contract.md)
- [GitHub Actions and GHCR publishing](docs/publishing.md)
- [Owner's public build examples](docs/research/public-build-examples.md)
- [Implementation plan](docs/implementation-plan.md)
- [Design interview and accepted decisions](docs/design.md)
- [Unsupported-operation examples](docs/unsupported-scenarios.md)
- [Deferred work](docs/TODO.md)
- [Domain glossary](GLOSSARY.md)

The selected runtime is TypeScript with Bun. The initial scope follows Dockge
1.5.0 operational behavior: discovery, stack lifecycle, YAML editing, creation,
status, bounded logs, and separately authorized `.env` retrieval/modification.
Shells are deferred. Durable operation recovery and Linux x64/arm64 Docker/binary
packaging are selected. Public GitHub Actions will publish images to GHCR; the
public mirror will be `realbeepmcjeep/dockge-mcp`, with Gitea authoritative.
The architectural interview is complete; final design confirmation is pending.

## Reference source

Dockge is cloned locally at `reference/dockge` and excluded from this repository.
The reviewed revision is recorded in [reference/README.md](reference/README.md).
Upstream source remains under its own MIT license. This project is also licensed
under [MIT](LICENSE).

No commands have been sent to a live Dockge instance during this research.
