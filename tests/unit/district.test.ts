import { describe, expect, it } from "vitest";
import { allowedDomains, isAllowedHost, normalizeDistrictUrl, validateDistrictUrl } from "@/lib/studentvue/district";
import { buildEnvelope, xmlEscape } from "@/lib/studentvue/soap";
import { gradebookParams } from "@/lib/studentvue/adapter";
import { RateLimiter } from "@/lib/server/rate-limit";

describe("district URL normalization", () => {
  it("normalizes to https + host", () => {
    expect(normalizeDistrictUrl("wa-nor-psv.edupoint.com")).toBe("https://wa-nor-psv.edupoint.com");
    expect(normalizeDistrictUrl("http://WA-NOR-PSV.edupoint.com/PXP2_Login_Student.aspx?regenerateSessionId=True")).toBe(
      "https://wa-nor-psv.edupoint.com",
    );
    expect(normalizeDistrictUrl("https://wa-nor-psv.edupoint.com/")).toBe("https://wa-nor-psv.edupoint.com");
  });
  it("rejects junk, IPs, credentials, odd ports", () => {
    expect(normalizeDistrictUrl("")).toBeNull();
    expect(normalizeDistrictUrl("localhost")).toBeNull();
    expect(normalizeDistrictUrl("http://127.0.0.1")).toBeNull();
    expect(normalizeDistrictUrl("https://user:pw@x.edupoint.com")).toBeNull();
    expect(normalizeDistrictUrl("https://x.edupoint.com:8080")).toBeNull();
    expect(normalizeDistrictUrl("ftp://x.edupoint.com")).toBeNull();
  });
  it("only allows known domains", () => {
    expect(validateDistrictUrl("wa-nor-psv.edupoint.com")).toBe("https://wa-nor-psv.edupoint.com");
    expect(validateDistrictUrl("evil.com")).toBeNull();
    expect(validateDistrictUrl("edupoint.com.evil.com")).toBeNull();
    expect(validateDistrictUrl("notedupoint.com")).toBeNull();
    expect(isAllowedHost("https://sis.district.org", ["district.org"])).toBe(true);
    expect(isAllowedHost("not a url", ["district.org"])).toBe(false);
    expect(allowedDomains(" .district.org, *.other.net ,")).toEqual(["edupoint.com", "district.org", "other.net"]);
  });
});

describe("SOAP envelope", () => {
  it("escapes credentials and params", () => {
    expect(xmlEscape(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&apos;");
    const env = buildEnvelope({
      userID: "stu<1>",
      password: "p&ss",
      webServiceHandleName: "PXPWebServices",
      methodName: "Gradebook",
      paramStr: gradebookParams(2),
    });
    expect(env).toContain("<userID>stu&lt;1&gt;</userID>");
    expect(env).toContain("<password>p&amp;ss</password>");
    expect(env).toContain("<skipLoginLog>1</skipLoginLog><parent>0</parent>");
    expect(env).toContain("&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;&lt;ReportPeriod&gt;2&lt;/ReportPeriod&gt;&lt;/Parms&gt;");
  });
  it("omits ReportPeriod for the current period", () => {
    expect(gradebookParams()).toBe("<Parms><ChildIntID>0</ChildIntID></Parms>");
    expect(gradebookParams(-1)).toBe("<Parms><ChildIntID>0</ChildIntID></Parms>");
  });
});

describe("RateLimiter", () => {
  it("limits per key within a window", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect(rl.hit("a").ok).toBe(true);
    expect(rl.hit("a").ok).toBe(true);
    expect(rl.hit("a").ok).toBe(false);
    expect(rl.hit("b").ok).toBe(true);
    t = 1001;
    expect(rl.hit("a").ok).toBe(true);
  });
});
