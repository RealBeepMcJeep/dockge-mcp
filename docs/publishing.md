# GitHub Actions and GHCR publishing

The owner accepted Docker plus compiled Bun executables for Linux x64/arm64,
MIT licensing, and public GitHub Actions automatic builds/publishing to GHCR.
The public GitHub owner is `realbeepmcjeep`; Gitea remains authoritative with a
one-way public GitHub push mirror. GitHub credentials will be supplied later.
No GitHub repository, workflow, release, or package has been created yet.

## Destinations

- Development repository exists at Gitea organization `AI-Goes-Fast`, name
  `dockge-mcp`.
- Public GitHub repository: `realbeepmcjeep/dockge-mcp`.
- Container package: `ghcr.io/realbeepmcjeep/dockge-mcp`.
- Binary release assets: Linux x64 and arm64 executables, with checksums.

## Accepted repository flow

Keep Gitea authoritative and configure a one-way push mirror to public GitHub.
[Gitea push mirrors](https://docs.gitea.com/usage/repository/repo-mirror/)
export commits, branches, and tags. They overwrite destination changes, so
source changes must land in Gitea. GitHub hosts Actions/release artifacts; its
mirror must not become a competing source. Push-on-commit mirroring requires a
supported Gitea version; otherwise use its scheduled/manual synchronization.

The [documented GitHub mirror setup](https://docs.gitea.com/usage/repository/repo-mirror/#setting-up-a-push-mirror-from-gitea-to-github)
uses a GitHub credential stored in Gitea's mirror configuration, with access to
push code and workflows. Create the public GitHub destination first. Never put
the mirror credential in code or image layers. The public build runner does not
need to reach private Gitea or Dockge; source is pushed outward to GitHub.

Do not configure bidirectional mirroring. GitHub contributions must be brought
into the Gitea source before mirroring, rather than merged only in GitHub.

## Proposed build/release policy

The owner's [public build examples](research/public-build-examples.md) provide
CI gating, Buildx caching, build metadata, MCP smoke, and anonymous-visibility
conventions. Adapt them for Bun, two architectures, binary release artifacts,
and the release channels below.

| Trigger | Validation/build | Publication |
| --- | --- | --- |
| Pull request | Frozen Bun install, type/schema checks, meaningful unit/integration fixtures, binary/image build checks. | No registry push or release write. |
| Trusted `main` push | Same checks; x64/arm64 artifacts and multi-platform image. | GHCR `dev` and commit-addressed tags; CI binary artifacts. |
| Validated `v*` SemVer tag | Same checks; verify tagged commit belongs to release history. | Versioned GHCR image and binary release assets/checksums. Stable releases also update `latest`; prereleases do not. |

Mirrored tags are pushes, not GitHub Release objects. Trigger releases with tag
pushes; a workflow can then create the corresponding GitHub Release. External
credential pushes trigger [normal push workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
unlike recursive events suppressed for workflow-generated GITHUB_TOKEN pushes.

Install pinned Bun with [oven-sh/setup-bun](https://bun.com/guides/runtime/cicd),
commit the lockfile, and enforce it with `bun ci`. Compile each target using
[Bun's executable build support](https://bun.com/docs/bundler/executables).
Verify artifacts on the matching architecture; cross-compilation alone is not
runtime validation. Pin actions by commit SHA and keep dependency versions
explicit. Docker Buildx produces the Linux amd64/arm64 image manifest.

## Publishing permissions and visibility

Use Actions' generated repository `GITHUB_TOKEN` with `contents: read` and
`packages: write` in the image-publish job. Binary GitHub Release publication
needs `contents: write` in its own release job. Tests/PR jobs only receive read
permissions. No manually provisioned long-lived GHCR token is needed in CI.
See [GitHub's publishing example](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

Tag images with source/revision/version labels, including
`org.opencontainers.image.source`, to link them to the public repository. Newly
created GHCR packages default to private even when the source repo is public;
set the package to Public after its first push and verify anonymous pulls.
See [GHCR package behavior](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Public CI uses test fixtures/disposable stacks and does not connect to production
Dockge or use homelab credentials. Runtime Dockge credentials, MCP bearer key,
operation ledger, raw environment files, and logs are never release artifacts.

## Current prerequisites

No usable GitHub credentials or GitHub CLI were found in read-only local
discovery; the owner will configure access later. Implementation/workflow
preparation can proceed locally after shared understanding is confirmed, while
GitHub publication requires configured access. The Gitea repository and accepted
design records are already committed.
