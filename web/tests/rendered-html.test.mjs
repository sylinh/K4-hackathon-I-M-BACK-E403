import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the complete VLearn Focus learning flow", async () => {
  const [page, layout, styles, hosting, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /Tải tài liệu lên/);
  assert.match(page, /parseMaterial/);
  assert.match(page, /handleTextSelection/);
  assert.match(page, /handleViewerScroll/);
  assert.match(page, /activeMaterial\.pages\.map/);
  assert.match(page, /Cuộn liên tục/);
  assert.match(page, /data-page-index/);
  assert.match(page, /bundledPdfPages/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /loadBundledPdf/);
  assert.match(page, /canvas\.toDataURL\("image\/jpeg", 0\.86\)/);
  assert.match(page, /pdf-text-layer/);
  assert.match(page, /previewDataUrl/);
  assert.doesNotMatch(page, /className="viewer-footer"/);
  assert.match(page, /Tạo quiz/);
  assert.match(page, /Tạo flashcard/);
  assert.match(page, /Xem kết quả/);
  assert.match(page, /day-1-foundation/);
  assert.match(page, /day-2-product/);
  assert.match(page, /d1-slide-hackathon\.pdf/);
  assert.match(page, /d2-slide-hackathon\.pdf/);
  assert.match(page, /\/api\/agent/);
  assert.match(page, /\/api\/materials/);
  assert.match(layout, /VLearn Focus — Học chủ động cùng AI/);
  assert.match(layout, /new URL\("\/og\.png", metadataBase\)/);
  assert.match(styles, /@media \(max-width: 920px\)/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, null);
  assert.equal(hostingConfig.r2, "MATERIALS");
  assert.match(hostingConfig.project_id, /^appgprj_[a-z0-9]+$/);
  assert.equal(JSON.parse(packageJson).name, "vlearn-focus");
  assert.doesNotMatch(page + layout + packageJson, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("includes production assets and API routes", async () => {
  const [
    ogStats,
    dayOneAsset,
    dayTwoAsset,
    dayOneSource,
    dayTwoSource,
    agentRoute,
    materialRoute,
    distEntries,
  ] = await Promise.all([
    stat(new URL("public/og.png", root)),
    readFile(new URL("public/materials/d1-slide-hackathon.pdf", root)),
    readFile(new URL("public/materials/d2-slide-hackathon.pdf", root)),
    readFile(new URL("../data/vlearn-pack/slides/d1-slide-hackathon.pdf", root)),
    readFile(new URL("../data/vlearn-pack/slides/d2-slide-hackathon.pdf", root)),
    readFile(new URL("app/api/agent/route.ts", root), "utf8"),
    readFile(new URL("app/api/materials/route.ts", root), "utf8"),
    readdir(new URL("dist/", root)),
  ]);

  assert.ok(ogStats.size > 100_000);
  assert.ok(dayOneAsset.length > 1_000_000);
  assert.ok(dayTwoAsset.length > 1_000_000);
  assert.equal(
    createHash("sha256").update(dayOneAsset).digest("hex"),
    createHash("sha256").update(dayOneSource).digest("hex"),
  );
  assert.equal(
    createHash("sha256").update(dayTwoAsset).digest("hex"),
    createHash("sha256").update(dayTwoSource).digest("hex"),
  );
  assert.match(agentRoute, /generativelanguage\.googleapis\.com/);
  assert.match(agentRoute, /gemini-3\.6-flash/);
  assert.match(agentRoute, /transcript-04-clean\.md\?raw/);
  assert.match(agentRoute, /transcript-01-clean\.md\?raw/);
  assert.match(agentRoute, /retrieveChunks/);
  assert.match(agentRoute, /fallbackChat/);
  assert.match(agentRoute, /fallbackQuiz/);
  assert.match(agentRoute, /fallbackFlashcards/);
  assert.match(materialRoute, /20 \* 1024 \* 1024/);
  assert.match(materialRoute, /MATERIALS\.put/);
  assert.ok(distEntries.includes("client"));
  assert.ok(distEntries.includes("server"));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
