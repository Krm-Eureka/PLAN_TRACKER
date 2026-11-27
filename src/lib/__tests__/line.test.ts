import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  verifyLineSignature,
  parseLinkCode,
  parseProjectIssueInput,
  parsePostbackData,
  buildMyTasksCarousel,
  buildProjectQuickReply,
  buildIssueCreatedReply,
  buildLineSessionContext,
} from "../line";

describe("verifyLineSignature", () => {
  const secret = "test-channel-secret";
  const body = JSON.stringify({ events: [{ type: "message" }] });
  const validSig = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  it("accepts a valid HMAC-SHA256 signature", () => {
    expect(verifyLineSignature(body, validSig, secret)).toBe(true);
  });

  it("rejects tampered body, wrong secret, or missing signature", () => {
    expect(verifyLineSignature(body + " ", validSig, secret)).toBe(false);
    expect(verifyLineSignature(body, validSig, "wrong-secret")).toBe(false);
    expect(verifyLineSignature(body, null, secret)).toBe(false);
    expect(verifyLineSignature(body, "invalid-base64", secret)).toBe(false);
  });
});

describe("LINE message parsers", () => {
  it("parses LINK-XXXXXX codes case-insensitively", () => {
    expect(parseLinkCode("LINK-123456")).toBe("LINK-123456");
    expect(parseLinkCode("  link-009911  ")).toBe("LINK-009911");
    expect(parseLinkCode("LINK-12345")).toBeNull();
    expect(parseLinkCode("26M018 test")).toBeNull();
  });

  it("parses single-line / voice-keyboard issue text", () => {
    expect(parseProjectIssueInput("26M018 มอเตอร์แกน X เสียงดัง")).toEqual({
      candidateCode: "26M018",
      description: "มอเตอร์แกน X เสียงดัง",
    });
    expect(parseProjectIssueInput("26IN001: แก้สิทธิ์ user")).toEqual({
      candidateCode: "26IN001",
      description: "แก้สิทธิ์ user",
    });
    expect(parseProjectIssueInput("แจ้งปัญหา")).toBeNull();
  });

  it("parses URL-encoded postback payloads", () => {
    expect(
      parsePostbackData("action=task_status&taskId=t-1&status=In%20Progress")
    ).toEqual({
      action: "task_status",
      taskId: "t-1",
      status: "In Progress",
    });
  });
});

describe("LINE message builders", () => {
  it("builds a Flex carousel for My Tasks excluding current status from buttons", () => {
    const msg = buildMyTasksCarousel([
      {
        id: "t-1",
        task_name: "Check PLC wiring",
        status: "In Progress",
        due_date: "2026-12-01",
        percent_complete: "50",
        project: { project_code: "26M018", project_name: "Assembly Line" },
      },
    ]);

    expect(msg.type).toBe("flex");
    if (msg.type === "flex") {
      const bubbles = msg.contents.contents as Array<{
        footer: { contents: Array<{ action: { data: string } }> };
      }>;
      expect(bubbles).toHaveLength(1);
      const datas = bubbles[0].footer.contents.map((b) => b.action.data);
      expect(datas.some((d) => d.includes("status=Done"))).toBe(true);
      expect(datas.some((d) => d.includes("status=In%20Progress"))).toBe(false);
    }
  });

  it("builds empty state text when user has no open tasks", () => {
    const msg = buildMyTasksCarousel([]);
    expect(msg.type).toBe("text");
  });

  it("limits quick reply project choices to LINE max 13 items", () => {
    const manyProjects = Array.from({ length: 20 }, (_, i) => ({
      id: `p-${i}`,
      project_code: `26M0${i}`,
      project_name: `Project ${i}`,
    }));
    const msg = buildProjectQuickReply(manyProjects);
    expect(msg.type).toBe("text");
    expect(msg.quickReply?.items).toHaveLength(13);
  });

  it("builds confirmation Flex for created issue", () => {
    const msg = buildIssueCreatedReply({
      id: "iss-1",
      issue_code: "ISS-261127-ABCD",
      project_code: "26M018",
      project_name: "Test Project",
      reporter_name: "Somchai",
      description: "Sensor loose",
      status: "Open",
      created_at: new Date("2026-11-27T04:00:00Z"),
    });
    expect(msg.type).toBe("flex");
    if (msg.type === "flex") {
      expect(msg.altText).toContain("ISS-261127-ABCD");
    }
  });

  it("maps DB user to SessionContext with admin flag", () => {
    const ctx = buildLineSessionContext({
      id: "u-1",
      email: "admin@eurekaautomation.co.th",
      name_en: "Admin",
      name_th: "แอดมิน",
      department_id: "IT",
      division: "IT",
      role_system: "Super Admin",
    });
    expect(ctx.isAdmin).toBe(true);
    expect(ctx.department).toBe("IT");
  });
});
