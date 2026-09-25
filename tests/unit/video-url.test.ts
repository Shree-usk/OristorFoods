import { describe, expect, it } from "vitest";
import { normalizeVideoUrl, youtubeThumbnailUrl } from "@/lib/video-url";

describe("normalizeVideoUrl", () => {
  it("recognizes youtube.com/watch?v= URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("recognizes youtu.be short URLs", () => {
    expect(normalizeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
    });
  });

  it("recognizes youtube.com/embed/ URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toMatchObject({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
    });
  });

  it("recognizes vimeo.com/<id> URLs", () => {
    expect(normalizeVideoUrl("https://vimeo.com/76979871")).toEqual({
      provider: "Vimeo",
      embedId: "76979871",
      url: "https://vimeo.com/76979871",
    });
  });

  it("recognizes player.vimeo.com/video/<id> URLs", () => {
    expect(normalizeVideoUrl("https://player.vimeo.com/video/76979871")).toMatchObject({
      provider: "Vimeo",
      embedId: "76979871",
    });
  });

  it("treats a direct file URL as self-hosted", () => {
    expect(normalizeVideoUrl("https://cdn.oristor.com/videos/chicken-curry.mp4")).toEqual({
      provider: "SelfHosted",
      embedId: null,
      url: "https://cdn.oristor.com/videos/chicken-curry.mp4",
    });
  });

  it("returns null for empty, malformed, or non-video-looking input", () => {
    expect(normalizeVideoUrl("")).toBeNull();
    expect(normalizeVideoUrl("not a url")).toBeNull();
  });
});

describe("youtubeThumbnailUrl", () => {
  it("builds the hqdefault thumbnail URL", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
