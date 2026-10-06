import { createXmlParser } from "@/lib/studentvue/parse";

// Converts Synergy Gradebook XML into the JSON shape returned by the StudentVUE (New) JSON API
// (camelCased keys, plain arrays: courses[].marks[].assignments[]; values as strings).

type Obj = Record<string, unknown>;
const CONTAINERS: Record<string, string> = {
  ReportingPeriods: "ReportPeriod",
  Courses: "Course",
  Marks: "Mark",
  Assignments: "Assignment",
};

const lowerFirst = (k: string) => k.charAt(0).toLowerCase() + k.slice(1);

function convert(node: unknown, calcStyle: "wrapped" | "array"): unknown {
  if (Array.isArray(node)) return node.map((n) => convert(n, calcStyle));
  if (node === null || typeof node !== "object") return node === "" ? null : node;
  const out: Obj = {};
  for (const [k, v] of Object.entries(node as Obj)) {
    if (k.startsWith("xmlns")) continue;
    if (CONTAINERS[k]) {
      const inner = v && typeof v === "object" ? (v as Obj)[CONTAINERS[k]] : undefined;
      out[lowerFirst(k)] = inner ? (convert(inner, calcStyle) as unknown[]) : [];
    } else if (k === "GradeCalculationSummary") {
      const rows = v && typeof v === "object" ? ((v as Obj).AssignmentGradeCalc ?? []) : [];
      const converted = convert(rows, calcStyle);
      out.gradeCalculationSummary = calcStyle === "array" ? converted : { assignmentGradeCalc: converted };
    } else {
      out[lowerFirst(k)] = convert(v, calcStyle);
    }
  }
  return out;
}

export function xmlToJsonGradebook(innerXml: string, calcStyle: "wrapped" | "array" = "wrapped") {
  const doc = createXmlParser().parse(innerXml) as Obj;
  return convert(doc.Gradebook, calcStyle) as Obj;
}
