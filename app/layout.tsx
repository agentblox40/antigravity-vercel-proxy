import React from 'react';

export const metadata = {
  title: 'Antigravity Gemini 24/7 Proxy',
  description: 'OpenAI-compatible serverless proxy for Google Antigravity AI Pro accounts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
