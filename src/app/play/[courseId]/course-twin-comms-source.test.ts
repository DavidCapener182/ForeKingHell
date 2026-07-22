import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-comms.tsx"),
  "utf8",
);

describe("Course Twin room communications", () => {
  it("uses explicit microphone consent, peer-to-peer audio and server-mediated signalling", () => {
    expect(source).toContain("navigator.mediaDevices.getUserMedia");
    expect(source).toContain("new RTCPeerConnection");
    expect(source).toContain('postEvent("voice.offer"');
    expect(source).toContain('postEvent("voice.answer"');
    expect(source).toContain('postEvent("voice.ice"');
    expect(source).toContain('postEvent("chat.message"');
    expect(source).toContain("audio is not");
  });
});
