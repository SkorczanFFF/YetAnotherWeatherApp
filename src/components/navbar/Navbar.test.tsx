import React from "react";
import { render, screen } from "@testing-library/react";
import Navbar from "./Navbar";
import { WeatherQuery } from "../../types/weather";

const mockSetQuery = jest.fn();

describe("Navbar", () => {
  it("shows YET ANOTHER and WEATHER APP when isDebugMode is false", () => {
    render(<Navbar setQuery={mockSetQuery} isDebugMode={false} />);
    expect(screen.getByText(/YET ANOTHER/i)).toBeInTheDocument();
    expect(screen.getByText(/WEATHER APP/i)).toBeInTheDocument();
    expect(screen.queryByText("DEBUG")).not.toBeInTheDocument();
  });

  it("shows DEBUG when isDebugMode is true", () => {
    render(<Navbar setQuery={mockSetQuery} isDebugMode={true} />);
    expect(screen.getByText("DEBUG")).toBeInTheDocument();
    expect(screen.queryByText(/YET ANOTHER/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/WEATHER APP/i)).not.toBeInTheDocument();
  });

  it("defaults to normal title when isDebugMode is not passed", () => {
    render(<Navbar setQuery={mockSetQuery} />);
    expect(screen.getByText(/WEATHER APP/i)).toBeInTheDocument();
  });
});
