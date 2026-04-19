# FF-DA — Fantasy Football Draft Assistant

A monorepo containing the Fantasy Football Draft Assistant web app built with Angular.

## Development

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)

### Install dependencies

```bash
pnpm install
```

### Run locally

```bash
pnpm draft-assistant:start
```

### Build

```bash
pnpm draft-assistant:build
```

---

## Deploy / Pages

### Deployment method

The site is deployed to **GitHub Pages** via **GitHub Actions** using the official [`actions/deploy-pages`](https://github.com/actions/deploy-pages) action.

### How it works

1. On every push to `main` (or via manual `workflow_dispatch`), the **Deploy** workflow (`.github/workflows/deploy.yml`) runs:
   - Installs dependencies with `pnpm`.
   - Builds the Angular app with `--base-href /FF-DA/` so all asset and route paths are relative to the project sub-path.
   - Uploads the build output as a Pages artifact.
   - Deploys the artifact to GitHub Pages.
2. On every push to `main` (including merged pull requests) or via manual `workflow_dispatch`, the **Update llms.txt** workflow (`.github/workflows/update-llms.yml`) refreshes the repository root `llms.txt` from Gitingest and commits it back when the generated content changes.

### Required repository settings

In **Settings → Pages**:
- **Source**: `GitHub Actions` (not a branch).

The workflow requires the following repository permissions (already configured in the workflow file):
- `pages: write`
- `id-token: write`

### Expected public URL

```
https://feyb.github.io/FF-DA/
```
