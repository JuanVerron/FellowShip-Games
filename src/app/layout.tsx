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
  title: "Fellowship Games",
  description: "Question bank roulette for fellowship sessions",
};

// maximumScale 5 disengaja. Mengunci perbesaran memang membuat tampilan
// terasa rapi, tapi ia merampas kemampuan orang yang penglihatannya kurang
// untuk membaca pertanyaan di layar HP.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Warna chrome browser HP mengikuti --latar di kedua mode. Satu nilai tetap
  // akan salah di salah satunya: hitam mati di layar terang, atau putih
  // menyilaukan di layar gelap. Nilainya hasil konversi oklch --latar ke sRGB.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#120d09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
