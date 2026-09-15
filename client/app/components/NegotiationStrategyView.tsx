import { Card } from "~/components/ui";
import type { NegotiationCoach } from "types";

function formatMoney(n: number | undefined) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/**
 * Shared render of a NegotiationCoach row's strategy, email templates, and
 * conversation scripts — used by both the salary-negotiation list expansion
 * and the single-session detail page.
 */
export function NegotiationStrategyView({ coach }: { coach: NegotiationCoach }) {
  const strategy = coach.strategy;
  const emailTemplates = coach.emailTemplates ?? [];
  const scripts = coach.scripts ?? [];

  return (
    <div className="space-y-6">
      {coach.offerDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 bg-[#FFFBF5] border border-[#E8DDD1] rounded-lg">
            <p className="text-xs text-gray-500">Base</p>
            <p className="font-semibold text-gray-900">{formatMoney(coach.offerDetails.baseSalary)}</p>
          </div>
          {coach.offerDetails.equity != null && (
            <div className="p-3 bg-[#FFFBF5] border border-[#E8DDD1] rounded-lg">
              <p className="text-xs text-gray-500">Equity/yr</p>
              <p className="font-semibold text-gray-900">{formatMoney(coach.offerDetails.equity)}</p>
            </div>
          )}
          {coach.offerDetails.bonus != null && (
            <div className="p-3 bg-[#FFFBF5] border border-[#E8DDD1] rounded-lg">
              <p className="text-xs text-gray-500">Bonus</p>
              <p className="font-semibold text-gray-900">{formatMoney(coach.offerDetails.bonus)}</p>
            </div>
          )}
          {coach.offerDetails.signOn != null && (
            <div className="p-3 bg-[#FFFBF5] border border-[#E8DDD1] rounded-lg">
              <p className="text-xs text-gray-500">Sign-on</p>
              <p className="font-semibold text-gray-900">{formatMoney(coach.offerDetails.signOn)}</p>
            </div>
          )}
        </div>
      )}

      {strategy && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Negotiation Strategy</h4>
          <Card padding="md">
            {strategy.overallApproach && <p className="text-sm text-gray-700 mb-3">{strategy.overallApproach}</p>}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600">Anchor</div>
                <div className="font-bold text-blue-900">{formatMoney(strategy.anchorPoint)}</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-green-600">Target</div>
                <div className="font-bold text-green-900">{formatMoney(strategy.targetPoint)}</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xs text-red-600">Walk Away</div>
                <div className="font-bold text-red-900">{formatMoney(strategy.walkAwayPoint)}</div>
              </div>
            </div>
            {strategy.keyLeveragePoints && strategy.keyLeveragePoints.length > 0 && (
              <div className="mb-3">
                <h5 className="text-sm font-medium text-gray-700 mb-1">Key Leverage Points</h5>
                <ul className="space-y-1">
                  {strategy.keyLeveragePoints.map((lp: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-indigo-500 mt-0.5">•</span> {lp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {strategy.stepByStep && strategy.stepByStep.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Step-by-Step Plan</h5>
                <div className="space-y-2">
                  {strategy.stepByStep.map((step, i) => (
                    <div key={step.step ?? i} className="flex gap-3 items-start">
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">{step.step}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{step.action}</p>
                        {step.script && <p className="text-xs text-gray-500 mt-1 italic">"{step.script}"</p>}
                        {step.tip && <p className="text-xs text-blue-600 mt-1">Tip: {step.tip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {emailTemplates.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Templates</h4>
          <div className="space-y-3">
            {emailTemplates.map((tpl, i) => (
              <Card key={i} padding="md">
                <div className="flex items-center gap-2 mb-2">
                  {tpl.type && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                      {tpl.type.replace(/_/g, " ")}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-700">{tpl.subject}</span>
                </div>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">{tpl.body}</pre>
              </Card>
            ))}
          </div>
        </div>
      )}

      {scripts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Conversation Scripts</h4>
          <div className="space-y-3">
            {scripts.map((script, i) => (
              <Card key={i} padding="md">
                <h5 className="font-medium text-gray-800 mb-2">{script.scenario}</h5>
                {script.opening && <p className="text-sm text-gray-600 mb-2"><strong>Opening:</strong> "{script.opening}"</p>}
                {script.keyPoints && script.keyPoints.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {script.keyPoints.map((kp, ki) => (
                      <li key={ki} className="text-sm text-gray-600">• {kp}</li>
                    ))}
                  </ul>
                )}
                {script.closing && <p className="text-sm text-gray-600 italic">Closing: "{script.closing}"</p>}
                {script.handlingObjections && script.handlingObjections.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Handling Objections</p>
                    <ul className="space-y-1">
                      {script.handlingObjections.map((obj, oi) => (
                        <li key={oi} className="text-sm text-gray-600">• {obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {!strategy && emailTemplates.length === 0 && scripts.length === 0 && (
        <p className="text-sm text-gray-400">This session has no generated content yet.</p>
      )}
    </div>
  );
}

export default NegotiationStrategyView;
