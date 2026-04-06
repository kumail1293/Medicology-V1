#!/usr/bin/env node
/**
 * MEDICOLOGY - DEPLOYMENT READY - FINAL STATUS CHECK
 * Run this to see your deployment status
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🚀 MEDICOLOGY - DEPLOYMENT STATUS REPORT');
console.log('='.repeat(70) + '\n');

const checks = [];

// Check 1: Git Repository
const hasGit = fs.existsSync('.git');
checks.push({ name: 'Git Repository Initialized', status: hasGit, critical: true });

// Check 2: Frontend Build
const hasFrontendBuild = fs.existsSync('artifacts/medicology/dist/public/index.html');
checks.push({ name: 'Frontend Production Build', status: hasFrontendBuild, critical: true });

// Check 3: Backend Source
const hasBackendSource = fs.existsSync('artifacts/api-server/src/app.ts');
checks.push({ name: 'Backend Source Code', status: hasBackendSource, critical: true });

// Check 4: Dependencies
const hasDependencies = fs.existsSync('node_modules');
checks.push({ name: 'Dependencies Installed', status: hasDependencies, critical: true });

// Check 5: Deployment Guides
const guides = [
  '00_START_HERE.md',
  'QUICK_START.md',
  'GITHUB_SETUP.md',
  'DEPLOY_NOW.md'
];
const hasGuides = guides.every(g => fs.existsSync(g));
checks.push({ name: 'Deployment Guides Created', status: hasGuides, critical: true });

// Check 6: gitignore Protection
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const protectsEnv = gitignore.includes('.env');
checks.push({ name: '.env Secrets Protected', status: protectsEnv, critical: true });

// Check 7: Configuration Template
const hasEnvExample = fs.existsSync('.env.example');
checks.push({ name: 'Configuration Template', status: hasEnvExample, critical: false });

// Print Results
console.log('CRITICAL DEPLOYMENT PREREQUISITES:\n');
let allCriticalPass = true;
checks.filter(c => c.critical).forEach(check => {
  const icon = check.status ? '✅' : '❌';
  const status = check.status ? 'PASS' : 'FAIL';
  console.log(`${icon} ${check.name.padEnd(40)} ${status}`);
  if (!check.status) allCriticalPass = false;
});

console.log('\nOPTIONAL ITEMS:\n');
checks.filter(c => !c.critical).forEach(check => {
  const icon = check.status ? '✅' : '⚠️';
  const status = check.status ? 'OK' : 'MISSING';
  console.log(`${icon} ${check.name.padEnd(40)} ${status}`);
});

console.log('\n' + '='.repeat(70));

if (allCriticalPass) {
  console.log('✅ ALL PREREQUISITES MET - READY FOR DEPLOYMENT\n');
  console.log('NEXT STEPS:');
  console.log('  1. Read: ./00_START_HERE.md');
  console.log('  2. Create GitHub repository at https://github.com/new');
  console.log('  3. Follow commands in 00_START_HERE.md to push code');
  console.log('  4. Deploy to Railway and Vercel (see QUICK_START.md)');
  console.log('  5. Update Namecheap DNS settings');
  console.log('\nExpected time to live: 15 minutes');
  console.log('Total cost: ~$10-15/year (domain only)\n');
  console.log('='.repeat(70) + '\n');
  process.exit(0);
} else {
  console.log('❌ DEPLOYMENT PREREQUISITES NOT MET\n');
  console.log('Please check the failed items above.\n');
  console.log('='.repeat(70) + '\n');
  process.exit(1);
}
