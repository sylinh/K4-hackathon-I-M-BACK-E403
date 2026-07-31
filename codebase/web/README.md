# VLearn Focus runtime

Đây là runtime prototype của repo. Từ thư mục gốc chạy:

```powershell
cd codebase/web
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Gemini live

Tạo `codebase/web/.dev.vars` từ `codebase/config/.dev.vars.example`, điền
`GEMINI_API_KEY_1` đến `GEMINI_API_KEY_8` và restart server. Key trống được bỏ
qua; key lỗi/quota sẽ tự chuyển sang key tiếp theo. Không commit file secret.

Khi chưa có key hoặc Gemini không sẵn sàng, prototype dùng fallback grounded
và vẫn giữ citation theo nguồn.

## Kiểm tra

```powershell
npm test
```

Eval chạy từ thư mục runtime bằng `npm run eval:v6`; report được ghi vào
`../../eval/results/`.
