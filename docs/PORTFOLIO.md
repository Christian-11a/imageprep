# ImagePrep portfolio case study

## Problem

Preparing a few images for upload often requires repeated manual resizing and
format conversion. Everyday users need a short workflow with a preview and clear
file sizes, without creating an account or sending photos to a processing server.

## Solution

ImagePrep is a free browser tool for resizing and converting JPEG, PNG, and WebP
images. Users choose settings, process a small batch, inspect the results, and
download individual files or a ZIP.

## Engineering decisions to discuss

- **Local processing:** browser image decoding and Canvas export avoid backend
  costs and external image uploads. Processing speed depends on the user's device.
- **Aspect-ratio preservation:** one scale factor fits both maximum dimensions,
  capped at one to prevent accidental upscaling.
- **Sequential processing:** one image at a time reduces simultaneous memory
  pressure. File-size and decoded-pixel limits are separate protections.
- **Output verification:** inspect the actual exported MIME type instead of
  assuming every browser supports the requested format.
- **Transparent images:** JPEG requires a background color because it cannot
  retain alpha transparency.
- **State consistency:** changed settings invalidate previous results so stale
  outputs cannot be downloaded as if they used the new settings.
- **Useful batch failures:** a failed image should not discard successful results.
- **Visual design:** an original SVG collage, a locally served variable font, and
  a consistent paper/ink/lime palette give the tool a recognizable identity.
- **Accessible interactions:** native controls and a modal dialog provide keyboard
  navigation; section reveals respect live reduced-motion preferences.
- **Responsive validation:** browser checks cover controls from 320 to 1920 pixels,
  alongside actual file exports and download behavior.

## Honest scope

This is a web-image preparation tool. It does not promise archival fidelity,
professional color management, preserved metadata, exact target file sizes, or
smaller output for every input. It excludes animated images and HEIC/RAW/SVG inputs.

## Development disclosure

The project was built with AI development assistance and human review. Before
using it in a portfolio, inspect the code, reproduce the tests, make your own
improvements, and explain the implementation in your own words. Describe only
checks and user feedback that actually happened.

## Suggested next steps

Test with a few real users, document specific feedback, and improve the workflow
based on that feedback. Record the issue and before/after behavior of each change.
Add a live demo and repository link after publication; do not imply they already
exist.
