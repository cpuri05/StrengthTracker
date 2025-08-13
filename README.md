# Strength Tracker

Strength Tracker is a fully‑functional workout logging and progress‑tracking web app.  It was designed to run entirely in the browser using a minimal React‑like library, so there is no build step or server required—just open the app and start logging your workouts.

## Features

- **Workout logging:** record workouts with date, exercise, weight (kg/lbs), reps and optional notes.
- **Exercise bank:** pick from preloaded exercises or add new ones via the “Other” option.  Once added, a custom exercise appears in the dropdown for future logs.
- **Weekly plans:** build a weekly plan by selecting days and exercises; the app will schedule the plan from the current date through your chosen end date.  When logging on a planned day, all scheduled exercises are preselected to speed up data entry.
- **Charts:** view real‑time line charts of weight and reps for each exercise and stacked bar charts of weekly training volume.  Charts are high‑resolution and scale to the device’s pixel ratio to avoid blurriness.
- **Statistics:** see global averages (weight, reps, volume) across all entries and your personal records (max weight, max reps, max volume) per exercise.
- **CSV export:** download a CSV file of all logged workouts for backups or external analysis.
- **Progressive Web App (PWA):** install the app on your mobile home screen.  A service worker caches all assets so the app works offline and stores data locally in `localStorage`.

## Getting Started

### Running locally

1. **Download the project:** unzip the archive and open the `workout-tracker` folder.
2. **Serve with a local HTTP server:** service workers only register over `http` or `https`.  You can quickly spin up a server with Python:

   ```bash
   cd workout-tracker
   python3 -m http.server 8080
   ```

   Then open `http://localhost:8080/StrengthTracker/` in your browser.  The app will automatically register its service worker and show an “Add to Home Screen” prompt on supported mobile browsers.

3. **Open index.html directly (limited):** you can open `index.html` via the `file://` protocol, but the service worker and PWA features will not work.  Logging and charts still function offline because data is stored in `localStorage`.

### Hosting on GitHub Pages

You can host the app for free using GitHub Pages.  When hosting under a GitHub Pages sub‑path (e.g. `https://cpuri05.github.io/StrengthTracker/`), certain PWA settings must point to this sub‑path.  The `index.html` in this repository already uses `/StrengthTracker/manifest.json` and registers the service worker from `/StrengthTracker/service-worker.js` with a scope of `/StrengthTracker/`【80547752977172†L43-L63】.  The `manifest.json` sets `start_url` and `scope` to `/StrengthTracker/`【80547752977172†L124-L129】.

To publish the app:

1. **Create a repository** on GitHub named **StrengthTracker** under your account (`cpuri05`).
2. **Upload the contents** of the `workout-tracker` folder (including `index.html`, `app.js`, `styles.css`, `manifest.json`, `service-worker.js`, `icons/`, etc.) to the repository root.
3. **Enable GitHub Pages:** go to the repository’s *Settings → Pages*, choose the `main` branch as the source and save.  After a few minutes, your app will be available at `https://cpuri05.github.io/StrengthTracker/`.
4. **Visit on mobile:** open the URL in Chrome or Safari on your phone.  You should see an “Add to Home Screen” banner.  Once installed, the app runs in its own window and works offline.

## Customising the Exercise Bank

The app ships with a bank of common strength‑training exercises.  To add a new exercise, select **Other** from the exercise dropdown, type the exercise name, and click **Add to Bank**.  This stores the exercise in `localStorage` so it will be available the next time you open the app.  Custom exercises also appear in the plan builder.

## Development Notes

The project uses a small, custom React‑like renderer in `myreact.js` to manage state and virtual DOM rendering.  All application state is managed in `app.js` using `useState`‐style hooks.  Charts are drawn with Chart.js and are scaled for high DPI displays.  A simple service worker caches assets for offline use.  There is no build process—everything runs directly in the browser.

## License

This project is provided for educational purposes.  You are free to modify and reuse it for your own projects.
