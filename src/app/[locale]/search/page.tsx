import { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import AISearchAgent from "@/components/AISearchAgent";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AISearch" });
  
  const path = locale === "en" ? "/search" : `/${locale}/search`;
  return {
    title: `Search — ESG Hub`,
    description: t("description"),
    alternates: {
      canonical: `https://esg-hub.ascent.partners${path}`,
    },
    openGraph: {
      title: `Search — ESG Hub AI Agent`,
      description: t("description"),
      url: `https://esg-hub.ascent.partners${path}`,
      siteName: "ESG Hub",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Search — ESG Hub AI Agent`,
      description: t("description"),
    },
  };
}

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AISearch" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  
  return (
    <Suspense
      fallback={
        <div className="content-wrapper">
          <div style={{ textAlign: "center", padding: "3rem 0" }} role="status" aria-live="polite">
            {/* The resolved search UI owns the document h1; the fallback must
                not add a second one to the streamed HTML. */}
            <p style={{
              fontFamily: "var(--font-heading)",
              fontSize: "2rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}>
              {t("title")}
            </p>
            <p style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.88rem",
              color: "var(--color-text-muted)",
            }}>
              {tCommon("loading")}
            </p>
          </div>
        </div>
      }
    >
      <AISearchAgent />
    </Suspense>
  );
}
