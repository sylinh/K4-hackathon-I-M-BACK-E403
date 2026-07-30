"use client";

import {
  ArrowRight,
  BookOpen,
  Bot,
  Circle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  Highlighter,
  ImagePlus,
  Layers3,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  MoreHorizontal,
  MousePointer2,
  PanelLeftClose,
  PanelRightClose,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  StickyNote,
  Sun,
  Upload,
  X,
  Eraser,
} from "lucide-react";
import JSZip from "jszip";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

type PdfTextItem = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  rotation: number;
};

type SlidePage = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  paragraphs: string[];
  points: string[];
  accent: "blue" | "coral" | "mint" | "amber";
  kind?: "slide" | "document";
  aspectRatio?: number;
  previewDataUrl?: string;
  pdfSource?: {
    id: string;
    data: Uint8Array;
  };
  pdfPageNumber?: number;
  textLayer?: PdfTextItem[];
};

type Material = {
  id: string;
  name: string;
  type: "PDF" | "PPTX" | "DOCX" | "TEXT";
  pages: SlidePage[];
  status: "Đã lưu" | "Cục bộ";
  updated: string;
  sourceUrl?: string;
  transcriptLabel?: string;
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  citation?: string;
  citations?: string[];
  evidence?: Array<{ claim: string; citation: string }>;
  confidence?: "Được nêu trực tiếp" | "Được suy ra" | "Không đủ thông tin";
  note?: string;
  live?: boolean;
};

type HighlightEntry = {
  id: string;
  text: string;
  pageIndex: number;
  pdfTextItemIds: string[];
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explain: string;
  citation?: string;
};

type Flashcard = {
  front: string;
  back: string;
  citation?: string;
};

type SavedLearningSet = {
  id: string;
  kind: "quiz" | "flashcards";
  materialId: string;
  materialName: string;
  pageIndex: number;
  savedAt: number;
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
};

type AgentTab = "chat" | "quiz" | "flashcards";
type ContextScope = "current-page" | "all-document";
type InterfaceLanguage = "vi" | "en";
type ViewerTool =
  | "read"
  | "highlight"
  | "pen"
  | "circle"
  | "note"
  | "image"
  | "eraser";

type AnnotationPoint = {
  x: number;
  y: number;
};

type PageAnnotation = {
  id: string;
  materialId: string;
  pageIndex: number;
  kind: "pen" | "circle" | "note" | "image";
  points?: AnnotationPoint[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  imageUrl?: string;
};

const accentOrder: SlidePage["accent"][] = ["blue", "coral", "mint", "amber"];

function bundledPdfPages(
  materialId: string,
  courseTitle: string,
  pageCount: number,
): SlidePage[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `${materialId}-page-${index + 1}`,
    eyebrow: `PDF • TRANG ${index + 1}`,
    title: index === 0 ? courseTitle : `Trang ${index + 1}`,
    subtitle: "Đang nạp nội dung nguyên bản…",
    paragraphs: [],
    points: [],
    accent: accentOrder[index % accentOrder.length],
    kind: "slide",
    aspectRatio: 16 / 9,
    pdfPageNumber: index + 1,
  }));
}

type PdfDocumentPromise = ReturnType<
  (typeof import("pdfjs-dist"))["getDocument"]
>["promise"];

const uploadedPdfDocumentCache = new Map<string, PdfDocumentPromise>();

async function getPdfDocument(source: NonNullable<SlidePage["pdfSource"]>) {
  const cachedDocument = uploadedPdfDocumentCache.get(source.id);
  if (cachedDocument) return cachedDocument;

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const documentPromise = pdfjs
    .getDocument({ data: source.data.slice() })
    .promise.catch((error) => {
      uploadedPdfDocumentCache.delete(source.id);
      throw error;
    });
  uploadedPdfDocumentCache.set(source.id, documentPromise);
  return documentPromise;
}

function PdfCanvasPage({
  source,
  pageNumber,
  zoom,
  label,
}: {
  source: NonNullable<SlidePage["pdfSource"]>;
  pageNumber: number;
  zoom: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null =
      null;
    let observer: IntersectionObserver | null = null;

    async function renderOriginalPage() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || cancelled) return;

      try {
        const pdf = await getPdfDocument(source);
        const pdfPage = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const cssWidth = Math.max(container.clientWidth, baseViewport.width);
        const pixelRatio = Math.min(
          3,
          Math.max(1, window.devicePixelRatio || 1),
        );
        const viewport = pdfPage.getViewport({
          scale: (cssWidth / baseViewport.width) * pixelRatio,
        });
        const canvasContext = canvas.getContext("2d", { alpha: false });
        if (!canvasContext) throw new Error("canvas-unavailable");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute("aria-label", label);
        renderTask = pdfPage.render({
          canvas,
          canvasContext,
          viewport,
          background: "rgb(255,255,255)",
        });
        await renderTask.promise;
        if (!cancelled) setRenderFailed(false);
        pdfPage.cleanup();
      } catch (error) {
        if (
          !cancelled &&
          (!(error instanceof Error) || error.name !== "RenderingCancelledException")
        ) {
          setRenderFailed(true);
        }
      }
    }

    const startRendering = () => {
      observer?.disconnect();
      void renderOriginalPage();
    };

    if ("IntersectionObserver" in window && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) startRendering();
        },
        { rootMargin: "700px 0px" },
      );
      observer.observe(containerRef.current);
    } else {
      startRendering();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      renderTask?.cancel();
    };
  }, [label, pageNumber, renderAttempt, source, zoom]);

  return (
    <div className="pdf-canvas-surface" ref={containerRef}>
      <canvas ref={canvasRef} role="img" />
      {renderFailed && (
        <div className="pdf-render-error">
          <p>Trang PDF chưa hiển thị được.</p>
          <button
            type="button"
            onClick={() => {
              uploadedPdfDocumentCache.delete(source.id);
              setRenderFailed(false);
              setRenderAttempt((value) => value + 1);
            }}
          >
            Thử hiển thị lại
          </button>
        </div>
      )}
    </div>
  );
}

const initialMaterials: Material[] = [
  {
    id: "day-1-foundation",
    name: "Day 1 · AI & LLM Foundation",
    type: "PDF",
    status: "Đã lưu",
    updated: "Học liệu lớp",
    sourceUrl: "/materials/d1-slide-hackathon.pdf",
    transcriptLabel: "Transcript 04 · T04",
    pages: bundledPdfPages(
      "day-1-foundation",
      "AI & LLM Foundation",
      29,
    ),
  },
  {
    id: "day-2-product",
    name: "Day 2 · Xác định bài toán cho AI",
    type: "PDF",
    status: "Đã lưu",
    updated: "Học liệu lớp",
    sourceUrl: "/materials/d2-slide-hackathon.pdf",
    transcriptLabel: "Transcript 01 · T01",
    pages: bundledPdfPages(
      "day-2-product",
      "Xác định bài toán cho AI",
      29,
    ),
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "Mình lấy slide đang mở làm nguồn trả lời chính; transcript chỉ bổ sung cách diễn giải khi cùng ngữ cảnh. Hãy chọn một đoạn hoặc đặt câu hỏi về trang hiện tại.",
    citation: "Day 1 · Slide PDF",
  },
];

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function typeFromFile(file: File): Material["type"] {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pptx") return "PPTX";
  if (extension === "docx") return "DOCX";
  if (extension === "pdf") return "PDF";
  return "TEXT";
}

function makePage(
  textBlocks: string[],
  pageIndex: number,
  label: string,
  kind: SlidePage["kind"] = "document",
  aspectRatio?: number,
): SlidePage {
  const safeBlocks = textBlocks.map(cleanText).filter(Boolean);
  const title = safeBlocks[0] || `${label} — Trang ${pageIndex + 1}`;
  const supporting = safeBlocks.slice(1);
  const points = supporting
    .filter((item) => item.length < 150)
    .slice(0, 5);
  const paragraphs = supporting
    .filter((item) => item.length >= 80)
    .slice(0, 3);

  return {
    id: `imported-${Date.now()}-${pageIndex}`,
    eyebrow: `${label.toUpperCase()} • TRANG ${pageIndex + 1}`,
    title,
    subtitle:
      points[0] ||
      paragraphs[0] ||
      "Nội dung đã được trích xuất và sẵn sàng để học cùng AI.",
    paragraphs:
      paragraphs.length > 0
        ? paragraphs
        : supporting.slice(0, 2).filter((item) => item !== points[0]),
    points:
      points.length > 0
        ? points
        : ["Chọn đoạn văn để bôi sáng", "Gửi phần đã chọn cho trợ lý AI"],
    accent: accentOrder[pageIndex % accentOrder.length],
    kind,
    aspectRatio,
  };
}

function AnnotationLayer({
  annotations,
  tool,
  language,
  onAdd,
  onUpdate,
  onRemove,
  onEraseHighlight,
}: {
  annotations: PageAnnotation[];
  tool: ViewerTool;
  language: InterfaceLanguage;
  onAdd: (
    annotation: Omit<PageAnnotation, "id" | "materialId" | "pageIndex">,
  ) => void;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onEraseHighlight: (pdfTextItemId?: string, text?: string) => void;
}) {
  const [draftPoints, setDraftPoints] = useState<AnnotationPoint[]>([]);
  const [circleStart, setCircleStart] = useState<AnnotationPoint | null>(null);
  const [circleEnd, setCircleEnd] = useState<AnnotationPoint | null>(null);
  const erasedDuringGestureRef = useRef(new Set<string>());

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100),
      ),
    };
  };

  const finishDrawing = () => {
    if (tool === "pen" && draftPoints.length > 1) {
      onAdd({ kind: "pen", points: draftPoints });
    }
    if (tool === "circle" && circleStart && circleEnd) {
      const x = Math.min(circleStart.x, circleEnd.x);
      const y = Math.min(circleStart.y, circleEnd.y);
      const width = Math.abs(circleEnd.x - circleStart.x);
      const height = Math.abs(circleEnd.y - circleStart.y);
      if (width > 1 && height > 1) {
        onAdd({ kind: "circle", x, y, width, height });
      }
    }
    setDraftPoints([]);
    setCircleStart(null);
    setCircleEnd(null);
    erasedDuringGestureRef.current.clear();
  };

  const distanceToSegment = (
    point: AnnotationPoint,
    start: AnnotationPoint,
    end: AnnotationPoint,
  ) => {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const projection = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * segmentX +
          (point.y - start.y) * segmentY) /
          lengthSquared,
      ),
    );
    return Math.hypot(
      point.x - (start.x + projection * segmentX),
      point.y - (start.y + projection * segmentY),
    );
  };

  const annotationContainsPoint = (
    annotation: PageAnnotation,
    point: AnnotationPoint,
  ) => {
    if (annotation.kind === "pen" && annotation.points) {
      return annotation.points.some(
        (linePoint, index) =>
          index > 0 &&
          distanceToSegment(point, annotation.points![index - 1], linePoint) <=
            2.2,
      );
    }
    const x = annotation.x ?? 0;
    const y = annotation.y ?? 0;
    const width = annotation.width ?? 0;
    const height = annotation.height ?? 0;
    if (annotation.kind === "circle") {
      const radiusX = Math.max(width / 2, 0.1);
      const radiusY = Math.max(height / 2, 0.1);
      const normalizedDistance = Math.hypot(
        (point.x - (x + radiusX)) / radiusX,
        (point.y - (y + radiusY)) / radiusY,
      );
      const tolerance = Math.max(0.12, 2.2 / Math.min(radiusX, radiusY));
      return Math.abs(normalizedDistance - 1) <= tolerance;
    }
    return (
      point.x >= x - 1 &&
      point.x <= x + width + 1 &&
      point.y >= y - 1 &&
      point.y <= y + height + 1
    );
  };

  const eraseAtPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const directAnnotationId = (
      event.target instanceof Element
        ? event.target.closest("[data-annotation-id]")
        : null
    )?.getAttribute("data-annotation-id");
    const point = pointFromEvent(event);
    const annotationId =
      directAnnotationId ??
      [...annotations]
        .reverse()
        .find((annotation) => annotationContainsPoint(annotation, point))?.id;
    if (
      annotationId &&
      !erasedDuringGestureRef.current.has(`annotation:${annotationId}`)
    ) {
      erasedDuringGestureRef.current.add(`annotation:${annotationId}`);
      onRemove(annotationId);
      return;
    }

    const highlightedText = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find(
        (element) =>
          element instanceof HTMLElement &&
          element.matches("[data-highlightable].is-highlighted"),
      ) as HTMLElement | undefined;
    if (!highlightedText) return;
    const highlightKey = `highlight:${
      highlightedText.dataset.pdfTextId ??
      cleanText(highlightedText.textContent ?? "")
    }`;
    if (erasedDuringGestureRef.current.has(highlightKey)) return;
    erasedDuringGestureRef.current.add(highlightKey);
    onEraseHighlight(
      highlightedText.dataset.pdfTextId,
      cleanText(highlightedText.textContent ?? ""),
    );
  };

  const draftCircle =
    circleStart && circleEnd
      ? {
          x: Math.min(circleStart.x, circleEnd.x),
          y: Math.min(circleStart.y, circleEnd.y),
          width: Math.abs(circleEnd.x - circleStart.x),
          height: Math.abs(circleEnd.y - circleStart.y),
        }
      : null;

  return (
    <div
      className={`annotation-layer tool-${tool}`}
      onPointerDown={(event) => {
        if (tool === "eraser") {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          erasedDuringGestureRef.current.clear();
          eraseAtPoint(event);
        } else if (tool === "pen") {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDraftPoints([pointFromEvent(event)]);
        } else if (tool === "circle") {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointFromEvent(event);
          setCircleStart(point);
          setCircleEnd(point);
        } else if (tool === "note") {
          const point = pointFromEvent(event);
          onAdd({
            kind: "note",
            x: point.x,
            y: point.y,
            width: 26,
            height: 20,
            text: "",
          });
        }
      }}
      onPointerMove={(event) => {
        if (
          tool === "eraser" &&
          event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
          eraseAtPoint(event);
        } else if (tool === "pen" && draftPoints.length > 0) {
          const point = pointFromEvent(event);
          setDraftPoints((current) => [...current, point]);
        } else if (tool === "circle" && circleStart) {
          setCircleEnd(pointFromEvent(event));
        }
      }}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
      aria-label={
        language === "vi" ? "Lớp ghi chú trên trang" : "Page annotation layer"
      }
    >
      <svg
        className="annotation-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {annotations.map((annotation) => {
          if (annotation.kind === "pen" && annotation.points) {
            return (
              <polyline
                key={annotation.id}
                className="annotation-pen"
                data-annotation-id={annotation.id}
                points={annotation.points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
              />
            );
          }
          if (annotation.kind === "circle") {
            return (
              <ellipse
                key={annotation.id}
                className="annotation-circle"
                data-annotation-id={annotation.id}
                cx={(annotation.x ?? 0) + (annotation.width ?? 0) / 2}
                cy={(annotation.y ?? 0) + (annotation.height ?? 0) / 2}
                rx={(annotation.width ?? 0) / 2}
                ry={(annotation.height ?? 0) / 2}
              />
            );
          }
          return null;
        })}
        {draftPoints.length > 1 && (
          <polyline
            className="annotation-pen is-draft"
            points={draftPoints
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
          />
        )}
        {draftCircle && (
          <ellipse
            className="annotation-circle is-draft"
            cx={draftCircle.x + draftCircle.width / 2}
            cy={draftCircle.y + draftCircle.height / 2}
            rx={draftCircle.width / 2}
            ry={draftCircle.height / 2}
          />
        )}
      </svg>

      {annotations.map((annotation) => {
        if (annotation.kind === "note") {
          return (
            <div
              className="page-note"
              key={annotation.id}
              data-annotation-id={annotation.id}
              style={{
                left: `${annotation.x ?? 0}%`,
                top: `${annotation.y ?? 0}%`,
                width: `${annotation.width ?? 26}%`,
                minHeight: `${annotation.height ?? 20}%`,
              }}
              onPointerDown={(event) => {
                if (tool !== "eraser") event.stopPropagation();
              }}
            >
              <textarea
                value={annotation.text ?? ""}
                onChange={(event) => onUpdate(annotation.id, event.target.value)}
                readOnly={tool === "eraser"}
                placeholder={language === "vi" ? "Ghi chú…" : "Note…"}
                aria-label={
                  language === "vi" ? "Nội dung ghi chú" : "Note content"
                }
              />
              <button
                type="button"
                onClick={() => onRemove(annotation.id)}
                aria-label={
                  language === "vi" ? "Xóa ghi chú" : "Delete note"
                }
                title={language === "vi" ? "Xóa ghi chú" : "Delete note"}
              >
                <X size={11} />
              </button>
            </div>
          );
        }
        if (annotation.kind === "image" && annotation.imageUrl) {
          return (
            <button
              type="button"
              className={`page-image ${
                tool === "eraser" ? "is-erasable" : ""
              }`}
              key={annotation.id}
              data-annotation-id={annotation.id}
              style={{
                left: `${annotation.x ?? 0}%`,
                top: `${annotation.y ?? 0}%`,
                width: `${annotation.width ?? 36}%`,
                height: `${annotation.height ?? 30}%`,
              }}
              onPointerDown={(event) => {
                if (tool !== "eraser") event.stopPropagation();
              }}
              aria-label={
                tool === "eraser"
                  ? language === "vi"
                    ? "Xóa ảnh"
                    : "Delete image"
                  : language === "vi"
                    ? "Ảnh ghi chú"
                    : "Annotation image"
              }
            >
              <span
                className="page-image-content"
                style={{ backgroundImage: `url("${annotation.imageUrl}")` }}
              />
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

type PdfJsModule = typeof import("pdfjs-dist");

let pdfWorkerConfigured = false;
const pdfDocumentCache = new Map<string, Promise<PDFDocumentProxy>>();
const pdfPageTextCache = new Map<string, Map<number, Promise<string>>>();

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

async function loadBundledPdf(sourceUrl: string) {
  const cached = pdfDocumentCache.get(sourceUrl);
  if (cached) return cached;

  const loading = loadPdfJs()
    .then((pdfjs) => pdfjs.getDocument({ url: sourceUrl }).promise)
    .catch((error) => {
      pdfDocumentCache.delete(sourceUrl);
      throw error;
    });
  pdfDocumentCache.set(sourceUrl, loading);
  return loading;
}

async function loadPdfPageText(sourceUrl: string, pageNumber: number) {
  let documentPages = pdfPageTextCache.get(sourceUrl);
  if (!documentPages) {
    documentPages = new Map<number, Promise<string>>();
    pdfPageTextCache.set(sourceUrl, documentPages);
  }
  const cached = documentPages.get(pageNumber);
  if (cached) return cached;

  const loading = loadBundledPdf(sourceUrl)
    .then(async (pdf) => {
      const pdfPage = await pdf.getPage(pageNumber);
      const content = await pdfPage.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? cleanText(item.str) : ""))
        .filter(Boolean)
        .join("\n");
      pdfPage.cleanup();
      return `[Trang ${pageNumber}]\n${text}`;
    })
    .catch((error) => {
      documentPages?.delete(pageNumber);
      throw error;
    });
  documentPages.set(pageNumber, loading);
  return loading;
}

async function renderPdfPage(
  pdfPage: PDFPageProxy,
  pageNumber: number,
  pdfjs: PdfJsModule,
  targetWidth = 1280,
) {
  const baseViewport = pdfPage.getViewport({ scale: 1 });
  const renderScale = Math.min(
    2,
    Math.max(1, targetWidth / baseViewport.width),
  );
  const viewport = pdfPage.getViewport({ scale: renderScale });
  const content = await pdfPage.getTextContent();
  const blocks = content.items
    .map((item) => ("str" in item ? item.str : ""))
    .map(cleanText)
    .filter(Boolean);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const canvasContext = canvas.getContext("2d", { alpha: false });
  if (!canvasContext) throw new Error("canvas-unavailable");
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({
    canvas,
    canvasContext,
    viewport,
  }).promise;

  const ratio = viewport.width / viewport.height;
  const renderedPage = makePage(
    blocks,
    pageNumber - 1,
    "PDF",
    ratio > 1.15 ? "slide" : "document",
    ratio,
  );
  renderedPage.previewDataUrl = canvas.toDataURL("image/jpeg", 0.86);
  renderedPage.textLayer = content.items.flatMap((item) => {
    if (!("str" in item) || !cleanText(item.str)) return [];
    const matrix = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.max(1, Math.hypot(matrix[2], matrix[3]));
    const renderedWidth = Math.max(1, item.width * renderScale);
    return [
      {
        text: item.str,
        left: (matrix[4] / viewport.width) * 100,
        top: ((matrix[5] - fontHeight) / viewport.height) * 100,
        width: (renderedWidth / viewport.width) * 100,
        height: (fontHeight / viewport.height) * 100,
        fontSize: (fontHeight / viewport.height) * 100,
        rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
      },
    ];
  });
  return renderedPage;
}

async function extractOfficePages(file: File): Promise<SlidePage[]> {
  const zip = await JSZip.loadAsync(file);
  const type = typeFromFile(file);
  const parser = new DOMParser();

  if (type === "PPTX") {
    const slideEntries = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((left, right) => {
        const a = Number(left.match(/slide(\d+)/i)?.[1] ?? 0);
        const b = Number(right.match(/slide(\d+)/i)?.[1] ?? 0);
        return a - b;
      });

    const pages = await Promise.all(
      slideEntries.map(async (entry, index) => {
        const xml = await zip.file(entry)?.async("text");
        const documentNode = parser.parseFromString(xml ?? "", "text/xml");
        const blocks = Array.from(documentNode.getElementsByTagName("a:t"))
          .map((node) => node.textContent ?? "")
          .filter(Boolean);
        return makePage(blocks, index, "Slide", "slide", 16 / 9);
      }),
    );

    return pages.filter((page) => page.title);
  }

  const xml = await zip.file("word/document.xml")?.async("text");
  if (!xml) return [];
  const documentNode = parser.parseFromString(xml, "text/xml");
  const paragraphNodes = Array.from(documentNode.getElementsByTagName("w:p"));
  const paragraphs = paragraphNodes
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("w:t"))
        .map((node) => node.textContent ?? "")
        .join(""),
    )
    .map(cleanText)
    .filter(Boolean);

  const pageSize = 8;
  return Array.from(
    { length: Math.max(1, Math.ceil(paragraphs.length / pageSize)) },
    (_, index) =>
      makePage(
        paragraphs.slice(index * pageSize, (index + 1) * pageSize),
        index,
        "Tài liệu",
        "document",
        210 / 297,
      ),
  );
}

async function extractPdfPages(file: File): Promise<SlidePage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  const originalData = new Uint8Array(await file.arrayBuffer());
  const source: NonNullable<SlidePage["pdfSource"]> = {
    id: crypto.randomUUID(),
    data: originalData,
  };
  const loadingTask = pdfjs.getDocument({ data: originalData.slice() });
  try {
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pages: SlidePage[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const pdfPage = await pdf.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const content = await pdfPage.getTextContent();
      const blocks = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .map(cleanText)
        .filter(Boolean);
      const ratio = viewport.width / viewport.height;
      const extractedPage = makePage(
        blocks,
        pageNumber - 1,
        "PDF",
        ratio > 1.15 ? "slide" : "document",
        ratio,
      );
      extractedPage.pdfSource = source;
      extractedPage.pdfPageNumber = pageNumber;
      extractedPage.textLayer = content.items.flatMap((item) => {
        if (!("str" in item) || !cleanText(item.str)) return [];
        const matrix = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.max(1, Math.hypot(matrix[2], matrix[3]));
        const renderedWidth = Math.max(1, item.width);
        return [
          {
            text: item.str,
            left: (matrix[4] / viewport.width) * 100,
            top: ((matrix[5] - fontHeight) / viewport.height) * 100,
            width: (renderedWidth / viewport.width) * 100,
            height: (fontHeight / viewport.height) * 100,
            fontSize: (fontHeight / viewport.height) * 100,
            rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
          },
        ];
      });
      pages.push(extractedPage);
      pdfPage.cleanup();
    }
    await loadingTask.destroy().catch(() => undefined);
    return pages;
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    throw error;
  }
}

function PdfPagePreview({
  materialId,
  sourceUrl,
  pageNumber,
  pageCount,
  materialName,
  highlightedPdfTextItems,
  onPageReady,
}: {
  materialId: string;
  sourceUrl: string;
  pageNumber: number;
  pageCount: number;
  materialName: string;
  highlightedPdfTextItems: Set<string>;
  onPageReady: (
    materialId: string,
    pageNumber: number,
    page: SlidePage,
  ) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber === 1);
  const [renderedPage, setRenderedPage] = useState<SlidePage | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (shouldRender || !hostRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;

    async function loadPage() {
      try {
        const [pdfjs, pdf] = await Promise.all([
          loadPdfJs(),
          loadBundledPdf(sourceUrl),
        ]);
        const pdfPage = await pdf.getPage(pageNumber);
        const rendered = await renderPdfPage(
          pdfPage,
          pageNumber,
          pdfjs,
          pageNumber === 1 ? 1440 : 1120,
        );
        pdfPage.cleanup();
        if (cancelled) return;
        setRenderedPage(rendered);
        onPageReady(materialId, pageNumber, rendered);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [
    materialId,
    onPageReady,
    pageNumber,
    retryNonce,
    shouldRender,
    sourceUrl,
  ]);

  return (
    <div className="pdf-native-page" ref={hostRef}>
      {renderedPage?.previewDataUrl ? (
        <>
          <img
            src={renderedPage.previewDataUrl}
            alt={`${materialName} — trang ${pageNumber}`}
            draggable={false}
          />
          <div
            className="pdf-text-layer"
            aria-label={`Lớp văn bản có thể bôi sáng của trang ${pageNumber}`}
          >
            {renderedPage.textLayer?.map((textItem, textIndex) => {
              const pdfTextItemId = `${materialId}-page-${pageNumber}:${textIndex}`;
              return (
                <span
                  key={`${pageNumber}-pdf-text-${textIndex}`}
                  data-highlightable
                  data-pdf-text-id={pdfTextItemId}
                  className={
                    highlightedPdfTextItems.has(pdfTextItemId)
                      ? "is-highlighted"
                      : ""
                  }
                  style={{
                    left: `${textItem.left}%`,
                    top: `${textItem.top}%`,
                    width: `${textItem.width}%`,
                    height: `${textItem.height}%`,
                    fontSize: `${textItem.fontSize}%`,
                    transform: `rotate(${textItem.rotation}deg)`,
                  }}
                >
                  {textItem.text}
                </span>
              );
            })}
          </div>
        </>
      ) : loadError ? (
        <div className="pdf-page-state is-error">
          <strong>Không thể dựng trang {pageNumber}</strong>
          <div>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setRenderedPage(null);
                setRetryNonce((value) => value + 1);
              }}
            >
              Thử lại
            </button>
            <a href={`${sourceUrl}#page=${pageNumber}`} target="_blank" rel="noreferrer">
              Mở PDF gốc
            </a>
          </div>
        </div>
      ) : (
        <div className="pdf-page-state" aria-label={`Đang nạp trang ${pageNumber}`}>
          <span className="pdf-loading-mark" />
          <strong>Đang nạp trang {pageNumber}</strong>
        </div>
      )}
      <div className="native-page-label">
        {pageNumber} / {pageCount}
      </div>
    </div>
  );
}

async function extractTextPages(file: File): Promise<SlidePage[]> {
  const text = await file.text();
  const chunks = text
    .split(/\n\s*\n/g)
    .map(cleanText)
    .filter(Boolean);
  const pageSize = 7;
  return Array.from(
    { length: Math.max(1, Math.ceil(chunks.length / pageSize)) },
    (_, index) =>
      makePage(
        chunks.slice(index * pageSize, (index + 1) * pageSize),
        index,
        "Ghi chú",
        "document",
        210 / 297,
      ),
  );
}

async function parseMaterial(file: File): Promise<SlidePage[]> {
  const type = typeFromFile(file);
  if (type === "DOCX" || type === "PPTX") return extractOfficePages(file);
  if (type === "PDF") return extractPdfPages(file);
  return extractTextPages(file);
}

export default function Home() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [activeMaterialId, setActiveMaterialId] = useState(
    initialMaterials[0].id,
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [viewerTool, setViewerTool] = useState<ViewerTool>("highlight");
  const [highlightEntries, setHighlightEntries] = useState<HighlightEntry[]>([]);
  const [annotations, setAnnotations] = useState<PageAnnotation[]>([]);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [agentTab, setAgentTab] = useState<AgentTab>("chat");
  const [contextScope, setContextScope] =
    useState<ContextScope>("current-page");
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [language, setLanguage] = useState<InterfaceLanguage>("vi");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [agentPanelWidth, setAgentPanelWidth] = useState(372);
  const [isAgentResizing, setIsAgentResizing] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<Flashcard[]>([]);
  const [savedLearningSets, setSavedLearningSets] = useState<SavedLearningSet[]>([]);
  const [isGeneratingLearning, setIsGeneratingLearning] = useState(false);
  const [learningLive, setLearningLive] = useState(false);
  const [toast, setToast] = useState("");
  const [showMoreTools, setShowMoreTools] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const annotationImageRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const moreToolsRef = useRef<HTMLDivElement>(null);
  const selectionHandledRef = useRef(false);
  const agentResizeStartRef = useRef({ clientX: 0, width: 372 });

  const updateBundledPage = useCallback(
    (materialId: string, pageNumber: number, renderedPage: SlidePage) => {
      setMaterials((current) =>
        current.map((material) => {
          if (material.id !== materialId) return material;
          return {
            ...material,
            pages: material.pages.map((existingPage, index) =>
              index === pageNumber - 1
                ? {
                    ...existingPage,
                    title: renderedPage.title,
                    subtitle: renderedPage.subtitle,
                    paragraphs: renderedPage.paragraphs,
                    points: renderedPage.points,
                    kind: renderedPage.kind,
                    aspectRatio: renderedPage.aspectRatio,
                  }
                : existingPage,
            ),
          };
        }),
      );
    },
    [],
  );

  const activeMaterial =
    materials.find((material) => material.id === activeMaterialId) ?? materials[0];
  const page = activeMaterial.pages[pageIndex] ?? activeMaterial.pages[0];
  const highlightMode = viewerTool === "highlight";
  const highlights = useMemo(
    () => highlightEntries.map((entry) => entry.text),
    [highlightEntries],
  );
  const highlightedPdfTextItems = useMemo(
    () =>
      new Set(
        highlightEntries.flatMap((entry) => entry.pdfTextItemIds),
      ),
    [highlightEntries],
  );
  const quiz = generatedQuiz;
  const flashcards = generatedFlashcards;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setIsDark(window.localStorage.getItem("vlearn-theme") === "dark");
        setLanguage(
          window.localStorage.getItem("vlearn-language") === "en"
            ? "en"
            : "vi",
        );
        const storedAgentWidth = Number(
          window.localStorage.getItem("vlearn-agent-panel-width"),
        );
        if (Number.isFinite(storedAgentWidth) && storedAgentWidth > 0) {
          setAgentPanelWidth(Math.max(320, Math.min(680, storedAgentWidth)));
        }
        const storedAnnotations = window.localStorage.getItem(
          "vlearn-annotations",
        );
        if (storedAnnotations) {
          setAnnotations(JSON.parse(storedAnnotations) as PageAnnotation[]);
        }
        const storedLearningSets = window.localStorage.getItem(
          "vlearn-personal-notebook",
        );
        if (storedLearningSets) {
          const parsed = JSON.parse(storedLearningSets);
          if (Array.isArray(parsed)) {
            setSavedLearningSets(
              parsed.filter(
                (entry): entry is SavedLearningSet =>
                  entry &&
                  (entry.kind === "quiz" || entry.kind === "flashcards") &&
                  typeof entry.materialId === "string" &&
                  typeof entry.materialName === "string",
              ),
            );
          }
        }
      } catch {
        // Device preferences remain optional.
      } finally {
        setPreferencesReady(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!showMoreTools) return;
    const closeMoreTools = (event: globalThis.MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (
        event instanceof globalThis.MouseEvent &&
        moreToolsRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setShowMoreTools(false);
    };
    document.addEventListener("pointerdown", closeMoreTools);
    document.addEventListener("keydown", closeMoreTools);
    return () => {
      document.removeEventListener("pointerdown", closeMoreTools);
      document.removeEventListener("keydown", closeMoreTools);
    };
  }, [showMoreTools]);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem(
        "vlearn-theme",
        isDark ? "dark" : "light",
      );
      window.localStorage.setItem("vlearn-language", language);
      window.localStorage.setItem(
        "vlearn-agent-panel-width",
        String(agentPanelWidth),
      );
      window.localStorage.setItem(
        "vlearn-annotations",
        JSON.stringify(annotations),
      );
      window.localStorage.setItem(
        "vlearn-personal-notebook",
        JSON.stringify(savedLearningSets),
      );
    } catch {
      // The viewer still works when browser storage is unavailable.
    }
  }, [
    agentPanelWidth,
    annotations,
    isDark,
    language,
    preferencesReady,
    savedLearningSets,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.scrollTop = 0;
  }, [activeMaterialId]);

  function selectMaterial(material: Material) {
    setActiveMaterialId(material.id);
    setPageIndex(0);
    setContextScope("current-page");
    setHighlightEntries([]);
    setGeneratedQuiz([]);
    setGeneratedFlashcards([]);
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        text: `Đã chọn “${material.name}”. Bạn có thể hỏi theo slide đang xem hoặc toàn bộ tài liệu.`,
        citation: `${material.type} • ${material.pages.length} trang`,
      },
    ]);
    resetQuiz();
  }

  function goToPage(nextIndex: number) {
    const targetIndex = Math.max(
      0,
      Math.min(activeMaterial.pages.length - 1, nextIndex),
    );
    setPageIndex(targetIndex);
    const target = viewerRef.current?.querySelector<HTMLElement>(
      `[data-page-index="${targetIndex}"]`,
    );
    if (target && viewerRef.current) {
      viewerRef.current.scrollTo({
        top: Math.max(0, target.offsetTop - 22),
        behavior: "smooth",
      });
    }
  }

  function addAnnotation(
    sourcePageIndex: number,
    annotation: Omit<PageAnnotation, "id" | "materialId" | "pageIndex">,
  ) {
    setAnnotations((current) => [
      ...current,
      {
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        materialId: activeMaterial.id,
        pageIndex: sourcePageIndex,
      },
    ]);
    setToast(language === "vi" ? "Đã thêm ghi chú" : "Annotation added");
  }

  function updateAnnotation(id: string, text: string) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, text } : annotation,
      ),
    );
  }

  function removeAnnotation(id: string) {
    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== id),
    );
    setToast(language === "vi" ? "Đã xóa ghi chú" : "Annotation removed");
  }

  function eraseHighlight(
    sourcePageIndex: number,
    pdfTextItemId?: string,
    text?: string,
  ) {
    setHighlightEntries((current) =>
      current.filter(
        (entry) =>
          entry.pageIndex !== sourcePageIndex ||
          !(
            (pdfTextItemId &&
              entry.pdfTextItemIds.includes(pdfTextItemId)) ||
            (text && entry.text === text)
          ),
      ),
    );
    setToast(
      language === "vi" ? "Đã xóa phần bôi sáng" : "Highlight removed",
    );
  }

  function onAnnotationImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast(language === "vi" ? "Hãy chọn một file ảnh" : "Choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast(
        language === "vi"
          ? "Ảnh ghi chú cần nhỏ hơn 2 MB"
          : "Annotation images must be under 2 MB",
      );
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      addAnnotation(pageIndex, {
        kind: "image",
        imageUrl: reader.result,
        x: 30,
        y: 24,
        width: 40,
        height: 34,
      });
      setViewerTool("read");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function addHighlight(
    text: string,
    sourcePageIndex = pageIndex,
    pdfTextItemIds: string[] = [],
  ) {
    const normalized = cleanText(text);
    if (!normalized || normalized.length < 3) return;
    const existingEntry = highlightEntries.find(
      (entry) =>
        entry.text === normalized && entry.pageIndex === sourcePageIndex,
    );
    setPageIndex(sourcePageIndex);
    setHighlightEntries((current) =>
      existingEntry
        ? current.filter((entry) => entry.id !== existingEntry.id)
        : [
            ...current,
            {
              id: `highlight-${Date.now()}-${sourcePageIndex}`,
              text: normalized,
              pageIndex: sourcePageIndex,
              pdfTextItemIds,
            },
          ].slice(-6),
    );
    setToast(
      existingEntry
        ? "Đã bỏ đoạn bôi sáng"
        : `Đã bôi sáng ${Math.max(1, pdfTextItemIds.length)} vùng văn bản`,
    );
  }

  function getSelectedPdfTextItemIds(
    selection: Selection,
    sourcePageIndex: number,
  ) {
    if (selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const selectionRects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );
    const pageElement = viewerRef.current?.querySelector<HTMLElement>(
      `[data-page-index="${sourcePageIndex}"]`,
    );
    if (!pageElement) return [];

    return Array.from(
      pageElement.querySelectorAll<HTMLElement>("[data-pdf-text-id]"),
    ).flatMap((element) => {
      try {
        if (!range.intersectsNode(element) || !element.dataset.pdfTextId) {
          return [];
        }
        if (selectionRects.length === 0) return [element.dataset.pdfTextId];
        const elementRects = Array.from(element.getClientRects());
        const overlapsSelection = elementRects.some((elementRect) =>
          selectionRects.some(
            (selectionRect) =>
              Math.min(elementRect.right, selectionRect.right) -
                Math.max(elementRect.left, selectionRect.left) >
                0.5 &&
              Math.min(elementRect.bottom, selectionRect.bottom) -
                Math.max(elementRect.top, selectionRect.top) >
                0.5,
          ),
        );
        return overlapsSelection ? [element.dataset.pdfTextId] : [];
      } catch {
        return [];
      }
    });
  }

  function handleTextSelection(sourcePageIndex: number) {
    if (!highlightMode) return;
    const selection = window.getSelection();
    const rawSelectedText = cleanText(selection?.toString() ?? "");
    if (selection && rawSelectedText.length >= 3) {
      const pdfTextItemIds = getSelectedPdfTextItemIds(
        selection,
        sourcePageIndex,
      );
      const selectedPdfTextItemIds = new Set(pdfTextItemIds);
      const selectedPdfText = cleanText(
        Array.from(
          viewerRef.current?.querySelectorAll<HTMLElement>(
            `[data-page-index="${sourcePageIndex}"] [data-pdf-text-id]`,
          ) ?? [],
        )
          .filter((element) =>
            selectedPdfTextItemIds.has(element.dataset.pdfTextId ?? ""),
          )
          .map((element) => element.textContent ?? "")
          .join(" "),
      );
      selectionHandledRef.current = true;
      addHighlight(
        selectedPdfText || rawSelectedText,
        sourcePageIndex,
        pdfTextItemIds,
      );
      window.setTimeout(() => {
        selectionHandledRef.current = false;
      }, 0);
    }
    selection?.removeAllRanges();
  }

  function handleViewerScroll() {
    const container = viewerRef.current;
    if (!container) return;
    const focusLine = container.scrollTop + container.clientHeight * 0.3;
    const pageElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-page-index]"),
    );
    if (pageElements.length === 0) return;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    pageElements.forEach((element) => {
      const elementCenter = element.offsetTop + element.offsetHeight * 0.28;
      const distance = Math.abs(elementCenter - focusLine);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = Number(element.dataset.pageIndex ?? 0);
      }
    });

    setPageIndex((current) => (current === closestIndex ? current : closestIndex));
  }

  async function storeFile(file: File) {
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/materials", {
        method: "POST",
        body: data,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function importFile(file: File) {
    const supported = /\.(pdf|pptx|docx|txt|md)$/i.test(file.name);
    if (!supported) {
      setUploadMessage("Định dạng chưa hỗ trợ. Hãy chọn PDF, PPTX, DOCX, TXT hoặc MD.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadMessage("Tệp lớn hơn 20 MB. Hãy dùng một bản tài liệu gọn hơn.");
      return;
    }

    setIsProcessing(true);
    setProcessingLabel(
      typeFromFile(file) === "PDF"
        ? "Đang mở nguyên bản toàn bộ file PDF…"
        : "Đang đọc cấu trúc tài liệu…",
    );
    setUploadMessage("");

    try {
      const materialId = `material-${Date.now()}`;
      const materialName = file.name.replace(/\.[^/.]+$/, "");
      const pages = await parseMaterial(file);
      if (pages.length === 0) throw new Error("empty");
      setProcessingLabel("Đang lưu và tạo ngữ cảnh học tập…");
      const stored = await storeFile(file);
      const material: Material = {
        id: materialId,
        name: materialName,
        type: typeFromFile(file),
        pages,
        status: stored ? "Đã lưu" : "Cục bộ",
        updated: "Vừa thêm",
      };
      setMaterials((current) => [material, ...current]);
      setActiveMaterialId(material.id);
      setPageIndex(0);
      setContextScope("current-page");
      setHighlightEntries([]);
      setGeneratedQuiz([]);
      setGeneratedFlashcards([]);
      setMessages([
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `“${material.name}” đã sẵn sàng. Chọn nguồn ở mục Hỏi AI rồi đặt câu hỏi để kiểm tra chatbot.`,
          citation: `${material.type} • ${pages.length} trang`,
        },
      ]);
      setUploadMessage(
        stored
          ? `Đã nhập ${pages.length} trang, giữ nguyên bố cục và lưu an toàn.`
          : `Đã mở ${pages.length} trang với bố cục gốc trên thiết bị này.`,
      );
      setToast("Tài liệu đã sẵn sàng");
    } catch {
      setUploadMessage(
        "Không đọc được cấu trúc tệp này. Hãy thử xuất lại tài liệu hoặc dùng bản PDF.",
      );
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importFile(file);
  }

  function onFileDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void importFile(file);
  }

  function importPastedText() {
    const text = cleanText(pasteValue);
    if (!text) return;
    const rawBlocks = pasteValue
      .split(/\n\s*\n|\n(?=[A-ZÀ-Ỹ0-9][^.!?]{0,70}$)/g)
      .map(cleanText)
      .filter(Boolean);
    const pages = Array.from(
      { length: Math.max(1, Math.ceil(rawBlocks.length / 6)) },
      (_, index) =>
        makePage(rawBlocks.slice(index * 6, (index + 1) * 6), index, "Nội dung dán"),
    );
    const material: Material = {
      id: `pasted-${Date.now()}`,
      name: pages[0].title.slice(0, 42),
      type: "TEXT",
      pages,
      status: "Cục bộ",
      updated: "Vừa thêm",
    };
    setMaterials((current) => [material, ...current]);
    setActiveMaterialId(material.id);
    setPageIndex(0);
    setContextScope("current-page");
    setPasteValue("");
    setShowPaste(false);
    setHighlightEntries([]);
    setGeneratedQuiz([]);
    setGeneratedFlashcards([]);
    setMessages([
      {
        id: Date.now() + 1,
        role: "assistant",
        text: `Nội dung “${material.name}” đã sẵn sàng để hỏi AI.`,
        citation: `TEXT • ${pages.length} trang`,
      },
    ]);
    setToast("Đã tạo tài liệu từ nội dung dán");
  }

  function serializePageContent(slidePage: SlidePage, index: number) {
    return [
      `[Trang ${index + 1}]`,
      slidePage.title,
      slidePage.subtitle,
      ...slidePage.paragraphs,
      ...slidePage.points,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function selectedSourceContext() {
    const pageIndexes =
      contextScope === "current-page"
        ? [pageIndex]
        : activeMaterial.pages.map((_, index) => index);

    if (activeMaterial.sourceUrl && activeMaterial.type === "PDF") {
      try {
        const pageTexts = await Promise.all(
          pageIndexes.map((index) =>
            loadPdfPageText(activeMaterial.sourceUrl!, index + 1),
          ),
        );
        return pageTexts.join("\n");
      } catch {
        // The extracted page metadata remains a usable local fallback.
      }
    }

    return pageIndexes
      .map((index) =>
        serializePageContent(activeMaterial.pages[index], index),
      )
      .join("\n");
  }

  function selectedLearningFocus() {
    const selectedPages =
      contextScope === "current-page"
        ? new Set([pageIndex])
        : new Set(activeMaterial.pages.map((_, index) => index));
    const noteTexts = annotations
      .filter(
        (annotation) =>
          annotation.materialId === activeMaterial.id &&
          annotation.kind === "note" &&
          selectedPages.has(annotation.pageIndex) &&
          annotation.text?.trim(),
      )
      .map(
        (annotation) =>
          `[Note trang ${annotation.pageIndex + 1}] ${annotation.text?.trim()}`,
      );
    return [...highlights, ...noteTexts].join("\n");
  }

  const sourceScopeLabel =
    contextScope === "current-page"
      ? language === "vi"
        ? `Slide đang xem • Trang ${pageIndex + 1}`
        : `Current slide • Page ${pageIndex + 1}`
      : language === "vi"
      ? `Toàn bộ tài liệu • ${activeMaterial.pages.length} trang`
      : `Full document • ${activeMaterial.pages.length} pages`;

  function citationPageNumber(citation: string) {
    const match = citation.match(/\bP(\d{3})\b/i);
    const pageNumber = match ? Number(match[1]) : 0;
    return pageNumber >= 1 && pageNumber <= activeMaterial.pages.length
      ? pageNumber
      : null;
  }

  function citationLabel(citation: string) {
    const pageNumber = citationPageNumber(citation);
    return pageNumber
      ? language === "vi"
        ? `Trang ${pageNumber} · P${String(pageNumber).padStart(3, "0")}`
        : `Page ${pageNumber} · P${String(pageNumber).padStart(3, "0")}`
      : citation;
  }

  function goToCitation(citation: string) {
    const pageNumber = citationPageNumber(citation);
    if (pageNumber) goToPage(pageNumber - 1);
  }

  async function sendQuestion(event?: FormEvent, promptOverride?: string) {
    event?.preventDefault();
    const prompt = cleanText(promptOverride ?? question);
    if (!prompt) return;

    setAgentTab("chat");
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "user", text: prompt },
    ]);
    setQuestion("");
    setIsThinking(true);

    let context = serializePageContent(page, pageIndex);

    try {
      context = await selectedSourceContext();
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          question: prompt,
          context,
          focus: selectedLearningFocus(),
          scope: contextScope,
          language,
          page: pageIndex + 1,
          pageCount: activeMaterial.pages.length,
          materialId: activeMaterial.id,
          material: activeMaterial.name,
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        evidence?: Array<{ claim: string; citation: string }>;
        confidence?:
          | "Được nêu trực tiếp"
          | "Được suy ra"
          | "Không đủ thông tin";
        note?: string;
        citations?: string[];
        live?: boolean;
      };
      if (!response.ok || !result.answer) throw new Error("agent");
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.answer,
          evidence: result.evidence,
          confidence: result.confidence,
          note: result.note,
          citations: result.citations,
          live: result.live,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "Không tìm thấy đủ thông tin trong tài liệu để kết luận.",
          confidence: "Không đủ thông tin",
          note: "Không thể kết nối trợ lý để kiểm tra nội dung nguồn.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  async function requestLearningContent(mode: "quiz" | "flashcards") {
    setIsGeneratingLearning(true);
    setLearningLive(false);
    try {
      const context = await selectedSourceContext();
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          question:
            mode === "quiz"
              ? "Tạo câu hỏi kiểm tra hiểu và áp dụng"
              : "Tạo thẻ ghi nhớ các ý quan trọng",
          context,
          focus: selectedLearningFocus(),
          scope: contextScope,
          language,
          page: pageIndex + 1,
          pageCount: activeMaterial.pages.length,
          materialId: activeMaterial.id,
          material: activeMaterial.name,
        }),
      });
      const result = (await response.json()) as {
        quiz?: QuizQuestion[];
        flashcards?: Flashcard[];
        live?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "agent");
      if (mode === "quiz" && Array.isArray(result.quiz)) {
        setGeneratedQuiz(result.quiz);
      }
      if (mode === "flashcards" && Array.isArray(result.flashcards)) {
        setGeneratedFlashcards(result.flashcards);
      }
      setLearningLive(Boolean(result.live));
    } catch {
      if (mode === "quiz") setGeneratedQuiz([]);
      if (mode === "flashcards") setGeneratedFlashcards([]);
      setToast("Không thể tạo nội dung từ học liệu đang mở");
    } finally {
      setIsGeneratingLearning(false);
    }
  }

  async function createQuiz() {
    resetQuiz();
    setGeneratedQuiz([]);
    setAgentTab("quiz");
    setRightOpen(true);
    await requestLearningContent("quiz");
  }

  async function createFlashcards() {
    setFlippedCards([]);
    setGeneratedFlashcards([]);
    setAgentTab("flashcards");
    setRightOpen(true);
    await requestLearningContent("flashcards");
  }

  function resetQuiz() {
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizChecked(false);
    setQuizComplete(false);
  }

  function saveLearningSet(kind: "quiz" | "flashcards") {
    const hasContent = kind === "quiz" ? quiz.length > 0 : flashcards.length > 0;
    if (!hasContent) return;
    const savedSet: SavedLearningSet = {
      id: `learning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      materialId: activeMaterial.id,
      materialName: activeMaterial.name,
      pageIndex,
      savedAt: Date.now(),
      ...(kind === "quiz" ? { quiz } : { flashcards }),
    };
    setSavedLearningSets((current) => [savedSet, ...current].slice(0, 12));
    setToast(
      language === "vi"
        ? `Đã lưu ${kind === "quiz" ? "quiz" : "flashcard"} vào Sổ tay cá nhân`
        : `${kind === "quiz" ? "Quiz" : "Flashcards"} saved to Personal notebook`,
    );
  }

  function openSavedLearningSet(savedSet: SavedLearningSet) {
    const material = materials.find((item) => item.id === savedSet.materialId);
    if (material) {
      setActiveMaterialId(material.id);
      setPageIndex(Math.max(0, Math.min(material.pages.length - 1, savedSet.pageIndex)));
    }
    setRightOpen(true);
    setLearningLive(false);
    if (savedSet.kind === "quiz" && savedSet.quiz?.length) {
      resetQuiz();
      setGeneratedQuiz(savedSet.quiz);
      setAgentTab("quiz");
    }
    if (savedSet.kind === "flashcards" && savedSet.flashcards?.length) {
      setFlippedCards([]);
      setGeneratedFlashcards(savedSet.flashcards);
      setAgentTab("flashcards");
    }
  }

  function chooseQuizAnswer(answer: number) {
    if (quizChecked) return;
    const next = [...quizAnswers];
    next[quizIndex] = answer;
    setQuizAnswers(next);
  }

  function continueQuiz() {
    if (!quizChecked) {
      setQuizChecked(true);
      return;
    }
    if (quizIndex === quiz.length - 1) {
      setQuizComplete(true);
      return;
    }
    setQuizIndex((current) => current + 1);
    setQuizChecked(false);
  }

  const score = quizAnswers.reduce(
    (total, answer, index) => total + (answer === quiz[index]?.answer ? 1 : 0),
    0,
  );

  function toggleCard(index: number) {
    setFlippedCards((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    );
  }

  function handlePageClick(
    event: MouseEvent<HTMLElement>,
    sourcePageIndex: number,
  ) {
    if (!highlightMode) return;
    if (selectionHandledRef.current) return;
    const target = event.target as HTMLElement;
    const highlightTarget =
      target.closest<HTMLElement>("[data-highlightable]");
    if (!highlightTarget || window.getSelection()?.toString()) return;

    const pdfTextItemId = highlightTarget.dataset.pdfTextId;
    if (pdfTextItemId) {
      const textLayer = highlightTarget.closest(".pdf-text-layer");
      const targetCenter =
        highlightTarget.offsetTop + highlightTarget.offsetHeight / 2;
      const lineItems = Array.from(
        textLayer?.querySelectorAll<HTMLElement>("[data-pdf-text-id]") ?? [],
      )
        .filter((element) => {
          const center = element.offsetTop + element.offsetHeight / 2;
          const tolerance = Math.max(
            2,
            Math.min(element.offsetHeight, highlightTarget.offsetHeight) * 0.55,
          );
          return Math.abs(center - targetCenter) <= tolerance;
        })
        .sort((left, right) => left.offsetLeft - right.offsetLeft);
      const targetIndex = lineItems.indexOf(highlightTarget);
      let startIndex = targetIndex;
      let endIndex = targetIndex;
      const isConnected = (left: HTMLElement, right: HTMLElement) => {
        const gap =
          right.offsetLeft - (left.offsetLeft + left.offsetWidth);
        return gap <= Math.max(12, Math.min(left.offsetHeight, right.offsetHeight) * 1.6);
      };
      while (
        startIndex > 0 &&
        isConnected(lineItems[startIndex - 1], lineItems[startIndex])
      ) {
        startIndex -= 1;
      }
      while (
        endIndex >= 0 &&
        endIndex < lineItems.length - 1 &&
        isConnected(lineItems[endIndex], lineItems[endIndex + 1])
      ) {
        endIndex += 1;
      }
      const connectedLineItems =
        targetIndex >= 0
          ? lineItems.slice(startIndex, endIndex + 1)
          : [highlightTarget];
      const lineText = cleanText(
        connectedLineItems
          .map((element) => element.textContent ?? "")
          .join(" "),
      );
      addHighlight(
        lineText,
        sourcePageIndex,
        connectedLineItems.flatMap((element) =>
          element.dataset.pdfTextId ? [element.dataset.pdfTextId] : [],
        ),
      );
      return;
    }

    const text = highlightTarget.textContent;
    if (text) {
      addHighlight(
        text,
        sourcePageIndex,
        [],
      );
    }
  }

  function resizeAgentPanel(clientX: number) {
    const delta = agentResizeStartRef.current.clientX - clientX;
    setAgentPanelWidth(
      Math.max(
        320,
        Math.min(680, agentResizeStartRef.current.width + delta),
      ),
    );
  }

  return (
    <main
      lang={language}
      className={`app-shell ${isDark ? "theme-dark" : ""} ${
        !leftOpen ? "left-collapsed" : ""
      } ${!rightOpen ? "right-collapsed" : ""} ${
        isAgentResizing ? "is-resizing-agent" : ""
      }`}
      style={
        {
          "--agent-panel-width": `${agentPanelWidth}px`,
        } as CSSProperties
      }
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={18} strokeWidth={2.4} />
          </div>
          <span>VLearn</span>
          <span className="brand-product">Focus</span>
        </div>
        <div className="breadcrumb">
          <span>AI Thực chiến</span>
          <ChevronRight size={14} />
          <strong>{activeMaterial.name}</strong>
        </div>
        <div className="top-actions">
          <button
            className="icon-button mobile-only"
            onClick={() => setLeftOpen((value) => !value)}
            aria-label="Mở thư viện"
          >
            <Menu size={19} />
          </button>
          <button
            className="language-button"
            onClick={() =>
              setLanguage((current) => (current === "vi" ? "en" : "vi"))
            }
            aria-label={
              language === "vi"
                ? "Switch interface and AI responses to English"
                : "Chuyển giao diện và câu trả lời AI sang tiếng Việt"
            }
            title={language === "vi" ? "English" : "Tiếng Việt"}
          >
            {language.toUpperCase()}
          </button>
          <details className="personal-notebook-menu">
            <summary title="Sổ tay cá nhân" aria-label="Mở Sổ tay cá nhân">
              <BookOpen size={16} />
              <span className="desktop-only">Sổ tay</span>
              {savedLearningSets.length > 0 && <b>{savedLearningSets.length}</b>}
            </summary>
            <section className="personal-notebook-popover" aria-label="Sổ tay cá nhân">
              <div className="personal-notebook-heading">
                <span>Sổ tay cá nhân</span>
                {savedLearningSets.length > 0 && <small>{savedLearningSets.length}</small>}
              </div>
              {savedLearningSets.length === 0 ? (
                <p>Lưu Quiz hoặc Flashcard để ôn lại sau.</p>
              ) : (
                <div className="personal-notebook-list">
                  {savedLearningSets.slice(0, 5).map((savedSet) => (
                    <button
                      key={savedSet.id}
                      type="button"
                      onClick={() => openSavedLearningSet(savedSet)}
                    >
                      <span>{savedSet.kind === "quiz" ? "Quiz" : "Flashcard"}</span>
                      <strong>{savedSet.materialName}</strong>
                      <small>
                        Trang {savedSet.pageIndex + 1} · {savedSet.kind === "quiz" ? savedSet.quiz?.length : savedSet.flashcards?.length} mục
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </details>
          <button
            className="icon-button"
            onClick={() => setIsDark((value) => !value)}
            aria-label={isDark ? "Bật giao diện sáng" : "Bật giao diện tối"}
            title={isDark ? "Giao diện sáng" : "Giao diện tối"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="avatar" title="Phan Huy Hoàng">
            PH
          </div>
        </div>
      </header>

      <aside className="library-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">KHÔNG GIAN HỌC</span>
            <h2>Học liệu của bạn</h2>
          </div>
          <button
            className="icon-button compact desktop-only"
            onClick={() => setLeftOpen(false)}
            aria-label="Thu gọn thư viện"
            title="Thu gọn"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.pptx,.docx,.txt,.md"
          onChange={onFileChange}
          hidden
        />
        <input
          ref={annotationImageRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onAnnotationImageChange}
          hidden
        />
        <button
          className="upload-zone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onFileDrop}
        >
          <span className="upload-icon">
            <Upload size={19} />
          </span>
          <span>
            <strong>Tải tài liệu lên</strong>
            <small>PDF, PPTX, DOCX • tối đa 20 MB</small>
          </span>
        </button>
        <button className="paste-link" onClick={() => setShowPaste(true)}>
          <Paperclip size={15} />
          Dán nội dung từ ghi chú
        </button>
        {uploadMessage && <p className="upload-message">{uploadMessage}</p>}

        <div className="library-summary">
          <span>{materials.length} tài liệu</span>
          <button aria-label="Sắp xếp tài liệu">
            Mới nhất <ChevronDown size={14} />
          </button>
        </div>

        <div className="material-list">
          {materials.map((material) => {
            const active = material.id === activeMaterialId;
            return (
              <button
                className={`material-card ${active ? "active" : ""}`}
                key={material.id}
                onClick={() => selectMaterial(material)}
              >
                <span className={`file-icon ${material.type.toLowerCase()}`}>
                  {material.type === "PPTX" ? (
                    <Layers3 size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </span>
                <span className="material-copy">
                  <strong>{material.name}</strong>
                  <small>
                    {material.type} • {material.pages.length} trang
                  </small>
                  <span className="material-meta">
                    <span className={`status-dot ${material.status === "Đã lưu" ? "saved" : ""}`} />
                    {material.status} · {material.updated}
                  </span>
                </span>
                {active && (
                  <span className="selected-check">
                    <Check size={13} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="library-tip">
          <Sparkles size={17} />
          <p>
            <strong>Mẹo nhanh</strong>
            Bôi sáng đúng một ý mỗi lần để AI tạo câu hỏi chính xác hơn.
          </p>
        </div>
      </aside>

      <section className="workspace">
        <div className="viewer-toolbar">
          <div className="toolbar-group">
            {!leftOpen && (
              <button
                className="tool-button icon-only desktop-only"
                onClick={() => setLeftOpen(true)}
                aria-label="Mở thư viện"
                title="Mở thư viện"
              >
                <Menu size={17} />
              </button>
            )}
            <button
              className={`tool-button ${viewerTool === "read" ? "active" : ""}`}
              onClick={() => setViewerTool("read")}
              title={language === "vi" ? "Chế độ đọc" : "Read mode"}
            >
              <MousePointer2 size={16} />
              <span>{language === "vi" ? "Đọc" : "Read"}</span>
            </button>
            <button
              className={`tool-button ${viewerTool === "pen" ? "active" : ""}`}
              onClick={() => setViewerTool("pen")}
              title={language === "vi" ? "Vẽ tự do trên trang" : "Draw on page"}
            >
              <Pencil size={16} />
              <span>{language === "vi" ? "Bút" : "Pen"}</span>
            </button>
            <button
              className={`tool-button ${
                viewerTool === "highlight" ? "active highlighter" : ""
              }`}
              onClick={() => setViewerTool("highlight")}
              title={
                language === "vi"
                  ? "Chọn hoặc bấm vào nội dung để bôi sáng"
                  : "Select text to highlight"
              }
            >
              <Highlighter size={16} />
              <span>{language === "vi" ? "Highlight" : "Highlight"}</span>
            </button>
            <div className="more-tools" ref={moreToolsRef}>
              <button
                type="button"
                className={`tool-button icon-only ${
                  ["circle", "note", "eraser"].includes(viewerTool)
                    ? "active"
                    : ""
                }`}
                aria-label={
                  language === "vi" ? "Thêm công cụ" : "More tools"
                }
                title={language === "vi" ? "Thêm công cụ" : "More tools"}
                aria-haspopup="menu"
                aria-expanded={showMoreTools}
                onClick={() => setShowMoreTools((current) => !current)}
              >
                <MoreHorizontal size={17} />
              </button>
              {showMoreTools && (
                <div
                  className="more-tools-menu"
                  role="menu"
                  aria-label={
                    language === "vi" ? "Công cụ bổ sung" : "Additional tools"
                  }
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={viewerTool === "circle" ? "active" : ""}
                    onClick={() => {
                      setViewerTool("circle");
                      setShowMoreTools(false);
                    }}
                  >
                    <Circle size={16} />
                    <span>{language === "vi" ? "Khoanh" : "Circle"}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={viewerTool === "note" ? "active" : ""}
                    onClick={() => {
                      setViewerTool("note");
                      setShowMoreTools(false);
                    }}
                  >
                    <StickyNote size={16} />
                    <span>{language === "vi" ? "Text" : "Text"}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMoreTools(false);
                      annotationImageRef.current?.click();
                    }}
                  >
                    <ImagePlus size={16} />
                    <span>{language === "vi" ? "Ảnh" : "Image"}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={viewerTool === "eraser" ? "active eraser" : ""}
                    onClick={() => {
                      setViewerTool("eraser");
                      setShowMoreTools(false);
                    }}
                  >
                    <Eraser size={16} />
                    <span>{language === "vi" ? "Tẩy" : "Erase"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="page-pill">
            <Layers3 size={13} />
            {language === "vi" ? "Trang" : "Page"} {pageIndex + 1} /{" "}
            {activeMaterial.pages.length}
            <span>
              {
                annotations.filter(
                  (annotation) =>
                    annotation.materialId === activeMaterial.id &&
                    annotation.pageIndex === pageIndex,
                ).length
              }{" "}
              note
            </span>
          </div>
          <div className="toolbar-group toolbar-right">
            <button
              className="tool-button icon-only"
              onClick={() => setZoom((value) => Math.max(80, value - 10))}
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
            >
              <Minus size={16} />
            </button>
            <span className="zoom-label">{zoom}%</span>
            <button
              className="tool-button icon-only"
              onClick={() => setZoom((value) => Math.min(120, value + 10))}
              aria-label="Phóng to"
              title="Phóng to"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div
          className="viewer-scroll"
          ref={viewerRef}
          onScroll={handleViewerScroll}
        >
          <div
            className="document-stack"
            style={{
              width: `${zoom}%`,
              maxWidth: `${(960 * zoom) / 100}px`,
            }}
          >
            {activeMaterial.pages.map((viewerPage, viewerIndex) => {
              const pageKind =
                viewerPage.kind ??
                (activeMaterial.type === "DOCX" ||
                activeMaterial.type === "TEXT"
                  ? "document"
                  : "slide");
              const pageRatio =
                viewerPage.aspectRatio ??
                (pageKind === "document" ? 210 / 297 : 16 / 9);

              return (
                <article
                  id={`viewer-page-${viewerIndex}`}
                  data-page-index={viewerIndex}
                  className={`document-page format-${pageKind} accent-${viewerPage.accent} ${
                    viewerIndex === pageIndex ? "is-current-page" : ""
                  } ${
                    (activeMaterial.sourceUrl && viewerPage.pdfPageNumber) ||
                    (viewerPage.pdfSource && viewerPage.pdfPageNumber)
                      ? "has-native-preview"
                      : ""
                  } ${highlightMode ? "highlight-mode" : "read-mode"} tool-${viewerTool}`}
                  style={{ aspectRatio: String(pageRatio) }}
                  key={viewerPage.id}
                  onMouseUp={() => handleTextSelection(viewerIndex)}
                  onClick={(event) => handlePageClick(event, viewerIndex)}
                >
                  {viewerPage.pdfPageNumber && activeMaterial.sourceUrl ? (
                    <PdfPagePreview
                      materialId={activeMaterial.id}
                      sourceUrl={activeMaterial.sourceUrl}
                      pageNumber={viewerPage.pdfPageNumber}
                      pageCount={activeMaterial.pages.length}
                      materialName={activeMaterial.name}
                      highlightedPdfTextItems={highlightedPdfTextItems}
                      onPageReady={updateBundledPage}
                    />
                  ) : viewerPage.pdfSource && viewerPage.pdfPageNumber ? (
                    <div className="pdf-native-page">
                      <PdfCanvasPage
                        source={viewerPage.pdfSource}
                        pageNumber={viewerPage.pdfPageNumber}
                        zoom={zoom}
                        label={`${activeMaterial.name} — trang ${
                          viewerIndex + 1
                        }`}
                      />
                      <div
                        className="pdf-text-layer"
                        aria-label={`Lớp văn bản có thể bôi sáng của trang ${
                          viewerIndex + 1
                        }`}
                      >
                        {viewerPage.textLayer?.map((textItem, textIndex) => (
                          (() => {
                            const pdfTextItemId = `${viewerPage.id}:${textIndex}`;
                            return (
                              <span
                                key={`${viewerPage.id}-pdf-text-${textIndex}`}
                                data-highlightable
                                data-pdf-text-id={pdfTextItemId}
                                className={
                                  highlightedPdfTextItems.has(pdfTextItemId)
                                    ? "is-highlighted"
                                    : ""
                                }
                                style={{
                                  left: `${textItem.left}%`,
                                  top: `${textItem.top}%`,
                                  width: `${textItem.width}%`,
                                  height: `${textItem.height}%`,
                                  fontSize: `${textItem.fontSize}%`,
                                  transform: `rotate(${textItem.rotation}deg)`,
                                }}
                              >
                                {textItem.text}
                              </span>
                            );
                          })()
                        ))}
                      </div>
                      <div className="native-page-label">
                        {viewerIndex + 1} / {activeMaterial.pages.length}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="page-topline">
                        <span>
                          TRANG {String(viewerIndex + 1).padStart(2, "0")} /{" "}
                          {activeMaterial.pages.length}
                        </span>
                        <span>{activeMaterial.name}</span>
                      </div>
                      <div className="slide-orbit orbit-one" />
                      <div className="slide-orbit orbit-two" />
                      <div className="slide-content">
                        <div className="slide-number">
                          {String(viewerIndex + 1).padStart(2, "0")}
                        </div>
                        <p className="slide-eyebrow" data-highlightable>
                          {viewerPage.eyebrow}
                        </p>
                        <h1 data-highlightable>{viewerPage.title}</h1>
                        {viewerPage.subtitle && (
                          <p className="slide-subtitle" data-highlightable>
                            {viewerPage.subtitle}
                          </p>
                        )}
                        <div className="slide-grid">
                          <div className="slide-copy">
                            {viewerPage.paragraphs.map((paragraph, index) => (
                              <p
                                key={`${viewerPage.id}-paragraph-${index}`}
                                data-highlightable
                                className={
                                  highlights.includes(paragraph)
                                    ? "is-highlighted"
                                    : ""
                                }
                              >
                                {paragraph}
                              </p>
                            ))}
                          </div>
                          <div className="point-stack">
                            {viewerPage.points.map((point, index) => (
                              <button
                                key={`${viewerPage.id}-point-${index}`}
                                data-highlightable
                                className={`point-card ${
                                  highlights.includes(point)
                                    ? "is-highlighted"
                                    : ""
                                }`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (highlightMode) {
                                    addHighlight(point, viewerIndex);
                                  }
                                }}
                              >
                                <span>
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                {point}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="page-footnote">
                        <span>VLEARN FOCUS</span>
                        <span>Cuộn để xem toàn bộ • Kéo chọn để bôi sáng</span>
                      </div>
                    </>
                  )}
                  <AnnotationLayer
                    annotations={annotations.filter(
                      (annotation) =>
                        annotation.materialId === activeMaterial.id &&
                        annotation.pageIndex === viewerIndex,
                    )}
                    tool={viewerTool}
                    language={language}
                    onAdd={(annotation) =>
                      addAnnotation(viewerIndex, annotation)
                    }
                    onUpdate={updateAnnotation}
                    onRemove={removeAnnotation}
                    onEraseHighlight={(pdfTextItemId, text) =>
                      eraseHighlight(viewerIndex, pdfTextItemId, text)
                    }
                  />
                </article>
              );
            })}
            <div className="document-end">
              <CheckCircle2 size={18} />
              <span>
                Bạn đã xem hết {activeMaterial.pages.length} trang của tài liệu
              </span>
            </div>
          </div>
        </div>
      </section>

      <aside className="agent-panel">
        <div
          className="agent-resize-handle desktop-only"
          role="separator"
          aria-orientation="vertical"
          aria-label={
            language === "vi"
              ? "Kéo để thay đổi độ rộng trợ lý"
              : "Drag to resize the assistant"
          }
          aria-valuemin={320}
          aria-valuemax={680}
          aria-valuenow={agentPanelWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            agentResizeStartRef.current = {
              clientX: event.clientX,
              width: agentPanelWidth,
            };
            setIsAgentResizing(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            resizeAgentPanel(event.clientX);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setIsAgentResizing(false);
          }}
          onPointerCancel={() => setIsAgentResizing(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setAgentPanelWidth((width) => Math.min(680, width + 24));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setAgentPanelWidth((width) => Math.max(320, width - 24));
            } else if (event.key === "Home") {
              event.preventDefault();
              setAgentPanelWidth(320);
            } else if (event.key === "End") {
              event.preventDefault();
              setAgentPanelWidth(680);
            }
          }}
        />
        <div className="agent-header">
          <div className="agent-title">
            <span className="agent-icon">
              <Bot size={19} />
            </span>
            <div>
              <h2>Focus AI</h2>
              <span>
                <i /> Hiểu theo ngữ cảnh
              </span>
            </div>
          </div>
          <button
            className="icon-button compact desktop-only"
            onClick={() => setRightOpen(false)}
            aria-label="Thu gọn trợ lý"
            title="Thu gọn"
          >
            <PanelRightClose size={17} />
          </button>
        </div>

        <div className="agent-tabs" role="tablist" aria-label="Công cụ học tập">
          <button
            className={agentTab === "chat" ? "active" : ""}
            onClick={() => setAgentTab("chat")}
            role="tab"
          >
            <MessageCircle size={15} /> {language === "vi" ? "Hỏi AI" : "Ask AI"}
          </button>
          <button
            className={agentTab === "quiz" ? "active" : ""}
            onClick={createQuiz}
            role="tab"
          >
            <CircleHelp size={15} /> Quiz
          </button>
          <button
            className={agentTab === "flashcards" ? "active" : ""}
            onClick={createFlashcards}
            role="tab"
          >
            <Layers3 size={15} /> {language === "vi" ? "Thẻ nhớ" : "Cards"}
          </button>
        </div>

        {agentTab === "chat" && (
          <>
            <div className="source-scope compact-source-scope">
              <div className="source-scope-heading">
                <span>{language === "vi" ? "Nguồn" : "Source"}</span>
              </div>
              <div
                className="source-scope-options"
                role="radiogroup"
                aria-label={
                  language === "vi"
                    ? "Chọn phạm vi tài liệu cho AI"
                    : "Select AI document scope"
                }
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={contextScope === "current-page"}
                  className={
                    contextScope === "current-page" ? "active" : ""
                  }
                  onClick={() => setContextScope("current-page")}
                >
                  <FileText size={15} />
                  <strong>
                    {language === "vi" ? "Slide hiện tại" : "Current"} ·{" "}
                    {pageIndex + 1}
                  </strong>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={contextScope === "all-document"}
                  className={
                    contextScope === "all-document" ? "active" : ""
                  }
                  onClick={() => setContextScope("all-document")}
                >
                  <BookOpen size={15} />
                  <strong>
                    {language === "vi" ? "Toàn bộ" : "All"} ·{" "}
                    {activeMaterial.pages.length}
                  </strong>
                </button>
              </div>
            </div>

            <div className="context-card">
              <div className="context-heading">
                <span>
                  <Highlighter size={14} />{" "}
                  {language === "vi" ? "Ngữ cảnh đã chọn" : "Selected context"}
                </span>
                {highlights.length > 0 && (
                  <button onClick={() => setHighlightEntries([])}>
                    {language === "vi" ? "Xoá tất cả" : "Clear"}
                  </button>
                )}
              </div>
              {highlights.length === 0 ? (
                <p>
                  {language === "vi"
                    ? `Chưa có đoạn ưu tiên. AI sẽ tìm trong ${
                        contextScope === "current-page"
                          ? `slide ${pageIndex + 1}`
                          : "toàn bộ tài liệu"
                      }.`
                    : `No priority excerpt. AI will search ${
                        contextScope === "current-page"
                          ? `slide ${pageIndex + 1}`
                          : "the full document"
                      }.`}
                </p>
              ) : (
                <div className="highlight-list">
                  {highlightEntries.map((highlight) => (
                    <div key={highlight.id}>
                      <span>“{highlight.text}”</span>
                      <button
                        onClick={() =>
                          setHighlightEntries((current) =>
                            current.filter((item) => item.id !== highlight.id),
                          )
                        }
                        aria-label="Bỏ đoạn bôi sáng"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="chat-scroll">
              {messages.map((message) => (
                <div
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  {message.role === "assistant" && (
                    <span className="message-avatar">
                      <Sparkles size={14} />
                    </span>
                  )}
                  <div className="message-bubble">
                    <p>{message.text}</p>
                    {message.evidence && message.evidence.length > 0 && (
                      <div className="answer-evidence">
                        <strong>{language === "vi" ? "Căn cứ" : "Evidence"}</strong>
                        {message.evidence.map((item, evidenceIndex) => (
                          <button
                            type="button"
                            className="evidence-citation"
                            key={`${message.id}-evidence-${evidenceIndex}`}
                            onClick={() => goToCitation(item.citation)}
                            title={citationLabel(item.citation)}
                          >
                            {item.claim} — <span>{citationLabel(item.citation)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {message.confidence && (
                      <p className="answer-level">
                        <strong>{language === "vi" ? "Mức độ" : "Grounding"}</strong>
                        {message.confidence}
                      </p>
                    )}
                    {message.note && (
                      <p className="answer-note">
                        <strong>{language === "vi" ? "Lưu ý" : "Note"}</strong>
                        {message.note}
                      </p>
                    )}
                    {message.citations && message.citations.length > 0 ? (
                      <div className="citation-list" aria-label="Trích dẫn nguồn">
                        {message.citations.map((citation) => (
                          <button
                            type="button"
                            className="citation"
                            key={`${message.id}-${citation}`}
                            onClick={() => goToCitation(citation)}
                            title={citationLabel(citation)}
                          >
                            <FileText size={12} />
                            {citationLabel(citation)}
                            {message.live && <span>AI live</span>}
                          </button>
                        ))}
                      </div>
                    ) : message.citation ? (
                      <button
                        type="button"
                        className="citation"
                        onClick={() => goToCitation(message.citation!)}
                        disabled={!citationPageNumber(message.citation)}
                      >
                        <FileText size={12} />
                        {citationLabel(message.citation)}
                        {message.live && <span>AI live</span>}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="message-row assistant">
                  <span className="message-avatar">
                    <Sparkles size={14} />
                  </span>
                  <div className="typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="quick-actions">
              <span>
                {language === "vi"
                  ? "Học nhanh từ phần đã chọn"
                  : "Learn from the selected scope"}
              </span>
              <div>
                <button onClick={createQuiz}>
                  <CircleHelp size={15} />{" "}
                  {language === "vi" ? "Tạo quiz" : "Create quiz"}
                </button>
                <button onClick={createFlashcards}>
                  <Layers3 size={15} />{" "}
                  {language === "vi" ? "Tạo flashcard" : "Create cards"}
                </button>
              </div>
            </div>

            <form className="chat-composer" onSubmit={sendQuestion}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendQuestion();
                  }
                }}
                placeholder={
                  contextScope === "current-page"
                    ? language === "vi"
                      ? `Hỏi về slide ${pageIndex + 1}…`
                      : `Ask about slide ${pageIndex + 1}…`
                    : language === "vi"
                      ? "Hỏi trên toàn bộ tài liệu…"
                      : "Ask across the full document…"
                }
                rows={2}
              />
              <div className="composer-footer">
                <button
                  type="button"
                  className="attach-button"
                  onClick={() => inputRef.current?.click()}
                  aria-label={
                    language === "vi"
                      ? "Tải một tài liệu khác"
                      : "Upload another document"
                  }
                  title={
                    language === "vi"
                      ? "Tải một tài liệu khác"
                      : "Upload another document"
                  }
                >
                  <Paperclip size={16} />
                </button>
                <span>{sourceScopeLabel}</span>
                <button
                  className="send-button"
                  type="submit"
                  disabled={!question.trim() || isThinking}
                  aria-label={
                    language === "vi" ? "Gửi câu hỏi" : "Send question"
                  }
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        )}

        {agentTab === "quiz" && (
          <div className="learning-pane">
            {isGeneratingLearning ? (
              <div className="learning-loading">
                <Sparkles size={20} />
                <strong>Đang tạo quiz từ đúng nguồn đã chọn…</strong>
                <span>
                  {sourceScopeLabel}
                </span>
              </div>
            ) : quiz.length === 0 ? (
              <div className="learning-loading">
                <CircleHelp size={20} />
                <strong>Chưa có quiz cho phần này</strong>
                <button className="primary-action" onClick={createQuiz}>
                  Tạo lại từ học liệu
                </button>
              </div>
            ) : !quizComplete ? (
              <>
                <div className="learning-heading">
                  <div>
                    <span>Quiz theo ngữ cảnh</span>
                    <h3>Kiểm tra hiểu thật</h3>
                  </div>
                  <span className="quiz-count">
                    {quizIndex + 1}/{quiz.length} · {learningLive ? "Gemini" : "Theo nguồn"}
                  </span>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${((quizIndex + 1) / quiz.length) * 100}%` }} />
                </div>
                <div className="quiz-card">
                  <span className="question-label">CÂU {quizIndex + 1}</span>
                  <h4>{quiz[quizIndex].question}</h4>
                  <div className="answer-list">
                    {quiz[quizIndex].options.map((option, index) => {
                      const selected = quizAnswers[quizIndex] === index;
                      const correct = quizChecked && index === quiz[quizIndex].answer;
                      const wrong = quizChecked && selected && !correct;
                      return (
                        <button
                          key={`${option}-${index}`}
                          className={`${selected ? "selected" : ""} ${
                            correct ? "correct" : ""
                          } ${wrong ? "wrong" : ""}`}
                          onClick={() => chooseQuizAnswer(index)}
                        >
                          <span>{String.fromCharCode(65 + index)}</span>
                          <p>{option}</p>
                          {correct && <CheckCircle2 size={18} />}
                          {wrong && <X size={18} />}
                        </button>
                      );
                    })}
                  </div>
                  {quizChecked && (
                    <div className="answer-explain">
                      <Sparkles size={16} />
                      <p>
                        <strong>
                          {quizAnswers[quizIndex] === quiz[quizIndex].answer
                            ? "Chính xác!"
                            : "Chưa chính xác."}
                        </strong>
                        {quiz[quizIndex].explain}
                        {quiz[quizIndex].citation && (
                          <small>[{quiz[quizIndex].citation}]</small>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  className="primary-action"
                  onClick={continueQuiz}
                  disabled={quizAnswers[quizIndex] === undefined}
                >
                  {quizChecked
                    ? quizIndex === quiz.length - 1
                      ? "Xem kết quả"
                      : "Câu tiếp theo"
                    : "Kiểm tra đáp án"}
                  <ArrowRight size={16} />
                </button>
                <button
                  className="learning-save-button"
                  type="button"
                  onClick={() => saveLearningSet("quiz")}
                >
                  <BookOpen size={15} /> Lưu quiz vào Sổ tay
                </button>
              </>
            ) : (
              <div className="quiz-result">
                <div className="score-orbit">
                  <span>
                    <strong>{score}</strong>/{quiz.length}
                  </span>
                </div>
                <span className="result-label">HOÀN THÀNH</span>
                <h3>
                  {score === quiz.length
                    ? "Bạn đã nắm rất chắc!"
                    : score >= 2
                      ? "Bạn đang đi đúng hướng."
                      : "Thử ôn lại phần bôi sáng nhé."}
                </h3>
                <p>
                  Focus AI đã đối chiếu từng đáp án với {sourceScopeLabel.toLowerCase()}.
                </p>
                <div className="result-stats">
                  <div>
                    <strong>{Math.round((score / quiz.length) * 100)}%</strong>
                    <span>Chính xác</span>
                  </div>
                  <div>
                    <strong>{quiz.length - score}</strong>
                    <span>Cần ôn lại</span>
                  </div>
                </div>
                <button className="primary-action" onClick={resetQuiz}>
                  <RotateCcw size={16} /> Làm lại quiz
                </button>
                <button className="secondary-action" onClick={createFlashcards}>
                  Ôn bằng flashcard
                </button>
                <button
                  className="learning-save-button"
                  type="button"
                  onClick={() => saveLearningSet("quiz")}
                >
                  <BookOpen size={15} /> Lưu quiz vào Sổ tay
                </button>
              </div>
            )}
          </div>
        )}

        {agentTab === "flashcards" && (
          <div className="learning-pane">
            {isGeneratingLearning ? (
              <div className="learning-loading">
                <Sparkles size={20} />
                <strong>Đang tạo thẻ từ đúng nguồn đã chọn…</strong>
                <span>
                  {sourceScopeLabel}
                </span>
              </div>
            ) : flashcards.length === 0 ? (
              <div className="learning-loading">
                <Layers3 size={20} />
                <strong>Chưa có thẻ nhớ cho phần này</strong>
                <button className="primary-action" onClick={createFlashcards}>
                  Tạo lại từ học liệu
                </button>
              </div>
            ) : (
              <>
                <div className="learning-heading">
                  <div>
                    <span>Flashcard theo ngữ cảnh</span>
                    <h3>Ôn lại điểm quan trọng</h3>
                  </div>
                  <span className="quiz-count">
                    {flashcards.length} thẻ · {learningLive ? "Gemini" : "Theo nguồn"}
                  </span>
                </div>
                <p className="flashcard-hint">
                  Chạm vào từng thẻ để lật. Nội dung chỉ dùng transcript của buổi đang mở.
                </p>
                <div className="flashcard-list">
                  {flashcards.map((card, index) => {
                    const flipped = flippedCards.includes(index);
                    return (
                      <button
                        key={`${card.front}-${index}`}
                        className={`flashcard ${flipped ? "flipped" : ""}`}
                        onClick={() => toggleCard(index)}
                      >
                        <span>{flipped ? "Đáp án" : `Thẻ ${index + 1}`}</span>
                        <p>{flipped ? card.back : card.front}</p>
                        <small>
                          {flipped && card.citation
                            ? `[${card.citation}] · Chạm để xem câu hỏi`
                            : "Chạm để xem đáp án"}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <button
                  className="primary-action"
                  onClick={() =>
                    setFlippedCards(flashcards.map((_, index) => index))
                  }
                >
                  <CheckCircle2 size={16} /> Lật tất cả thẻ
                </button>
                <button
                  className="learning-save-button"
                  type="button"
                  onClick={() => saveLearningSet("flashcards")}
                >
                  <BookOpen size={15} /> Lưu flashcard vào Sổ tay
                </button>
              </>
            )}
          </div>
        )}
      </aside>

      {!rightOpen && (
        <button
          className="floating-agent desktop-only"
          onClick={() => setRightOpen(true)}
          aria-label="Mở trợ lý AI"
        >
          <Sparkles size={18} />
          <span>Hỏi AI</span>
        </button>
      )}

      <button
        className="mobile-agent-button mobile-only"
        onClick={() => setRightOpen((value) => !value)}
        aria-label="Mở trợ lý AI"
      >
        {rightOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {showPaste && (
        <div className="modal-backdrop" role="presentation">
          <section className="paste-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <span className="section-kicker">TẠO TÀI LIỆU NHANH</span>
                <h2>Dán nội dung cần học</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowPaste(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <p>
              Dán ghi chú, transcript hoặc nội dung bài học. Focus AI sẽ chia
              thành các trang có thể bôi sáng.
            </p>
            <textarea
              autoFocus
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder="Ví dụ: Prompt tốt cần có mục tiêu, ngữ cảnh và tiêu chí hoàn thành…"
              rows={10}
            />
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setShowPaste(false)}>
                Huỷ
              </button>
              <button
                className="primary-action"
                onClick={importPastedText}
                disabled={!pasteValue.trim()}
              >
                <Sparkles size={16} /> Tạo không gian học
              </button>
            </div>
          </section>
        </div>
      )}

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-card">
            <span className="processing-logo">
              <Sparkles size={21} />
            </span>
            <div>
              <strong>{processingLabel}</strong>
              <p>Focus AI đang tách trang và chuẩn bị nội dung bôi sáng.</p>
            </div>
            <div className="processing-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </main>
  );
}
