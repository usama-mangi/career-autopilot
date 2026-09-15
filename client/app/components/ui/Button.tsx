import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "~/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = "primary",
    size = "md",
    loading,
    loadingText = "Loading...",
    disabled,
    children,
    ...props
  }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-600 active:scale-[0.98] shadow-sm hover:shadow-md focus:ring-primary-500/30",
      secondary: "bg-white text-gray-700 border border-[#E8DDD1] hover:bg-[#FFFBF5] active:bg-[#F5EDE4] active:scale-[0.98] focus:ring-gray-500/30",
      ghost: "text-gray-600 hover:text-gray-900 hover:bg-[#F5EDE4] active:bg-[#E8DDD1] focus:ring-gray-500/30",
      danger: "bg-danger text-white hover:bg-danger-600 active:bg-danger-700 active:scale-[0.98] focus:ring-red-500/30",
      outline: "bg-transparent text-gray-700 border border-[#E8DDD1] hover:bg-[#FFFBF5] hover:border-[#9C8E7E] focus:ring-gray-500/30",
    };

    // sm keeps a compact footprint for dense desktop controls; icon is a full
    // 44px touch target. Never make sm the only path to a mobile action.
    const sizes = {
      sm: "px-3 py-2.5 text-xs gap-1.5 sm:py-1.5",
      md: "px-4 py-2.5 text-sm gap-2 sm:py-2",
      lg: "px-6 py-3 text-base gap-2",
      icon: "p-2.5 min-w-[44px] min-h-[44px]",
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="sr-only">{loadingText}</span>
          </>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;