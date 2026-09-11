import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Single warm, rounded-terminal family for both display and body text --
// friendlier than a mono/serif split, while still reading as considered
// rather than a default system font.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SkillGrid",
  description: "Trust through evidence, not self-report.",
};

// Runs before paint to apply a stored theme preference (see
// app/ui/ThemeToggle.tsx) and avoid a flash of the wrong theme. No
// preference stored means "system" -- CSS media query handles it.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("skillgrid-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
