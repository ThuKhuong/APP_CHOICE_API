# APP CHOICE API

## 📝 Mô tả dự án

**APP CHOICE API** là backend service cho hệ thống thi trắc nghiệm trực tuyến, được xây dựng bằng Node.js và Express. API này cung cấp các endpoint để quản lý người dùng, bài thi, câu hỏi và theo dõi quá trình thi của sinh viên.

### Đặc điểm chính:
- 🔐 Xác thực người dùng với JWT
- 📚 Quản lý bài thi và câu hỏi trắc nghiệm
- 👥 Hỗ trợ 3 loại người dùng: Sinh viên, Giáo viên, Giám thị
- 📊 Theo dõi và giám sát thi real-time
- 🗄️ Lưu trữ dữ liệu với PostgreSQL
- 🔒 Bảo mật với bcrypt và middleware xác thực

## 🚀 Hướng dẫn cài đặt

### Yêu cầu hệ thống:
- Node.js (phiên bản 16 trở lên)
- PostgreSQL (phiên bản 12 trở lên)
- npm hoặc yarn

### Bước 1: Clone repository
```bash
git clone https://github.com/ThuKhuong/APP_CHOICE_API.git
cd APP_CHOICE_API
```

### Bước 2: Cài đặt PostgreSQL
1. Tải và cài đặt PostgreSQL từ [postgresql.org](https://www.postgresql.org/download/)
2. Tạo database mới:
```sql
CREATE DATABASE multiple_choice;
```

### Bước 3: Cấu hình môi trường
Tạo file `.env` trong thư mục gốc:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=multiple_choice
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
```

### Bước 4: Cài đặt dependencies
```bash
npm install
```

### Bước 5: Chạy ứng dụng
```bash

# Chạy server với hot reload 
npm run dev

# Hoặc chạy server bình thường
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📖 Cách sử dụng

### API Endpoints

#### Authentication (`/api/auth`)
- `POST /register` - Đăng ký tài khoản mới
- `POST /login` - Đăng nhập

#### Teacher (`/api/teacher`)
- `GET /exams` - Lấy danh sách bài thi
- `POST /exams` - Tạo bài thi mới
- `GET /exams/:id` - Lấy chi tiết bài thi
- `PUT /exams/:id` - Cập nhật bài thi
- `DELETE /exams/:id` - Xóa bài thi

#### Student (`/api/student`)
- `POST /start` - Bắt đầu làm bài thi
- `POST /answer` - Lưu câu trả lời
- `DELETE /answer` - Xóa câu trả lời
- `POST /submit` - Nộp bài thi
- `GET /history` - Lịch sử thi

#### Proctor (`/api/proctor`)
- `GET /monitor` - Theo dõi sinh viên đang thi
- `GET /violations` - Danh sách vi phạm
- `POST /violations` - Báo cáo vi phạm

### Ví dụ sử dụng

#### Đăng nhập
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@example.com", "password": "password123"}'
```

#### Tạo bài thi mới
```bash
curl -X POST http://localhost:3000/api/teacher/exams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Bài thi Toán học",
    "duration": 60,
    "questions": [...]
  }'
```

## 📦 Dependencies

### Production Dependencies:
- **express** (^5.1.0) - Web framework
- **pg** (^8.16.3) - PostgreSQL client
- **bcrypt** (^6.0.0) - Password hashing
- **jsonwebtoken** (^9.0.2) - JWT authentication
- **cors** (^2.8.5) - Cross-origin resource sharing
- **dotenv** (^17.2.3) - Environment variables
- **ws** (^8.18.3) - WebSocket support

### Development Dependencies:
- **nodemon** (^3.1.10) - Auto-restart development server

## 🐛 Khắc phục lỗi phổ biến

### 1. Lỗi kết nối database
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Giải pháp:**
- Kiểm tra PostgreSQL đã chạy chưa
- Kiểm tra thông tin kết nối trong file `.env`
- Kiểm tra database `multiple_choice` đã tồn tại

### 2. Lỗi JWT
```
Error: jwt malformed
```
**Giải pháp:**
- Kiểm tra JWT_SECRET trong file `.env`
- Đảm bảo token được gửi đúng format: `Bearer <token>`

### 3. Lỗi CORS
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Giải pháp:**
- Kiểm tra cấu hình CORS trong `server.js`
- Đảm bảo frontend đang gọi đúng URL API

## ❓ Câu hỏi thường gặp

**Q: Làm sao để thay đổi port server?**
A: Sửa biến `PORT` trong file `server.js` hoặc thêm vào file `.env`

**Q: Có thể sử dụng database khác không?**
A: Có thể, nhưng cần thay đổi driver database và cấu hình kết nối

**Q: Làm sao để deploy lên production?**
A: Sử dụng PM2 hoặc Docker, cấu hình environment variables và database production

## 🤝 Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Để đóng góp:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

### Quy tắc đóng góp:
- Code phải tuân thủ ESLint rules
- Viết test cases cho tính năng mới
- Cập nhật documentation nếu cần
- Commit message rõ ràng và có ý nghĩa

## 📚 Tài liệu tham khảo

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT.io](https://jwt.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🐛 Lỗi đã biết

1. **Memory leak với WebSocket connections** - Đang được khắc phục
2. **Race condition khi nhiều sinh viên submit cùng lúc** - Cần implement queue system
3. **Slow query với báo cáo thống kê lớn** - Cần optimize database indexes

## 📄 License

Dự án này được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

## 👥 Tác giả

- **ThuKhuong** - *Initial work* - [GitHub](https://github.com/ThuKhuong)

## 📞 Liên hệ

Nếu có câu hỏi hoặc cần hỗ trợ, vui lòng tạo issue trên GitHub repository.
