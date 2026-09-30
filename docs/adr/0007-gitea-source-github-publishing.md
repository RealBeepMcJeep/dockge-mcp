# Keep Gitea authoritative and publish through a public GitHub mirror

Development remains in `AI-Goes-Fast/dockge-mcp` on Gitea, with a one-way public
push mirror to `realbeepmcjeep/dockge-mcp` for GitHub Actions builds and releases.
Publish Docker images to `ghcr.io/realbeepmcjeep/dockge-mcp` and Linux x64/arm64
binary release assets. This combines the chosen Gitea development home with
public build infrastructure, at the cost of mirror setup and requiring all
source changes to reach Gitea before synchronization; GitHub credentials will
be configured later.
