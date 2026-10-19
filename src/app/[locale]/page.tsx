import { getPageByPermalink } from "@/lib/pages";
import MarkdownContent from "@/components/MarkdownContent";
import Link from "next/link";
import HomeSearchBox from "@/components/HomeSearchBox";
import { getTranslations, setRequestLocale } from "next-intl/server";

const HOMEPAGE_SECTION_KEYS = [
  { href: "/environmental", key: "environmental" },
  { href: "/social", key: "social" },
  { href: "/governance", key: "governance" },
  { href: "/standards", key: "standards" },
  { href: "/finance", key: "finance" },
  { href: "/emerging-topics", key: "emergingTopics" },
];

const SECTION_COLORS: Record<string, string> = {
  environmental: "var(--color-section-env)",
  social: "var(--color-section-social)",
  governance: "var(--color-section-gov)",
  standards: "var(--color-section-standards)",
  finance: "var(--color-section-climate)",
  emergingTopics: "var(--color-section-biodiversity)",
};

const SECONDARY_RESOURCE_KEYS = [
  { href: "/learning", key: "learning" },
  { href: "/practice", key: "practice" },
  { href: "/books", key: "books" },
  { href: "/videos", key: "videos" },
  { href: "/glossary", key: "glossary" },
  { href: "/developers", key: "developers" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // No headers() here: it opts the homepage out of static rendering. The
  // esg.video -> /videos redirect lives in src/middleware.ts (and vercel.json).
  const t = await getTranslations({ locale, namespace: "Home" });

  const pageResult = await getPageByPermalink("/", locale);
  const page = pageResult === "db_error" ? null : pageResult;

  return (
    <>
      <div
        style={{
          background: "var(--apf-color-surface-hero)",
          borderBottom: "3px solid var(--apf-color-gold)",
          padding: "3.5rem 1.5rem 3rem",
          color: "var(--apf-color-neutral-white)",
        }}
      >
        <div
          style={{
            maxWidth: "var(--wide-max-width)",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(2rem, 4vw, 3.25rem)",
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: "var(--apf-color-neutral-white)",
              marginTop: 0,
              marginBottom: "0.5rem",
              borderBottom: "none",
              paddingBottom: 0,
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              fontSize: "var(--apf-font-size-18)",
              color: "color-mix(in srgb, var(--apf-color-neutral-white) 88%, transparent)",
              maxWidth: "640px",
              margin: "0 auto 1.75rem",
              lineHeight: 1.6,
            }}
          >
            {t("subtitle")}
          </p>

          <HomeSearchBox />
        </div>
      </div>

      <div className="wide-wrapper">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
            gap: "0.8rem",
            margin: "1.2rem 0 2rem",
          }}
        >
          {HOMEPAGE_SECTION_KEYS.map((section) => (
            <Link
              key={section.href}
              href={`/${locale}${section.href}`}
              className="section-card"
              style={{ borderLeft: `3px solid ${SECTION_COLORS[section.key]}` }}
            >
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  marginBottom: "0.3rem",
                  color: SECTION_COLORS[section.key],
                }}
              >
                {t(`sections.${section.key}.title` as never)}
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                {t(`sections.${section.key}.description` as never)}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "var(--color-bg-alt)",
          borderTop: "1px solid var(--color-border)",
          padding: "1.5rem",
          marginTop: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: "var(--wide-max-width)",
            margin: "0 auto",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: "0.8rem",
              marginTop: 0,
            }}
          >
            {t("professionalDevelopment")}
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.6rem",
            }}
          >
            {SECONDARY_RESOURCE_KEYS.map((resource) => (
              <Link
                key={resource.href}
                href={`/${locale}${resource.href}`}
                style={{
                  display: "inline-block",
                  padding: "0.4em 0.9em",
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 0,
                  fontSize: "0.85rem",
                  color: "var(--color-link)",
                  textDecoration: "none",
                }}
              >
                {t(`resources.${resource.key}` as never)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {page?.content && (
        <div className="content-wrapper" style={{ marginTop: "2rem" }}>
          <MarkdownContent content={page.content} />
        </div>
      )}
    </>
  );
}
