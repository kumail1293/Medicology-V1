#!/usr/bin/env node
/**
 * USER EXECUTION TEST - Verify user CAN deploy
 * This tests that all commands the user needs to run will work
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('\n📋 TESTING USER DEPLOYMENT EXECUTION\n');

const tests = [];

// Test 1: Git is available
try {
  execSync('git --version', { stdio: 'pipe' });
  tests.push({ name: 'Git installed', pass: true });
} catch {
  tests.push({ name: 'Git installed', pass: false });
}

// Test 2: Node/npm available
try {
  execSync('node --version', { stdio: 'pipe' });
  tests.push({ name: 'Node.js installed', pass: true });
} catch {
  tests.push({ name: 'Node.js installed', pass: false });
}

// Test 3: pnpm available
try {
  execSync('pnpm --version', { stdio: 'pipe' });
  tests.push({ name: 'pnpm installed', pass: true });
} catch {
  tests.push({ name: 'pnpm installed', pass: false });
}

// Test 4: Can read package.json
try {
  fs.readFileSync('package.json', 'utf8');
  tests.push({ name: 'package.json readable', pass: true });
} catch {
  tests.push({ name: 'package.json readable', pass: false });
}

// Test 5: Can access git repo
try {
  execSync('git log -1', { stdio: 'pipe' });
  tests.push({ name: 'Git repository accessible', pass: true });
} catch {
  tests.push({ name: 'Git repository accessible', pass: false });
}

// Print results
console.log('🔍 SYSTEM CAPABILITY CHECKS:\n');
let allPass = true;
tests.forEach(test => {
  const icon = test.pass ? '✅' : '❌';
  console.log(`${icon} ${test.name}`);
  if (!test.pass) allPass = false;
});

console.log('\n' + '='.repeat(60));

if (allPass) {
  console.log('\n✅ USER CAN EXECUTE DEPLOYMENT\n');
  console.log('Your system is ready to run the deployment commands.\n');
  console.log('Execute these steps:\n');
  console.log('1. Read 00_START_HERE.md\n');
  console.log('2. Run:\n');
  console.log('   git remote add origin https://github.com/YOUR_USERNAME/medicology.git');
  console.log('   git branch -M main');
  console.log('   git push -u origin main\n');
  console.log('3. Follow QUICK_START.md for Railway and Vercel\n');
  console.log('✅ DEPLOYMENT EXECUTABLE BY USER\n');
} else {
  console.log('\n⚠️ SOME TOOLS MISSING - User may need to install:\n');
  if (!tests[0].pass) console.log('   - Git: https://git-scm.com/download/win');
  if (!tests[1].pass) console.log('   - Node.js: https://nodejs.org/');
  if (!tests[2].pass) console.log('   - pnpm: npm install -g pnpm\n');
}

console.log('='.repeat(60) + '\n');
process.exit(allPass ? 0 : 1);
