# Kakuro Zone

[![Netlify Status](https://api.netlify.com/api/v1/badges/66336b93-2c29-416e-83a9-3da3c29a7e2b/deploy-status)](https://app.netlify.com/projects/kakurozone/deploys)

A kakuro puzzle website for daily fun, with printable puzzle packs.

[Play now!](https://kakurozone.netlify.app/)

## How to run locally

With Node.js 22.12+ installed:

```sh
git clone https://github.com/cassidoo/kakurozone.git
cd kakurozone
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173).

## Brand assets

`public/og-image.png` is the 1200x630 social-sharing image; `public/og-image-square.png`
is a 1200x1200 alternative. Their matching SVGs and `public/icon.svg` contain
outlined Archivo Black lettering, so they render without loading a font.
The KZ icon also ships as a multi-size ICO, an Apple touch icon, and 192/512px
app icons. Social metadata in `index.html` uses `https://kakurozone.netlify.app/`;
update those absolute URLs if the production domain changes.
