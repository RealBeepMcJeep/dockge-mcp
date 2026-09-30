# Upstream references

Reviewed on 2026-09-30:

- Repository: https://github.com/louislam/dockge
- Branch: `master`
- Commit: `f809ae192b571944ad773e9866d3e67064ae8043`
- Commit date: 2026-04-18
- Package version: `1.5.0` (source checkout; not proof of a released/deployed version)
- Local checkout: `reference/dockge`
- License: upstream MIT; see `reference/dockge/LICENSE`

Reproduce the reviewed checkout from this project's root:

```sh
git clone https://github.com/louislam/dockge.git reference/dockge
git -C reference/dockge checkout --detach f809ae192b571944ad773e9866d3e67064ae8043
```

The checkout is ignored so our project history does not include a copy of Dockge.
The implementation must have a declared supported version and protocol fixtures;
this snapshot alone does not establish compatibility with any live installation.

Follow-up comparison also reviewed official release tag `1.5.0`, commit
`bac498f97ffc33f7ffb2380bd68493de0719f4dd`, using upstream source URLs. Release
and master differ despite the same package version; see the source review.
