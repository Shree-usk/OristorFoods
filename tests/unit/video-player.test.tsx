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
    expect(document.querySelector("track")).toHaveAttribute("src", "/captions.vtt");
  });

  it("falls back to a plain poster image when the URL doesn't normalize", () => {
    render(<VideoPlayer video={{ url: "not a real url", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />);
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
    expect(screen.getByAltText("Recipe hero")).toBeInTheDocument();
  });
});
