# Trip Prep Tracker (React + Vite + Tailwind)

A flashy trip-prep tracker with tabs, animations, sound effects, and a vibe gallery.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## Build & Preview

```bash
npm run build
npm run preview
```

## Notes

- If you see a MetaMask error overlay: it is from a browser extension or host. The app ignores those errors so the UI keeps running.
- Data is stored in your browser's localStorage. Use **Export** and **Import** in the app header to save/restore.

## Backend API

A simple Express/SQLite backend lives in the `server` folder. It stores shared trip data and handles image uploads.

### Run the server

```bash
cd server
npm install
npm start
```

The server exposes:

- `GET /people` – list trip members
- `PATCH /people/:id` – update member status, transport, ETA or payment info
- `GET /gallery` – list uploaded photos
- `POST /gallery/upload` – upload a `.jpg`, `.jpeg` or `.png` (max 5MB)

Uploaded images are saved to `server/uploads` and served at `/uploads/*`.
