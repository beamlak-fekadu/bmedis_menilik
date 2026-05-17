'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';
import type { ReactNode } from 'react';

export default function ThemeProvider({
  children,
  ...props
}: { children: ReactNode } & Omit<ThemeProviderProps, 'children'>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
