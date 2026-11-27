export const MAX_ISSUE_DESCRIPTION_LENGTH = 2500;

export const ISSUE_STATUSES = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];
