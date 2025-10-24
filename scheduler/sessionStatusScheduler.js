const pool = require('../db.js');
const Session = require('../models/Session.js');

class SessionStatusScheduler {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.lastLogTime = 0;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Chạy job mỗi 1 giây để cập nhật chính xác
    this.interval = setInterval(async () => {
      try {
        await this.updateSessionStatuses();
      } catch (error) {
        console.error('Error in status update job:', error.message);
      }
    }, 1000);

    // Chạy ngay lập tức lần đầu
    this.updateSessionStatuses();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
  }

  async updateSessionStatuses() {
    try {
      const result = await Session.updateSessionStatuses();
      
      if (result.updated) {
        const now = Date.now();
        // Chỉ log mỗi 10 giây để tránh spam
        if (now - this.lastLogTime > 10000) {
          console.log(`[${new Date().toLocaleTimeString()}] Status updated`);
          this.lastLogTime = now;
        }
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error.message);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: new Date().toISOString()
    };
  }
}

// Tạo instance global
const scheduler = new SessionStatusScheduler();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, stopping scheduler...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, stopping scheduler...');
  scheduler.stop();
  process.exit(0);
});

// Export để có thể import từ file khác
module.exports = scheduler;

// Nếu chạy trực tiếp file này
if (require.main === module) {
  console.log('Starting Session Status Scheduler as standalone process...');
  scheduler.start();
}
