import { cn } from "~/lib/utils";
import { Card } from "~/components/ui";
import type { First90DaysTracker, First90EarlyWin, First90FeedbackLoop, First90Phase } from "types";

/**
 * The server stores a tracker as phase-grouped milestones (learning →
 * contributing → leading), feedback loops, and early wins — see
 * buildFirst90DaysPrompt in server/src/post-onboarding/prompts.ts. This
 * renders that shape; the list page previously rendered a "phases" shape
 * that no server path ever produced.
 */

const PHASE_STYLES: Record<string, { label: string; chip: string; bar: string }> = {
  learning: { label: "Learning", chip: "bg-blue-50 text-blue-700 border-blue-100", bar: "bg-blue-500" },
  contributing: { label: "Contributing", chip: "bg-purple-50 text-purple-700 border-purple-100", bar: "bg-purple-500" },
  leading: { label: "Leading", chip: "bg-green-50 text-green-700 border-green-100", bar: "bg-green-500" },
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-100",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-100",
  low: "bg-green-50 text-green-700 border-green-100",
};

function EmptyList({ title, children }: { title: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) && children.length > 0;
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
      {hasContent ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="text-xs text-gray-400">Nothing here yet.</p>
      )}
    </div>
  );
}

export function First90PlanView({ tracker }: { tracker: First90DaysTracker }) {
  const milestones: First90Phase[] = Array.isArray(tracker.milestones) ? tracker.milestones : [];
  const feedbackLoops: First90FeedbackLoop[] = Array.isArray(tracker.feedbackLoops) ? tracker.feedbackLoops : [];
  const earlyWins: First90EarlyWin[] = Array.isArray(tracker.earlyWins) ? tracker.earlyWins : [];

  const totalItems = milestones.reduce((sum, m) => sum + (m.goals?.length || 0) + (m.deliverables?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Phases — the core of the plan */}
      <div className="space-y-4">
        {milestones.length === 0 && (
          <p className="text-sm text-gray-400">No milestones were generated for this plan yet.</p>
        )}
        {milestones.map((phase, i) => {
          const style = PHASE_STYLES[phase.phase] ?? PHASE_STYLES.learning;
          return (
            <Card key={phase.phase || i} padding="md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border", style.chip)}>
                    {style.label}
                  </span>
                  {phase.timeframe && <span className="text-xs text-gray-500">{phase.timeframe}</span>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Goals</p>
                  <ul className="space-y-1">
                    {(phase.goals || []).map((g, gi) => (
                      <li key={gi} className="text-gray-700 flex items-start gap-1.5">
                        <span className="text-primary-400 mt-0.5">•</span> {g}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Deliverables</p>
                  <ul className="space-y-1">
                    {(phase.deliverables || []).map((d, di) => (
                      <li key={di} className="text-gray-700 flex items-start gap-1.5">
                        <span className="text-primary-400 mt-0.5">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Success Criteria</p>
                  <ul className="space-y-1">
                    {(phase.successCriteria || []).map((s, si) => (
                      <li key={si} className="text-gray-700 flex items-start gap-1.5">
                        <span className="text-primary-400 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Feedback loops */}
      <EmptyList title="Feedback Loops">
        {feedbackLoops.map((f, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900">{f.type}</span>
              {f.frequency && <span className="text-xs text-gray-500">· {f.frequency}</span>}
            </div>
            {f.purpose && <p className="text-gray-600">{f.purpose}</p>}
            {(f.participants?.length ?? 0) > 0 && (
              <p className="text-xs text-gray-500 mt-1">With: {f.participants?.join(", ")}</p>
            )}
          </div>
        ))}
      </EmptyList>

      {/* Early wins */}
      <EmptyList title="Early Wins">
        {earlyWins.map((w, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-gray-900">{w.opportunity}</span>
              {w.impact && (
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border", IMPACT_STYLES[w.impact] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                  {w.impact} impact
                </span>
              )}
              {w.effort && <span className="text-xs text-gray-500">· {w.effort} effort</span>}
              {w.timeframe && <span className="text-xs text-gray-500">· {w.timeframe}</span>}
            </div>
            {(w.steps?.length ?? 0) > 0 && (
              <ul className="mt-1 space-y-0.5">
                {w.steps?.map((s, si) => (
                  <li key={si} className="text-gray-600 text-xs flex items-start gap-1.5">
                    <span className="text-gray-300 mt-0.5">{si + 1}.</span> {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </EmptyList>

      {totalItems === 0 && feedbackLoops.length === 0 && earlyWins.length === 0 && (
        <p className="text-xs text-gray-400">
          This plan looks empty — it may have been generated before milestone storage was in place. Delete and recreate it to get a fresh plan.
        </p>
      )}
    </div>
  );
}

export default First90PlanView;
