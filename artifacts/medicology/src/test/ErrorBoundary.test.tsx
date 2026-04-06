import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../components/ErrorBoundary";

const Bomb = ({ throw: doThrow }: { throw: boolean }) => {
  if (doThrow) throw new Error("test explosion");
  return <div>All good</div>;
};

describe("ErrorBoundary", () => {
  it("renders children normally when no error", () => {
    render(
      <ErrorBoundary>
        <Bomb throw={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("shows error UI when child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb throw={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/test explosion/i)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("resets when 'Try again' is clicked", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    // Use a mutable flag so after reset the child no longer throws
    let shouldThrow = true;
    const ToggleBomb = () => {
      if (shouldThrow) throw new Error("test explosion");
      return <div>All good</div>;
    };

    render(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Disable throwing BEFORE clicking reset so the re-render succeeds
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("All good")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <Bomb throw={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
