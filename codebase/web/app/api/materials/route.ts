import { env } from "cloudflare:workers";

const allowedExtensions = new Set(["pdf", "pptx", "docx", "txt", "md"]);
const maxBytes = 20 * 1024 * 1024;

function safeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Thiếu tệp tải lên." }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension)) {
      return Response.json(
        { error: "Định dạng tệp chưa được hỗ trợ." },
        { status: 415 },
      );
    }
    if (file.size > maxBytes) {
      return Response.json(
        { error: "Tệp vượt quá giới hạn 20 MB." },
        { status: 413 },
      );
    }

    const runtimeEnv = env as unknown as {
      MATERIALS?: R2Bucket;
    };
    if (!runtimeEnv.MATERIALS) {
      return Response.json(
        { error: "Kho tài liệu chưa được kết nối." },
        { status: 503 },
      );
    }

    const key = `materials/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    await runtimeEnv.MATERIALS.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: file.name.slice(0, 180),
      },
    });

    return Response.json(
      {
        id: key,
        name: file.name,
        size: file.size,
        type: file.type,
      },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: "Không thể lưu tài liệu lúc này." },
      { status: 500 },
    );
  }
}
