import { Link } from "react-router";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  ACTIVE_STAGES,
  APPLICATION_STATUS_CONFIG,
  STAGE_HINTS,
  formatDate,
  type ApplicationStatus,
} from "~/lib/status-config";
import { Button } from "~/components/ui";

export interface StageLaneApp {
  id: string;
  companyName: string;
  roleTitle: string;
  status: string;
  appliedAt?: string | null;
  nextActionAt?: string | null;
}

interface StageCardProps {
  app: StageLaneApp;
  /** What you can do next from this stage, e.g. move to next stage. */
  onAdvance?: (appId: string, nextStatus: ApplicationStatus) => void;
  /** Secondary actions shown on the card (reject/withdraw are destructive, keep them in detail). */
  showMoveToDetail?: boolean;
}

function StageCard({ app }: StageCardProps) {
  const cfg = APPLICATION_STATUS_CONFIG[app.status as ApplicationStatus] ?? APPLICATION_STATUS_CONFIG.draft;
  return (
    <Link
      to={`/applications/${app.id}`}
      className="block bg-white rounded-lg p-3 shadow-sm border border-[#E8DDD1] hover:shadow-md hover:border-primary-200 transition-all duration-150"
      aria-label={`${app.companyName} — ${app.roleTitle}, ${cfg.label}`}
    >
      <p className="text-sm font-medium text-gray-900 truncate">{app.companyName}</p>
      <p className="text-xs text-gray-600 truncate">{app.roleTitle}</p>
      <p className="text-[10px] text-gray-400 mt-1.5">
        {app.appliedAt ? `Applied ${formatDate(app.appliedAt)}` : "Not submitted yet"}
      </p>
    </Link>
  );
}

interface StageLanesProps {
  apps: StageLaneApp[];
  closedApps?: StageLaneApp[];
  onAdvance?: (appId: string, nextStatus: ApplicationStatus) => void;
  onArchive?: (appId: string, status: ApplicationStatus) => void;
  className?: string;
}

/**
 * Stage lanes: the pipeline as a journey with five ordered stages, plus a
 * collapsed "closed" archive. No drag-drop — every card's next action is a
 * single visible click, which is faster than dragging and works on touch and
 * keyboard alike.
 */
export function StageLanes({ apps, closedApps = [], className }: StageLanesProps) {
  const closedCount = closedApps.length;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {ACTIVE_STAGES.map((status) => {
          const cfg = APPLICATION_STATUS_CONFIG[status];
          const laneApps = apps.filter((a) => a.status === status);
          return (
            <div key={status} className="flex flex-col rounded-xl border border-[#E8DDD1] bg-[#FFF8F0] overflow-hidden">
              <div className={cn("px-3 py-2.5 border-b border-[#E8DDD1]", cfg.bgColor)}>
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/70", cfg.color)}>
                    {laneApps.length}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{STAGE_HINTS[status]}</p>
            </div>
              <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                {laneApps.map((app) => (
                  <StageCard key={app.id} app={app} />
                ))}
                {laneApps.length === 0 && (
                  <p className="text-[10px] text-gray-400 text-center py-6">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed outcomes: out of the way but never lost. Empty lanes waste
          attention; the archive keeps them one click away instead. */}
      <details className="group rounded-xl border border-[#E8DDD1] bg-[#FFFBF5]">
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
          <svg
            className="w-3.5 h-3.5 text-gray-400 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-600">Closed</span>
          <span className="text-xs text-gray-400">{closedCount} job{closedCount !== 1 ? "s" : ""}</span>
          <span className="ml-auto flex items-center gap-2">
            {(["accepted", "rejected", "withdrawn"] as ApplicationStatus[]).map((s) => {
              const count = closedApps.filter((a) => a.status === s).length;
              if (count === 0) return null;
              const cfg = APPLICATION_STATUS_CONFIG[s];
              return (
                <span key={s} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", cfg.bgColor, cfg.color, cfg.borderColor)}>
                  {cfg.label} {count}
                </span>
              );
            })}
          </span>
        </summary>
        {closedCount === 0 ? (
          <p className="px-4 pb-4 text-xs text-gray-400">No closed jobs yet.</p>
        ) : (
          <div className="px-4 pb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {closedApps.map((app) => {
              const cfg = APPLICATION_STATUS_CONFIG[app.status as ApplicationStatus] ?? APPLICATION_STATUS_CONFIG.draft;
              return (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-[#E8DDD1] hover:border-primary-200 transition-colors"
                >
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0", cfg.bgColor, cfg.color, cfg.borderColor)}>
                    {cfg.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{app.companyName}</p>
                    <p className="text-xs text-gray-500 truncate">{app.roleTitle}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </details>
    </div>
  );
}

export default StageLanes;
