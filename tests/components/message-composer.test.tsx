import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "../../components/message-composer";
import { MAX_MESSAGE_LENGTH } from "../../lib/chat/send-message";
import { catalogs } from "../../lib/i18n/messages";
import { I18nProvider } from "../../lib/i18n/provider";

function setup(error: string | null = null) {
  const onSend = vi.fn();
  render(<MessageComposer onSend={onSend} error={error} />);
  return {
    onSend,
    input: screen.getByLabelText("Sporočilo") as HTMLTextAreaElement,
    send: screen.getByRole("button", { name: "Pošlji" }),
  };
}

describe("MessageComposer", () => {
  it("sends the trimmed message with Enter and clears the draft", async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, "  Živjo!  {Enter}");
    expect(onSend).toHaveBeenCalledWith("Živjo!");
    expect(input.value).toBe("");
    expect(input).toHaveFocus();
  });

  it("adds a line break with Shift+Enter instead of sending", async () => {
    const { onSend, input } = setup();
    await userEvent.type(input, "vrstica{Shift>}{Enter}{/Shift}druga");
    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe("vrstica\ndruga");
  });

  it("keeps the button disabled for an empty or blank draft", async () => {
    const { onSend, input, send } = setup();
    expect(send).toBeDisabled();
    await userEvent.type(input, "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(send).toBeDisabled();
  });

  it("marks a too-long draft invalid and shows the counter", async () => {
    const { send, input } = setup();
    await userEvent.click(input);
    await userEvent.paste("a".repeat(MAX_MESSAGE_LENGTH + 1));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(send).toBeDisabled();
    expect(
      screen.getByText(`${MAX_MESSAGE_LENGTH + 1}/${MAX_MESSAGE_LENGTH}`),
    ).toBeInTheDocument();
  });

  it("announces a send error", () => {
    setup("Sporočila ni bilo mogoče poslati.");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sporočila ni bilo mogoče poslati.",
    );
  });

  it("renders in English", async () => {
    const onSend = vi.fn();
    render(
      <I18nProvider locale="en" messages={catalogs.en}>
        <MessageComposer onSend={onSend} error="Couldn't send the message." />
      </I18nProvider>,
    );
    const input = screen.getByLabelText("Message");
    expect(input).toHaveAttribute("placeholder", "Write a message …");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't send the message.",
    );
    await userEvent.type(input, "Hi!{Enter}");
    expect(onSend).toHaveBeenCalledWith("Hi!");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
