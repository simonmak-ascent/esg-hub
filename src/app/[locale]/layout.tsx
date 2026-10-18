import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Open_Sans, Raleway } from "next/font/google";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIChatWidget from "@/components/AIChatWidget";
import "@/app/globals.css";

// Incremental static regeneration: every page is rendered at most once per
// window instead of on every request. The site previously rendered request-time
// with `cache: no-store` on every DB call, so nothing was ever cached at the CDN
// (TTFB 0.8-2.3 s). Content changes reach readers within the window.
export const revalidate = 300;

const SITE_URL = "https://esg-hub.ascent.partners";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway", display: "swap" });
const fontVariables = `${openSans.variable} ${raleway.variable}`;

// Blocking theme init — light default (APF parity), persisted choice, no FOUC.
// Reads the APF key first and falls back to the legacy APG key.
const THEME_INIT =
  "try{var k=localStorage.getItem('apf-theme')||localStorage.getItem('apg-theme');document.documentElement.setAttribute('data-theme',k==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}";

interface LayoutParams {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("defaultTitle"),
      template: t("templateTitle"),
    },
    description: t("defaultDesc"),
    keywords: [
      "ESG",
      "Environmental",
      "Social",
      "Governance",
      "sustainability",
      "reporting",
      "IFRS",
      "SASB",
      "GRI",
      "TCFD",
      "climate",
      "ESG standards",
    ],
    authors: [{ name: "Ascent Partners Foundation" }],
    creator: "Ascent Partners Foundation",
    publisher: "Ascent Partners Foundation",
    alternates: {
      languages: {
        "en-GB": SITE_URL,
        "zh-Hans": `${SITE_URL}/zh`,
        "zh-Hant-HK": `${SITE_URL}/hk`,
        "x-default": SITE_URL,
      },
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      locale: locale === "zh" ? "zh_CN" : locale === "hk" ? "zh_HK" : "en_US",
      siteName: "ESG Hub",
      title: t("defaultTitle"),
      description: t("defaultDesc") + " " + t("articlesCount"),
      url: SITE_URL,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: t("defaultTitle"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("defaultDesc") + " " + t("articlesCount"),
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  // Pass the locale explicitly: without it next-intl resolves the locale from
  // request headers, which opts every page out of static rendering.
  const messages = await getMessages({ locale });

  return (
    <html lang={locale === "zh" ? "zh-Hans" : locale === "hk" ? "zh-Hant-HK" : "en-GB"} data-theme="light" className={fontVariables}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <Footer />
          <AIChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
