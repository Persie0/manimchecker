# Manim Checker

A static, privacy-friendly browser-based video review workspace for rendered Manim/OpenCV/animation videos.

## Use

1. Open the [website](https://persie0.github.io/manimchecker/) and drop or choose a video (MP4/WebM, or other browser-playable formats).
2. Pause where you want to leave feedback. Enter a note, choose a category, click **Add note**. The timecode is captured when you begin writing; notes are displayed chronologically and as timeline markers.
3. Click a note timecode/marker to seek to it; edit or delete notes as needed.
4. Download timestamped notes as **Markdown**, plain **TXT**, **CSV** or a re-importable **JSON** backup.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` or `K` | Play/pause |
| `Left/Right` | Seek -/+ 5 seconds |
| `,` / `.` | Seek one approximate frame backward/forward |
| `N` | Pause, capture timestamp, focus note field |
| `Ctrl/Cmd + Enter` | Save note |

Select the expected FPS to change the frame-step increment. HTML5 video seeking is not guaranteed to be exact to a decoded source frame in every browser/codec.

## Data and privacy

Videos are **never uploaded** to GitHub or any server. They use local browser `Blob` object URLs. Feedback is stored in `localStorage` under a fingerprint made from the selected file's name, size and last-modified date; reopen the *same file* to continue a review. The video itself is not persisted, and notes will not automatically move between browsers or devices. Export JSON backups for portability. Browser storage may be cleared and private browsing may not retain it.

Notes can contain any text; the app inserts note contents as text rather than HTML. The site has no analytics, network calls, build dependencies or backend service. No generated MP4 or SRT is committed.

## GitHub Pages configuration

This repository is a ready-to-serve static site with its `index.html` at the repository root. If this is the first deployment, visit **[Settings → Pages](https://github.com/Persie0/manimchecker/settings/pages)** and choose **Deploy from a branch → `main` → `/(root)` → Save**. The site URL is <https://persie0.github.io/manimchecker/> once Pages finishes publishing. No custom GitHub Actions workflow is required.

## Run locally

Open `index.html` directly, or run:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000/>. No Node/npm packages are needed.

## Files

- `index.html` — accessible markup
- `styles.css` — responsive dark UI
- `app.js` — player controls, note persistence and exports
- `favicon.svg` — app icon
- `.nojekyll` — publish the site as-is