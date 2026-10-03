# ImagePrep roadmap

ImagePrep is a free, open-source tool for everyday image uploads. Keep processing
on the device and prefer small, useful improvements over unnecessary dependencies.

## v1.0 — Initial public release

- [x] JPEG, PNG, and still WebP preparation with previews and individual/ZIP downloads.
- [x] File validation, individual rejection recovery, and bounded batch processing.
- [x] Responsive interface, keyboard navigation, and reduced-motion support.
- [x] Best-effort file-size targets and short clear-undo recovery.
- [x] Automated processing, workflow, accessibility, and production-subpath checks.
- [ ] Publish the public GitHub repository and deploy a free demo.
- [ ] Test Safari/iOS and real low-memory phones.
- [ ] Gather feedback from 3–5 users preparing images for actual uploads.

## v1.1 — Usability

Prioritize findings from initial user testing. Candidates: reusable upload presets,
remembering settings locally, clearer format selection, and more assistive-technology
testing. Keep image persistence separate from saving preferences.

## v1.2 — Performance

Measure memory and responsiveness before changing limits. Investigate Web Workers,
smaller thumbnails, and cancellation within multi-encode operations. OffscreenCanvas
alone does not move processing into a worker. Retain bounded concurrency and graceful
failure on devices that cannot finish an export.

## v1.3 — Practical features

Consider crop/rotate, configurable output filenames, and saved custom presets when
user feedback justifies them. Research HEIC and additional formats separately for
licensing, compatibility, download size, and device-memory costs.

## Release process

Identify a user problem, implement the smallest useful change, run appropriate
checks, document results and limitations, then publish release notes. Do not claim
device testing or user feedback that has not happened.
