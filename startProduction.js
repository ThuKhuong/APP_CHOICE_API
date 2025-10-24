#!/usr/bin/env node

/**
 * Production Start Script
 * Chạy cả API server và scheduler cùng lúc
 */

const { spawn } = require('child_process');

console.log('Production Environment');
console.log('========================');

// Start API server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit'
});

// Start scheduler
const scheduler = spawn('node', ['scheduler/runScheduler.js'], {
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
  console.log(`Server exited: ${code}`);
  scheduler.kill('SIGTERM');
  process.exit(code);
});

// Handle scheduler exit
scheduler.on('exit', (code) => {
  console.log(`Scheduler exited: ${code}`);
  server.kill('SIGTERM');
  process.exit(code);
});

console.log('Started successfully!');
console.log('Server: http://localhost:3000');
console.log('Scheduler: Every 1s');
console.log('Press Ctrl+C to stop');
