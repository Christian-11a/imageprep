# Verification and release handoff

Checked on October 3, 2026 (Asia/Manila). This is a local release; GitHub
publication and public hosting have not been performed.

## Results

| Check | Result |
| --- | --- |
| Unit tests | 19 passed |
| TypeScript and Vite production build | Passed |
| Microsoft Edge browser cases | 25 passed |
| Google Chrome browser cases | All 25 passed across the full run and settings-hint contrast repair recheck |
| Playwright Firefox browser cases | 25 passed |
| Production app below `/ImagePrep/` | Passed, including ZIP chunk loading and download |
| Automated accessibility | No WCAG 2 A/AA or 2.1 AA violations detected in the tested desktop, narrow-screen, and preview states |

Each browser ran the processing and workflow suite, four design checks, and eight
product UX checks.
Firefox uses a managed test binary stored in the ignored
`.playwright-browsers/` folder. It is not installed as a system browser.

## What the browser checks covered

- Real JPEG, PNG, and WebP outputs reopen with the expected MIME type and dimensions.
- Aspect ratio, no upscaling, alpha transparency, and JPEG background fill.
- JPEG EXIF orientation and lossy WebP header dimensions.
- Corrupt files, unsupported files, file-size limits, and oversized decoded dimensions.
- Sample image, responsive empty workspace, comparison preview, and individual download.
- ZIP contents and duplicate filenames, including new images added after processing.
- Settings changes invalidate downloads and release previous output URLs.
- Removal and clearing release image URLs.
- Cancellation retains successes and allows remaining images to finish.
- Simulated device export failure preserves successful outputs and can be retried.
- A preview opened during processing updates when the output arrives.
- Dialog Escape handling, keyboard focus trapping, and focus restoration.
- No image-upload requests observed during the tested workflow.
- Prepared filenames, metadata, and action labels remain readable at 320, 375,
  414, 768, and 1280 pixels, including with a reserved scrollbar gutter.
- Document width is checked against the available client width.
- Mobile visual order matches keyboard order; filename buttons open previews
  and restore focus after closing them.
- Success feedback is distinct from warnings and clears when settings change.
- Rejected files have individual reasons and recovery advice; invalid files do
  not consume slots ahead of ten valid images.
- Width and height drafts preserve outputs until blur and mark only their own
  invalid field. Target size has independent validation and resets for PNG.
- Clear undo restores prepared blobs with fresh working preview/download URLs.
- A sample export fits 50,000 bytes; a dense image that cannot fit 1,000 bytes
  keeps an available output and explicitly reports the missed target.
- Total batch byte/pixel admission boundaries are tested. The browser admission
  check simulates 20 MP decodes; it does not allocate three real 20 MP images.
- Mobile action feedback remains visible and fits the available client width.
- Size presets update both dimensions and invalidate previous outputs.
- Helpful disclosures open with the keyboard.
- Reveals work in short viewports and respond to live reduced-motion changes.
- No remote assets requested during the responsive/sample workflow; the font
  and original SVG artwork are bundled locally.

The app keeps the main JavaScript bundle around 89 KB gzipped, with a
separate lazy ZIP bundle around 28 KB gzipped and a 37 KB local font. These are
build sizes, not measurements of physical-device performance.

## Reproduce

```powershell
npm.cmd run check
npm.cmd run test:e2e
npm.cmd run test:production
```

The default browser is installed Microsoft Edge. For installed Chrome:

```powershell
$env:IMAGEPREP_TEST_BROWSER = 'chrome'
npm.cmd run test:e2e
Remove-Item Env:IMAGEPREP_TEST_BROWSER
```

For the downloaded test Firefox in this checkout:

```powershell
$env:IMAGEPREP_TEST_BROWSER = 'firefox'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npm.cmd run test:e2e
Remove-Item Env:IMAGEPREP_TEST_BROWSER
Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH
```

The Firefox binary is ignored by Git. After cloning elsewhere, download it using
Playwright if you want Firefox checks. Browser-test reports and traces are also
ignored. In the Codex sandbox, Firefox required an unrestricted local test run
to start; ordinary Edge and Chrome tests ran successfully within the sandbox.

## Limits of this verification

- Narrow-screen browser tests simulate layout. They do not measure memory or
  performance on a physical phone.
- Safari, iOS, and Android devices were not tested.
- Automated accessibility checks complement, rather than replace, manual
  assistive-technology testing.
- Exported metadata and color fidelity are not guaranteed. This is not an
  archival or professional color-processing tool.
- The hosting workflow is prepared but has not been exercised on GitHub.

## Your first test

Open `START-IMAGEPREP.cmd` and follow `TEST-WHEN-YOU-WAKE-UP.md`. All processing
features work without GitHub authentication, an MCP setup, API keys, or a paid
service. Refreshing the page clears the current images and results.
