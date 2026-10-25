export const TASK_SECTIONS = Object.freeze({
  QUANT: "Quant",
  VARC: "VARC",
  DILR: "DILR",
  REVISION: "Revision",
  MOCK_TEST: "Mock_test",
  OTHER: "Other",
});

export const TASK_SECTION_VALUES = Object.freeze(
  Object.values(TASK_SECTIONS),
);

export const TASK_STATUSES = Object.freeze({
  PENDING: "Pending",
  NOT_STARTED: "Not_Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  NOT_DONE: "Not_Done",
  SKIPPED: "Skipped",
  RESCHEDULED: "Rescheduled",
});

export const TASK_STATUS_VALUES = Object.freeze(
  Object.values(TASK_STATUSES),
);

export const TASK_PRIORITIES = Object.freeze({
  MUST_DO: "Must do",
  SHOULD_DO: "Shoud do",
  BONUS: "Bonus",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
});

export const TASK_PRIORITY_VALUES = Object.freeze(
  Object.values(TASK_PRIORITIES),
);
