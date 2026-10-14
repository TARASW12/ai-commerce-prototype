import type { Metadata } from "next";
import { profile } from "@/lib/profile";

const program = profile.programs[0];

export const metadata: Metadata = {
  title: `${program.name} — ${profile.brand.name} (VSA)`,
  description: program.summary,
  openGraph: {
    title: `${program.name} — ${profile.brand.name}`,
    description: program.summary,
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
