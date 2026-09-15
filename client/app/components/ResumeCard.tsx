import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { getUploadUrl } from "~/lib/api";
import { Card, Button } from "~/components/ui";
import type { ResumeFormat, GeneratedResume, ApplicationStatus as GlobalApplicationStatus } from "types";

export type ResumeApplicationStatus = GlobalApplicationStatus | "not_applied";

const STATUS_CONFIG: Record<
  ResumeApplicationStatus,
  { label: string; color: string; bgColor: string }
> = {
  not_applied: { label: "Not Applied", color: "text-gray-600", bgColor: "bg-gray-100" },
  draft: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  applied: { label: "Applied", color: "text-primary-600", bgColor: "bg-primary-50" },
  phone_screen: { label: "Phone Screen", color: "text-info", bgColor: "bg-info-50" },
  interviewing: { label: "Interviewing", color: "text-warning", bgColor: "bg-warning-light" },
  offer: { label: "Offer", color: "text-success", bgColor: "bg-success-light" },
  rejected: { label: "Rejected", color: "text-danger", bgColor: "bg-danger-light" },
  accepted: { label: "Accepted", color: "text-success", bgColor: "bg-success-light" },
  withdrawn: { label: "Withdrawn", color: "text-gray-400", bgColor: "bg-gray-100" },
};

function StatusBadge({
  status,
  id,
  onStatusChange,
}: {
  status: string;
  id: string;
  onStatusChange?: (id: string, status: ResumeApplicationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUS_CONFIG[(status as ResumeApplicationStatus) ?? "not_applied"] ?? STATUS_CONFIG.not_applied;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((o) => !o);
  }

  function handleSelect(e: React.MouseEvent, value: ResumeApplicationStatus) {
    e.preventDefault();
    e.stopPropagation();
    onStatusChange?.(id, value);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className={`text-xs font-semibold rounded-full ${current.color}`}
      >
        {current.label}
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[160px] py-1 animate-in fade-in duration-150">
          {(Object.entries(STATUS_CONFIG) as [ResumeApplicationStatus, { label: string; color: string; bgColor: string }][]).map(
            ([value, { label, bgColor }]) => (
              <button
                key={value}
                onClick={(e) => handleSelect(e, value)}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
              >
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bgColor} ${STATUS_CONFIG[value].color}`}>
                  {label}
                </span>
                {value === status && <span className="ml-auto text-gray-400 text-xs">✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

const FORMAT_BADGE_COLORS: Record<string, string> = {
  pdf: "bg-badge-green text-badge-green-text",
  docx: "bg-badge-blue text-badge-blue-text",
  txt: "bg-badge-yellow text-badge-yellow-text",
  html: "bg-badge-neutral text-badge-neutral-text",
  linkedin: "bg-badge-blue text-badge-blue-text",
  generated: "bg-badge-neutral text-badge-neutral-text",
};

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  html: "HTML",
  linkedin: "LinkedIn",
  generated: "AI",
};

interface ResumeCardProps {
  resume: {
    id: string;
    feedback?: { overallScore?: number; ATS?: { score?: number } };
    imagePath?: string;
    companyName?: string;
    jobTitle?: string;
    format?: ResumeFormat;
    textPreview?: string;
    applicationStatus?: string;
    generatedContent?: GeneratedResume;
  };
  onStatusChange?: (id: string, status: ResumeApplicationStatus) => void;
  onDelete?: (id: string) => void;
}

export default function ResumeCard({ resume, onStatusChange, onDelete }: ResumeCardProps) {
  const navigate = useNavigate();
  const { id, feedback, imagePath, companyName, jobTitle, format, textPreview, applicationStatus, generatedContent } = resume;
  const gc = generatedContent;
  const displayFormat = gc ? "generated" : (format || "txt");
  const badgeColor = FORMAT_BADGE_COLORS[displayFormat] || "bg-gray-100 text-gray-700";
  const badgeLabel = FORMAT_LABELS[displayFormat] || displayFormat.toUpperCase();
  const resumeURL = imagePath ? getUploadUrl(`resumes/${imagePath}`) : "";
  const textContent = textPreview || null;
  const score = feedback?.ATS?.score ?? feedback?.overallScore ?? 0;

  return (
    <div
      className="block cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, [role='button']")) return;
        navigate(`/resumes/${id}`);
      }}
    >
      <Card hover className="flex flex-col h-full animate-in fade-in duration-300">
        {/* Preview section */}
        {format === "pdf" && resumeURL ? (
          <div className="rounded-lg overflow-hidden border border-gray-100 mb-3">
            <img src={resumeURL} alt="resume" className="w-full h-[200px] object-cover object-top" />
          </div>
        ) : gc ? (
          <div className="rounded-lg border border-gray-100 bg-white p-4 mb-3 h-[200px] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none z-10" />
            <div className="text-center mb-2">
              <p className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">
                {gc.basics?.name || jobTitle || "Your Name"}
              </p>
              {gc.basics?.headline && (
                <p className="text-[9px] text-gray-500 truncate">{gc.basics.headline}</p>
              )}
            </div>
            {gc.skills?.length > 0 && (
              <div className="mb-2">
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Skills</p>
                <div className="flex flex-wrap gap-0.5">
                  {gc.skills.slice(0, 6).map((s, i) => (
                    <span key={i} className="text-[7px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {typeof s === "string" ? s : s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {gc.experience?.length > 0 && (
              <div>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Experience</p>
                {gc.experience.slice(0, 2).map((exp, i) => (
                  <p key={i} className="text-[8px] text-gray-600 truncate">
                    {exp.title}{exp.company ? ` at ${exp.company}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : textContent ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 mb-3">
            <p className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Preview</p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-[8] font-sans">
              {textContent}
            </pre>
          </div>
        ) : null}

        {/* Info section */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {companyName && (
                <h3 className="text-base font-bold text-gray-900 truncate">{companyName}</h3>
              )}
              {!companyName && !jobTitle && <h3 className="text-base font-bold text-gray-900">Resume</h3>}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
                {badgeLabel}
              </span>
              {score > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  score >= 70 ? "bg-emerald-50 text-emerald-700" :
                  score >= 40 ? "bg-amber-50 text-amber-700" :
                  "bg-red-50 text-red-600"
                }`}>
                  {score}
                </span>
              )}
            </div>
            {jobTitle && <p className="text-sm text-gray-500 truncate">{jobTitle}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100"
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <StatusBadge
            status={applicationStatus ?? "not_applied"}
            id={id}
            onStatusChange={onStatusChange}
          />
          <div className="flex items-center gap-1">
            <a
              href={`/resumes/${id}/edit`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/resumes/${id}/edit`); }}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </a>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(id); }}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
