# Image Prep Tool — draft project plan

Status: local release implemented. Audience and learning preferences are confirmed. ImagePrep is the working project name. Public repository and hosting are deferred until the user tests the app and requests publication. See docs/VERIFICATION.md for completed checks.

## Purpose

Build a free, open-source browser tool for resizing and converting images individually or in small batches. Users preview results and download their files without uploading image contents to a server.

The confirmed audience is everyday users preparing images for uploads. The user is a fourth-year CS student preparing for OJT, with a good foundation and room to strengthen practical development skills. Explain key decisions and keep the architecture straightforward enough to understand and discuss in interviews. The working name is Image Prep; final branding is pending.

## Cost and setup

- Use free, open-source dependencies and browser APIs.
- Publish source in a public GitHub repository and the demo on GitHub Pages using its supplied domain.
- Stay within GitHub's free hosting and workflow allowances. Avoid paid services and billing-enabled extras.
- No backend, database, external image-processing API, account system, or custom domain is needed.
- Development assistance costs depend on the user's existing tooling; the app itself does not require an AI subscription or API.
- Local inspection found Node.js v24.13.0, npm 11.6.2, and Git 2.46.0.windows.1. GitHub CLI was not found on PATH.
- GitHub account access is needed for publication, not local development. Prefer normal Git authentication; GitHub CLI is optional for repository management.
- No MCP server is required. Existing local file, terminal, and browser capabilities are sufficient. GitHub integration can be added later if convenient.
- Authenticate through the provider's login flow rather than sharing credentials in chat.

## First release

1. Add JPEG, PNG, and WebP files with a file picker or drag and drop.
2. Show thumbnails, original dimensions, and file sizes. Allow removal and clearing the list.
3. Choose output format: JPEG, PNG, or WebP when supported by the browser.
4. Set maximum width and height. Preserve aspect ratio and do not upscale by default.
5. Set JPEG/WebP quality with a slider and clear explanation. PNG has no lossy quality slider.
6. Choose a background color for JPEG exports of transparent images; default to white.
7. Click Process to create outputs sequentially, with progress and per-file error states.
8. Compare original and output previews; show dimensions, sizes, and actual percentage change, including size increases.
9. Download one output or all successful outputs as a ZIP, with unique filenames.
10. Offer a small bundled sample image to make the demo easy to try.

Initial conservative limits: 10 files per batch, 10 MB per file, 20 megapixels per decoded input, and 4096 pixels per output dimension. Validate these limits in desktop and mobile testing and document them. Compressed file size alone is not a sufficient memory limit.

## Interface

One responsive page: Add images → Choose settings → Process → Preview and download.

On desktop, place settings beside the image list. On mobile, stack controls above the results. Use labeled controls, keyboard-accessible upload and downloads, visible focus indicators, and progress/error announcements. A short note explains that image contents stay on the device.

Changing settings marks existing outputs as out of date until reprocessed. Do not silently offer old outputs as if they match new settings.

## Implementation

- Vite, React, and TypeScript for the app.
- Plain CSS for the initial design; introduce a styling framework only if it improves delivery.
- Browser image decoding and Canvas drawing/export for processing.
- A small ZIP dependency such as JSZip, with its license checked when selected.
- Vitest for dimension and filename logic; browser integration checks for real image decoding and exports.
- Keep image-processing functions separate from UI components.
- Keep original and output blobs in memory for the current session; avoid persistence of user images.
- Process one image at a time and release bitmap/canvas resources promptly. Revoke object URLs when removed or replaced.
- Bundle assets locally. No analytics or remote file-processing requests in the initial release.

## Edge cases and product limits

- Detect unreadable files and unsupported formats without failing the whole batch.
- Verify the resulting blob's MIME type because browsers can fall back to PNG for unsupported exports.
- Test portrait photos with orientation metadata, transparent PNGs, and repeated filenames.
- Explain that re-exported files may lose metadata and vary in color rendering; this is a web-image preparation tool, not an archival or professional color workflow.
- PNG exports may grow in size. Show actual results rather than promise every export is smaller.
- Do not support GIF animation, HEIC, SVG, RAW, AVIF, cropping, AI enhancement, or guaranteed target-file-size output in version one.
- Catch export failures and handle mobile memory limits with useful messages.

## Milestones and acceptance checks

### 1. Foundation and interface

Create the project in a dedicated subfolder, initialize Git, add layout and sample data, and verify the production build. Confirm naming and visual direction with the user during planning.

### 2. Single-image processing

Implement decoding, resize calculations, export, preview, and download. Confirm aspect ratio, no-upscale behavior, transparency handling, actual MIME type, and that downloads reopen correctly.

### 3. Batch workflow

Add sequential processing, progress, removal, per-file errors, duplicate-name handling, and ZIP export. Confirm that a bad input does not discard successful results and that changed settings invalidate old outputs.

### 4. Quality and documentation

Test representative JPEG/PNG/WebP fixtures, orientation, size limits, keyboard use, narrow screens, and Chrome/Edge plus Firefox. Check Safari/iOS where a device is available; disclose unverified browsers.

Write README, local setup instructions, known limitations, contribution guidance, an MIT license once confirmed, screenshots, and a short portfolio case study explaining decisions and tradeoffs. Use self-created or clearly licensed demo assets.

### 5. Public release

Create or select the user's public repository after naming is settled. Authenticate normally, push the reviewed source, and configure GitHub Pages deployment. Verify asset paths under the repository URL, the live processing flow, and downloads. Keep this stage pending until the user requests publication.

## Local release definition of done

- Working locally testable app, with public repository and hosting prepared but deferred.
- Accurate resize/conversion previews and usable individual/ZIP downloads.
- User image contents are processed locally; network checks confirm no image uploads.
- Clear errors and documented format/device limits.
- Responsive and keyboard-usable interface.
- Production build and relevant checks pass.
- README, screenshots, license, and portfolio case study are present.

## Later improvements

After feedback: named export presets, offline support, crop controls, processing in a worker, and target-size compression. Add these separately rather than expand the initial release.

## User inputs and remaining decisions

- Confirmed: fourth-year CS student preparing for OJT, with good fundamentals; explain practical architecture and tradeoffs.
- Confirmed: everyday users preparing images for uploads.
- Confirmed: user already has a GitHub account.
- Pending: final project/repository name. Use Image Prep as a working name.
- Needed at publication: GitHub profile URL or username and normal provider authentication.
- Proposed defaults: public repository, MIT license, clean neutral visual design, GitHub Pages deployment. These are planning recommendations, not actions already taken.

## Sources

- GitHub Pages availability and limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Canvas export behavior: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- Optional Codex MCP configuration: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
