"use client";

import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  Highlighter,
  Layers3,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Sun,
  Upload,
  X,
  Zap,
} from "lucide-react";
import JSZip from "jszip";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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
  textLayer?: Array<{
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    rotation: number;
  }>;
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
  live?: boolean;
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

type AgentTab = "chat" | "quiz" | "flashcards";

const accentOrder: SlidePage["accent"][] = ["blue", "coral", "mint", "amber"];

const initialMaterials: Material[] = [
  {
    id: "day-1-foundation",
    name: "Day 1 · AI & LLM Foundation",
    type: "PDF",
    status: "Đã lưu",
    updated: "Học liệu lớp",
    sourceUrl: "/materials/d1-slide-hackathon.pdf",
    transcriptLabel: "Transcript 04 · T04",
    pages: [
      {
        id: "day-1-loading",
        eyebrow: "AI IN ACTION · DAY 01",
        title: "AI & LLM Foundation",
        subtitle: "Đang nạp slide và liên kết Transcript 04…",
        paragraphs: [],
        points: [],
        accent: "blue",
      },
    ],
  },
  {
    id: "day-2-product",
    name: "Day 2 · Xác định bài toán cho AI",
    type: "PDF",
    status: "Đã lưu",
    updated: "Học liệu lớp",
    sourceUrl: "/materials/d2-slide-hackathon.pdf",
    transcriptLabel: "Transcript 01 · T01",
    pages: [
      {
        id: "day-2-loading",
        eyebrow: "AI IN ACTION · DAY 02",
        title: "Xác định bài toán cho AI",
        subtitle: "Đang nạp slide và liên kết Transcript 01…",
        paragraphs: [
          "Từ yêu cầu mơ hồ đến Problem Statement rõ ràng.",
        ],
        points: [],
        accent: "coral",
      },
    ],
  },
];

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "Mình chỉ trả lời từ slide và transcript đã liên kết với đúng buổi học đang mở. Hãy chọn một đoạn hoặc đặt câu hỏi về trang hiện tại.",
    citation: "Day 1 · Transcript T04",
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
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const limit = Math.min(pdf.numPages, 60);
  const pages: SlidePage[] = [];

  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const pdfPage = await pdf.getPage(pageNumber);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const renderScale = Math.min(
      2,
      Math.max(1.25, 1440 / baseViewport.width),
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
    const extractedPage = makePage(
      blocks,
      pageNumber - 1,
      "PDF",
      ratio > 1.15 ? "slide" : "document",
      ratio,
    );
    extractedPage.previewDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    extractedPage.textLayer = content.items.flatMap((item) => {
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
    pages.push(extractedPage);
    pdfPage.cleanup();
  }
  await pdf.destroy();
  return pages;
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
  const [highlightMode, setHighlightMode] = useState(true);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [agentTab, setAgentTab] = useState<AgentTab>("chat");
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [generatedFlashcards, setGeneratedFlashcards] = useState<Flashcard[]>([]);
  const [isGeneratingLearning, setIsGeneratingLearning] = useState(false);
  const [learningLive, setLearningLive] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const selectionHandledRef = useRef(false);
  const loadedCourseIdsRef = useRef(new Set<string>());

  const activeMaterial =
    materials.find((material) => material.id === activeMaterialId) ?? materials[0];
  const page = activeMaterial.pages[pageIndex] ?? activeMaterial.pages[0];
  const quiz = generatedQuiz;
  const flashcards = generatedFlashcards;

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

  useEffect(() => {
    if (
      !activeMaterial.sourceUrl ||
      loadedCourseIdsRef.current.has(activeMaterial.id)
    ) {
      return;
    }
    loadedCourseIdsRef.current.add(activeMaterial.id);
    let cancelled = false;

    async function loadCourseSlides() {
      setIsProcessing(true);
      setProcessingLabel(`Đang nạp ${activeMaterial.name}…`);
      try {
        const response = await fetch(activeMaterial.sourceUrl!);
        if (!response.ok) throw new Error("slides");
        const blob = await response.blob();
        const file = new File([blob], `${activeMaterial.id}.pdf`, {
          type: "application/pdf",
        });
        const pages = await extractPdfPages(file);
        if (cancelled || pages.length === 0) return;
        setMaterials((current) =>
          current.map((material) =>
            material.id === activeMaterial.id ? { ...material, pages } : material,
          ),
        );
        setToast(
          `${pages.length} trang đã liên kết với ${activeMaterial.transcriptLabel}`,
        );
      } catch {
        loadedCourseIdsRef.current.delete(activeMaterial.id);
        setToast("Không thể nạp slide của buổi học");
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    }

    void loadCourseSlides();
    return () => {
      cancelled = true;
    };
  }, [activeMaterial]);

  function selectMaterial(material: Material) {
    setActiveMaterialId(material.id);
    setPageIndex(0);
    setHighlights([]);
    setGeneratedQuiz([]);
    setGeneratedFlashcards([]);
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

  function addHighlight(text: string, sourcePageIndex = pageIndex) {
    const normalized = cleanText(text);
    if (!normalized || normalized.length < 3) return;
    setPageIndex(sourcePageIndex);
    setHighlights((current) =>
      current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [...current, normalized].slice(-6),
    );
    setToast(
      highlights.includes(normalized)
        ? "Đã bỏ đoạn bôi sáng"
        : "Đã thêm vào ngữ cảnh AI",
    );
  }

  function handleTextSelection(sourcePageIndex: number) {
    if (!highlightMode) return;
    const selected = window.getSelection()?.toString() ?? "";
    if (cleanText(selected).length >= 3) {
      selectionHandledRef.current = true;
      addHighlight(selected, sourcePageIndex);
      window.setTimeout(() => {
        selectionHandledRef.current = false;
      }, 0);
    }
    window.getSelection()?.removeAllRanges();
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
        ? "Đang dựng nguyên bản từng trang PDF…"
        : "Đang đọc cấu trúc tài liệu…",
    );
    setUploadMessage("");

    try {
      const pages = await parseMaterial(file);
      if (pages.length === 0) throw new Error("empty");
      setProcessingLabel("Đang lưu và tạo ngữ cảnh học tập…");
      const stored = await storeFile(file);
      const material: Material = {
        id: `material-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        type: typeFromFile(file),
        pages,
        status: stored ? "Đã lưu" : "Cục bộ",
        updated: "Vừa thêm",
      };
      setMaterials((current) => [material, ...current]);
      setActiveMaterialId(material.id);
      setPageIndex(0);
      setHighlights([]);
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
    setPasteValue("");
    setShowPaste(false);
    setHighlights([]);
    setToast("Đã tạo tài liệu từ nội dung dán");
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

    const context =
      highlights.length > 0
        ? highlights.join("\n")
        : [page.title, page.subtitle, ...page.paragraphs, ...page.points]
            .filter(Boolean)
            .join("\n");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          question: prompt,
          context,
          page: pageIndex + 1,
          materialId: activeMaterial.id,
          material: activeMaterial.name,
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
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
          citation:
            result.citations && result.citations.length > 0
              ? `${activeMaterial.name} • ${result.citations
                  .map((id) => `[${id}]`)
                  .join(" ")}`
              : `${activeMaterial.name} • Trang ${pageIndex + 1}`,
          live: result.live,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Dựa trên phần đang chọn, ý chính là: ${context.slice(0, 330)}${context.length > 330 ? "…" : ""}`,
          citation: `${activeMaterial.name} • Trang ${pageIndex + 1}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function currentLearningContext() {
    return highlights.length > 0
      ? highlights.join("\n")
      : [page.title, page.subtitle, ...page.paragraphs, ...page.points]
          .filter(Boolean)
          .join("\n");
  }

  async function requestLearningContent(mode: "quiz" | "flashcards") {
    setIsGeneratingLearning(true);
    setLearningLive(false);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          question:
            mode === "quiz"
              ? "Tạo câu hỏi kiểm tra hiểu và áp dụng"
              : "Tạo thẻ ghi nhớ các ý quan trọng",
          context: currentLearningContext(),
          page: pageIndex + 1,
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
    const text = target.closest<HTMLElement>("[data-highlightable]")?.innerText;
    if (text && !window.getSelection()?.toString()) {
      addHighlight(text, sourcePageIndex);
    }
  }

  return (
    <main
      className={`app-shell ${isDark ? "theme-dark" : ""} ${
        !leftOpen ? "left-collapsed" : ""
      } ${!rightOpen ? "right-collapsed" : ""}`}
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
            className="search-button"
            onClick={() => setLeftOpen(true)}
            aria-label="Tìm học liệu"
          >
            <Search size={17} />
            <span>Tìm học liệu</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="streak">
            <Zap size={15} fill="currentColor" />
            <span>7 ngày</span>
          </div>
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
              className={`tool-button ${!highlightMode ? "active" : ""}`}
              onClick={() => setHighlightMode(false)}
              title="Chế độ đọc"
            >
              <ArrowRight size={16} />
              <span>Đọc</span>
            </button>
            <button
              className={`tool-button ${highlightMode ? "active highlighter" : ""}`}
              onClick={() => setHighlightMode(true)}
              title="Chọn hoặc bấm vào nội dung để bôi sáng"
            >
              <Highlighter size={16} />
              <span>Bôi sáng</span>
            </button>
            <button className="tool-button icon-only" aria-label="Thêm tuỳ chọn" title="Thêm tuỳ chọn">
              <MoreHorizontal size={17} />
            </button>
          </div>
          <div className="page-pill">
            <Layers3 size={13} />
            Trang {pageIndex + 1} / {activeMaterial.pages.length}
            <span>Cuộn liên tục</span>
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
                  } ${viewerPage.previewDataUrl ? "has-native-preview" : ""}`}
                  style={{ aspectRatio: String(pageRatio) }}
                  key={viewerPage.id}
                  onMouseUp={() => handleTextSelection(viewerIndex)}
                  onClick={(event) => handlePageClick(event, viewerIndex)}
                >
                  {viewerPage.previewDataUrl ? (
                    <div className="pdf-native-page">
                      <img
                        src={viewerPage.previewDataUrl}
                        alt={`${activeMaterial.name} — trang ${viewerIndex + 1}`}
                        draggable={false}
                      />
                      <div
                        className="pdf-text-layer"
                        aria-label={`Lớp văn bản có thể bôi sáng của trang ${
                          viewerIndex + 1
                        }`}
                      >
                        {viewerPage.textLayer?.map((textItem, textIndex) => (
                          <span
                            key={`${viewerPage.id}-pdf-text-${textIndex}`}
                            data-highlightable
                            className={
                              highlights.includes(cleanText(textItem.text))
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
            <MessageCircle size={15} /> Hỏi AI
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
            <Layers3 size={15} /> Thẻ nhớ
          </button>
        </div>

        {agentTab === "chat" && (
          <>
            <div className="context-card">
              <div className="context-heading">
                <span>
                  <Highlighter size={14} /> Ngữ cảnh đã chọn
                </span>
                {highlights.length > 0 && (
                  <button onClick={() => setHighlights([])}>Xoá tất cả</button>
                )}
              </div>
              {highlights.length === 0 ? (
                <p>
                  Chưa có đoạn bôi sáng. AI sẽ dùng toàn bộ nội dung trang{" "}
                  {pageIndex + 1}.
                </p>
              ) : (
                <div className="highlight-list">
                  {highlights.map((highlight, index) => (
                    <div key={`${highlight}-${index}`}>
                      <span>“{highlight}”</span>
                      <button
                        onClick={() =>
                          setHighlights((current) =>
                            current.filter((item) => item !== highlight),
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
                    {message.citation && (
                      <button
                        className="citation"
                        onClick={() => goToPage(pageIndex)}
                      >
                        <FileText size={12} />
                        {message.citation}
                        {message.live && <span>AI live</span>}
                      </button>
                    )}
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
              <span>Học nhanh từ phần đã chọn</span>
              <div>
                <button onClick={createQuiz}>
                  <CircleHelp size={15} /> Tạo quiz
                </button>
                <button onClick={createFlashcards}>
                  <Layers3 size={15} /> Tạo flashcard
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
                placeholder="Hỏi về phần bạn vừa bôi sáng…"
                rows={2}
              />
              <div className="composer-footer">
                <button type="button" className="attach-button" aria-label="Đính kèm">
                  <Paperclip size={16} />
                </button>
                <span>AI chỉ dùng tài liệu đang mở</span>
                <button
                  className="send-button"
                  type="submit"
                  disabled={!question.trim() || isThinking}
                  aria-label="Gửi câu hỏi"
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
                <strong>Đang tạo quiz từ đúng transcript…</strong>
                <span>{activeMaterial.transcriptLabel}</span>
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
                    <span>QUIZ THEO NGỮ CẢNH</span>
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
                  Focus AI đã đối chiếu từng đáp án với nội dung ở trang{" "}
                  {pageIndex + 1}.
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
              </div>
            )}
          </div>
        )}

        {agentTab === "flashcards" && (
          <div className="learning-pane">
            {isGeneratingLearning ? (
              <div className="learning-loading">
                <Sparkles size={20} />
                <strong>Đang tạo thẻ từ đúng transcript…</strong>
                <span>{activeMaterial.transcriptLabel}</span>
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
                    <span>FLASHCARD THEO NGỮ CẢNH</span>
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
                        <span>{flipped ? "ĐÁP ÁN" : `THẺ ${index + 1}`}</span>
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
