import { env } from "cloudflare:workers";
import dayOneTranscript from "../../../content/transcript-04-clean.md?raw";
import dayTwoTranscript from "../../../content/transcript-01-clean.md?raw";

type AgentMode = "chat" | "quiz" | "flashcards";
type SourceScope = "current-page" | "all-document";

type AgentRequest = {
  mode?: AgentMode;
  question?: string;
  context?: string;
  page?: number;
  pageCount?: number;
  materialId?: string;
  material?: string;
  scope?: SourceScope;
  focus?: string;
};

type TranscriptChunk = {
  id: string;
  text: string;
};

const transcriptByMaterial = {
  "day-1-foundation": {
    label: "Day 1 - AI & LLM Foundation",
    transcript: dayOneTranscript,
  },
  "day-2-product": {
    label: "Day 2 - Xác định bài toán cho AI",
    transcript: dayTwoTranscript,
  },
} as const;

const stopWords = new Set(
  "ai anh ban bài bằng biêt biết cac cách cho của có câu đã đang đây đến được gì hay hãy hơn khi là làm một nào này những nói ở phải phần sao sẽ theo thì trong trên từ và vào về với".split(
    " ",
  ),
);

function compact(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit).trimEnd()}…`
    : normalized;
}

function parseTranscript(markdown: string): TranscriptChunk[] {
  const markers = Array.from(
    markdown.matchAll(/\*\*\[(T\d{2}-\d{3})\]\*\*/g),
  );
  return markers.flatMap((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? markdown.length;
    const text = compact(
      markdown
        .slice(start, end)
        .replace(/\[Hoạt động lớp:[\s\S]*?\]/g, "")
        .replace(/^##.*$/gm, ""),
      1800,
    );
    return text.length >= 30 ? [{ id: marker[1], text }] : [];
  });
}

const chunksByMaterial = Object.fromEntries(
  Object.entries(transcriptByMaterial).map(([id, material]) => [
    id,
    parseTranscript(material.transcript),
  ]),
) as Record<string, TranscriptChunk[]>;

function normalizeTokens(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function retrieveChunks(
  materialId: string,
  question: string,
  context: string,
  limit = 7,
) {
  const chunks = chunksByMaterial[materialId] ?? [];
  return rankChunks(chunks, question, context, limit);
}

function rankChunks(
  chunks: TranscriptChunk[],
  question: string,
  context: string,
  limit = 7,
) {
  const queryTokens = new Set(normalizeTokens(`${question} ${context}`));
  const ranked = chunks
    .map((chunk, index) => {
      const chunkTokens = normalizeTokens(chunk.text);
      const overlap = chunkTokens.reduce(
        (score, token) => score + (queryTokens.has(token) ? 1 : 0),
        0,
      );
      const contextBonus = context
        .split(/\s+/)
        .filter((term) => term.length > 8 && chunk.text.includes(term))
        .length;
      return { chunk, index, score: overlap + contextBonus * 2 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = ranked.filter((item) => item.score > 0).slice(0, limit);
  if (selected.length >= Math.min(5, limit)) {
    return selected.map((item) => item.chunk);
  }
  return ranked.slice(0, Math.min(limit, chunks.length)).map((item) => item.chunk);
}

function contextChunks(context: string) {
  const matches = Array.from(
    context.matchAll(
      /\[Trang\s+(\d+)\]\s*([\s\S]*?)(?=\n\[Trang\s+\d+\]|$)/gi,
    ),
  );
  if (matches.length === 0) {
    const text = compact(context, 3200);
    return text ? [{ id: "P001", text }] : [];
  }
  return matches.flatMap((match) => {
    const text = compact(match[2], 3200);
    if (!text) return [];
    return [
      {
        id: `P${String(Number(match[1])).padStart(3, "0")}`,
        text,
      },
    ];
  });
}

function sourceBlock(chunks: TranscriptChunk[]) {
  return chunks.map((chunk) => `[${chunk.id}] ${chunk.text}`).join("\n\n");
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) return "";
  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const content = (candidate as { content?: { parts?: unknown[] } }).content;
      return Array.isArray(content?.parts) ? content.parts : [];
    })
    .map((part) =>
      part &&
      typeof part === "object" &&
      "text" in part &&
      typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .filter(Boolean)
    .join("\n");
}

function parseJsonResponse(value: string) {
  const normalized = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fallbackChat(chunks: TranscriptChunk[], question: string) {
  const primary = chunks[0];
  if (!primary) {
    return {
      answer: "Chưa tìm thấy nội dung phù hợp trong học liệu đang mở.",
      citations: [],
    };
  }
  return {
    answer: `Theo bài giảng, ${compact(primary.text, 620)}${
      question.toLocaleLowerCase("vi").includes("ví dụ")
        ? " Bạn có thể dùng chính tình huống này làm ví dụ để diễn giải lại bằng lời của mình."
        : ""
    }`,
    citations: chunks.slice(0, 2).map((chunk) => chunk.id),
  };
}

function fallbackQuiz(chunks: TranscriptChunk[]) {
  if (chunks.length === 0) return [];
  return Array.from({ length: 3 }, (_, index) => {
    const chunk = chunks[index % chunks.length];
    const answer = compact(chunk.text, 150);
    return {
      question:
        index === 0
          ? "Ý nào dưới đây được bài giảng nhấn mạnh?"
          : `Phát biểu nào phù hợp với đoạn [${chunk.id}]?`,
      options: [
        answer,
        "AI luôn đúng nếu cửa sổ ngữ cảnh đủ lớn.",
        "Mọi bài toán đều nên được tự động hóa hoàn toàn.",
        "Có thể bỏ qua dữ liệu và tiêu chí đánh giá.",
      ],
      answer: 0,
      explain: `Đáp án được đối chiếu trực tiếp với đoạn [${chunk.id}].`,
      citation: chunk.id,
    };
  });
}

function fallbackFlashcards(chunks: TranscriptChunk[]) {
  if (chunks.length === 0) return [];
  return Array.from({ length: 5 }, (_, index) => {
    const chunk = chunks[index % chunks.length];
    return {
      front: `Ý chính ${index + 1} từ nguồn [${chunk.id}] là gì?`,
      back: compact(chunk.text, 260),
      citation: chunk.id,
    };
  });
}

function promptForMode(
  mode: AgentMode,
  question: string,
  pageContext: string,
  sources: string,
  options: {
    scope: SourceScope;
    material: string;
    sourceKind: "paired-transcript" | "uploaded-document";
    focus: string;
    page: number;
    pageCount: number;
  },
) {
  const scopeDirection =
    options.scope === "current-page"
      ? `Chỉ giải thích nội dung thuộc trang ${options.page}; không mở rộng sang phần khác của tài liệu.`
      : `Được tổng hợp trên toàn bộ ${options.pageCount} trang; ưu tiên các phần liên quan trực tiếp đến câu hỏi.`;
  const sourceDirection =
    options.sourceKind === "paired-transcript"
      ? "Nguồn sự thật là transcript đã ghép đúng với bộ slide. Ngữ cảnh slide xác định phạm vi cần trả lời."
      : "Nguồn sự thật là nội dung trích xuất trực tiếp từ file người dùng vừa tải lên.";
  const citationFormat =
    options.sourceKind === "paired-transcript" ? "Txx-xxx" : "Pxxx";

  const common = `Bạn là trợ giảng VLearn cho tài liệu "${options.material}".

PHẠM VI NGƯỜI DÙNG ĐÃ CHỌN:
${scopeDirection}

QUY TẮC NGUỒN:
${sourceDirection}
- Không dùng kiến thức ngoài, không đoán, không trộn với tài liệu khác.
- Nếu nguồn không đủ, nói rõ chưa đủ căn cứ.
- Mọi kết luận phải gắn mã trích dẫn dạng ${citationFormat} có trong nguồn.
- Không được tạo mã trích dẫn không xuất hiện trong NGUỒN.

NGỮ CẢNH SLIDE ĐÃ CHỌN:
${compact(pageContext, 7000)}

TRỌNG TÂM NGƯỜI HỌC ĐÃ BÔI SÁNG:
${options.focus ? compact(options.focus, 2400) : "Không có; bám theo câu hỏi."}

NGUỒN:
${sources}`;

  if (mode === "quiz") {
    return `${common}

Tạo đúng 3 câu trắc nghiệm kiểm tra khả năng hiểu và áp dụng. Trả về JSON thuần:
{"quiz":[{"question":"...","options":["...","...","...","..."],"answer":0,"explain":"...","citation":"${citationFormat}"}]}
answer là chỉ số 0-3. Mỗi câu chỉ có một đáp án đúng và không dùng phương án vô lý.`;
  }
  if (mode === "flashcards") {
    return `${common}

Tạo 5 thẻ nhớ ngắn gọn. Trả về JSON thuần:
{"flashcards":[{"front":"...","back":"...","citation":"${citationFormat}"}]}`;
  }
  return `${common}

CÂU HỎI:
${compact(question, 1000)}

Trả về JSON thuần:
{"answer":"Câu trả lời tiếng Việt rõ ràng, bám đúng phạm vi đã chọn và có mã [${citationFormat}] ngay sau ý tương ứng.","citations":["${citationFormat}"]}`;
}

function schemaForMode(mode: AgentMode) {
  const citation = {
    type: "string",
    description: "Mã nguồn có trong prompt, dạng Txx-xxx hoặc Pxxx.",
  };
  if (mode === "quiz") {
    return {
      type: "object",
      properties: {
        quiz: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
              },
              answer: { type: "integer", minimum: 0, maximum: 3 },
              explain: { type: "string" },
              citation,
            },
            required: [
              "question",
              "options",
              "answer",
              "explain",
              "citation",
            ],
          },
        },
      },
      required: ["quiz"],
    };
  }
  if (mode === "flashcards") {
    return {
      type: "object",
      properties: {
        flashcards: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              front: { type: "string" },
              back: { type: "string" },
              citation,
            },
            required: ["front", "back", "citation"],
          },
        },
      },
      required: ["flashcards"],
    };
  }
  return {
    type: "object",
    properties: {
      answer: { type: "string" },
      citations: {
        type: "array",
        minItems: 1,
        maxItems: 7,
        items: citation,
      },
    },
    required: ["answer", "citations"],
  };
}

async function callGemini(prompt: string, mode: AgentMode) {
  const runtimeEnv = env as unknown as {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
  };
  if (!runtimeEnv.GEMINI_API_KEY) return null;

  const model = runtimeEnv.GEMINI_MODEL || "gemini-3.6-flash";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": runtimeEnv.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schemaForMode(mode),
            maxOutputTokens: 3200,
            thinkingConfig: {
              thinkingLevel: "minimal",
            },
          },
        }),
      },
    );
    if (!response.ok) continue;
    const parsed = parseJsonResponse(extractGeminiText(await response.json()));
    if (parsed) return parsed;
  }
  return null;
}

function isMaterialId(value: string): value is keyof typeof transcriptByMaterial {
  return value in transcriptByMaterial;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentRequest;
    const mode = payload.mode ?? "chat";
    const materialId = payload.materialId?.trim() ?? "";
    const material = payload.material?.trim() || "Tài liệu đang mở";
    const question = payload.question?.trim() ?? "";
    const context = payload.context?.trim() ?? "";
    const focus = payload.focus?.trim() ?? "";
    const scope: SourceScope =
      payload.scope === "all-document" ? "all-document" : "current-page";
    const page = Math.max(1, Number(payload.page) || 1);
    const pageCount = Math.max(page, Number(payload.pageCount) || page);
    const pairedMaterial = isMaterialId(materialId);

    if (!pairedMaterial && context.length < 20) {
      return Response.json(
        { error: "Tài liệu tải lên chưa có đủ nội dung để hỏi AI." },
        { status: 400 },
      );
    }
    if (mode === "chat" && !question) {
      return Response.json({ error: "Cần có câu hỏi." }, { status: 400 });
    }

    const chunks = pairedMaterial
      ? retrieveChunks(
          materialId,
          question,
          scope === "current-page" ? `${context}\n${focus}` : focus,
        )
      : rankChunks(contextChunks(context), question, focus, 7);
    const prompt = promptForMode(
      mode,
      question,
      context,
      sourceBlock(chunks),
      {
        scope,
        material,
        sourceKind: pairedMaterial
          ? "paired-transcript"
          : "uploaded-document",
        focus,
        page,
        pageCount,
      },
    );
    const liveResult = await callGemini(prompt, mode);

    if (mode === "quiz") {
      const quiz =
        Array.isArray(liveResult?.quiz) && liveResult.quiz.length === 3
        ? liveResult.quiz.slice(0, 3)
        : fallbackQuiz(chunks);
      return Response.json({ quiz, live: Boolean(liveResult) });
    }
    if (mode === "flashcards") {
      const flashcards =
        Array.isArray(liveResult?.flashcards) &&
        liveResult.flashcards.length === 5
        ? liveResult.flashcards.slice(0, 5)
        : fallbackFlashcards(chunks);
      return Response.json({ flashcards, live: Boolean(liveResult) });
    }

    const fallback = fallbackChat(chunks, question);
    return Response.json({
      answer:
        typeof liveResult?.answer === "string"
          ? liveResult.answer
          : fallback.answer,
      citations: Array.isArray(liveResult?.citations)
        ? liveResult.citations
        : fallback.citations,
      live: Boolean(liveResult),
    });
  } catch {
    return Response.json(
      { error: "Trợ lý chưa thể xử lý câu hỏi." },
      { status: 500 },
    );
  }
}
