# Free Deployment Guide - Namecheap + Railway/Render

## Overview
This guide shows how to deploy the Medicology app for **FREE** using your Namecheap domain and a combination of free hosting services.

## Architecture
- **Frontend**: Deploy to Vercel (free tier) or Netlify
- **Backend API**: Deploy to Railway (free tier) or Render  
- **Domain**: Point Namecheap domain to your hosting

---

## Option 1: Railway + Vercel (Recommended)

### Step 1: Deploy Backend to Railway (FREE)

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Connect GitHub Repository**
   - In Railway dashboard, click "New Project"
   - Select "Deploy from GitHub"
   - Connect your GitHub and select the repository

3. **Configure Environment Variables**
   - In Railway, go to Variables tab
   - Add these environment variables:
     ```
     DATABASE_URL=your_postgres_url
     JWT_SECRET=your_secure_random_string
     NODE_ENV=production
     ```

4. **Deploy**
   - Railway auto-detects Monorepo structure
   - Configure to deploy from `artifacts/api-server`
   - Railway assigns you a URL like: `https://api-xxxx.railway.app`

5. **Get Your API URL**
   - Copy the provided Railway URL for later

---

### Step 2: Deploy Frontend to Vercel (FREE)

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Your Project**
   - Click "Add New" → "Project"
   - Select your GitHub repository

3. **Configure Build Settings**
   - Build Command: `cd artifacts/medicology && npm run build`
   - Output Directory: `artifacts/medicology/dist`
   - Root Directory: `.` (leave as is)

4. **Add Environment Variables**
   - In Vercel Settings → Environment Variables, add:
     ```
     VITE_API_URL=https://api-xxxx.railway.app
     ```
   - (Replace with your actual Railway API URL)

5. **Deploy**
   - Click "Deploy"
   - Vercel gives you a URL like: `https://medicology.vercel.app`

---

### Step 3: Point Namecheap Domain to Your App

1. **Connect Custom Domain to Vercel**
   - In Vercel Dashboard → Settings → Domains
   - Click "Add Domain"
   - Enter your Namecheap domain

2. **Update Namecheap DNS**
   - Login to Namecheap
   - Go to your domain → Manage
   - Click "Advanced DNS"
   - Change nameservers to Vercel's:
     ```
     ns1.vercel.app
     ns2.vercel.app
     ns3.vercel.app
     ns4.vercel.app
     ```
   - Or add CNAME records as Vercel instructs

3. **Wait for DNS Propagation**
   - Can take 5minutes to 48 hours
   - Check status: https://dns.google/

---

## Option 2: Render + Netlify (Also Free)

### Deploy Backend to Render
1. Go to https://render.com
2. Create Web Service
3. Connect GitHub repository
4. Select root: `artifacts/api-server`
5. Set Environment Variables
6. Deploy (free tier available)

### Deploy Frontend to Netlify
1. Go to https://netlify.com
2. Connect GitHub
3. Build command: `cd artifacts/medicology && npm run build`
4. Publish directory: `artifacts/medicology/dist`
5. Connect Namecheap domain

---

## Option 3: Free Tier Limitations & Upgrades

### Railway Free Tier
- **Free**: $5 monthly credit (usually enough for low traffic)
- **Database**: PostgreSQL included
- **Auto-deploys** from GitHub

### Vercel Free Tier
- **Unlimited**: Deployments, domains, SSL
- **Bandwidth**: 100GB/month
- **Serverless Functions**: Limited

### Render Free Tier
- **Spinning down**: Services go inactive after 15 min of inactivity (cold start)
- **1 free Web Service** running continuously
- **PostgreSQL**: Free tier available

---

## Database Setup (Pick One)

### Option A: Railway PostgreSQL (Easiest)
- Included with Railway project
- Auto-provisioned
- Get connection string from Railway Variables

### Option B: Free PostgreSQL Hosting
- **Neon**: https://neon.tech (free tier)
- **Supabase**: https://supabase.com (free tier)
- **Render PostgreSQL**: https://render.com

---

## Full Deployment Checklist

- [ ] Commit all code to GitHub
- [ ] Railway account created
- [ ] Database configured (Railway or external)
- [ ] Backend deployed to Railway
- [ ] Backend API URL noted
- [ ] Vercel account created
- [ ] Frontend environment variables set
- [ ] Frontend deployed to Vercel
- [ ] Vercel frontend URL working
- [ ] Namecheap DNS updated to Vercel nameservers
- [ ] DNS propagation verified
- [ ] Domain redirects to your app ✓

---

## Troubleshooting

### API Connection Issues
```bash
# Check if backend is running
curl https://api-xxxx.railway.app/health

# Verify frontend env variables
# Check browser console for API URL being used
```

### CORS Issues
- Ensure backend has correct CORS origin:
  ```typescript
  app.use(cors({ origin: 'https://yourdomain.com' }));
  ```

### Cold Starts (Render)
- Render free tier goes inactive - use Uptime Robot (free) to ping it
- Or upgrade to "Pay As You Go" tier

### DNS Not Working
- Wait 24-48 hours for full propagation
- Check with: https://whois.com/whois/yourdomain.com
- Verify nameservers changed in Namecheap

---

## Environment Variables Reference

**Frontend (.env for Vite)**
```
VITE_API_URL=https://api-xxxx.railway.app
```

**Backend (.env for api-server)**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=production
PORT=3000
```

---

## Monitoring & Logs

### Railway Logs
- Dashboard → Your Project → Logs tab

### Vercel Logs  
- Dashboard → Deployments → Click deployment → Logs

### Error Tracking
- Consider adding Sentry (free tier) for better error monitoring

---

## Cost Estimate (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Railway | ~$5 | Includes DB |
| Vercel | FREE | Unless exceeding limits |
| Netlify | FREE | Alternative to Vercel |
| Namecheap Domain | ~$10-15 | Your existing domain |
| **TOTAL** | **~$15-20** | Very cheap! |

---

## Next Steps

1. Push code to GitHub
2. Create Railway account (use GitHub login)
3. Deploy backend to Railway
4. Create Vercel account (use GitHub login)
5. Deploy frontend to Vercel
6. Update Namecheap DNS settings
7. Test your domain!

That's it! Your app will be live within 5 minutes (plus DNS propagation time).

---

## Support Resources
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Namecheap Support: https://www.namecheap.com/support/
