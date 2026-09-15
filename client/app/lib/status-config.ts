export type ApplicationStatus =
  | "draft"
  | "applied"
  | "phone_screen"
  | "interviewing"
  | "offer"
  | "rejected"
  | "accepted"
  | "withdrawn";

export type OfferStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "declined"
  | "expired";

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const APPLICATION_STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  draft: {
    label: "Draft",
    color: "text-gray-600",
    bgColor: "bg-[#F5EDE4]",
    borderColor: "border-[#E8DDD1]",
  },
  applied: {
    label: "Applied",
    color: "text-primary-600",
    bgColor: "bg-primary-50",
    borderColor: "border-primary-100",
  },
  phone_screen: {
    label: "Phone Screen",
    color: "text-info",
    bgColor: "bg-info-50",
    borderColor: "border-info-100",
  },
  interviewing: {
    label: "Interviewing",
    color: "text-warning",
    bgColor: "bg-warning-50",
    borderColor: "border-warning-100",
  },
  offer: {
    label: "Offer",
    color: "text-success",
    bgColor: "bg-success-50",
    borderColor: "border-success-100",
  },
  rejected: {
    label: "Rejected",
    color: "text-danger",
    bgColor: "bg-danger-50",
    borderColor: "border-danger-100",
  },
  accepted: {
    label: "Accepted",
    color: "text-success",
    bgColor: "bg-success-50",
    borderColor: "border-success-100",
  },
  withdrawn: {
    label: "Withdrawn",
    color: "text-gray-400",
    bgColor: "bg-[#F5EDE4]",
    borderColor: "border-[#E8DDD1]",
  },
};

export const OFFER_STATUS_CONFIG: Record<OfferStatus, StatusConfig> = {
  pending: {
    label: "Pending",
    color: "text-warning",
    bgColor: "bg-warning-50",
    borderColor: "border-warning-100",
  },
  negotiating: {
    label: "Negotiating",
    color: "text-info",
    bgColor: "bg-info-50",
    borderColor: "border-info-100",
  },
  accepted: {
    label: "Accepted",
    color: "text-success",
    bgColor: "bg-success-50",
    borderColor: "border-success-100",
  },
  declined: {
    label: "Declined",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
  },
  expired: {
    label: "Expired",
    color: "text-danger",
    bgColor: "bg-danger-50",
    borderColor: "border-danger-100",
  },
};

/**
 * The active pipeline is a journey, not a board: five ordered stages a job
 * moves through while it is live. Closed outcomes live in the archive so the
 * board only ever shows the six columns a user acts on, never eight.
 */
export const ACTIVE_STAGES: ApplicationStatus[] = [
  "draft",
  "applied",
  "phone_screen",
  "interviewing",
  "offer",
];

/** Terminal statuses that leave the active board and move to the archive. */
export const CLOSED_STATUSES: ApplicationStatus[] = ["rejected", "accepted", "withdrawn"];

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.includes(status as ApplicationStatus);
}

/** Short "what happens here" hint shown under each stage lane. */
export const STAGE_HINTS: Record<ApplicationStatus, string> = {
  draft: "Tailor resume & cover letter",
  applied: "Waiting to hear back",
  phone_screen: "First conversation",
  interviewing: "Rounds in progress",
  offer: "Evaluate & negotiate",
  rejected: "",
  accepted: "",
  withdrawn: "",
};

export const PIPELINE_STATUSES: ApplicationStatus[] = [
  "draft",
  "applied",
  "phone_screen",
  "interviewing",
  "offer",
  "rejected",
  "accepted",
  "withdrawn",
];

export function getNextStatuses(current: ApplicationStatus): ApplicationStatus[] {
  const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
    draft: ["applied", "withdrawn"],
    applied: ["phone_screen", "rejected", "withdrawn"],
    phone_screen: ["interviewing", "rejected", "withdrawn"],
    interviewing: ["offer", "rejected", "withdrawn"],
    offer: ["accepted", "rejected", "withdrawn"],
    // Reopen paths so rejected/withdrawn jobs are not dead ends — reapplying
    // or returning to a role months later is a normal part of a job hunt.
    rejected: ["applied", "withdrawn"],
    withdrawn: ["applied"],
    accepted: [],
  };
  return transitions[current] || [];
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
