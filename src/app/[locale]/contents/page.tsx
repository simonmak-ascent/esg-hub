import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAllPages } from "@/lib/pages";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contents" });
  
  const path = locale === "en" ? "/contents" : `/${locale}/contents`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `https://esg-hub.ascent.partners${path}`,
    },
  };
}

export default async function ContentsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contents" });
  const tPillars = await getTranslations({ locale, namespace: "Pillars" });
  
  const pages = await getAllPages();
  
  const bySection = pages.reduce((acc, page) => {
    const section = page.section || "uncategorized";
    if (!acc[section]) acc[section] = [];
    acc[section].push(page);
    return acc;
  }, {} as Record<string, typeof pages>);
  
  const pillarCounts = {
    E: pages.filter(p => p.section === "environmental").length,
    S: pages.filter(p => p.section === "social").length,
    G: pages.filter(p => p.section === "governance").length,
  };
  
  const totalCount = pages.length;

  return (
    <div className="content-wrapper layout-content">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li><Link href={`/${locale}/`}>ESG Hub</Link></li>
          <li>›</li>
          <li aria-current="page">{t("title")}</li>
        </ol>
      </nav>
      
      <h1>{t("title")}</h1>
      
      <p className="contents-description">
        {t("description")}
      </p>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--color-section-env)" }}>{pillarCounts.E}</div>
          <div className="stat-label">{tPillars("environmental")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--color-section-social)" }}>{pillarCounts.S}</div>
          <div className="stat-label">{tPillars("social")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--color-section-gov)" }}>{pillarCounts.G}</div>
          <div className="stat-label">{tPillars("governance")}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalCount}</div>
          <div className="stat-label">{t("totalArticles")}</div>
        </div>
      </div>
      
      <h2 id="by-subject">{t("browseBySubject")}</h2>
      
      <div style={{ marginBottom: "3rem" }}>
        <section className="section-card">
          <h3 className="section-heading env">{t("esgPillars")}</h3>
          <div className="section-links">
            <Link href={`/${locale}/environmental`} className="section-link">
              <span className="section-link-title">Environmental</span>
              <span className="section-link-desc">{bySection.environmental?.length || 0} articles — Climate, emissions, biodiversity</span>
            </Link>
            <Link href={`/${locale}/social`} className="section-link">
              <span className="section-link-title">Social</span>
              <span className="section-link-desc">{bySection.social?.length || 0} articles — Human rights, labor, community</span>
            </Link>
            <Link href={`/${locale}/governance`} className="section-link">
              <span className="section-link-title">Governance</span>
              <span className="section-link-desc">{bySection.governance?.length || 0} articles — Board, ethics, transparency</span>
            </Link>
          </div>
        </section>

        <section className="section-card">
          <h3 className="section-heading standards">{t("standardsFrameworks")}</h3>
          <div className="section-links">
            <Link href={`/${locale}/standards`} className="section-link">
              <span className="section-link-title">Standards & Frameworks</span>
              <span className="section-link-desc">{bySection.standards?.length || 0} articles — GRI, IFRS S1/S2, TCFD, TNFD, SASB</span>
            </Link>
            <Link href={`/${locale}/hk-apac`} className="section-link">
              <span className="section-link-title">Regional Regulations</span>
              <span className="section-link-desc">{(bySection["hk-apac"]?.length || 0) + (bySection.regulations?.length || 0)} articles — EU, APAC, North America</span>
            </Link>
            <Link href={`/${locale}/ratings`} className="section-link">
              <span className="section-link-title">ESG Ratings & Data</span>
              <span className="section-link-desc">{bySection.ratings?.length || 0} articles — Rating agencies & methodologies</span>
            </Link>
          </div>
        </section>

        <section className="section-card">
          <h3 className="section-heading finance">{t("financeInvestment")}</h3>
          <div className="section-links">
            <Link href={`/${locale}/finance`} className="section-link">
              <span className="section-link-title">ESG Finance</span>
              <span className="section-link-desc">{bySection.finance?.length || 0} articles — Blended Finance, Green Taxonomies, Social Bonds</span>
            </Link>
            <Link href={`/${locale}/climate-finance`} className="section-link">
              <span className="section-link-title">Climate Finance</span>
              <span className="section-link-desc">{bySection["climate-finance"]?.length || 0} articles — Carbon Markets, Green Bonds, Net-Zero</span>
            </Link>
            <Link href={`/${locale}/investment`} className="section-link">
              <span className="section-link-title">ESG Investment</span>
              <span className="section-link-desc">{bySection.investment?.length || 0} articles — Impact Investing, Shareholder Activism</span>
            </Link>
          </div>
        </section>

        <section className="section-card">
          <h3 className="section-heading biodiversity">{t("sustainabilityTopics")}</h3>
          <div className="section-links">
            <Link href={`/${locale}/biodiversity`} className="section-link">
              <span className="section-link-title">Biodiversity & Nature</span>
              <span className="section-link-desc">{bySection.biodiversity?.length || 0} articles — TNFD, Ecosystem Services, Nature-Positive</span>
            </Link>
            <Link href={`/${locale}/emerging-topics`} className="section-link">
              <span className="section-link-title">Emerging Topics</span>
              <span className="section-link-desc">{bySection["emerging-topics"]?.length || 0} articles — AI Ethics, Circular Economy, Just Transition</span>
            </Link>
            <Link href={`/${locale}/sdg`} className="section-link">
              <span className="section-link-title">UN SDGs</span>
              <span className="section-link-desc">{(bySection.sdg?.length || 0) + (bySection.sdgs?.length || 0)} articles — 17 Sustainable Development Goals</span>
            </Link>
          </div>
        </section>

        <section className="section-card">
          <h3 className="section-heading learning">{t("learningPractice")}</h3>
          <div className="section-links">
            <Link href={`/${locale}/learning`} className="section-link">
              <span className="section-link-title">Learning Hub</span>
              <span className="section-link-desc">{(bySection.learning?.length || 0) + (bySection.learn?.length || 0)} articles — Courses & Certifications</span>
            </Link>
            <Link href={`/${locale}/practice`} className="section-link">
              <span className="section-link-title">Practice & Implementation</span>
              <span className="section-link-desc">{bySection.practice?.length || 0} articles — Implementation Guides</span>
            </Link>
            <Link href={`/${locale}/learning/esg-fundamentals`} className="section-link">
              <span className="section-link-title">ESG Fundamentals</span>
              <span className="section-link-desc">{bySection.fundamentals?.length || 0} articles — Foundation Knowledge</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="contents-footer-links">
        <Link href={`/${locale}/search`} className="footer-link">Search</Link>
        <Link href={`/${locale}/glossary`} className="footer-link">Glossary</Link>
        <Link href={`/${locale}/books`} className="footer-link">Books</Link>
        <Link href={`/${locale}/videos`} className="footer-link">Videos</Link>
        <Link href={`/${locale}/developers`} className="footer-link">Developers</Link>
      </div>
    </div>
  );
}
