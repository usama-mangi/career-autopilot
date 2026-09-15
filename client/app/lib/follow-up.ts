import type { FollowUpEmail, FollowUpEmailGenerateRequest, InterviewNote } from "types";

/**
 * Suggests the follow-up email type and send-timing guidance for one of a
 * note's follow-up items, from the note's interview date and what has
 * already been drafted or sent: materials asks map to their own type;
 * otherwise the first touch after an interview is a thank-you (best
 * same-day), and once that exists the next touch is a check-in around the
 * one-week mark.
 */
export function suggestFollowUp(
  note: InterviewNote,
  item: string,
  existingEmails: FollowUpEmail[],
): { type: FollowUpEmailGenerateRequest["type"]; timing: string } {
  const daysSinceInterview = Math.floor(
    (Date.now() - new Date(note.interviewDate).getTime()) / 86400000,
  );
  const lowerItem = item.toLowerCase();
  const itemSays = (words: string[]) => words.some((w) => lowerItem.includes(w));
  const sent = existingEmails.filter((e) => e.interviewNoteId === note.id);
  const hasThankYou = sent.some((e) => e.type === "thank_you");
  const hasCheckIn = sent.some((e) => e.type === "check_in");

  // Materials asks have their own type and no timing pressure.
  if (itemSays(["portfolio", "materials", "repo", "code sample", "work sample", "writing sample", "link"])) {
    return { type: "additional_materials", timing: "Anytime — the sooner they can look, the better." };
  }

  // Availability / scheduling back-and-forth is bespoke, not a template.
  if (itemSays(["availab", "schedule", "reschedule", "time slot"])) {
    return { type: "custom", timing: "Reply within a day so scheduling doesn't stall." };
  }

  // First touch after an interview: the thank-you, best same-day.
  if (!hasThankYou && (itemSays(["thank"]) || daysSinceInterview <= 2)) {
    const timing =
      daysSinceInterview <= 0
        ? "Send today — same-day thank-yous land best."
        : daysSinceInterview === 1
          ? "Send today — you're inside the 48-hour window."
          : "Late, but better late than never — keep it short.";
    return { type: "thank_you", timing };
  }

  // After the thank-you: the one-week check-in.
  const timing =
    daysSinceInterview < 5
      ? "Give it a few more days — a week after the interview is the sweet spot."
      : daysSinceInterview <= 10
        ? "The one-week mark is now — a good time to check in."
        : hasCheckIn
          ? "Second check-in — keep it short and add something new."
          : "Overdue — every week of silence lowers your odds a little.";
  return { type: "check_in", timing };
}
