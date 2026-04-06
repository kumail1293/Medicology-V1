# Setup Guide for Testing the Medicology App

## Quick Start

### Prerequisites
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)

### Installation

1. **Clone/Navigate to the project:**
   ```bash
   cd Question-Bank
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

### Running the App

#### Option A: Local Testing (Recommended for first-time setup)

Open two terminal windows:

**Terminal 1 - Start Backend API Server:**
```bash
cd artifacts/api-server
pnpm dev
```
The API will start on http://localhost:3000 (or check console for actual port)

**Terminal 2 - Start Frontend Web App:**
```bash
cd artifacts/medicology
pnpm dev
```
The app will start on http://localhost:5173 (or check console for actual port)

#### Option B: Network Access (For testing from other computers)

Same as Option A, but others can access the app at:
```
http://<your-computer-ip>:5173
```

Find your IP with:
- **Windows:** `ipconfig` (look for IPv4 Address)
- **Mac/Linux:** `ifconfig` or `hostname -I`

### Building for Production

```bash
pnpm run build
cd artifacts/api-server
pnpm start
```

### Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5173 (frontend)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Kill process on port 3000 (backend)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Module not found errors:**
```bash
# Clear and reinstall
pnpm install --force
```

**Type errors:**
```bash
pnpm typecheck
```

### Testing Features

- **Navigate** through the question bank
- **Practice** questions
- **Admin panel** (if authenticated)
- **Bookmarks** and **Notes** features
- **Daily challenges**

### Environment Variables

Create `.env` file in the root directory if needed:
```
DATABASE_URL=your_database_url
JWT_SECRET=your_secret_key
```

Check the backend configuration in `artifacts/api-server/src` for additional settings.

---

**Need help?** Check the console output for error messages or contact the development team.
