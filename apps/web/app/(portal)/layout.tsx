import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { BottomNav } from "@/components/shell/BottomNav";

/**
 * Portal-Shell: Sidebar (Desktop) + Topbar + Inhalt + BottomNav (Mobile).
 * Canvas-Hintergrund, Surface-Flächen — Look gemäß mockup-final.html.
 */
export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10 lg:pt-7">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
