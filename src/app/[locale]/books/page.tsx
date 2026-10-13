import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPageByPermalink } from "@/lib/pages";
import { queryHttp } from "@/lib/surrealdb";
import MarkdownContent from "@/components/MarkdownContent";
import Link from "next/link";
import Image from "next/image";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Books" });
  
  const path = locale === "en" ? "/books" : `/${locale}/books`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: `https://esg-hub.ascent.partners${path}` },
    openGraph: {
      title: "ESG Books & Literature — ESG Hub",
      description:
        "Comprehensive ESG book collection with downloadable PDF resources.",
      url: `https://esg-hub.ascent.partners${path}`,
      siteName: "ESG Hub",
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
  };
}

interface Book {
  slug: string;
  title: string;
  author: string;
  category: string;
  description: string;
  pdf_url: string | null;
  cover_url: string | null;
  pdf_size: number;
}

const EXTERNAL_BOOKS = [
  {
    title: "GRI Standards 2021",
    author: "Global Reporting Initiative",
    description:
      "The complete set of GRI Universal, Sector, and Topic Standards for sustainability reporting.",
    url: "https://www.globalreporting.org/standards/",
    type: "Standards Document",
  },
  {
    title: "IFRS S1 & S2 Sustainability Disclosure Standards",
    author: "IFRS Foundation",
    description:
      "The ISSB's global baseline sustainability disclosure standards covering general requirements (S1) and climate-related disclosures (S2).",
    url: "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/",
    type: "Standards Document",
  },
  {
    title: "TCFD Recommendations (Final Report)",
    author: "Task Force on Climate-related Financial Disclosures",
    description:
      "The foundational recommendations for climate-related financial disclosures, now incorporated into ISSB standards.",
    url: "https://www.fsb-tcfd.org/recommendations/",
    type: "Framework",
  },
  {
    title: "TNFD Recommendations",
    author: "Taskforce on Nature-related Financial Disclosures",
    description:
      "Framework for organizations to report and act on evolving nature-related dependencies, impacts, risks, and opportunities.",
    url: "https://tnfd.global/recommendations-of-the-tnfd/",
    type: "Framework",
  },
  {
    title: "UN Principles for Responsible Investment",
    author: "United Nations PRI",
    description:
      "The six principles for responsible investment and supporting resources for institutional investors.",
    url: "https://www.unpri.org/about-us/what-are-the-principles-for-responsible-investment",
    type: "Principles",
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BooksPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Books" });
  const tNav = await getTranslations({ locale, namespace: "Navigation" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  
  let books: Book[] = [];
  try {
    books = await queryHttp<Book>(
      "SELECT slug, title, author, category, description, pdf_url, cover_url, pdf_size FROM book ORDER BY category, title;"
    );
  } catch (err) {
    console.error("[BooksPage] Failed to fetch books:", err);
  }

  const pageResult = await getPageByPermalink("/books/", locale);
  const page = pageResult === "db_error" ? null : pageResult;

  const categories = new Map<string, Book[]>();
  for (const book of books) {
    const cat = book.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(book);
  }

  return (
    <div className="wide-wrapper">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={`/${locale}/`}>{tCommon("home")}</Link>
        <span className="separator" aria-hidden="true">/</span>
        <span aria-current="page">{tNav("books")}</span>
      </nav>

      <h1>{t("literatureTitle")}</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem", maxWidth: "720px" }}>
        {t("description")}
      </p>

      {Array.from(categories.entries()).map(([category, catBooks]) => (
        <section key={category} style={{ marginBottom: "2.5rem" }}>
          <h2>{category}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1.2rem",
              marginTop: "0.8rem",
            }}
          >
            {catBooks.map((book) => (
              <div
                key={book.slug}
                style={{
                  background: "var(--color-bg-alt)",
                  border: "1px solid var(--color-border-light)",
                  borderRadius: "4px",
                  padding: "1.2rem",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.6rem" }}>
                  {book.cover_url ? (
                    <div
                      style={{
                        width: "60px",
                        height: "80px",
                        flexShrink: 0,
                        borderRadius: "2px",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        position: "relative",
                      }}
                    >
                      <Image
                        src={book.cover_url}
                        alt={`${book.title} cover`}
                        fill
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "60px",
                        height: "80px",
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "var(--color-text)",
                        marginBottom: "0.15rem",
                      }}
                    >
                      {book.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      {book.author}
                    </div>
                  </div>
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.55,
                    flex: 1,
                    margin: "0 0 0.6rem 0",
                  }}
                >
                  {book.description}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  {book.pdf_url ? (
                    <a
                      href={book.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.82rem",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 500,
                        padding: "0.35em 0.7em",
                        background: "var(--color-primary)",
                        color: "#fff",
                        borderRadius: "3px",
                        textDecoration: "none",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {t("downloadPdf")}
                      {book.pdf_size > 0 && (
                        <span style={{ opacity: 0.8, fontSize: "0.75rem" }}>
                          {t("fileSize", { size: formatFileSize(book.pdf_size) })}
                        </span>
                      )}
                    </a>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                      {t("pdfComingSoon")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {books.length === 0 && (
        <section style={{ marginBottom: "2.5rem" }}>
          <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {t("unableToLoad")}
          </p>
        </section>
      )}

      <section style={{ marginBottom: "2.5rem" }}>
        <h2>{t("standardsDocs")}</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.88rem", marginBottom: "0.8rem" }}>
          {t("standardsDesc")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {EXTERNAL_BOOKS.map((book) => (
            <a
              key={book.title}
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="research-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="research-card-title">{book.title}</div>
                  <div className="research-card-meta">
                    {book.author} &middot; {book.type}
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-text-muted)"
                  strokeWidth="2"
                  style={{ flexShrink: 0, marginTop: "0.2rem" }}
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
              <div className="research-card-abstract">{book.description}</div>
            </a>
          ))}
        </div>
      </section>

      {page && page.content && (
        <section style={{ marginTop: "2rem" }}>
          <h2>{t("additionalReading")}</h2>
          <div className="prose" style={{ maxWidth: "var(--content-max-width)" }}>
            <MarkdownContent content={page.content} />
          </div>
        </section>
      )}
    </div>
  );
}
