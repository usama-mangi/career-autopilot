import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "./lib/theme-store";
import { ToastProvider } from "~/components/ui/Toast";
import { NetworkStatusProvider } from "~/components/ui/NetworkStatus";

export const links: Route.LinksFunction = () => [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <NetworkStatusProvider>
            <ToastProvider>{children}</ToastProvider>
          </NetworkStatusProvider>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = "Page not found";
      details = "There is no page at this address. Check the link or go back to the dashboard.";
    } else {
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-[#E8DDD1] shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{message}</h1>
        <p className="text-sm text-gray-500 mb-6">{details}</p>
        <div className="flex gap-3 justify-center">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
          >
            Go to dashboard
          </a>
        </div>
        {stack && (
          <details className="w-full text-left mt-6">
            <summary className="cursor-pointer text-sm text-gray-500 mb-2">Error details</summary>
            <pre className="w-full p-4 overflow-x-auto text-left text-xs bg-[#F5EDE4] rounded-lg">
              <code>{stack}</code>
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
