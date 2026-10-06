import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  StudentVueError,
  decodeXmlEntities,
  extractSoapResult,
  parseDistricts,
  parseGradebook,
  parseScore,
  parseStudentName,
  toIsoDate,
} from "@/lib/studentvue/parse";
import { demoGradebookXml, wrapSoapEnvelope } from "@/lib/demo/generate";

const edge = readFileSync(join(__dirname, "../fixtures/edge-cases.xml"), "utf8");

describe("parseScore (SRD parsing rules)", () => {
  it("parses 'x / y' points as graded", () => {
    expect(parseScore("8.00 / 10.0000", "", "")).toEqual({ score: 8, possible: 10, status: "graded" });
  });
  it("parses 'Points Possible' as ungraded", () => {
    expect(parseScore("10.0000 Points Possible", "", "")).toEqual({ score: null, possible: 10, status: "ungraded" });
  });
  it("treats 'Not Graded' and blank as ungraded", () => {
    expect(parseScore("", "Not Graded", "").status).toBe("ungraded");
    expect(parseScore("", "", "").status).toBe("ungraded");
  });
  it("treats 'Not for Grading' as notForGrading", () => {
    expect(parseScore("", "Not for Grading", "").status).toBe("notForGrading");
  });
  it("parses percent-only scores as x / 100", () => {
    expect(parseScore("", "85%", "")).toEqual({ score: 85, possible: 100, status: "graded" });
  });
  it("parses 'x out of y' when Points is missing", () => {
    expect(parseScore("", "9 out of 10", "")).toEqual({ score: 9, possible: 10, status: "graded" });
  });
  it("marks missing and late from notes", () => {
    expect(parseScore("0.00 / 10.0000", "", "Missing").status).toBe("missing");
    expect(parseScore("10.00 / 10.0000", "", "Turned in Late").status).toBe("late");
    expect(parseScore("10.00 / 10.0000", "", "translated").status).toBe("graded");
  });
  it("marks excused", () => {
    expect(parseScore("5.0000 Points Possible", "Excused", "").status).toBe("excused");
  });
  it("handles thousands separators", () => {
    expect(parseScore("1,000.00 / 1,000.0000", "", "")).toEqual({ score: 1000, possible: 1000, status: "graded" });
  });
});

describe("toIsoDate", () => {
  it("converts US dates", () => {
    expect(toIsoDate("9/5/2026")).toBe("2026-09-05");
    expect(toIsoDate("2026-09-05")).toBe("2026-09-05");
  });
});

describe("decodeXmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeXmlEntities("&lt;a b=&quot;1&quot;&gt;&amp;amp;&#65;&#x42;&apos;")).toBe('<a b="1">&amp;AB\'');
  });
});

describe("extractSoapResult", () => {
  it("unescapes the inner result (parse twice)", () => {
    const inner = '<Gradebook ErrorMessage=""><Courses /></Gradebook>';
    expect(extractSoapResult(wrapSoapEnvelope(inner))).toBe(inner);
  });
  it("throws on malformed input", () => {
    expect(() => extractSoapResult("not xml at all")).toThrow(StudentVueError);
  });
  it("throws upstream error on SOAP fault", () => {
    const fault =
      '<soap:Envelope xmlns:soap="x"><soap:Body><soap:Fault><faultstring>Server was unable</faultstring></soap:Fault></soap:Body></soap:Envelope>';
    expect(() => extractSoapResult(fault)).toThrow(/error/i);
  });
  it("handles very large escaped payloads", () => {
    const inner = demoGradebookXml(1, new Date(2026, 9, 5)).repeat(1);
    const big = wrapSoapEnvelope(inner.replace("<Courses>", "<Courses>" + "<!-- pad -->".repeat(20000)));
    expect(extractSoapResult(big).length).toBeGreaterThan(200_000);
  });
});

describe("parseGradebook", () => {
  it("maps RT_ERROR with a password message to BAD_CREDENTIALS", () => {
    try {
      parseGradebook('<RT_ERROR ERROR_MESSAGE="Invalid user id or password"><STACK_TRACE /></RT_ERROR>');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(StudentVueError);
      expect((e as StudentVueError).code).toBe("BAD_CREDENTIALS");
    }
  });
  it("maps other RT_ERRORs to UPSTREAM_ERROR", () => {
    expect(() => parseGradebook('<RT_ERROR ERROR_MESSAGE="Service temporarily down" />')).toThrow(
      expect.objectContaining({ code: "UPSTREAM_ERROR" }),
    );
  });
  it("throws MALFORMED when there is no Gradebook element", () => {
    expect(() => parseGradebook("<Something />")).toThrow(expect.objectContaining({ code: "MALFORMED" }));
  });

  const gb = parseGradebook(edge);

  it("parses reporting periods and the current period", () => {
    expect(gb.reportPeriods).toHaveLength(2);
    expect(gb.reportPeriods[0]).toEqual({ index: 0, name: "Quarter 1", start: "2026-09-03", end: "2026-11-07" });
    expect(gb.currentPeriod).toBe(0);
  });

  it("parses course metadata and decodes entities", () => {
    const bio = gb.courses[0];
    expect(bio.id).toBe("1-Biology & Lab (SCI101)");
    expect(bio.title).toBe("Biology & Lab (SCI101)");
    expect(bio.teacher).toBe("Doe, Jane");
    expect(bio.teacherEmail).toBe("jdoe@example.org");
    expect(bio.room).toBe("12");
    expect(bio.level).toBe("regular");
    expect(bio.official).toEqual({ percent: 87, letter: "B+" });
  });

  it("skips the TOTAL row and reads weights", () => {
    const bio = gb.courses[0];
    expect(bio.weighted).toBe(true);
    expect(bio.categories).toEqual([
      { name: "Tests", weight: 70 },
      { name: "Homework", weight: 30 },
      { name: "Projects", weight: 0 },
    ]);
  });

  it("parses each assignment per the rules", () => {
    const a = Object.fromEntries(gb.courses[0].assignments.map((x) => [x.id, x]));
    expect(a["9001"]).toMatchObject({ score: 80, possible: 100, status: "graded", date: "2026-09-20", dueDate: "2026-09-20" });
    expect(a["9003"]).toMatchObject({ score: null, possible: 10, status: "ungraded" });
    expect(a["9004"]).toMatchObject({ score: null, status: "missing", notes: "Missing" });
    expect(a["9005"]).toMatchObject({ score: 2, possible: 0, status: "graded" });
    expect(a["9006"]).toMatchObject({ status: "notForGrading" });
    expect(a["9007"]).toMatchObject({ score: 20, status: "late" });
    expect(a["9008"]).toMatchObject({ status: "excused" });
  });

  it("treats a course with no calc rows as points-based and detects AP", () => {
    const psych = gb.courses[1];
    expect(psych.weighted).toBe(false);
    expect(psych.level).toBe("ap");
    expect(psych.teacherEmail).toBeUndefined();
    expect(psych.assignments.find((x) => x.id === "9101")).toMatchObject({ score: 85, possible: 100 });
  });

  it("handles a course with no assignments or grade", () => {
    const sh = gb.courses[2];
    expect(sh.assignments).toEqual([]);
    expect(sh.official).toEqual({ percent: null, letter: null });
  });

  it("forces single elements to arrays", () => {
    const one = parseGradebook(
      '<Gradebook ErrorMessage=""><ReportingPeriods><ReportPeriod Index="0" GradePeriod="S1" StartDate="" EndDate="" /></ReportingPeriods>' +
        '<Courses><Course Period="1" Title="Art" Staff="A"><Marks><Mark CalculatedScoreRaw="100"><GradeCalculationSummary><AssignmentGradeCalc Type="All" Weight="100%" /></GradeCalculationSummary>' +
        '<Assignments><Assignment GradebookID="1" Measure="X" Type="All" Date="1/1/2026" Points="5 / 5" /></Assignments></Mark></Marks></Course></Courses></Gradebook>',
    );
    expect(one.reportPeriods).toHaveLength(1);
    expect(one.courses).toHaveLength(1);
    expect(one.courses[0].assignments).toHaveLength(1);
    expect(one.courses[0].categories).toEqual([{ name: "All", weight: 100 }]);
  });

  it("surfaces a Gradebook ErrorMessage", () => {
    expect(() => parseGradebook('<Gradebook ErrorMessage="Grades are not available" />')).toThrow(
      expect.objectContaining({ code: "UPSTREAM_ERROR" }),
    );
  });
});

describe("parseStudentName / parseDistricts", () => {
  it("reads the student's name", () => {
    expect(parseStudentName("<StudentInfo><FormattedName>Jamie Lee</FormattedName><NickName /></StudentInfo>")).toBe(
      "Jamie Lee",
    );
    expect(parseStudentName("<StudentInfo><NickName>JJ</NickName><FormattedName>Jamie Lee</FormattedName></StudentInfo>")).toBe("JJ");
  });
  it("throws BAD_CREDENTIALS for StudentInfo RT_ERROR", () => {
    expect(() => parseStudentName('<RT_ERROR ERROR_MESSAGE="Invalid user id or password" />')).toThrow(
      expect.objectContaining({ code: "BAD_CREDENTIALS" }),
    );
  });
  it("parses district lists", () => {
    const xml =
      '<DistrictLists><DistrictInfos><DistrictInfo DistrictID="1" Name="Northshore School District" Address="Bothell WA 98011" PvueURL="https://wa-nor-psv.edupoint.com" /></DistrictInfos></DistrictLists>';
    expect(parseDistricts(xml)).toEqual([
      { name: "Northshore School District", url: "https://wa-nor-psv.edupoint.com", address: "Bothell WA 98011" },
    ]);
    expect(parseDistricts("<DistrictLists><DistrictInfos /></DistrictLists>")).toEqual([]);
  });
});

describe("parseJsonGradebook (StudentVUE (New) JSON API)", () => {
  it("produces exactly the same model as the XML parser", async () => {
    const { parseJsonGradebook } = await import("@/lib/studentvue/parse");
    const { xmlToJsonGradebook } = await import("../helpers/json-gradebook");
    for (const xml of [edge, demoGradebookXml(1, new Date(2026, 9, 5)), demoGradebookXml(0, new Date(2026, 9, 5))]) {
      const fromXml = parseGradebook(xml);
      expect(parseJsonGradebook(xmlToJsonGradebook(xml, "wrapped"))).toEqual(fromXml);
      expect(parseJsonGradebook(xmlToJsonGradebook(xml, "array"))).toEqual(fromXml);
    }
  });

  it("tolerates numbers, PascalCase keys, and missing containers", async () => {
    const { parseJsonGradebook } = await import("@/lib/studentvue/parse");
    const gb = parseJsonGradebook({
      ErrorMessage: null,
      reportingPeriods: [{ index: 0, gradePeriod: "S1", startDate: "9/1/2026", endDate: "1/20/2027" }],
      courses: [
        {
          period: 2,
          Title: "AP Biology",
          staff: "Kim, Ana",
          staffEMail: "akim@example.org",
          marks: [
            {
              calculatedScoreRaw: 88.5,
              calculatedScoreString: "B+",
              gradeCalculationSummary: null,
              assignments: [{ gradebookID: 7, measure: "Lab", type: "Labs", date: "9/9/2026", points: "8.5 / 10", score: "", notes: null }],
            },
          ],
        },
      ],
    });
    expect(gb.reportPeriods[0]).toMatchObject({ index: 0, name: "S1", start: "2026-09-01" });
    expect(gb.courses[0]).toMatchObject({ period: 2, title: "AP Biology", level: "ap", weighted: false, teacherEmail: "akim@example.org" });
    expect(gb.courses[0].assignments[0]).toMatchObject({ id: "7", score: 8.5, possible: 10, status: "graded" });
  });

  it("rejects a missing gradebook", async () => {
    const { parseJsonGradebook } = await import("@/lib/studentvue/parse");
    expect(() => parseJsonGradebook(null)).toThrow(expect.objectContaining({ code: "MALFORMED" }));
  });

  it("recognises Synergy 2027's SOAP deprecation error", () => {
    expect(() =>
      parseGradebook('<RT_ERROR ERROR_MESSAGE="This app is deprecated. To continue, please download StudentVUE (New). Error code: D5518-00." />'),
    ).toThrow(expect.objectContaining({ code: "DEPRECATED" }));
  });
});
