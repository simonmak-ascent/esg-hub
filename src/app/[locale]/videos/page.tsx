import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import { queryHttp } from "@/lib/surrealdb";
import { getPageByPermalink, CONTENT_REVALIDATE } from "@/lib/pages";
import MarkdownContent from "@/components/MarkdownContent";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Videos" });
  
  const path = locale === "en" ? "/videos" : `/${locale}/videos`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `https://esg-hub.ascent.partners${path}` },
    openGraph: {
      title: "ESG Video Library — ESG Hub",
      description:
        "Curated collection of educational ESG videos, webinars, and expert interviews.",
      url: `https://esg-hub.ascent.partners${path}`,
      siteName: "ESG Hub",
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
  };
}

interface VideoEntry {
  id: string;
  title: string;
  youtubeId: string;
  caption: string;
  source: string;
  duration: string;
  topics: string[];
  category: string;
}

function parseVideosFromContent(content: string): {
  videos: VideoEntry[];
  categories: Map<string, VideoEntry[]>;
} {
  const videos: VideoEntry[] = [];
  const lines = content.split("\n");
  let currentCategory = "General";
  let currentVideo: Partial<VideoEntry> | null = null;
  let videoIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      currentCategory = h2Match[1].trim();
      continue;
    }

    const embedMatch = line.match(
      /\{%\s*include\s+video-embed\.html\s+provider="(\w+)"\s+id="([^"]+)"\s+title="([^"]+)"\s+caption="([^"]*)"\s*%\}/
    );
    if (embedMatch) {
      if (currentVideo && currentVideo.youtubeId) {
        videos.push(currentVideo as VideoEntry);
      }
      currentVideo = {
        id: `video-${videoIndex++}`,
        title: embedMatch[3],
        youtubeId: embedMatch[2],
        caption: embedMatch[4],
        source: "",
        duration: "",
        topics: [],
        category: currentCategory,
      };
      continue;
    }

    if (currentVideo) {
      const durationMatch = line.match(/\*\*Duration\*\*:\s*(.+)/);
      if (durationMatch) {
        currentVideo.duration = durationMatch[1].trim();
        continue;
      }
      const sourceMatch = line.match(/\*\*Source\*\*:\s*(.+)/);
      if (sourceMatch) {
        currentVideo.source = sourceMatch[1].trim();
        continue;
      }
      const topicMatch = line.match(/^-\s+(.+)/);
      if (topicMatch && currentVideo.topics) {
        currentVideo.topics.push(topicMatch[1].trim());
        continue;
      }
      if (line.startsWith("---")) {
        if (currentVideo.youtubeId) {
          videos.push(currentVideo as VideoEntry);
        }
        currentVideo = null;
      }
    }
  }
  if (currentVideo && currentVideo.youtubeId) {
    videos.push(currentVideo as VideoEntry);
  }

  const categories = new Map<string, VideoEntry[]>();
  for (const v of videos) {
    const cat = v.category || "General";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(v);
  }

  return { videos, categories };
}

async function getVideoReferencingPages(): Promise<
  { title: string; permalink: string; section: string | null }[]
> {
  try {
    return await queryHttp<{
      title: string;
      permalink: string;
      section: string | null;
    }>(
      `SELECT title, permalink, section FROM page WHERE (content CONTAINS 'youtube.com' OR content CONTAINS 'youtu.be' OR content CONTAINS 'video-embed') AND permalink != '/videos/' AND permalink != '/learning/videos/' ORDER BY section ASC, title ASC LIMIT 50;`,
      undefined,
      { revalidate: CONTENT_REVALIDATE }
    );
  } catch {
    return [];
  }
}

export default async function VideosPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Videos" });
  const tNav = await getTranslations({ locale, namespace: "Navigation" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  
  const videoPageResult = await getPageByPermalink("/videos/", locale);
  const learningVideoPageResult = await getPageByPermalink("/learning/videos/", locale);
  const videoPage = videoPageResult === "db_error" ? null : videoPageResult;
  const learningVideoPage = learningVideoPageResult === "db_error" ? null : learningVideoPageResult;

  const mainContent = videoPage?.content || "";
  const learningContent = learningVideoPage?.content || "";
  const combined = mainContent + "\n---\n" + learningContent;
  const { categories } = parseVideosFromContent(combined);

  const crossRefs = await getVideoReferencingPages();

  return (
    <div className="wide-wrapper">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${locale}/`}>{tCommon("home")}</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span aria-current="page">{tNav("videos")}</span>
      </nav>

      <h1>{t("title")}</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem", maxWidth: "720px" }}>
        {t("description")}
      </p>

      {Array.from(categories.entries()).map(([category, vids]) => (
        <section key={category} style={{ marginBottom: "2rem" }}>
          <h2 id={category.toLowerCase().replace(/\s+/g, "-")}>{category}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1rem",
              marginTop: "0.8rem",
            }}
          >
            {vids.map((video) => (
              <div key={video.id} className="video-card">
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", position: "relative" }}
                >
                  <Image
                    src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                    alt={video.title}
                    width={480}
                    height={270}
                    style={{
                      width: "100%",
                      aspectRatio: "16/9",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.3)",
                      transition: "background 0.15s",
                    }}
                  >
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.6)" />
                      <polygon points="19,14 19,34 36,24" fill="currentColor" />
                    </svg>
                  </div>
                </a>
                <div className="video-card-info">
                  <div className="video-card-title">{video.title}</div>
                  {video.caption && (
                    <div style={{ fontSize: "0.82rem", color: "var(--color-text-secondary)", marginBottom: "0.3rem" }}>
                      {video.caption}
                    </div>
                  )}
                  <div className="video-card-meta">
                    {video.source && <span>{video.source}</span>}
                    {video.source && video.duration && <span> &middot; </span>}
                    {video.duration && <span>{video.duration}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {learningContent && (
        <section style={{ marginTop: "2rem" }}>
          <h2>{t("videoChannels")}</h2>
          <div className="prose" style={{ maxWidth: "var(--content-max-width)" }}>
            <MarkdownContent content={cleanVideoMarkdown(learningContent)} />
          </div>
        </section>
      )}

      {crossRefs.length > 0 && (
        <section style={{ marginTop: "2.5rem", borderTop: "1px solid var(--color-border-light)", paddingTop: "1.5rem" }}>
          <h2>{t("pagesWithVideo")}</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem", marginBottom: "1rem" }}>
            {t("pagesWithVideoDesc")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "0.6rem",
            }}
          >
            {crossRefs.map((ref) => (
              <Link
                key={ref.permalink}
                href={`/${locale}${ref.permalink || "/"}`}
                className="topic-card"
              >
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    color: "var(--color-link)",
                  }}
                >
                  {ref.title}
                </div>
                {ref.section && (
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "0.15rem" }}>
                    {ref.section.charAt(0).toUpperCase() + ref.section.slice(1)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function cleanVideoMarkdown(content: string): string {
  return content
    .replace(/\{%\s*include\s+video-embed\.html[^%]*%\}/g, "")
    .replace(/\*\*Topics Covered\*\*:[\s\S]*?(?=\n---|\n##|$)/g, "")
    .replace(/\*\*Duration\*\*:[^\n]*/g, "")
    .replace(/\*\*Source\*\*:[^\n]*/g, "");
}
