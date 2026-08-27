GNM app screenshots used in the website hero (portrait, full-device PNG/WebP).
Cross-fades in this order, Dashboard first:
  dashboard.png   - Home / Dashboard
  scan.png        - Scan Complete
  preview.jpeg    - Preview Changes (demo/placeholder contacts only)
  history.png     - History
  settings.png    - Privacy & settings

cleanup.png is spare (not currently shown).

The 'Preview Changes' screen is deliberately NOT used: it displays real
contact names and numbers. To restore it, take that screenshot with demo or
redacted contacts, save it as preview.png/webp, and re-add it to
apps/web/src/components/AppPreviewPhone.tsx.

Any resolution; the frame crops to a ~1170x2532 ratio, top-aligned.
Missing files -> hero falls back to the GNM logo.
