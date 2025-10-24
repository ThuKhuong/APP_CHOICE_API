#!/usr/bin/env node

/**
 * Start both API server and scheduler
 * Chạy cả server API và job scheduler
 * 
 * Usage:
 *   node startAll.js
 *   npm run start:all
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting API Server and Scheduler...');
console.log('=====================================');

// Start API server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Start scheduler
const scheduler = spawn('node', ['scheduler/runScheduler.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill('SIGINT');
  scheduler.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  server.kill('SIGTERM');
  scheduler.kill('SIGTERM');
  process.exit(0);
});

// Handle server exit
server.on('exit', (code) => {
  console.log(`API Server exited with code ${code}`);
  scheduler.kill('SIGTERM');
  process.exit(code);
});

// Handle scheduler exit
scheduler.on('exit', (code) => {
  console.log(`Scheduler exited with code ${code}`);
  server.kill('SIGTERM');
  process.exit(code);
});

console.log('Both processes started successfully!');
console.log('API Server: http://localhost:3000');
console.log('Scheduler: Running every 5 seconds');
console.log('Press Ctrl+C to stop both processes');
