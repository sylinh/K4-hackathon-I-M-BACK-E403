# VLearn Focus

Không gian học chủ động giúp người học:

- tải lên PDF, PPTX, DOCX, TXT hoặc Markdown;
- đọc và lướt theo từng trang;
- kéo chọn hoặc bấm vào nội dung để bôi sáng;
- hỏi trợ lý theo đúng ngữ cảnh đã chọn;
- tạo quiz, nhận giải thích và xem kết quả;
- tạo flashcard từ chính phần kiến thức đang học.

## Chạy trên Windows

```powershell
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Kiểm tra bản sản xuất

```powershell
npm test
```

## AI live

Ứng dụng dùng Gemini `gemini-3.6-flash` cho chat, quiz và flashcard. Khi chưa có
API key, trợ lý vẫn trả kết quả dự phòng bằng cách truy xuất đúng transcript và
giữ nguyên mã trích dẫn. Muốn dùng mô hình live, cấu hình `GEMINI_API_KEY_1`,
`GEMINI_API_KEY_2` và `GEMINI_API_KEY_3` trong môi trường chạy rồi khởi động lại
ứng dụng. Khi một project hết quota hoặc tạm lỗi, server sẽ chuyển sang project
tiếp theo và tạm ngưng key lỗi. Biến `GEMINI_API_KEY` cũ vẫn được hỗ trợ để tương
thích ngược. Không commit API key vào repository.

## Liên kết học liệu

Hai gói học liệu lớp được khóa nguồn ở phía server:

- Day 1: `d1-slide-hackathon.pdf` + `transcript-04-clean.md` (`T04-*`);
- Day 2: `d2-slide-hackathon.pdf` + `transcript-01-clean.md` (`T01-*`).

Client chỉ gửi `materialId` và ngữ cảnh trang đang xem. Server tự chọn transcript
đúng gói, truy xuất các đoạn liên quan rồi mới gọi mô hình. Vì vậy câu trả lời,
quiz và flashcard không thể lấy nhầm nội dung từ buổi học còn lại.

## Lưu tài liệu

Tệp được phân tích ngay trên trình duyệt. Khi triển khai qua Sites, nội dung gốc
được lưu trong binding R2 `MATERIALS`; nếu kho lưu trữ chưa sẵn sàng, giao diện
vẫn hoạt động ở chế độ cục bộ.
