# Flake Lab — one-page site · deploy handoff

**This is a finished, self-contained static site. Ship it as-is.**
`index.html` is the deliverable. It already contains the markup, styles, fonts, images, logo assets, the brand QR code and all animation logic inlined into one file.

---

## RULE ZERO — do not change the design

Claude Code: your job here is **hosting only**, not design or refactoring. Do not:

- edit, reformat, prettify, minify or re-indent `index.html`
- convert it to React / Next.js / Astro / Tailwind / a component structure
- rename, resize, recolor, re-crop or re-export any asset
- change copy, fonts, spacing, colors, radii, shadows, rotations or animation timings
- add analytics, cookie banners, chat widgets, frameworks, build tooling or a package.json
- "fix" the inline styles, the `<x-dc>` wrapper, or the embedded runtime — they are intentional
- run a formatter or linter over the file

Allowed changes (only these, only if asked):

- add/replace files that sit **next to** `index.html`: `favicon.ico`, `og-image.png`, `robots.txt`, `sitemap.xml`
- edit `vercel.json` headers/redirects
- swap the URLs listed under *Content owners* below

If something looks broken, report it — do not redesign it.

---

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The whole site. Self-contained, ~1.8 MB, no build step. |
| `vercel.json` | Static config: clean URLs, cache headers for images/fonts. |
| `robots.txt` | Allows all crawlers, points at the sitemap. |
| `sitemap.xml` | Single URL (`https://flakelab.ca/`). Update the domain if it changes. |
| `.gitignore` | Ignores `.vercel`, `.DS_Store`, logs. |

No dependencies. No `npm install`. No framework preset.

---

## Deploy: GitHub → Vercel

### 1. Create the repo

```bash
cd design_handoff_flakelab_site
git init
git add .
git commit -m "Flake Lab one-page site"
git branch -M main
```

Create an empty GitHub repo named `flakelab-site` (no README, no .gitignore, no license), then:

```bash
git remote add origin https://github.com/<your-username>/flakelab-site.git
git push -u origin main
```

If you have the GitHub CLI: `gh repo create flakelab-site --public --source=. --push`

### 2. Import into Vercel

1. vercel.com → **Add New… → Project → Import Git Repository** → pick `flakelab-site`.
2. Configure with these **exact** settings:
   - Framework Preset: **Other**
   - Root Directory: `./` (repo root)
   - Build Command: **leave empty**
   - Output Directory: **leave empty** (serves the repo root)
   - Install Command: **leave empty**
   - Node version: irrelevant, nothing runs server-side
3. **Deploy.** First build takes a few seconds — it is just an upload.

CLI alternative:

```bash
npm i -g vercel
vercel        # preview deploy, accept defaults, no build command
vercel --prod # production
```

Every push to `main` redeploys production automatically. Pull requests get preview URLs.

### 3. Custom domain

In Vercel → Project → **Settings → Domains**, add `flakelab.ca` and `www.flakelab.ca` (let Vercel redirect `www` → apex, or the reverse — your call).

At your DNS registrar:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

**Important:** `store.flakelab.ca` is a separate live store on another host. Do **not** touch, move, or proxy that subdomain, and do not add a wildcard DNS record that could swallow it. Verify the exact values Vercel shows you in the Domains panel before saving — they take precedence over the table above.

HTTPS is issued automatically once DNS resolves (usually minutes).

---

## Content owners (the only URLs in the site)

| What | Where it points |
| --- | --- |
| Order / store CTAs (4 links) | `https://store.flakelab.ca` |
| Instagram (nav-less; panel + footer) | `https://www.instagram.com/flakelab.ca?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==` |
| Email / wholesale | `mailto:hello@flakelab.ca` — **confirm this inbox exists before launch** |
| QR code graphic | Brand-styled SVG, inlined; encodes the Instagram URL above |

Ordering status label ("Ordering open now" / "Menu drops Thursday" / "Sold out this week") is baked into the deployed build as **Ordering open now**. Changing it is a design-side edit — ask the designer, don't hand-edit the bundle.

---

## Pre-launch checklist

- [ ] Site loads at the Vercel URL; hero wordmark, doodle puff and ticker all render
- [ ] Hovering / tapping the puff doodles shows the crumb burst (desktop + mobile)
- [ ] All four store CTAs open `store.flakelab.ca`
- [ ] Instagram links and the QR code both resolve to `@flakelab.ca` (scan the QR with a real phone)
- [ ] `hello@flakelab.ca` receives mail
- [ ] Mobile Safari + Chrome Android: no horizontal scroll, nav bar legible over cream
- [ ] `flakelab.ca` and `www.flakelab.ca` both serve over HTTPS
- [ ] `store.flakelab.ca` still works after the DNS change
- [ ] Add `favicon.ico` and an `og-image.png` (1200×630) if the designer supplies them

---

## Notes / open items for the client

- The maker's-seal asset in the brand kit reads **EST 1975 · Anand, Gujarat**, which conflicts with the **Estd. 1974** used throughout this site. The seal is deliberately not used here. Pick one year and have the kit corrected.
- The site has no analytics by design. If you want them, Vercel Analytics is the one-line, cookie-free option — ask the designer to add the snippet so the file stays authoritative.
- Source of truth for future design edits is the design project (`Flake Lab Site v3.dc.html`), not this bundle. Edits made here will be overwritten the next time the design is re-exported.
