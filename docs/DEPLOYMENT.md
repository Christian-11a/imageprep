# Cloudflare Pages deployment

ImagePrep is a static React/Vite application. Cloudflare serves the built assets;
image preparation runs locally in each visitor's browser.

Live site: **https://imageprep.pages.dev/**. Initial deployment succeeded on
2026-10-03 from commit `9e3bda6`. Chrome live checks confirmed sample WebP
preparation (67 KB to 18 KB), original/prepared preview, and ZIP completion
feedback, with no recorded browser warnings or errors. Download buttons were
exercised; the browser automation could not independently confirm saved download
files, so check those manually when testing the release.

## Git integration

Connect the public `Christian-11a/imageprep` GitHub repository to a Cloudflare
Pages project. Grant the Cloudflare GitHub integration access to this repository
only when selecting repositories.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Vite, or None with the settings below |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |
| Node version | `24` (`.node-version`; use `NODE_VERSION=24` if needed) |

No application API keys, database, paid services, or custom domain are required.
Use the generated HTTPS `pages.dev` address for the initial release. Production
updates build from pushes to `main`; Git-connected Pages can also provide previews.

## Release checks

Run `npm run check` and `npm run test:production` before release. On the actual
deployment, verify that assets load, the sample prepares, previews work, and both
individual and ZIP downloads complete. Check the browser console for errors.

The existing GitHub Pages workflow is a manual alternative; it does not publish
automatically on push. Do not run it when Cloudflare Pages is the chosen host.

Deployment is complete only after Cloudflare reports success and the live URL
has passed smoke checks. Record the verified URL in README and the repository's
website field after deployment.
