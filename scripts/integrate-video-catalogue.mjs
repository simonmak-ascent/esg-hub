/**
 * Integrate v6 video catalogue into /learning/courses/ and /learning/videos/
 * page content, and replace verified-dead YouTube handles.
 * (specs/video-catalogue-integration/{spec,plan}.md)
 *
 * Usage:
 *   node scripts/integrate-video-catalogue.mjs            # dry-run (default): print diff
 *   node scripts/integrate-video-catalogue.mjs --apply    # write changes (backup first)
 *   node scripts/integrate-video-catalogue.mjs --csv /path/to/file.csv
 */

import { getDbEnv } from "./lib/db-env.mjs";
import fs from "node:fs";

const DRY_RUN = !process.argv.includes("--apply");
const csvIdx = process.argv.indexOf("--csv");
const CSV_PATH = csvIdx > -1 ? process.argv[csvIdx + 1] : "./esg_video_catalogue_v6_superset.csv";

const DEAD_LINK_FIXES = [
  ["https://www.youtube.com/@TNFD_", "https://www.youtube.com/channel/UCxr65yI_szV8UODfmyuhTzw"],
  ["https://www.youtube.com/@EFRAG", "https://www.youtube.com/channel/UCxcljiiUM2JD02SMuFUTUwA"],
];

const COURSES_PAGE = "/learning/courses/";
const VIDEOS_PAGE = "/learning/videos/";

const COURSE_SECTION = {
  "GRI-C": "Sustainability Reporting & Disclosure",
  default: "General ESG & Sustainability",
};
const VIDEO_SECTION = {
  "BURSA-VS-0001": "Reporting Standards & Frameworks",
  "HKGFA-CT-0001": "Investment & Finance",
  "HKGFA-W-0001": "Investment & Finance",
  "HKGFA-W-0002": "Investment & Finance",
  "JPX-V-0001": "Reporting Standards & Frameworks",
  "JPX-V-0002": "Investment & Finance",
  "JPX-VS-0001": "Reporting Standards & Frameworks",
  "TNFD-W-0001": "Climate & Environment",
  "WB-W-0001": "Investment & Finance",
};

// ---------- minimal CSV parser (handles quoted fields, escaped quotes) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      if (c === "\r") i++;
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

// ---------- helpers ----------
const urlOf = (r) => (r.localeurljson.match(/https?:\/\/\S+/) || [""])[0];
const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const jaMarker = (r) => (r.localeurljson.startsWith("ja") ? " (Japanese)" : "");

function fmtDuration(r) {
  const mins = parseFloat(r.durationminutes);
  if (!mins) return "Self-paced";
  if (mins >= 60) {
    const h = mins / 60;
    return `${h.toFixed(mins % 60 ? 1 : 0)} ${h === 1 ? "hour" : "hours"}`;
  }
  return `${mins} minutes`;
}
const truncateWords = (s, max) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).trim().replace(/[,;:]+$/, "");
};
const fmtFocus = (r) => truncateWords((r.description.split(".")[0] || r.topictags.split(";")[0]).trim(), 80);

async function verifyUrl(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (res.status === 200) return "ok";
    if ([403, 415].includes(res.status)) return `bot-blocked(${res.status})`;
    return `FAIL(${res.status})`;
  } catch (e) {
    return `FAIL(${e.name})`;
  }
}

// ---------- DB ----------
const env = getDbEnv();
async function querySurreal(surrealql) {
  const res = await fetch(`${env.endpoint}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Accept: "application/json",
      "surreal-ns": env.namespace,
      "surreal-db": env.database,
      Authorization: "Basic " + Buffer.from(`${env.username}:${env.password}`).toString("base64"),
    },
    body: surrealql,
  });
  if (!res.ok) throw new Error(`SurrealDB error ${res.status}: ${await res.text()}`);
  return res.json();
}
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// ---------- section insertion ----------
function insertIntoSection(content, sectionName, addition) {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${sectionName}`);
  if (start === -1) throw new Error(`Section not found: ${sectionName}`);
  // find end of section: next "## " heading or "---" separator
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ") || lines[i].trim() === "---") { end = i; break; }
  }
  // insert before trailing blank lines of the section
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, addition);
  return lines.join("\n");
}

function courseRow(r, url) {
  return `| [${r.coursetitle}${jaMarker(r)}](${url}) | ${r.sourceorganization} | ${fmtDuration(r)} | ${fmtFocus(r)} |`;
}
function videoEntry(r, url) {
  // /learning/videos/ is rendered by the generic [...slug] markdown pipeline,
  // which shows {% include %} shortcodes as raw text — always use prose format
  // here. (Only the custom /videos page parses embed includes.)
  return `**[${r.coursetitle}${jaMarker(r)}](${url})** — ${fmtFocus(r)}. *${r.sourceorganization}, ${fmtDuration(r)}.*`;
}

// ---------- main ----------
const records = parseCsv(fs.readFileSync(CSV_PATH, "utf8")).filter((r) => r.status === "active");
console.log(`Active records in CSV: ${records.length}`);

const pagesRes = await querySurreal(
  `SELECT permalink, content FROM page WHERE permalink IN ['${COURSES_PAGE}','${VIDEOS_PAGE}'];`
);
const pages = Object.fromEntries((pagesRes[0]?.result || []).map((p) => [p.permalink, p.content]));
if (!pages[COURSES_PAGE] || !pages[VIDEOS_PAGE]) throw new Error("Could not fetch both learning pages");

let coursesContent = pages[COURSES_PAGE];
let videosContent = pages[VIDEOS_PAGE];
const corpus = (coursesContent + "\n" + videosContent).toLowerCase();

// dead-link fixes
console.log("\n--- Dead-link fixes ---");
for (const [dead, replacement] of DEAD_LINK_FIXES) {
  const occurrences = videosContent.split(dead).length - 1;
  console.log(`${dead} -> ${replacement}  (${occurrences} occurrence${occurrences === 1 ? "" : "s"})`);
  videosContent = videosContent.split(dead).join(replacement);
}

// classify + verify + integrate
console.log("\n--- Classification & verification ---");
const report = { integrated: [], skipped: [], failed: [] };

// group candidates by URL: multiple records sharing one landing URL merge into one row
const eligible = [];
for (const r of records) {
  const url = urlOf(r);
  const ytId = (url.match(/[?&]v=([\w-]{11})/) || url.match(/youtu\.be\/([\w-]{11})/) || [])[1];
  const isDupe =
    (url && corpus.includes(url.toLowerCase())) ||
    (ytId && corpus.includes(ytId.toLowerCase())) ||
    corpus.includes(normTitle(r.coursetitle).slice(0, 30));
  const flagged = r.editorialnotes.toUpperCase().includes("NEEDS REVIEW");
  if (flagged) { report.skipped.push(`${r.contentref}: NEEDS REVIEW flag`); continue; }
  if (isDupe) { report.skipped.push(`${r.contentref}: already in DB content`); continue; }
  eligible.push({ r, url });
}
const byUrl = new Map();
for (const e of eligible) {
  if (!byUrl.has(e.url)) byUrl.set(e.url, []);
  byUrl.get(e.url).push(e.r);
}

for (const [url, group] of byUrl) {
  const r = group[0];
  const merged = group.length > 1
    ? {
        ...r,
        coursetitle: group.length === 3 && r.contentref.startsWith("OECD")
          ? "OECD E-Learning Academy on Responsible Business Conduct"
          : r.coursetitle,
        description: `Includes: ${group.map((g) => g.coursetitle).join("; ")}.`,
      }
    : r;

  const status = await verifyUrl(url);
  if (status.startsWith("FAIL")) { report.failed.push(`${group.map((g) => g.contentref).join("+")}: ${url} -> ${status}`); continue; }

  const isCourse = merged.contenttype === "course";
  const entry = isCourse ? courseRow(merged, url) : videoEntry(merged, url);
  const section = isCourse
    ? (Object.entries(COURSE_SECTION).find(([k]) => k !== "default" && r.contentref.startsWith(k))?.[1] ?? COURSE_SECTION.default)
    : VIDEO_SECTION[r.contentref];
  if (!section) { report.skipped.push(`${r.contentref}: no section mapping`); continue; }

  if (isCourse) coursesContent = insertIntoSection(coursesContent, section, entry);
  else videosContent = insertIntoSection(videosContent, section, entry);
  report.integrated.push(`${group.map((g) => g.contentref).join("+")} -> ${isCourse ? "courses" : "videos"}/${section} [${status}]${group.length > 1 ? " (merged row)" : ""}`);
}

console.log("INTEGRATED:"); report.integrated.forEach((l) => console.log("  " + l));
console.log("SKIPPED:"); report.skipped.forEach((l) => console.log("  " + l));
if (report.failed.length) { console.log("FAILED URL CHECKS:"); report.failed.forEach((l) => console.log("  " + l)); }

// diff summary
const cl = (s) => s.split("\n").length;
console.log(`\n--- Change summary ---`);
console.log(`courses: ${cl(coursesContent) - cl(pages[COURSES_PAGE])} lines added`);
console.log(`videos:  ${cl(videosContent) - cl(pages[VIDEOS_PAGE])} lines added`);

if (DRY_RUN) {
  console.log("\n--- DRY-RUN: new entries that WOULD be added ---\n");
  const addedCourses = coursesContent.split("\n").filter((l) => !pages[COURSES_PAGE].split("\n").includes(l));
  const addedVideos = videosContent.split("\n").filter((l) => !pages[VIDEOS_PAGE].split("\n").includes(l));
  console.log("== /learning/courses/ =="); addedCourses.forEach((l) => console.log("+ " + l));
  console.log("\n== /learning/videos/ =="); addedVideos.forEach((l) => console.log("+ " + l));
  const changed = DEAD_LINK_FIXES.filter(([d]) => pages[VIDEOS_PAGE].includes(d));
  if (changed.length) {
    console.log("\n== dead-link replacements in /learning/videos/ ==");
    changed.forEach(([d, r]) => console.log(`- ${d}\n+ ${r}`));
  }
  console.log("\n(dry-run — re-run with --apply to write)");
  process.exit(0);
}

// ---------- apply ----------
const ts = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(
  new URL(`../specs/video-catalogue-integration/backup-${ts}.md`, import.meta.url),
  `# Pre-mutation backup ${ts}\n\n## ${COURSES_PAGE}\n\n${pages[COURSES_PAGE]}\n\n## ${VIDEOS_PAGE}\n\n${pages[VIDEOS_PAGE]}\n`
);
console.log(`Backup written: specs/video-catalogue-integration/backup-${ts}.md`);

await querySurreal(`UPDATE page SET content = '${esc(coursesContent)}' WHERE permalink = '${COURSES_PAGE}';`);
await querySurreal(`UPDATE page SET content = '${esc(videosContent)}' WHERE permalink = '${VIDEOS_PAGE}';`);

// re-verify
const after = await querySurreal(
  `SELECT content FROM page WHERE permalink IN ['${COURSES_PAGE}','${VIDEOS_PAGE}'];`
);
const afterCorpus = (after[0]?.result || []).map((p) => p.content).join("\n");
for (const [dead] of DEAD_LINK_FIXES) {
  if (afterCorpus.includes(dead)) throw new Error(`VERIFY FAILED: ${dead} still present`);
}
console.log("✅ Applied and verified: dead handles gone, entries written.");

const reportMd = `# Integration Report ${ts}\n\n## Integrated (${report.integrated.length})\n${report.integrated.map((l) => "- " + l).join("\n")}\n\n## Skipped (${report.skipped.length})\n${report.skipped.map((l) => "- " + l).join("\n")}\n\n## Failed URL checks (${report.failed.length})\n${report.failed.map((l) => "- " + l).join("\n")}\n\n## Dead-link replacements\n${DEAD_LINK_FIXES.map(([d, r]) => `- ${d} -> ${r}`).join("\n")}\n`;
fs.writeFileSync(new URL("../specs/video-catalogue-integration/integration-report.md", import.meta.url), reportMd);
console.log("Report: specs/video-catalogue-integration/integration-report.md");
