import assert from "node:assert/strict";
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
  assert.match(page, /range\.intersectsNode\(element\)/);
  assert.match(page, /data-pdf-text-id/);
  assert.match(page, /highlightedPdfTextItems/);
  assert.match(page, /handleViewerScroll/);
  assert.match(page, /activeMaterial\.pages\.map/);
  assert.match(page, /Cuộn liên tục/);
  assert.match(page, /data-page-index/);
  assert.match(page, /new Uint8Array\(await file\.arrayBuffer\(\)\)/);
  assert.match(page, /source\.data\.slice\(\)/);
  assert.doesNotMatch(page, /URL\.createObjectURL\(file\)/);
  assert.match(page, /<PdfCanvasPage/);
  assert.match(page, /window\.devicePixelRatio/);
  assert.match(page, /const pageCount = pdf\.numPages/);
  assert.match(page, /loadingTask\.destroy\(\)/);
  assert.doesNotMatch(page, /pdf\.destroy\(\)/);
  assert.doesNotMatch(page, /canvas\.toDataURL/);
  assert.doesNotMatch(page, /Math\.min\(pdf\.numPages,\s*60\)/);
  assert.match(page, /pdf-text-layer/);
  assert.match(page, /pdfSource/);
  assert.doesNotMatch(page, /className="viewer-footer"/);
  assert.match(page, /Tạo quiz/);
  assert.match(page, /Tạo flashcard/);
  assert.match(page, /Xem kết quả/);
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
  const [ogStats, agentRoute, materialRoute, distEntries] = await Promise.all([
    stat(new URL("public/og.png", root)),
    readFile(new URL("app/api/agent/route.ts", root), "utf8"),
    readFile(new URL("app/api/materials/route.ts", root), "utf8"),
    readdir(new URL("dist/", root)),
  ]);

  assert.ok(ogStats.size > 100_000);
  assert.match(agentRoute, /api\.openai\.com\/v1\/responses/);
  assert.match(agentRoute, /fallbackAnswer/);
  assert.match(materialRoute, /20 \* 1024 \* 1024/);
  assert.match(materialRoute, /MATERIALS\.put/);
  assert.match(materialRoute, /await file\.arrayBuffer\(\)/);
  assert.ok(distEntries.includes("client"));
  assert.ok(distEntries.includes("server"));
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});
