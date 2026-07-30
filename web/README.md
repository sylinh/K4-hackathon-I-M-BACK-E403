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

Ứng dụng luôn có chế độ trợ lý demo theo ngữ cảnh để trình diễn không cần API
key. Muốn dùng mô hình live, tạo `.env` từ `.env.example`, đặt
`OPENAI_API_KEY` trong môi trường chạy và khởi động lại ứng dụng. Không commit
API key vào repository.

## Lưu tài liệu

Tệp được phân tích ngay trên trình duyệt. Khi triển khai qua Sites, nội dung gốc
được lưu trong binding R2 `MATERIALS`; nếu kho lưu trữ chưa sẵn sàng, giao diện
vẫn hoạt động ở chế độ cục bộ.
