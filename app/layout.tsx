import type { Metadata } from "next";
import { profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: `${profile.brand.name} (VSA) — online figure skating programs`,
  description: profile.brand.description,
  openGraph: {
    title: `${profile.brand.name} (VSA)`,
    description: profile.brand.description,
    type: "website",
  },
  other: {
    "ai-content-declaration": "structured-product-data",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0f1115",
          color: "#e6e8ec",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.6,
        }}
      >
        {children}
      </body>
    </html>
  );
}
