# Hamza Tariq — Engineering Portfolio

A static personal portfolio (HTML, CSS, vanilla JavaScript). No build step, no frameworks, no backend. It is designed to be hosted free on **GitHub Pages**.

## Project structure

```
.
├── index.html                  Home page (hero, about, skills, experience, projects, education, leadership, contact)
├── projects/
│   ├── index.html              All projects (incl. firefighting robot, wind turbine, rope braiding, course projects)
│   ├── autodidact.html         AUTODIDACT case study
│   └── bat-uav.html            Bat-inspired micro UAV case study
├── css/style.css               All styles and design tokens (colours, type, spacing at the top)
├── js/
│   ├── config.js               ← EDIT THIS: GitHub URL, project images, repository links
│   └── main.js                 Navigation, image loading, hero animation
├── assets/
│   ├── Hamza_Tariq_CV.pdf      CV served by every "Download CV" button
│   ├── favicon.svg
│   ├── fonts/                  Self-hosted Archivo + JetBrains Mono (SIL OFL licences included)
│   └── images/                 Put your project images here
├── .github/workflows/deploy.yml  Automatic deployment to GitHub Pages
├── .nojekyll                   Tells GitHub Pages to serve files as-is
└── robots.txt
```

## Preview locally

Any static server works. From this folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly also works for most things.)

## 1. GitHub profile

The GitHub link is set in `js/config.js`:

```js
github: "https://github.com/hamzatzs",
```

Set it to `""` to hide every GitHub link.

## 2. Replace image placeholders

Every placeholder on the site shows a **slot name** (for example `slot: autodidact-mujoco`). To fill one:

1. Copy your image into `assets/images/` (JPG, PNG or WebP; around 1600 px wide is plenty).
2. Register it in `js/config.js`:

```js
images: {
  "autodidact-mujoco": "mujoco-twin.png",
  "uav-prototype": "uav-prototype.jpg",
},
```

Available slots:

| Slot | Where it appears |
|---|---|
| `autodidact-cover` | AUTODIDACT card (home + all projects) |
| `autodidact-environment` | Case study: simulated robot environment |
| `autodidact-mujoco` | Case study: MuJoCo simulation |
| `autodidact-architecture` | Case study: original architecture diagram |
| `autodidact-dashboard` | Case study: system dashboard |
| `autodidact-team` | Case study: hackathon presentation / team photo |
| `uav-cover` | UAV card (home + all projects) |
| `uav-cad` | Case study: CAD model |
| `uav-mechanism` | Case study: wing mechanism |
| `uav-printed-parts` | Case study: 3D-printed components |
| `uav-cfd` | Case study: CFD / FEA results |
| `uav-adams` | Case study: MSC Adams simulation |
| `uav-prototype` | Case study: prototype photo |
| `uav-testing` | Case study: wind-tunnel / field test |
| `firefighting-cover` | Firefighting robot (home card + all projects) |
| `wind-turbine-cover` | Wind turbine (home card + all projects) |
| `rope-braiding-cover` | Rope braiding machine (home card + all projects) |

Each image's alt text is taken from the `data-alt` attribute in the HTML. Edit it there if you want a more specific description.

On the home page, cards without an image show a line illustration labelled "Concept illustration". Adding an image replaces it automatically.

## 3. Update your CV

Replace `assets/Hamza_Tariq_CV.pdf` with the new file **using the same name**. All download buttons update automatically.

## 4. Optional: link project repositories

In `js/config.js`:

```js
repos: { "autodidact": "https://github.com/hamzatzs/autodidact" }
```

A "View repository" link then appears on the AUTODIDACT case study.

## Deploy to GitHub Pages

### First time

1. On GitHub, create a new **public** repository, e.g. `portfolio`.
   (If you name it `hamzatzs.github.io`, the site will live at `https://hamzatzs.github.io/` instead of `/portfolio/`.)
2. Push this folder to it:

   ```bash
   cd path/to/this/folder
   git init
   git add .
   git commit -m "Initial portfolio"
   git branch -M main
   git remote add origin https://github.com/hamzatzs/portfolio.git
   git push -u origin main
   ```

   No Git on your machine? On the empty repository page choose **uploading an existing file** and drag in the folder contents. Include the hidden `.github` folder and `.nojekyll`. On macOS press Cmd+Shift+. in Finder to show hidden files.
3. In the repository go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs and, after about a minute, shows the live URL, e.g. `https://hamzatzs.github.io/portfolio/`.

### Updating

Edit, commit and push to `main`. The site redeploys automatically.

```bash
git add .
git commit -m "Add UAV photos"
git push
```

### Alternative without Actions

Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)`. This works too, because all paths are relative.

## Before publishing — checklist

- [ ] GitHub URL added in `js/config.js`
- [ ] Real project images added (at least `autodidact-cover` and `uav-cover`)
- [ ] "Lessons learned" (AUTODIDACT) and "Takeaways" (UAV) reviewed. They are marked as drafts in the HTML comments and should be in your own words.
- [ ] Decide whether you want your phone number public. To remove it, delete the "Phone" block in the contact section of `index.html`.
- [ ] Optional: add details to the firefighting robot entry in `projects/index.html` (sensors, controller, results).
- [ ] Optional: after deploying, add `<meta property="og:image" content="https://…/assets/images/social.jpg">` to each page for a link-preview image.

## Customising the design

All theme settings are in the **THEME CONTROLS** block at the top of `css/style.css`:

- `--c-blue`, `--c-violet`, `--c-cyan`, `--c-teal`: the accent palette, written as `R G B` numbers (e.g. `92 132 255`).
- `--glow`: one dial for the strength of every glow (0 = off, 1 = very strong).
- `--bg-main`, `--bg-secondary`, `--card-bg`, `--card-border`: base backgrounds and cards.
- `--<section>-bg`, `--<section>-glow-1`, `--<section>-glow-2`: each section's own background and lights (hero, about, skills, experience, projects, education, leadership, contact).
- `--autodidact-a/-b`, `--uav-a/-b`, `--fire-a/-b`, `--wind-a/-b`, `--rope-a/-b`: the two-colour gradient of each project card.

Each section has its own class (`.section--hero`, `.section--about` …) if you want to restyle one completely.

Animations (hero load, drifting light, moving grid, scroll reveal) switch off automatically when the visitor's system has "reduce motion" turned on.

## Interactive effects

| Effect | File | How to change it |
|---|---|---|
| 3D robot arm in the hero (autonomous pick-and-place, follows the cursor, drag to rotate, tap on phones) | `src/arm3d.js` (source) → `js/arm3d.min.js` (what the site loads) | See "Editing the 3D arm" below |
| Particle network in the hero and contact sections, tile spotlight and colour flash, cursor light, dot field with click ripples behind the middle sections | `js/fx.js` | Edit directly, no build step. Strength settings are in section 8 of `css/style.css` |

All effects switch off for visitors who have "reduce motion" turned on. If a browser cannot run WebGL, the original 2D arm drawing is shown instead.

To remove an effect, delete its `<script>` line at the bottom of `index.html` (`js/arm3d.min.js` or `js/fx.js`).

### Editing the 3D arm

`js/arm3d.min.js` is `src/arm3d.js` bundled with the parts of [three.js](https://threejs.org) it uses (MIT licence, see `js/THREE-LICENSE.txt`), so the site needs no CDN. After changing `src/arm3d.js`, rebuild once with Node.js installed:

```bash
npm install three esbuild
npx esbuild src/arm3d.js --bundle --minify --format=iife --outfile=js/arm3d.min.js
```

Useful values near the top of `src/arm3d.js`: link lengths (`L1`, `L2`), camera position (`view`), colours (taken from the CSS accent variables), and the task speed (`/ 0.42` in `segDuration`).
