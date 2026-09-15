import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { cn } from "~/lib/utils";
import { useSession, signOut } from "~/lib/auth-store";
import { useNavigate } from "react-router";
import { useTheme } from "~/lib/theme-store";

interface NavItem {
  to: string;
  label: string;
  icon: (active: boolean) => ReactElement;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  // Ordered by the lifecycle a job moves through. Each section header is a
  // stage of the journey; everything else lives in Library.
  {
    label: "Find",
    items: [
      { to: "/jobs", label: "Search Jobs", icon: SearchIcon },
      { to: "/saved-searches", label: "Saved Searches", icon: BookmarkIcon },
      { to: "/job-alerts", label: "Job Alerts", icon: BellIcon },
      { to: "/companies", label: "Companies", icon: BuildingIcon },
    ],
  },
  {
    label: "Prepare",
    items: [
      { to: "/resumes", label: "My Resumes", icon: DocumentIcon },
      { to: "/cover-letter-templates", label: "Cover Letters", icon: LetterIcon },
      { to: "/portfolio", label: "Portfolio", icon: FolderIcon },
    ],
  },
  {
    label: "Track",
    items: [
      { to: "/applications", label: "My Jobs", icon: TargetIcon },
      { to: "/applications/analytics", label: "Analytics", icon: ChartIcon },
    ],
  },
  {
    label: "Interview",
    items: [
      { to: "/interview-schedule", label: "Schedule", icon: CalendarIcon },
      { to: "/interview-prep", label: "Prep Hub", icon: MicIcon },
    ],
  },
  {
    label: "Land",
    items: [
      { to: "/offers", label: "Offers", icon: TrophyIcon },
      { to: "/offers/compare", label: "Compare", icon: CompareIcon },
      { to: "/offers/negotiate", label: "Negotiate", icon: DollarIcon },
    ],
  },
  {
    label: "After",
    items: [
      { to: "/onboarding/first-90-days", label: "First 90 Days", icon: RocketIcon },
    ],
  },
  {
    label: "Library",
    items: [
      { to: "/interview-notes", label: "Interview Notes", icon: ChatIcon },
      { to: "/mock-interview", label: "Mock Interview", icon: ChatIcon },
      { to: "/technical-practice", label: "Practice", icon: CodeIcon },
      { to: "/references", label: "References", icon: LetterIcon },
      { to: "/linkedin-profile", label: "LinkedIn Profile", icon: BuildingIcon },
    ],
  },
];

function SearchIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function BookmarkIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
    </svg>
  );
}

function BellIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function BuildingIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function KanbanIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function TargetIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );
}

function RocketIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function ChartIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function MicIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function CalendarIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ChatIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

function CodeIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function TrophyIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.665 6.023 6.023 0 01-2.77-.665" />
    </svg>
  );
}

function CompareIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function DollarIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DocumentIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function LetterIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function FolderIcon(active: boolean) {
  return (
    <svg className={cn("size-4", active ? "text-primary-500" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={cn("size-3.5 text-gray-400 transition-transform duration-200", expanded && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ collapsed = false, onToggle, open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-sections");
    if (stored) {
      try {
        setExpandedSections(JSON.parse(stored));
      } catch {
        setExpandedSections({});
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-sections", JSON.stringify(expandedSections));
  }, [expandedSections]);

  function toggleSection(label: string) {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(to: string) {
    if (to === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname === to || location.pathname.startsWith(to + "/");
  }

  function findActiveSection(): string | null {
    for (const section of SECTIONS) {
      for (const item of section.items) {
        if (isActive(item.to)) return section.label;
      }
    }
    return null;
  }

  const activeSection = findActiveSection();

  if (collapsed) {
    return (
      <aside
        id="sidebar"
        className="fixed inset-y-0 left-0 z-40 w-[68px] bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2"
        aria-label="Main navigation"
      >
        <Link to="/dashboard" className="mb-4 flex items-center justify-center w-9 h-9 rounded-lg bg-primary-500 text-white" aria-label="Career Autopilot Dashboard">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        <nav className="flex-1 flex flex-col gap-1 w-full px-2" aria-label="Navigation">
          <Link
            to="/dashboard"
            className={cn(
              "flex items-center justify-center w-full h-10 rounded-lg transition-colors",
              location.pathname === "/dashboard"
                ? "bg-primary-50 text-primary-500"
                : "text-gray-500 hover:bg-gray-100"
            )}
            title="Dashboard"
            aria-current={location.pathname === "/dashboard" ? "page" : undefined}
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </Link>
          {SECTIONS.map((section) => {
            const hasActive = section.items.some((item) => isActive(item.to));
            return (
              <div key={section.label} className="relative">
                {hasActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r" />
                )}
                <Link
                  to={section.items[0].to}
                  className={cn(
                    "flex items-center justify-center w-full h-10 rounded-lg transition-colors",
                    hasActive
                      ? "bg-primary-50 text-primary-500"
                      : "text-gray-500 hover:bg-gray-100"
                  )}
                  title={section.label}
                >
                  {section.items[0].icon(hasActive)}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 px-2">
          <button
            onClick={toggle}
            className="flex items-center justify-center w-full h-10 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-[260px] bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-100 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CA</span>
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">Career Autopilot</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Dashboard link */}
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-2",
            location.pathname === "/dashboard"
              ? "text-primary-600 bg-primary-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Dashboard
        </Link>

        {/* Sections */}
        {SECTIONS.map((section) => {
          // Lifecycle sections are small and always relevant — expand them by
          // default so the journey is visible at a glance; Library stays
          // collapsed to keep the navigation scannable.
          const lifecycleDefault = section.label !== "Library";
          const expanded = expandedSections[section.label] ?? (lifecycleDefault || activeSection === section.label);
          const hasActive = section.items.some((item) => isActive(item.to));

          return (
            <div key={section.label} className="mb-1">
              <button
                onClick={() => toggleSection(section.label)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors",
                  hasActive
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
                aria-expanded={expanded}
                aria-controls={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <ChevronIcon expanded={expanded} />
                {section.label}
              </button>
              {expanded && (
                <div id={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`} className="ml-2 mt-0.5 space-y-0.5" role="group" aria-label={`${section.label} navigation`}>
                  {section.items.map((item) => {
                    const active = isActive(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                          active
                            ? "text-primary-600 bg-primary-50"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r" aria-hidden="true" />
                        )}
                        {item.icon(active)}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-100 p-3 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>

        {/* User */}
        {session?.user && (
          <>
            <Link
              to="/profile"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors mt-1"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-primary-600">
                  {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="truncate">{session.user.name || session.user.email}</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-danger-600 hover:text-danger-700 hover:bg-danger-50 transition-colors mt-1"
            >
              <LogOutIcon />
              <span>Log out</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function LogOutIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
