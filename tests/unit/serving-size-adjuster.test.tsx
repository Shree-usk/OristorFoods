import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServingSizeAdjuster } from "@/components/storefront/recipes/serving-size-adjuster";

describe("ServingSizeAdjuster", () => {
  it("calls onChange with servings + 1 when the increment button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServingSizeAdjuster servings={4} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /increase servings/i }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("never calls onChange below 1 or above 50", async () => {
    const user = userEvent.setup();
    const onChangeAtMin = vi.fn();
    render(<ServingSizeAdjuster servings={1} onChange={onChangeAtMin} />);
    await user.click(screen.getByRole("button", { name: /decrease servings/i }));
    expect(onChangeAtMin).not.toHaveBeenCalled();
  });
});
