"use client";
import { useState, useMemo } from "react";
import Image from "next/image";

/**
 * Curated Unsplash image URLs mapped to ESG topics.
 * Using direct Unsplash CDN URLs with resize parameters.
 */
const TOPIC_IMAGES: Record<string, string[]> = {
  climate: [
    "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=960&h=280&fit=crop&auto=format",
  ],
  biodiversity: [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=960&h=280&fit=crop&auto=format",
  ],
  water: [
    "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1432405972618-c6b0cfba8673?w=960&h=280&fit=crop&auto=format",
  ],
  energy: [
    "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=960&h=280&fit=crop&auto=format",
  ],
  social: [
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=960&h=280&fit=crop&auto=format",
  ],
  governance: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=960&h=280&fit=crop&auto=format",
  ],
  standards: [
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=960&h=280&fit=crop&auto=format",
  ],
  hongkong: [
    "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=960&h=280&fit=crop&auto=format",
  ],
  finance: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=960&h=280&fit=crop&auto=format",
  ],
  sustainability: [
    "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=960&h=280&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=960&h=280&fit=crop&auto=format",
  ],
};

const SECTION_TOPIC_MAP: Record<string, string> = {
  environmental: "climate",
  social: "social",
  governance: "governance",
  standards: "standards",
  "hk-apac": "hongkong",
  learning: "sustainability",
  sdg: "sustainability",
  ratings: "finance",
  finance: "finance",
};

const KEYWORD_TOPIC_MAP: Record<string, string> = {
  climate: "climate",
  carbon: "climate",
  emission: "climate",
  ghg: "climate",
  biodiversity: "biodiversity",
  nature: "biodiversity",
  forest: "biodiversity",
  ecosystem: "biodiversity",
  water: "water",
  ocean: "water",
  freshwater: "water",
  energy: "energy",
  renewable: "energy",
  solar: "energy",
  human: "social",
  labor: "social",
  health: "social",
  diversity: "social",
  board: "governance",
  ethics: "governance",
  gri: "standards",
  ifrs: "standards",
  tcfd: "standards",
  tnfd: "biodiversity",
  finance: "finance",
  investment: "finance",
};

interface PageImageProps {
  section?: string | null;
  title: string;
  keywords?: string | null;
}

function getTopic(section?: string | null, title?: string, keywords?: string | null): string {
  if (section && SECTION_TOPIC_MAP[section]) return SECTION_TOPIC_MAP[section];
  const combined = ((title || "") + " " + (keywords || "")).toLowerCase();
  for (const [key, topic] of Object.entries(KEYWORD_TOPIC_MAP)) {
    if (combined.includes(key)) return topic;
  }
  return "sustainability";
}

function getImageUrl(topic: string, title: string): string {
  const images = TOPIC_IMAGES[topic] || TOPIC_IMAGES.sustainability;
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return images[Math.abs(hash) % images.length];
}

export default function PageImage({ section, title, keywords }: PageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const topic = useMemo(() => getTopic(section, title, keywords), [section, title, keywords]);
  const imageUrl = useMemo(() => getImageUrl(topic, title), [topic, title]);

  if (error) return null;

  return (
    <div style={{ position: "relative", marginBottom: "1rem" }}>
      <Image
        src={imageUrl}
        alt={`Illustration for ${title}`}
        width={960}
        height={280}
        className="page-hero-image"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s", width: "100%", height: "auto" }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {loaded && (
        <div
          style={{
            position: "absolute",
            bottom: "0.4rem",
            right: "0.5rem",
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.6)",
            background: "rgba(0,0,0,0.4)",
            padding: "0.1em 0.4em",
            borderRadius: 0,
          }}
        >
          Photo via{" "}
          <a
            href="https://unsplash.com/?utm_source=esg_hub&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(255,255,255,0.8)", textDecoration: "underline" }}
          >
            Unsplash
          </a>
        </div>
      )}
    </div>
  );
}
