# Contributing to ImagePrep

Keep changes focused on making image preparation easier for everyday users.

1. Install Node.js 24 LTS and run `npm install`.
2. Run `npm run dev` and reproduce the behavior before changing it.
3. Keep image-processing functions separate from interface code.
4. Run `npm run check` and `npm run test:e2e` before submitting a change. The default browser test project uses installed Microsoft Edge.
5. Explain the problem, resulting behavior, and checks performed in the pull request.

Use generated or explicitly licensed image fixtures. Never commit private photos,
credentials, `node_modules`, or build artifacts. Add tests for meaningful behavior,
especially image dimensions, format handling, resource cleanup, and batch failures.

The app processes image contents locally. Changes that send user images to an
external service require a separate product decision and an explicit user-facing
explanation.
