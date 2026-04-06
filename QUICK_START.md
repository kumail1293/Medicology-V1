# ⚡ QUICK REFERENCE - Deploy in 15 Minutes

## 🎯 The 4-Step Path to Live (Copy & Paste Commands)

### Step 1️⃣: GitHub (5 minutes)
```powershell
cd c:\Medicology\Question-Bank
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/medicology.git
git push -u origin main
```
**Replace** `YOUR_USERNAME` with your actual GitHub username.

### Step 2️⃣: Railway Backend (2 minutes)
1. Visit: https://railway.app/new
2. Click "Deploy from GitHub"
3. Select your `medicology` repository
4. Set Variables:
   ```
   DATABASE_URL=postgresql://user:pass@host/db
   JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >
   NODE_ENV=production
   ```
5. Deploy → **Copy API URL** (you'll need it next!)

### Step 3️⃣: Vercel Frontend (2 minutes)
1. Visit: https://vercel.com/new
2. Import your GitHub repo
3. Build settings **stay default** 
4. Add Environment Variable:
   ```
   VITE_API_URL=https://api-xxxxx.railway.app
   ```
   (Paste the URL from Step 2)
5. Deploy → **Get your live app URL**

### Step 4️⃣: Connect Domain (1 minute + DNS wait)
1. In Namecheap: Advanced DNS → Update Nameservers to:
   ```
   ns1.vercel.app
   ns2.vercel.app
   ns3.vercel.app
   ns4.vercel.app
   ```
2. In Vercel: Settings → Domains → Add your domain
3. **Wait** 5 minutes to 48 hours for DNS propagation
4. **LIVE!** 🚀

---

## 📊 Key Links

| Service | Link | Free? |
|---------|------|-------|
| GitHub | https://github.com | ✅ |
| Railway | https://railway.app | ✅ ($5/mo) |
| Vercel | https://vercel.com | ✅ |
| Namecheap | https://www.namecheap.com | ❌ (~$10/yr) |

---

## 🔐 Generate JWT Secret

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output → paste in Railway Variables as `JWT_SECRET`

---

## 💰 Total Cost

- Railway: ~$5/month (but gets $5 monthly credit)
- Vercel: FREE
- Namecheap: ~$10-15/year (your domain)
- **Total: ~$0.50-1/month** (or FREE if Railway credit covers it)

---

## ✅ Success Checks

After each step, verify:

**After Git Push:**
- Check https://github.com/YOUR_USERNAME/medicology
- Verify code is there, `.env` is NOT there

**After Railway Deploy:**
- Check Railway dashboard → Deployments
- Status should say "✓ Success"
- Copy the API URL

**After Vercel Deploy:**
- Visit the Vercel URL (https://xxxx.vercel.app)
- App should load
- Check browser console for errors

**After DNS Update:**
- Wait 5-48 hours
- Visit your domain (https://yourdomain.com)
- App should load!

---

## 🆘 Common Issues

| Problem | Fix |
|---------|-----|
| "Cannot find module" error | Check DATABASE_URL is valid |
| Blank page on Vercel | Check VITE_API_URL is correct in Vercel env vars |
| Still can't reach domain | Wait longer for DNS (can take 48hrs) |
| Railway fails to deploy | Check github push was successful |

---

## 📚 Full Documentation

- Detailed steps: **DEPLOY_NOW.md**
- GitHub setup: **GITHUB_SETUP.md**
- All options: **DEPLOYMENT_GUIDE.md**
- Local testing: **SETUP_FOR_TESTING.md**
- Project info: **README.md**

---

**You've got this! 🚀 Follow the 4 steps above and you're live in 15 minutes!**
