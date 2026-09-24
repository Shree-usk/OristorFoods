import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";

describe("CheckboxOption", () => {
  it("names the checkbox by its visible label and toggles when the label is clicked", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<CheckboxOption label="Vegan" checked={false} onCheckedChange={onCheckedChange} />);

    expect(screen.getByRole("checkbox", { name: "Vegan" })).not.toBeChecked();
    await user.click(screen.getByText("Vegan"));

    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
