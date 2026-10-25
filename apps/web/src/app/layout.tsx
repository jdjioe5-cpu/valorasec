import type { Metadata } from 'next';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'ValoraSec — Soroban Smart Contract Security',
  description:
    'Open-source security platform for Soroban smart contracts on the Stellar Network. Audit, verify, and secure your smart contracts.',
  keywords: ['soroban', 'stellar', 'smart contract', 'security', 'audit', 'blockchain'],
  authors: [{ name: 'ValoraSec Contributors' }],
  openGraph: {
    title: 'ValoraSec — Soroban Smart Contract Security',
    description:
      'Open-source security platform for Soroban smart contracts on the Stellar Network.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background min-h-screen font-sans">
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground focus:outline-primary absolute left-2 top-2 z-[100] rounded-md px-4 py-2 text-sm font-medium opacity-0 transition-opacity focus:opacity-100"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="valorasec-theme"
          disableTransitionOnChange={false}
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
