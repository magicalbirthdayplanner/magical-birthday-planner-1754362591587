import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Party Planner - AI-Powered Kids Birthday Planner',
  description: 'Create magical birthday parties for kids aged 0-12 with AI-generated suggestions, checklists, and themed inspiration boards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="pt-16">
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
        {/* TODO: Remove iframe-navigation.js in production, should never be removed by AI */}
        <script src="/scripts/iframe-navigation.js"></script>
      </body>
    </html>
  );
}
