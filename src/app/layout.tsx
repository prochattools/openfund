import { Providers } from '@/components/providers';
import { getSEOTags } from '@/libs/seo';
import { cn } from '@/helpers/utils';
import '@/assets/styles/globals.css';
import type { Viewport } from 'next';
import { Golos_Text } from 'next/font/google';
import type { ReactNode } from 'react';

const golos = Golos_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-golos',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#f5f1ea',
  width: 'device-width',
  initialScale: 1,
};

export const metadata = getSEOTags({
  title: 'Yeshua Academy Finance',
  description: 'Interne financiële administratie voor Yeshua Academy.',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className={cn('font-sans bg-[#f5f1ea] text-[#251f1a] antialiased', golos.variable)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
