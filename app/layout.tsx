import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SES/RJ · Treino por tópico",
  description: "1.080 questões comentadas: 10 em cada tópico do edital, resumos, mini testes, redação, revisão de erros e desempenho por matéria.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
