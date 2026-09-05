import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import "./globals.css";
import "@/styles/axion-science-tokens.css";
import "@/styles/axion-premium-landing.css";
import "@/styles/axion-writer-chrome.css";
import "@/styles/axion-premium-workspace.css";
import { ThemeProvider } from "@/components/theme-provider";
import { EcosystemBar } from "@/components/ecosystem/ecosystem-bar";
import { EcosystemKeyboardNav } from "@/components/ecosystem/ecosystem-keyboard-nav";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
    title: "Axion Writer",
    description: "Scientific writing and publication workspace connected to Axion Science projects and evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <body className={`${manrope.variable} ${playfair.variable} min-h-screen`}>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
                    <EcosystemKeyboardNav currentApp="writer" />
                    <EcosystemBar currentApp="writer" />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
