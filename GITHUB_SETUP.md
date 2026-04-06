# GitHub Setup Guide - Push Your Code

This guide walks you through getting your code to GitHub so you can deploy.

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Fill in details:
   - **Repository name**: `medicology` (or `question-bank`)
   - **Description**: "Medical question bank app with practice tests"
   - **Public** or **Private**: Your choice (Private recommended until ready)
   - Click **Create repository**
3. You'll get a URL like: `https://github.com/YOUR_USERNAME/medicology.git`

## Step 2: Configure Git Locally

Open PowerShell in your Question-Bank folder:

```powershell
cd c:\Medicology\Question-Bank

# Set your git name and email (one time)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Initialize & Push

```powershell
# Initialize repository
git init

# Add all files (respects .gitignore - won't add .env!)
git add .

# Check what will be committed (optional - verify no secrets!)
git status

# Commit
git commit -m "Initial commit: Medicology medical question bank application"

# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/medicology.git

# Push to GitHub (first time)
git branch -M main
git push -u origin main
```

## Step 4: Verify on GitHub

1. Visit your GitHub repo: `https://github.com/YOUR_USERNAME/medicology`
2. Verify:
   - ✅ All files visible
   - ✅ NO .env file (should be ignored)
   - ✅ node_modules NOT there (should be ignored)
   - ✅ README.md, DEPLOY_NOW.md visible

## After Each Update

```powershell
# Make changes...
git add .
git commit -m "Your change description"
git push
```

## Troubleshooting

**"fatal: destination path already exists"**
```powershell
# Repository already exists locally. Try:
cd c:\Medicology\Question-Bank
git remote set-url origin https://github.com/YOUR_USERNAME/medicology.git
git push -u origin main
```

**Forgot to change USERNAME/REPO**
```powershell
git remote set-url origin https://github.com/CORRECT_USERNAME/REPO_NAME.git
git push
```

**Accidentally about to commit .env**
```powershell
# Don't worry - .gitignore prevents this
# But if you already committed it, do this:
git rm --cached .env
git commit -m "Remove .env from git"
git push
```

**Want to undo last commit**
```powershell
git reset --soft HEAD~1
# Now you can fix and recommit
```

## What NOT to Commit

These are automatically ignored (in .gitignore):
- `.env` - **NEVER** commit your secrets!
- `.env.local` - Local overrides
- `node_modules/` - Too large, reinstalled by `pnpm install`
- `dist/` - Build output (rebuilt during deployment)
- `.vscode/` - Your personal editor settings

## GitHub & Deployment

Once code is on GitHub:

1. **Railway** will auto-detect the repo and deploy on push
2. **Vercel** will auto-build on every commit
3. Changes push live automatically (CI/CD)

## Final Check Before Push

```powershell
# Verify git status
git status

# Should show:
# - All your code files
# - NO .env
# - NO node_modules
# - NO dist folders
```

That's it! Your code is now on GitHub and ready for deployment! 🚀

---

**Next Step**: Follow DEPLOY_NOW.md to deploy to Railway and Vercel
