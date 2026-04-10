# SteelSync-Opt | AI Port-to-Plant Logistics

This project integrates a frontend optimization dashboard with a Node.js/Express backend.

## How to Run

### 1. Unified Server (Recommended)
This runs both the backend API and the frontend on a single port (default 5000).

```bash
npm start
```
Go to: [http://localhost:5000](http://localhost:5000)

### 2. Frontend Only (Debug)
If you only want to serve the static files without the backend:

```bash
npm run frontend-only
```
Go to: [http://localhost:9999](http://localhost:9999)

## Project Structure
- `index.html`: Main entry point.
- `js/`: Frontend logic and debug server.
- `backend/`: Express server and API routes.
- `css/`: Styling files.
