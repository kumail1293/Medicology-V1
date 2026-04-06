# Pre-Deployment Checklist

## Required Before Deployment

- [ ] GitHub repository created and code pushed
- [ ] `.env` file is in `.gitignore` (NEVER commit secrets!)
- [ ] All TypeScript errors resolved (`pnpm typecheck` passes)
- [ ] All packages installed (`pnpm install` succeeds)
- [ ] Frontend builds successfully (`pnpm run build` in artifacts/medicology)
- [ ] Backend has production database configured
- [ ] JWT_SECRET is set as environment variable
- [ ] DATABASE_URL is configured
- [ ] CORS is properly configured in backend

---

## Step-by-Step Deployment

### 1. Prepare Code for GitHub

```bash
# Navigate to workspace
cd c:\Medicology\Question-Bank

# Create .gitignore if not exists (should include)
node_modules/
.env
.env.local
dist/
*.log
.DS_Store
uploads/
```

### 2. Quick Fix: Ensure Code Builds

```bash
# From workspace root
pnpm typecheck
pnpm run build
```

### 3. Push to GitHub

```bash
git add .
git commit -m "Initial commit: Medicology question bank app"
git push origin main
```

### 4. Deploy Backend (Railway)

**Visit:** https://railway.app/new

- Select "GitHub Repo"
- Choose your repository
- Set environment variables:
  - DATABASE_URL → (Get fresh PostgreSQL from Railway)
  - JWT_SECRET → (Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - NODE_ENV → production

**Then Railway will:**
- Auto-detect Node.js project
- Automatically deploy from `artifacts/api-server`
- Provide you with: `https://api-xxxxx.railway.app`

### 5. Deploy Frontend (Vercel)

**Visit:** https://vercel.com/new

- Import GitHub repository
- Framework: Vite (might need to select "Other" or let it auto-detect)
- Build settings:
  - Build Command: `cd artifacts/medicology && npm run build`
  - Output Directory: `artifacts/medicology/dist`

- Environment Variables:
  - VITE_API_URL → `https://api-xxxxx.railway.app` (from Step 4)

- Deploy! (Vercel generates: `https://app-xxxxx.vercel.app`)

### 6. Connect Namecheap Domain

**In Namecheap Dashboard:**
1. Go to Domains → Your Domain → Manage
2. Click "Advanced DNS"
3. Change Nameservers to:
   ```
   ns1.vercel.app
   ns2.vercel.app
   ns3.vercel.app
   ns4.vercel.app
   ```
4. Save changes
5. Wait 5-48 hours for DNS to propagate

**In Vercel Dashboard:**
1. Go to Settings → Domains
2. Add your Namecheap domain
3. Vercel verifies it automatically

---

## Post-Deployment

### Verify Everything Works

1. **Visit your domain**: `https://yourdomain.com`
2. **Test login**: Create account and login
3. **Check console errors**: DevTools → Console tab
4. **Test API calls**: Network tab in DevTools
5. **Check backend logs**: Railway dashboard

### Common Issues & Fixes

**Blank page?**
- Check VITE_API_URL in Vercel environment
- Check browser console for errors

**API errors (CORS)?**
- Verify CORS config in backend
- Check Railway DATABASE_URL is valid

**Database errors?**
- Ensure DATABASE_URL is correct
- Run migrations if needed

**Slow cold starts?**
- This is normal for free tier
- Use Uptime Robot to keep Railway active

---

## Cost Summary

| Service | Monthly Cost | Limit |
|---------|-------------|-------|
| Railway | ~$5 | Includes database |
| Vercel | Free | 100GB bandwidth |
| Namecheap Domain | ~$10 | Your domain |
| **Total** | **~$15** | Very affordable! |

---

## Production Best Practices

- [ ] Set strong JWT_SECRET (32+ chars)
- [ ] Use HTTPS everywhere (Vercel/Railway do this)
- [ ] Enable CORS only for your domain
- [ ] Set NODE_ENV=production
- [ ] Configure database backups (Railway has this)
- [ ] Add error tracking (Sentry free tier)
- [ ] Monitor API performance (Railway dashboard)
- [ ] Set up uptime monitoring (Uptime Robot free)

---

## Quick Command Reference

```bash
# Build locally before pushing
pnpm run build

# Check for type errors
pnpm typecheck

# Run dev servers locally
cd artifacts/api-server && pnpm dev
# In another terminal:
cd artifacts/medicology && pnpm dev

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Check Railway logs
railway logs

# Check Vercel logs
vercel logs
```

---

## Need Help?

- **Railway Issues**: https://docs.railway.app
- **Vercel Issues**: https://vercel.com/docs
- **Domain Issues**: Namecheap Support Chat
- **Code Issues**: Check console/logs for error messages

**Estimated Time:** 10-15 minutes to deploy + 24-48 hours for DNS propagation

Good luck! 🚀
