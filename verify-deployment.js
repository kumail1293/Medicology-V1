#!/usr/bin/env node
/**
 * Pre-Deployment Verification Script
 * Run this to verify everything is ready before deploying
 */

const fs = require('fs');
const path = require('path');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(status, message) {
  const icons = {
    '✓': '\x1b[32m✓\x1b[0m',
    '✗': '\x1b[31m✗\x1b[0m',
    '⚠': '\x1b[33m⚠\x1b[0m',
    'ℹ': '\x1b[36mℹ\x1b[0m'
  };

  const icon = icons[status] || status;
  console.log(`  ${icon}  ${message}`);

  if (status === '✓') checks.passed++;
  else if (status === '✗') checks.failed++;
  else if (status === '⚠') checks.warnings++;
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log('✓', `${description}: Found`);
    return true;
  } else {
    log('✗', `${description}: NOT FOUND at ${filePath}`);
    return false;
  }
}

console.log('\n📋 Medicology Deployment Pre-Flight Checklist\n');

// 1. Project Structure
console.log('1️⃣  Project Structure');
checkFile('artifacts/api-server', 'Backend API');
checkFile('artifacts/medicology', 'Frontend App');
checkFile('lib/db', 'Database Library');

// 2. Configuration Files
console.log('\n2️⃣  Configuration Files');
checkFile('.env.example', '.env.example template');
checkFile('.gitignore', '.gitignore (secrets protection)');
checkFile('pnpm-workspace.yaml', 'pnpm workspace config');

// 3. Build Artifacts
console.log('\n3️⃣  Build Artifacts');
checkFile('artifacts/medicology/dist/public', 'Frontend production build');
checkFile('artifacts/medicology/dist/public/index.html', 'Frontend HTML entry');
checkFile('artifacts/medicology/dist/public/assets', 'Frontend assets (JS/CSS)');

// 4. Documentation
console.log('\n4️⃣  Deployment Documentation');
checkFile('QUICK_START.md', 'Quick start guide');
checkFile('GITHUB_SETUP.md', 'GitHub setup guide');
checkFile('DEPLOY_NOW.md', 'Deploy now guide');
checkFile('DEPLOYMENT_GUIDE.md', 'Detailed deployment guide');
checkFile('DEPLOYMENT_CHECKLIST.md', 'Deployment checklist');
checkFile('README.md', 'Project README');

// 5. Dependencies
console.log('\n5️⃣  Dependencies');
checkFile('node_modules', 'node_modules installed');
checkFile('pnpm-lock.yaml', 'Dependency lock file');

// 6. Helper Scripts
console.log('\n6️⃣  Helper Scripts');
checkFile('start-app.bat', 'Windows batch starter');
checkFile('start-app.ps1', 'PowerShell starter');

// 7. .gitignore Security Check
console.log('\n7️⃣  Security Check');
const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
if (gitignoreContent.includes('.env')) {
  log('✓', '.env is in gitignore (secrets protected)');
} else {
  log('✗', '.env is NOT in gitignore (DANGER: secrets could leak!)');
}

if (gitignoreContent.includes('node_modules')) {
  log('✓', 'node_modules is in gitignore');
} else {
  log('⚠', 'node_modules is NOT in gitignore');
}

// 8. Summary
console.log('\n' + '='.repeat(50));
console.log(`\n✓ Passed: ${checks.passed}`);
console.log(`✗ Failed: ${checks.failed}`);
console.log(`⚠ Warnings: ${checks.warnings}`);

if (checks.failed === 0) {
  console.log('\n🚀 READY FOR DEPLOYMENT!\n');
  console.log('Next steps:');
  console.log('  1. Read QUICK_START.md for the 4-step deployment');
  console.log('  2. Follow GITHUB_SETUP.md to push code to GitHub');
  console.log('  3. Deploy to Railway and Vercel (see DEPLOY_NOW.md)');
  console.log('  4. Connect your Namecheap domain\n');
  process.exit(0);
} else {
  console.log('\n❌ FIX ISSUES BEFORE DEPLOYING!\n');
  process.exit(1);
}
