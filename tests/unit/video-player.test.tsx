import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VideoPlayer } from "@/components/storefront/recipes/video-player";

describe("VideoPlayer", () => {
  it("does not render an iframe or video element before the user clicks play", () => {
    render(
      <VideoPlayer
        video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }}
        posterUrl="/hero.jpg"
        posterAlt="Recipe hero"
      />,
    );
    expect(screen.queryByTitle(/play video/i)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("mounts the YouTube iframe only after clicking the play button", async () => {
    const user = userEvent.setup();
    render(
      <VideoPlayer video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />,
    );
    await user.click(screen.getByRole("button", { name: /play video/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", expect.stringContaining("youtube.com/embed/dQw4w9WgXcQ"));
  });

  it("titles the iframe as a video, not the poster's alt text", async () => {
    const user = userEvent.setup();
    render(
      <VideoPlayer video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />,
    );
    await user.click(screen.getByRole("button", { name: /play video/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", "Video: Recipe hero");
  });

  it("moves keyboard focus to the iframe after clicking play", async () => {
    const user = userEvent.setup();
    render(
      <VideoPlayer video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />,
    );
    await user.click(screen.getByRole("button", { name: /play video/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveFocus();
  });

  it("mounts the Vimeo iframe only after clicking play", async () => {
    const user = userEvent.setup();
    render(<VideoPlayer video={{ url: "https://vimeo.com/76979871", provider: "Vimeo" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />);
    await user.click(screen.getByRole("button", { name: /play video/i }));
    expect(document.querySelector("iframe")).toHaveAttribute("src", expect.stringContaining("player.vimeo.com/video/76979871"));
  });

  it("renders a native video element directly for self-hosted, no click needed", () => {
    render(
      <VideoPlayer
        video={{ url: "https://cdn.oristor.com/v.mp4", provider: "SelfHosted", captionsUrl: "/captions.vtt" }}
        posterUrl="/hero.jpg"
        posterAlt="Recipe hero"
      />,
    );
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("crossorigin", "anonymous");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(document.querySelector("track")).toHaveAttribute("src", "/captions.vtt");
  });

  it("falls back to a plain poster image when the URL doesn't normalize", () => {
    render(<VideoPlayer video={{ url: "not a real url", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />);
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
    expect(screen.getByAltText("Recipe hero")).toBeInTheDocument();
  });

  it("falls back to the poster image when the URL normalizes to a different provider than authored", () => {
    // "youtube.com/shorts/..." isn't matched by video-url.ts's YOUTUBE_PATTERNS
    // (only watch?v=, embed/, and youtu.be/ are), so normalizeVideoUrl
    // resolves this to SelfHosted even though the tip/recipe was authored
    // as Youtube. VideoPlayer must not render the SelfHosted <video> branch
    // for authored-provider content it can't actually confirm is playable.
    render(
      <VideoPlayer
        video={{ url: "https://youtube.com/shorts/abc123", provider: "Youtube" }}
        posterUrl="/hero.jpg"
        posterAlt="Recipe hero"
      />,
    );
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
    expect(screen.getByAltText("Recipe hero")).toBeInTheDocument();
  });
});
