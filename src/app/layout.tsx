import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: { default: 'ThoughtExpense Console', template: '%s | ThoughtExpense Console' },
  description: 'Operations console for ThoughtExpense',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={instrument.variable} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
