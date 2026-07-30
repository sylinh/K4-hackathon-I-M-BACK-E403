import { env } from "cloudflare:workers";

type AgentRequest = {
  question?: string;
  context?: string;
  page?: number;
  material?: string;
};

function compact(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit).trimEnd()}…`
    : normalized;
}

function fallbackAnswer(question: string, context: string) {
  const lowerQuestion = question.toLocaleLowerCase("vi");
  const source = compact(context, 520);

  if (/ví dụ|minh hoạ|tình huống/.test(lowerQuestion)) {
    return `Ví dụ thực tế: hãy xem phần được chọn như một yêu cầu đầu vào cho agent. Agent cần đọc đúng dữ kiện “${compact(
      context,
      220,
    )}”, xác định điều còn thiếu, rồi mới chọn trả lời trực tiếp hay gọi công cụ. Như vậy, quyết định của agent luôn bám vào ngữ cảnh thay vì tự đoán.`;
  }
  if (/tóm tắt|ý chính|nói ngắn/.test(lowerQuestion)) {
    return `Tóm tắt ngắn: ${source}`;
  }
  if (/tại sao|vì sao/.test(lowerQuestion)) {
    return `Vì nội dung đang nhấn mạnh rằng: ${source} Khi áp dụng, điểm quan trọng là không tách kết luận khỏi dữ kiện ở trang hiện tại.`;
  }
  return `Dựa trên phần bạn đang học, câu trả lời là: ${source}\n\nMẹo tự kiểm tra: hãy thử diễn đạt lại ý này bằng một tình huống của riêng bạn trước khi chuyển sang trang tiếp theo.`;
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown[] }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((item) =>
      item &&
      typeof item === "object" &&
      "text" in item &&
      typeof (item as { text?: unknown }).text === "string"
        ? (item as { text: string }).text
        : "",
    )
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentRequest;
    const question = payload.question?.trim() ?? "";
    const context = payload.context?.trim() ?? "";
    if (!question || !context) {
      return Response.json(
        { error: "Cần có câu hỏi và ngữ cảnh tài liệu." },
        { status: 400 },
      );
    }

    const runtimeEnv = env as unknown as {
      OPENAI_API_KEY?: string;
      OPENAI_MODEL?: string;
    };

    if (runtimeEnv.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${runtimeEnv.OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: runtimeEnv.OPENAI_MODEL || "gpt-4.1-mini",
          instructions:
            "Bạn là trợ giảng học tập. Chỉ trả lời bằng tiếng Việt từ ngữ cảnh được cung cấp. Nếu ngữ cảnh không đủ, nói rõ phần còn thiếu. Trả lời ngắn gọn, có tính sư phạm và không bịa nguồn.",
          input: `Tài liệu: ${payload.material ?? "Tài liệu đang mở"}\nTrang: ${
            payload.page ?? 1
          }\n\nNgữ cảnh:\n${compact(context, 7000)}\n\nCâu hỏi:\n${compact(
            question,
            800,
          )}`,
          max_output_tokens: 420,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const answer = extractOutputText(result);
        if (answer) {
          return Response.json({ answer, live: true });
        }
      }
    }

    return Response.json({
      answer: fallbackAnswer(question, context),
      live: false,
    });
  } catch {
    return Response.json(
      { error: "Trợ lý chưa thể xử lý câu hỏi." },
      { status: 500 },
    );
  }
}
