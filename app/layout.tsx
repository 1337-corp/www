import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://1337.cd"),
  title: "1337 Corp",
  description: "We are the quiet architects of what comes next.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "1337 Corp",
    description: "We are the quiet architects of what comes next.",
    url: "https://1337.cd",
    siteName: "1337 Corp",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "1337 Corp",
    description: "We are the quiet architects of what comes next.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "1337 Corp",
  url: "https://1337.cd",
  description: "We are the quiet architects of what comes next.",
  slogan: "The quiet architects of what comes next.",
};

export const viewport: Viewport = {
  themeColor: "#05050a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
