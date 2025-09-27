export const metadata = { title: 'Gestione Olio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased max-w-6xl mx-auto p-6">{children}</body>
    </html>
  );
}
