# Visual direction

ImagePrep uses an editorial look for a practical image tool. Warm paper and dark ink make the workspace easy to scan; a lime accent marks the active action. The landscape scenes are original vector artwork, made in the project and served locally.

## Core tokens

- Paper: `#f7f6f2`
- Ink: `#20241c`
- Accent lime: `#d7ff65`
- Display and interface type: variable DM Sans, bundled locally as one Latin WOFF2 file through `src/fonts.css`, with a sans-serif fallback

## Layout and flow

The hero explains the purpose and offers an immediate sample. Trying it scrolls to the tool. The upload area leads into image rows and a separate settings panel, with size presets, actual output dimensions, and a clearly disabled preparation action until images are available. On phones, settings and image rows stack. Original/prepared previews use a native modal dialog with keyboard focus restoration and a single-column comparison on narrow screens.

Supporting sections follow the tool: three steps, local-processing privacy, and keyboard-accessible disclosures for image limits and output tradeoffs. The header links to these sections without introducing extra pages.

## Artwork

The coast, desert, and alpine scenes use a shared 600 × 450 frame and a restrained palette, while each keeps a distinct atmosphere. Layered curves and small line details give the shapes depth without external images, fonts, or raster assets. The hero collage uses the scenes as a small visual index of formats the app can prepare.

## Motion and accessibility

Marked sections reveal once as they enter view. A single `<main>` reveal root owns the observer; rendered content stays visible until the observer setup is ready. The hook fails open when Intersection Observer is unavailable and reveals every target when reduced motion is requested, including preference changes while the page is open. Motion uses CSS transitions and Intersection Observer rather than an animation library. The interface itself requires JavaScript.

Hover motion is limited to buttons and the illustrated photo collage. Only opacity and transforms animate in section reveals, with no parallax, continuous background animation, or WebGL cost. Controls use visible keyboard focus and native input semantics. Supporting text is at least 12px; contrast is checked in empty, prepared, disclosure, and preview states.

The SVGs include titles and descriptions for direct use. When used as decorative hero art beside explanatory text, the app can mark the images decorative to avoid repeating that description.

## Hallmark audit refinements

The audit fixes preserve the warm paper, ink, and lime identity. Semantic color
tokens and a four-pixel spacing scale keep the styling consistent. Headline
tracking is more readable, supporting text uses the body face, and headings
no longer depend on decorative ordinal labels.

Image rows appear before settings on narrow screens in both visual and keyboard
order. Filenames are preview buttons; metadata and actions remain readable even
with long filenames and classic scrollbars. Success notices use a quiet green
check, while warnings keep their amber treatment. Buttons have pressed feedback,
hover effects are restrained, and progress animates with a transform.

## Product UX refinements

Supported formats and per-file limits stay visible after adding images. A nearby
disclosure explains unsupported formats and the total batch budget. Rejected
files use a structured report with filenames, reasons, and recovery instructions.
They do not consume slots reserved for accepted files.

Width, height, and target-size drafts commit on blur. Errors are attached only to
the invalid field and appear after leaving it. Changed export settings explain
why preparation is needed again. A fixed mobile action bar provides a shortcut
to settings, cancellation, and ZIP saving without adding another processing path.

Clear all releases live object URLs immediately and retains one file/blob snapshot
for up to 15 seconds. Undo creates fresh URLs; a subsequent batch action expires
the snapshot. Target-size export reuses one canvas for at most seven encodes,
keeps dimensions intact, and reports both successful and unattainable targets.

## Review artifacts

- `docs/screenshots/before-redesign.png`: previous interface
- `docs/screenshots/redesign-desktop.png`: new desktop view
- `docs/screenshots/redesign-mobile.png`: new mobile page
- `docs/screenshots/comparison.png`: prepared-image preview
- `docs/screenshots/hallmark-mobile-workspace.png`: prepared mobile rows after audit fixes
- `docs/screenshots/ux-mobile.png`: per-file recovery and mobile actions

Browser checks and their limits are documented in `VERIFICATION.md`.
