# Medicology - Medical Question Bank

A full-stack web application for medical education with comprehensive question banks, practice tests, progress tracking, and more.

## 🎯 Quick Start

### Prerequisites
- Node.js v18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL only if you want a real database (mock mode needs none)

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your database URL and JWT secret

# 3. Run Backend API
cd artifacts/api-server
pnpm dev
# API starts on http://localhost:5000

# 4. In another terminal, run Frontend
cd artifacts/medicology
pnpm dev
# App opens on http://localhost:5173 (Vite proxies /api to the backend on :5000)
```

Visit **http://localhost:5173** in your browser!

### 🗄️ Mock Database Mode (No PostgreSQL Needed)

The backend can run without a database using a built-in in-memory mock DB, which
is perfect for frontend work, demos, and quick testing:

- Set `USE_SQLITE=true` in the root `.env`, or simply leave `DATABASE_URL` unset.
- The API then logs `📊 Using mock database for development (data not persisted)`.
- **Auth, admin, announcements, questions, progress — all routes work**, with
  seeded-capable in-memory tables.
- ⚠️ **Data is not persisted**: restarting the API server wipes registered users
  and any data created. Promotions/announcements made in a session disappear on
  restart.

To use a real PostgreSQL database instead, set `DATABASE_URL` to a Postgres
connection string (local, Railway, Neon, or Supabase) and remove `USE_SQLITE`.

> **Ports:** the API listens on **5000** (`artifacts/api-server/.env.local` sets
> `PORT=5000`), not 3000. The frontend Vite dev server runs on **5173** and
> proxies `/api` requests to `VITE_API_URL` (default `http://localhost:5000`).

---

## 📦 Project Structure

```
Question-Bank/
├── artifacts/
│   ├── api-server/          # Express backend API (Node.js)
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── middleware/  # Auth, validation, etc
│   │   │   ├── db.ts        # Database setup
│   │   │   └── app.ts       # Express server
│   │   └── package.json
│   │
│   └── medicology/          # React frontend (Vite)
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── pages/       # Page routes
│       │   ├── lib/         # Utilities & API client
│       │   └── main.tsx     # App entry
│       └── package.json
│
├── lib/
│   ├── api-client-react/    # React hooks for API
│   ├── api-spec/            # OpenAPI specification
│   └── db/                  # Database schema & migrations
│
└── package.json             # Workspace root

```

---

## 🚀 Deployment

### Free Tier Deployment (Recommended)

We provide **free** deployment using Railway + Vercel + your Namecheap domain.

**See:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

**Quick Summary:**
1. Push code to GitHub
2. Deploy backend to Railway (free $5 credit)
3. Deploy frontend to Vercel (free tier)
4. Point Namecheap domain to Vercel
5. Done! ~15 minutes total

**Cost:** ~$10-15/month (mostly domain)

---

## 🔧 Available Commands

### Workspace Commands
```bash
pnpm install        # Install all dependencies
pnpm run build      # Build all packages
pnpm typecheck      # Check TypeScript errors
pnpm run dev        # Start all dev servers (requires setup)
```

### Backend Commands
```bash
cd artifacts/api-server

pnpm dev            # Start dev server (hot reload)
pnpm build          # Build for production
pnpm start          # Run production build
pnpm typecheck      # Check TypeScript
```

### Frontend Commands
```bash
cd artifacts/medicology

pnpm dev            # Start Vite dev server
pnpm build          # Build for production
pnpm serve          # Preview production build
pnpm test           # Run testing suite
pnpm typecheck      # Check TypeScript
```

---

## 🗄️ Database

### Development
- Uses PostgreSQL via connection string in `.env`
- Schema managed with Drizzle ORM

### Production
- Railway (free PostgreSQL included)
- Or Neon/Supabase (free tiers available)

### Initialize Database
```bash
# Database runs migrations automatically on app startup
# If manual setup needed, check lib/db/src/schema/
```

---

## 🔐 Authentication

- JWT-based authentication
- Login with email/password
- Tokens valid for 30 days
- Admin roles for special access

### Admin Setup

Admins are promoted by an existing admin via the admin panel (`/admin` → Users)
or the API. In mock-DB mode, promote any user with a crafted dev token against
`PUT /api/admin/users/:id` (see the admin routes for details).

---

## 📝 Features

- ✅ User authentication & profiles
- ✅ Question bank with multiple categories
- ✅ Practice mode with explanations
- ✅ Progress tracking & analytics
- ✅ Bookmarks & notes
- ✅ Study buddies system
- ✅ Daily challenges
- ✅ Admin panel for content management
- ✅ Responsive mobile design

---

## 🐛 Troubleshooting

### Port Already in Use
The API uses port **5000** and the frontend uses **5173**.

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :5000
kill -9 <PID>
```

### Module Not Found
```bash
# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install --force
```

### Database Connection Error
```bash
# Check DATABASE_URL in .env
# For local dev without Postgres, set USE_SQLITE=true to use the mock DB
# Ensure PostgreSQL is running if you are NOT using mock mode
# Verify credentials are correct
```

### CORS Errors
```bash
# Check CORS is enabled for your domain in backend
# See artifacts/api-server/src/app.ts
```

---

## 📚 Documentation

- [Environment Variables](./.env.example)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Run `pnpm typecheck` to check errors
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👥 Team

- **Backend**: Express + Node.js + PostgreSQL
- **Frontend**: React + Vite + TypeScript
- **Database**: Drizzle ORM + PostgreSQL
- **API Validation**: Zod schemas
- **UI Components**: Custom + Radix UI

---

## 🆘 Support

- Check logs: `railway logs` or Vercel dashboard
- Read error messages in console
- See troubleshooting section above
- Contact team for database/deployment issues

---

## 🎓 Learning Resources

- React: https://react.dev
- Express: https://expressjs.com
- PostgreSQL: https://www.postgresql.org
- Drizzle ORM: https://orm.drizzle.team
- Vite: https://vitejs.dev

---

## Next Steps

1. **Local Development**: Follow Quick Start section
2. **Explore Code**: Check out the project structure
3. **Read Docs**: See documentation files
4. **Deploy**: Follow DEPLOYMENT_GUIDE.md
5. **Customize**: Add your own features!

**Good luck! 🚀**
