#!/usr/bin/env node

/**
 * Session Status Scheduler
 * Chạy job cập nhật status ca thi mỗi 5 giây
 * 
 * Usage:
 *   node scheduler/runScheduler.js
 *   npm run scheduler
 */

const scheduler = require('./sessionStatusScheduler.js');

console.log('Session Status Scheduler');
console.log('Press Ctrl+C to stop');

scheduler.start();

// Hiển thị status mỗi 60 giây
setInterval(() => {
  const status = scheduler.getStatus();
  console.log(`Status: ${status.isRunning ? 'RUNNING' : 'STOPPED'} | Last: ${new Date(status.lastUpdate).toLocaleTimeString()}`);
}, 60000);
