# AI SITIKI - Free AI Router Pack

Pack này giải quyết vấn đề tài khoản khách/free dùng hết quota Gemini quá nhanh.

## Cách hoạt động

Luồng mới:

```txt
Guest / Free user
→ kiểm tra quyền model và giới hạn lượt như cũ
→ nếu model đang dùng là free
→ gọi theo FREE_AI_PROVIDER_ORDER
→ nếu provider đầu lỗi/quá giới hạn trước khi stream ra chữ nào
→ tự fallback sang provider tiếp theo
```

Paid user vẫn dùng model trả phí theo gói, không bị route sang nguồn free.

## Khuyến nghị cấu hình ngay trên Vercel

Thêm env:

```txt
FREE_AI_PROVIDER_ORDER=openrouter,primary
OPENROUTER_API_KEY=<key OpenRouter của bạn>
OPENROUTER_FREE_MODELS=openrouter/free
OPENROUTER_APP_TITLE=AI SITIKI
FREE_AI_ENABLE_VISION_FALLBACK=false
```

Ý nghĩa:

```txt
openrouter: khách/free dùng OpenRouter trước
primary: nếu OpenRouter lỗi thì fallback về model free đang có trong DB, thường là Gemini
```

## File cần copy

```txt
lib/ai-router.ts
app/api/chat/stream/route.ts
app/api/chat/route.ts
app/vault-hbn/free-ai/page.tsx
app/vault-hbn/layout.tsx
app/vault-hbn/page.tsx
.env.example
README-free-ai-router.md
```

Nếu bạn không muốn đổi menu admin thì có thể không copy:

```txt
app/vault-hbn/layout.tsx
app/vault-hbn/page.tsx
```

Nhưng nên copy để có trang kiểm tra cấu hình tại:

```txt
/vault-hbn/free-ai
```

## Sau khi copy

```bash
npm run build
```

Nếu ổn:

```bash
git add .
git commit -m "add free ai router fallback"
git push
```

## Lưu ý vận hành

- Không dùng nhiều Gemini key để né quota. Cách an toàn hơn là route free traffic qua OpenRouter/free hoặc một nguồn OpenAI-compatible rẻ/free.
- Vẫn giữ giới hạn guest/free như hiện tại để tránh bị abuse.
- Vision fallback đang tắt mặc định. Ảnh vẫn ưu tiên Gemini/primary.
- Nếu provider fallback lỗi sau khi đã stream ra một phần câu trả lời thì hệ thống không retry nữa để tránh trả lời lẫn lộn.
