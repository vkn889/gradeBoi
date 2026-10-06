// Shared data model. Every gradebook adapter returns this shape (see SRD "Data model").

export type ReportPeriod = {
  index: number;
  name: string;
  start: string;
  end: string;
};

export type Gradebook = {
  reportPeriods: ReportPeriod[];
  currentPeriod: number;
  courses: Course[];
};

export type CourseLevel = "regular" | "honors" | "ap";

export type Course = {
  /** period + title, stable across loads */
  id: string;
  period: number;
  title: string;
  teacher: string;
  teacherEmail?: string;
  room?: string;
  level: CourseLevel;
  official: { percent: number | null; letter: string | null };
  /** false = total points */
  weighted: boolean;
  categories: Category[];
  assignments: Assignment[];
};

export type Category = {
  name: string;
  /** 0 to 100 */
  weight: number;
};

export type AssignmentStatus =
  | "graded"
  | "ungraded"
  | "missing"
  | "late"
  | "excused"
  | "notForGrading";

export type Assignment = {
  /** GradebookID, or "h-<uuid>" if hypothetical */
  id: string;
  name: string;
  category: string;
  date: string;
  dueDate?: string;
  /** null = not graded */
  score: number | null;
  possible: number;
  status: AssignmentStatus;
  notes?: string;
  isHypothetical?: boolean;
  isEdited?: boolean;
};

export type ApiError = { error: { code: string; message: string } };

/** A document published to the student in StudentVUE (transcript, report card, letters, ...). */
export type StudentDocument = {
  id: string;
  /** display name (StudentVUE's comment, else its type) */
  name: string;
  type: string;
  /** ISO date, or the raw string when unparseable */
  date: string;
  fileName?: string;
  isTranscript: boolean;
};

export type DocumentFile = {
  fileName: string;
  contentType: string;
  data: Uint8Array;
};
