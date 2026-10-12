import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Open_Sans, Titillium_Web, Raleway } from "next/font/google";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIChatWidget from "@/components/AIChatWidget";
import "@/app/globals.css";

export const dynamic = "force-dynamic";

const SITE_URL = "https://esg-hub.ascent.partners";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });
const titillium = Titillium_Web({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-titillium", display: "swap" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway", display: "swap" });
const fontVariables = `${openSans.variable} ${titillium.variable} ${raleway.variable}`;

// Blocking theme init — dark default, persisted choice (APG parity, no FOUC).
const THEME_INIT =
  "try{var v=localStorage.getItem('apg-theme');document.documentElement.setAttribute('data-theme',v==='light'||v==='dark'?v:'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}";

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

  const messages = await getMessages();

  return (
    <html lang={locale === "zh" ? "zh-Hans" : locale === "hk" ? "zh-Hant-HK" : "en-GB"} data-theme="dark" className={fontVariables}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main>{children}</main>
          <Footer />
          <AIChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
