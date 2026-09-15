import { type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
}

const maxWidthStyles = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  "2xl": "max-w-[1200px]",
  full: "max-w-full",
};

const paddingStyles = {
  none: "",
  sm: "px-4 sm:px-6",
  md: "px-6",
  lg: "px-8",
};

export function PageShell({
  children,
  className,
  maxWidth = "2xl",
  padding = "md",
}: PageShellProps) {
  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      <div className={cn("mx-auto w-full", maxWidthStyles[maxWidth], paddingStyles[padding])}>
        <div className="py-8">{children}</div>
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)}>
      <div>          <h2 className="text-xs font-semibold text-gray-500">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  onClick?: () => void;
}

const cardPaddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className, padding = "md", hover = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm",
        cardPaddingStyles[padding],
        hover && "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default PageShell;
