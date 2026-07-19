# CosmoBot — Frontend

This repository contains the static frontend for CosmoBot (HTML/CSS/JS). Below are quick setup and hosting instructions.

Prerequisites
- Node.js and npm (optional, only if you use build tools)
- Python (for `python -m http.server` local preview)
- Git (to push to GitHub)

Local preview
1. From project root run:
```powershell
python -m http.server 8000
```
2. Open http://localhost:8000 or on your phone use http://<YOUR_PC_IP>:8000

Environment
- Copy `.env.example` to `.env` and add real keys (do NOT commit `.env`).

Deploy to GitHub and enable Pages
1. Create a repository on GitHub.
2. Add remote and push:
```bash
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```
3. On GitHub, go to Settings → Pages and choose `main` branch / root, then save.

Alternative (using `gh` CLI):
```bash
gh repo create your-username/your-repo --public --source=. --remote=origin --push
gh repo view --web
```

Notes
- Do not commit `.env` or secret keys — add them to `.gitignore`.
- If your site uses OAuth callbacks (Supabase), add the Pages URL to allowed redirect URIs.
# CosmoBot — AI Student Companion by Acutro Technologies Private Limited

Pure **HTML, CSS, and JavaScript** — no Node.js, no build step, no backend.

## How to run

**Option 1 — Double-click (easiest)**

Open `index.html` in Chrome, Edge, or Firefox.

**Option 2 — VS Code / Cursor Live Server**

Right-click `index.html` → **Open with Live Server**.

## Pages

| File | Route |
|------|-------|
| `index.html` | Landing page |
| `register.html` | Sign up |
| `login.html` | Log in |
| `dashboard.html` | After login |

## Project structure

```
acutro/
├── index.html
├── register.html
├── login.html
├── dashboard.html
├── css/
│   └── styles.css
├── js/
│   ├── spaceCanvas.js    # Animated space background
│   ├── authService.js    # localStorage auth (no server)
│   ├── register.js
│   ├── login.js
│   └── dashboard.js
└── cosmobot.svg
```

## Auth (client-side only)

Register and login save data in your browser's `localStorage`. No server needed — a backend can be added later.

User record schema:

```json
{
  "uid": "String",
  "name": "String",
  "email": "String",
  "school": "String",
  "age": "Number",
  "grade": "String",
  "linked_device": null
}
```

## Test flow

1. Open `index.html`
2. Click **Register** → fill form → submit
3. Log in on `login.html`
4. View profile on `dashboard.html`
