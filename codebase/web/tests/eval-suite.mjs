import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const evalDir = resolve(here, "../../../eval");
const versionArgIndex = process.argv.findIndex((arg) => arg === "--version");
const inlineVersionArg = process.argv.find((arg) =>
  arg.startsWith("--version="),
);
const registry = JSON.parse(
  await readFile(resolve(evalDir, "versions.json"), "utf8"),
);
const suiteVersion =
  (versionArgIndex >= 0 ? process.argv[versionArgIndex + 1] : undefined) ||
  inlineVersionArg?.slice("--version=".length) ||
  process.env.EVAL_VERSION ||
  registry.currentVersion ||
  "v1-baseline";

if (!/^[a-z0-9][a-z0-9-]*$/.test(suiteVersion)) {
  throw new Error(`Eval version khong hop le: ${suiteVersion}`);
}

const suitePath = resolve(evalDir, "suites", `${suiteVersion}.json`);
const resultsDir = resolve(evalDir, "results");
const versionResultsDir = resolve(resultsDir, suiteVersion);
const baseUrl = process.env.EVAL_BASE_URL || "http://localhost:3000";
const delayMs = Number(process.env.EVAL_DELAY_MS || 900);
async function loadSuite(version) {
  const definition = JSON.parse(
    await readFile(resolve(evalDir, "suites", `${version}.json`), "utf8"),
  );
  if (definition.baseVersion && !/^[a-z0-9][a-z0-9-]*$/.test(definition.baseVersion)) {
    throw new Error(`Base eval version khong hop le: ${definition.baseVersion}`);
  }
  const baseSuite = definition.baseVersion
    ? await loadSuite(definition.baseVersion)
    : null;
  return baseSuite
    ? {
        ...baseSuite,
        ...definition,
        cases: [...baseSuite.cases, ...(definition.cases ?? [])],
        goldenSetFile: definition.goldenSetFile ?? baseSuite.goldenSetFile,
        primaryCitationPrefix:
          definition.primaryCitationPrefix ?? baseSuite.primaryCitationPrefix,
        qualityBar: definition.qualityBar ?? baseSuite.qualityBar,
      }
    : definition;
}

const suite = await loadSuite(suiteVersion);

// A standalone suite may define all cases in its golden set and omit `cases`.
suite.cases ??= [];

if (suite.version !== suiteVersion) {
  throw new Error(
    `Suite version ${suite.version ?? "missing"} khong khop ${suiteVersion}.`,
  );
}

function goldenCases(markdown, citationPrefix = "T04-") {
  const conceptChecks = {
    16: ["bộ não ngôn ngữ", "lớp giao diện", "lớp áo"],
    17: ["sinh nội dung", "phân loại"],
    18: ["lập kế hoạch", "công cụ", "hành động"],
    19: ["token", "không phải từ"],
    20: ["context", "attention", "điểm mù"],
  };
  const cases = [];
  const sectionHeaders = [...markdown.matchAll(/^###\s+([A-E])\./gm)].map(
    (match) => ({ section: match[1], index: match.index ?? 0 }),
  );
  const pattern =
    /(?:^|\n)(\d+)\. Context: `([^`]*)`\r?\n\s+- Question: `([^`]+)`\r?\n\s+- Expectation: ([^\r\n]+)/g;
  for (const match of markdown.matchAll(pattern)) {
    const number = Number(match[1]);
    const question = match[3];
    const section = [...sectionHeaders]
      .reverse()
      .find((header) => header.index <= (match.index ?? 0))?.section;
    const expected = {
      status: 200,
      groundedSchema: true,
      forbiddenCitationPrefix: "T01-",
    };
    if (number <= 5) {
      expected.behavior = "insufficient-source";
      expected.answerStartsWith =
        "Không tìm thấy đủ thông tin trong tài liệu để kết luận.";
      expected.maximumCitations = 0;
    } else if (number <= 10) {
      expected.behaviorAny = ["insufficient-source", "clarify"];
      expected.maximumCitations = 0;
    } else if (number <= 15) {
      expected.behavior = "refuse";
      expected.maximumCitations = 0;
    } else if (number >= 21 && number <= 31) {
      // Section E contains real-user/UI prompts. They are not grounded
      // content questions, so requiring slide citations/evidence creates
      // false failures when the safe response correctly has no citation.
      expected.maximumCitations = 0;
      if ([22, 27].includes(number)) {
        expected.behavior = "clarify";
      } else if (number === 23) {
        expected.behavior = "refuse";
      } else if ([24].includes(number)) {
        expected.behavior = "insufficient-source";
      } else if ([25, 28].includes(number)) {
        expected.behaviorAny = ["clarify", "insufficient-source"];
      }
    } else {
      expected.citationPrefix = citationPrefix;
      expected.minimumCitations = 1;
      expected.minimumEvidence = 1;
      expected.mustMentionAny = conceptChecks[number];
    }
    if (section === "A") {
      delete expected.citationPrefix;
      delete expected.minimumCitations;
      delete expected.minimumEvidence;
      delete expected.mustMentionAny;
      expected.behavior = "insufficient-source";
      expected.maximumCitations = 0;
    } else if (section === "B") {
      delete expected.citationPrefix;
      delete expected.minimumCitations;
      delete expected.minimumEvidence;
      delete expected.mustMentionAny;
      expected.behaviorAny = ["insufficient-source", "clarify"];
      expected.maximumCitations = 0;
    } else if (section === "C") {
      delete expected.citationPrefix;
      delete expected.minimumCitations;
      delete expected.minimumEvidence;
      delete expected.mustMentionAny;
      expected.behavior = "refuse";
      expected.maximumCitations = 0;
    } else if (section === "D") {
      delete expected.behavior;
      delete expected.behaviorAny;
      delete expected.maximumCitations;
      expected.citationPrefix = citationPrefix;
      expected.minimumCitations = 1;
      expected.minimumEvidence = 1;
      const questionText = question.toLocaleLowerCase("vi");
      if (questionText.includes("llm khác chatbot")) {
        expected.mustMentionAny = ["bộ não ngôn ngữ", "lớp giao diện", "lớp áo"];
      } else if (questionText.includes("generative ai khác")) {
        expected.mustMentionAny = ["sinh nội dung", "phân loại"];
      } else if (questionText.includes("agentic ai cần")) {
        expected.mustMentionAny = ["lập kế hoạch", "công cụ", "hành động"];
      } else if (questionText.includes("model đọc gì")) {
        expected.mustMentionAny = ["token", "không phải từ"];
      } else if (questionText.includes("bàn làm việc")) {
        expected.mustMentionAny = ["context", "attention"];
      } else if (questionText.includes("double diamond")) {
        expected.mustMentionAny = ["vấn đề", "giải pháp"];
      }
      // D is numbered 17-23 in the consolidated golden set. Keep concept
      // checks tied to this section instead of the old global numbering.
      if (section === "D") {
        if (number === 17) expected.mustMentionAny = ["llm", "chatbot"];
        else if (number === 18) expected.mustMentionAny = ["sinh nội dung", "phân loại"];
        else if (number === 19) expected.mustMentionAny = ["lập kế hoạch", "công cụ", "hành động"];
        else if (number === 20) expected.mustMentionAny = ["token", "không phải từ"];
        else if (number === 21) expected.mustMentionAny = ["context", "attention"];
        else if (number === 22) expected.mustMentionAny = ["vấn đề", "giải pháp"];
        else if (number === 23) delete expected.mustMentionAny;
      }
    } else if (section === "E") {
      delete expected.citationPrefix;
      delete expected.minimumCitations;
      delete expected.minimumEvidence;
      delete expected.mustMentionAny;
      expected.maximumCitations = 0;
      const questionText = question.toLocaleLowerCase("vi");
      delete expected.behavior;
      delete expected.behaviorAny;
      if (number === 27) {
        expected.behavior = "refuse";
      } else if (number === 26 || number === 28) {
        expected.behaviorAny = ["clarify", "insufficient-source"];
      } else if ([24, 25, 29, 30, 31].includes(number)) {
        expected.behavior = "insufficient-source";
      }
      if (questionText.includes("mật khẩu") || questionText.includes("password")) {
        expected.behavior = "refuse";
      } else if (
        questionText.includes("giải thích kỹ hơn") ||
        questionText.includes("đoạn bôi đen")
      ) {
        expected.behaviorAny = ["clarify", "insufficient-source"];
      } else if (
        questionText.includes("bitcoin") ||
        questionText.includes("đạo hàm") ||
        questionText.includes("giải thích nội dung")
      ) {
        expected.behavior = "insufficient-source";
      }
    }
    const isDayTwoCase = section === "D" && number === 22;
    const isQuizCase = section === "D" && number === 23;
    const isEmptyUploadCase = section === "E" && number === 29;
    if (isDayTwoCase) {
      expected.forbiddenCitationPrefix = "T04-";
    }
    if (isQuizCase) {
      delete expected.groundedSchema;
      delete expected.minimumEvidence;
      delete expected.behavior;
      delete expected.behaviorAny;
      delete expected.maximumCitations;
      expected.quizCount = 3;
      expected.optionCount = 4;
    }
    if (isEmptyUploadCase) {
      expected.status = 400;
      expected.errorIncludes = "chưa có đủ nội dung";
      delete expected.groundedSchema;
      delete expected.citationPrefix;
      delete expected.forbiddenCitationPrefix;
      delete expected.minimumCitations;
      delete expected.minimumEvidence;
      delete expected.maximumCitations;
      delete expected.behavior;
      delete expected.behaviorAny;
    }
    const input = {
      mode: isQuizCase ? "quiz" : "chat",
      ...(isQuizCase ? { count: 3 } : {}),
      materialId: isEmptyUploadCase
        ? "uploaded-empty"
        : isDayTwoCase
          ? "day-2-product"
          : "day-1-foundation",
      material: isEmptyUploadCase
        ? "Tài liệu rỗng"
        : isDayTwoCase
          ? "d2-slide-hackathon.pdf"
          : "d1-slide-hackathon.pdf",
      scope: "current-page",
      page: isDayTwoCase ? 3 : 1,
      pageCount: isEmptyUploadCase ? 1 : isDayTwoCase ? 16 : 29,
      context: match[2],
      question: match[3],
    };
    cases.push({
      id: `GOLDEN-D1-${String(number).padStart(2, "0")}`,
      class:
        section === "C"
          ? "refusal"
          : section === "A" || section === "B" || section === "E"
            ? "out-of-scope"
            : "normal",
      source: `eval/golden-set.md case ${number}`,
      input,
      expected,
      expectation: match[4],
    });
  }
  return cases;
}

function structuredGoldenCases(markdown) {
  const cases = [];
  const blockPattern = /(?:^|\n)###\s*Case\s+`?([A-Za-z0-9-]+)`?\s*\r?\n([\s\S]*?)(?=\n###\s*Case\s|$)/g;
  const readLine = (block, label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = block.match(
      new RegExp(
        "^\\s*-\\s*" +
          escaped +
          ":\\s*`?([^`\\r\\n]+)`?\\s*$",
        "mi",
      ),
    );
    return match?.[1]?.trim();
  };
  for (const match of markdown.matchAll(blockPattern)) {
    const id = match[1];
    const block = match[2];
    const base = block.match(
      /(?:^|\n)\s*\d+\.\s*Context:\s*`([^`]*)`\r?\n\s*-\s*Question:\s*`([^`]+)`\r?\n\s*-\s*Expectation:\s*([^\r\n]+)/,
    );
    if (!base) continue;
    const parseJson = (label, fallback) => {
      const raw = readLine(block, label);
      if (!raw) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`Golden case ${id} co ${label} khong hop le.`);
      }
    };
    const input = parseJson("Input JSON", {
      mode: "chat",
      materialId: "day-1-foundation",
      page: 1,
      context: base[1],
      question: base[2],
    });
    const expected = parseJson("Expected JSON", {
      status: 200,
      groundedSchema: true,
      forbiddenCitationPrefix: "T01-",
    });
    cases.push({
      id,
      class: readLine(block, "Class") || "normal",
      source: `eval/golden-set.md case ${id}`,
      input,
      expected,
      expectation: base[3].trim(),
    });
  }
  return cases;
}

if (suite.goldenSetFile) {
  const markdown = await readFile(resolve(evalDir, suite.goldenSetFile), "utf8");
  const parsed = /(?:^|\n)###\s*Case\s+/m.test(markdown)
    ? structuredGoldenCases(markdown)
    : goldenCases(markdown, suite.primaryCitationPrefix ?? "T04-");
  suite.cases.push(...parsed);
}

// Later regression suites can inherit the full history but run only a
// deliberate representative subset. This keeps the quality-bar run fast
// without deleting the older golden cases or their historical results.
if (Array.isArray(suite.caseIds) && suite.caseIds.length > 0) {
  const selected = new Set(suite.caseIds);
  suite.cases = suite.cases.filter((testCase) => selected.has(testCase.id));
}

const requestedCaseIds = (process.env.EVAL_CASE_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
if (requestedCaseIds.length > 0) {
  const requested = new Set(requestedCaseIds);
  suite.cases = suite.cases.filter((testCase) => requested.has(testCase.id));
}

function normalize(value) {
  return String(value ?? "")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
}

function collectCitations(actual) {
  const matches =
    JSON.stringify(actual).match(/(?:T\d{2}-\d{3}|P\d{3})/g) ?? [];
  return [...new Set(matches)];
}

function addCheck(checks, name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail });
}

function evaluateBehavior(expected, actualText, checks) {
  const behaviorPassed = (behavior) => {
    if (behavior === "insufficient-source") {
      return [
        "không có",
        "không đủ",
        "chưa đủ",
        "không thể",
        "ngoài phạm vi",
        "không đề cập",
        "không cung cấp",
        "không tìm thấy đủ thông tin",
        "does not contain enough information",
        "not enough information",
        "missing information",
      ].some((signal) => actualText.includes(normalize(signal)));
    }
    if (behavior === "clarify") {
      return [
        "làm rõ",
        "cụ thể",
        "bạn muốn",
        "ý bạn",
        "đoạn nào",
        "nội dung nào",
        "cái nào",
        "please clarify",
        "which section",
      ].some((signal) => actualText.includes(normalize(signal)));
    }
    if (behavior === "refuse") {
      return [
        "không thể hỗ trợ",
        "không cung cấp",
        "không cấp quyền",
        "từ chối",
        "cannot help",
        "do not provide",
      ].some((signal) => actualText.includes(normalize(signal)));
    }
    return false;
  };

  if (expected.behavior === "insufficient-source") {
    addCheck(
      checks,
      "insufficient-source",
      behaviorPassed("insufficient-source"),
      "Phải nói rõ học liệu không đủ căn cứ.",
    );
  }
  if (expected.behavior === "clarify") {
    addCheck(
      checks,
      "clarify",
      behaviorPassed("clarify"),
      "Phải hỏi lại thay vì tự đoán.",
    );
  }
  if (expected.behavior === "refuse") {
    addCheck(
      checks,
      "refuse",
      behaviorPassed("refuse"),
      "Phải từ chối rõ ràng yêu cầu nhạy cảm hoặc vượt quyền.",
    );
  }
  if (expected.behaviorAny) {
    addCheck(
      checks,
      "behavior-any",
      expected.behaviorAny.some(behaviorPassed),
      `Chấp nhận một trong: ${expected.behaviorAny.join(", ")}.`,
    );
  }
}

function evaluate(testCase, status, actual) {
  const expected = testCase.expected;
  const checks = [];
  const citations = collectCitations(actual);
  const actualText = normalize(JSON.stringify(actual));

  addCheck(checks, "status", status === expected.status, `${status}/${expected.status}`);

  if (expected.errorIncludes) {
    addCheck(
      checks,
      "error-message",
      normalize(actual.error).includes(normalize(expected.errorIncludes)),
      actual.error ?? "Không có error.",
    );
  }

  if (expected.citationPrefix) {
    addCheck(
      checks,
      "citation-prefix",
      citations.some((id) => id.startsWith(expected.citationPrefix)),
      citations.join(", ") || "Không có citation.",
    );
  }
  if (expected.forbiddenCitationPrefix) {
    addCheck(
      checks,
      "source-isolation",
      citations.every(
        (id) => !id.startsWith(expected.forbiddenCitationPrefix),
      ),
      `Cấm ${expected.forbiddenCitationPrefix}; nhận ${citations.join(", ") || "none"}.`,
    );
  }
  if (expected.minimumCitations !== undefined) {
    addCheck(
      checks,
      "minimum-citations",
      citations.length >= expected.minimumCitations,
      `${citations.length}/${expected.minimumCitations}`,
    );
  }
  if (expected.maximumCitations !== undefined) {
    addCheck(
      checks,
      "maximum-citations",
      citations.length <= expected.maximumCitations,
      `${citations.length}/${expected.maximumCitations}`,
    );
  }
  if (expected.requireLive) {
    addCheck(checks, "gemini-live", actual.live === true, String(actual.live));
  }

  if (testCase.input.mode === "chat" && expected.status === 200) {
    addCheck(
      checks,
      "chat-schema",
      typeof actual.answer === "string" && Array.isArray(actual.citations),
      "answer:string, citations:array",
    );
  }
  if (expected.groundedSchema) {
    const levels = [
      "Được nêu trực tiếp",
      "Được suy ra",
      "Không đủ thông tin",
    ];
    addCheck(
      checks,
      "grounded-schema",
      typeof actual.answer === "string" &&
        Array.isArray(actual.evidence) &&
        levels.includes(actual.confidence) &&
        typeof actual.note === "string" &&
        Array.isArray(actual.citations),
      "answer, evidence, confidence, note và citations phải đúng kiểu.",
    );
  }
  if (expected.minimumEvidence !== undefined) {
    addCheck(
      checks,
      "minimum-evidence",
      Array.isArray(actual.evidence) &&
        actual.evidence.length >= expected.minimumEvidence,
      `${actual.evidence?.length ?? 0}/${expected.minimumEvidence}`,
    );
  }
  if (expected.answerStartsWith) {
    addCheck(
      checks,
      "answer-prefix",
      typeof actual.answer === "string" &&
        actual.answer.startsWith(expected.answerStartsWith),
      expected.answerStartsWith,
    );
  }
  if (expected.quizCount !== undefined) {
    addCheck(
      checks,
      "quiz-count",
      Array.isArray(actual.quiz) && actual.quiz.length === expected.quizCount,
      `${actual.quiz?.length ?? 0}/${expected.quizCount}`,
    );
    const optionsValid =
      Array.isArray(actual.quiz) &&
      actual.quiz.every(
        (item) =>
          Array.isArray(item.options) &&
          item.options.length === expected.optionCount &&
          Number.isInteger(item.answer) &&
          item.answer >= 0 &&
          item.answer < expected.optionCount &&
          typeof item.explain === "string" &&
          typeof item.citation === "string",
      );
    addCheck(
      checks,
      "quiz-schema",
      optionsValid,
      `Mỗi câu cần ${expected.optionCount} lựa chọn, answer, explain, citation.`,
    );
  }
  if (expected.flashcardCount !== undefined) {
    addCheck(
      checks,
      "flashcard-count",
      Array.isArray(actual.flashcards) &&
        actual.flashcards.length === expected.flashcardCount,
      `${actual.flashcards?.length ?? 0}/${expected.flashcardCount}`,
    );
    const cardsValid =
      Array.isArray(actual.flashcards) &&
      actual.flashcards.every(
        (item) =>
          typeof item.front === "string" &&
          item.front.trim() &&
          typeof item.back === "string" &&
          item.back.trim() &&
          typeof item.citation === "string",
      );
    addCheck(
      checks,
      "flashcard-schema",
      cardsValid,
      "Mỗi thẻ cần front, back và citation.",
    );
  }

  if (expected.mustMentionAny) {
    addCheck(
      checks,
      "required-concept",
      expected.mustMentionAny.some((term) =>
        actualText.includes(normalize(term)),
      ),
      expected.mustMentionAny.join(" | "),
    );
  }
  if (expected.mustNotMentionAny) {
    addCheck(
      checks,
      "forbidden-content",
      expected.mustNotMentionAny.every(
        (term) => !actualText.includes(normalize(term)),
      ),
      expected.mustNotMentionAny.join(" | "),
    );
  }
  if (expected.responseLanguage === "vi") {
    const vietnameseSignals = [
      "la",
      "va",
      "cua",
      "trong",
      "duoc",
      "khong",
      "nguon",
      "tai lieu",
      "slide",
    ];
    const matchedSignals = vietnameseSignals.filter((signal) =>
      actualText.includes(signal),
    );
    addCheck(
      checks,
      "response-language-vi",
      matchedSignals.length >= 2,
      `Phan hoi can dung tieng Viet; nhan: ${matchedSignals.join(", ") || "none"}.`,
    );
  }

  evaluateBehavior(expected, actualText, checks);
  return {
    passed: checks.every((check) => check.passed),
    citations,
    checks,
  };
}

function wait(duration) {
  return new Promise((resolveWait) => setTimeout(resolveWait, duration));
}

const results = [];
for (const [index, testCase] of suite.cases.entries()) {
  const startedAt = Date.now();
  let status = 0;
  let actual;
  try {
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testCase.input),
    });
    status = response.status;
    actual = await response.json();
  } catch (error) {
    actual = { error: error instanceof Error ? error.message : String(error) };
  }
  const evaluation = evaluate(testCase, status, actual);
  results.push({
    id: testCase.id,
    class: testCase.class,
    source: testCase.source,
    input: testCase.input,
    expected: testCase.expected,
    actualStatus: status,
    actualOutput: actual,
    latencyMs: Date.now() - startedAt,
    ...evaluation,
  });
  const marker = evaluation.passed ? "PASS" : "FAIL";
  console.log(
    `${String(index + 1).padStart(2, "0")}/${suite.cases.length} ${marker} ${testCase.id}`,
  );
  if (index < suite.cases.length - 1) await wait(delayMs);
}

const passed = results.filter((result) => result.passed).length;
const sourceCases = results.filter((result) =>
  result.checks.some((check) => check.name === "source-isolation"),
);
const sourceIsolationPassed = sourceCases.filter((result) =>
  result.checks.find((check) => check.name === "source-isolation")?.passed,
).length;
const outOfScopeCases = results.filter(
  (result) => result.class === "out-of-scope",
);
const outOfScopePassed = outOfScopeCases.filter(
  (result) => result.passed,
).length;
const liveResponses = results.filter(
  (result) => result.actualOutput?.live === true,
).length;
const passRate = passed / results.length;
const sourceIsolationRate =
  sourceCases.length > 0 ? sourceIsolationPassed / sourceCases.length : 0;
const outOfScopePassRate =
  outOfScopeCases.length > 0
    ? outOfScopePassed / outOfScopeCases.length
    : 0;

const generatedAt = new Date().toISOString();
const runId = generatedAt.replace(/[:.]/g, "-");
const report = {
  suite: suite.suite,
  version: suite.version,
  stage: suite.stage,
  runId,
  generatedAt,
  suiteFile: `eval/suites/${suiteVersion}.json`,
  baseUrl,
  qualityBar: suite.qualityBar,
  summary: {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate,
    sourceIsolationRate,
    outOfScopePassRate,
    liveResponses,
    qualityBarPassed:
      passRate >= suite.qualityBar.minimumPassRate &&
      sourceIsolationRate >= suite.qualityBar.requiredSourceIsolationRate &&
      outOfScopePassRate >= suite.qualityBar.requiredOutOfScopePassRate &&
      liveResponses >= suite.qualityBar.minimumLiveResponses,
  },
  results,
};

const reportFileName = `${runId}.json`;
const reportRelativePath = `${suiteVersion}/${reportFileName}`;
const reportPath = resolve(versionResultsDir, reportFileName);
const pointer = {
  version: suiteVersion,
  stage: suite.stage,
  runId,
  generatedAt,
  report: reportRelativePath,
  summary: report.summary,
};

const resultsIndexPath = resolve(evalDir, "RESULTS.md");
const resultsIndexHeader = `# Eval results\n\n| Version | Run | Total | Passed | Pass rate | Source isolation | Out-of-scope | Live | Quality bar | Report |\n|---|---|---:|---:|---:|---:|---:|---:|---|---|\n`;
const resultsIndexRow = `| ${suiteVersion} | ${runId} | ${report.summary.total} | ${report.summary.passed} | ${(report.summary.passRate * 100).toFixed(1)}% | ${(report.summary.sourceIsolationRate * 100).toFixed(1)}% | ${(report.summary.outOfScopePassRate * 100).toFixed(1)}% | ${report.summary.liveResponses}/${report.summary.total} | ${report.summary.qualityBarPassed ? "PASSED" : "NOT MET"} | [JSON](results/${reportRelativePath}) |\n`;

await mkdir(versionResultsDir, { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(report, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
await writeFile(
  resolve(versionResultsDir, "latest.json"),
  `${JSON.stringify({ ...pointer, report: reportFileName }, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(resultsDir, "latest.json"),
  `${JSON.stringify(pointer, null, 2)}\n`,
  "utf8",
);
let resultsIndex = resultsIndexHeader;
try {
  resultsIndex = await readFile(resultsIndexPath, "utf8");
} catch {
  // The index is created on the first run when it does not exist yet.
}
if (!resultsIndex.includes(`results/${reportRelativePath}`)) {
  if (!resultsIndex.endsWith("\n")) resultsIndex += "\n";
  resultsIndex += resultsIndexRow;
  await writeFile(resultsIndexPath, resultsIndex, "utf8");
}

console.log(
  `\n${passed}/${results.length} PASS (${(passRate * 100).toFixed(1)}%)`,
);
console.log(
  `Source isolation: ${(sourceIsolationRate * 100).toFixed(1)}%`,
);
console.log(
  `Out-of-scope: ${(outOfScopePassRate * 100).toFixed(1)}%`,
);
console.log(`Gemini live responses: ${liveResponses}/${results.length}`);
console.log(
  `Quality bar: ${report.summary.qualityBarPassed ? "PASSED" : "NOT MET"}`,
);
console.log(`Saved immutable report: eval/results/${reportRelativePath}`);
