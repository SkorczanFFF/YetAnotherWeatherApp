import React, { useState } from "react";
import { toast } from "react-toastify";
import { WeatherQuery, Units } from "../../weather/types";
import "./Navbar.scss";

interface NavbarProps {
  setQuery: (query: WeatherQuery) => void;
  isDebugMode?: boolean;
  onOpenMapPicker?: () => void;
  units: Units;
  setUnits: (units: Units) => void;
}

const isValidCityName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 100) return false;
  return /^[\p{L}\s\-'.]+$/u.test(trimmed);
};

const Navbar: React.FC<NavbarProps> = ({
  setQuery,
  isDebugMode = false,
  onOpenMapPicker,
  units,
  setUnits,
}) => {
  const [city, setCity] = useState<string>("");

  const handleSearch = (): void => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;
    if (!isValidCityName(trimmedCity)) {
      toast.error("Please enter a valid city name.");
      return;
    }
    setQuery({ q: trimmedCity });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    handleSearch();
  };

  const handleLocation = (): void => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setQuery({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Please enable it in browser settings.",
          2: "Location unavailable. Please try again.",
          3: "Location request timed out. Please try again.",
        };
        toast.error(messages[err.code] || "Unable to get location.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <header className="topbar">
      <a className="brand" href="https://mskorus.pl/" aria-label="Yet Another Weather App">
        <span className="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </svg>
        </span>
        <span className="brand-text">
          {isDebugMode ? "DEBUG MODE" : "YET ANOTHER WEATHER APP"}
        </span>
      </a>

      <form className="search-group" role="search" onSubmit={handleSubmit}>
        <button
          type="button"
          className="icon-btn loc-btn"
          onClick={handleLocation}
          aria-label="Use my location"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </button>
        <div className="search">
          <input
            value={city}
            onChange={(e) => setCity(e.currentTarget.value)}
            type="text"
            placeholder="Search city…"
            aria-label="Search city"
          />
          <button type="submit" className="search-submit" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        </div>
        {onOpenMapPicker && (
          <button
            type="button"
            className="icon-btn map-btn"
            onClick={onOpenMapPicker}
            aria-label="Pick location from map"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3 3 5.5v15.5L9 18l6 3 6-2.5V3l-6 2.5L9 3Z" />
              <path d="M9 3v15" />
              <path d="M15 5.5V21" />
            </svg>
          </button>
        )}
      </form>

      <div className="tools">
        <div className="unit-toggle" role="group" aria-label="Units">
          <button
            type="button"
            className={units === "metric" ? "on" : ""}
            onClick={() => setUnits("metric")}
          >
            °C
          </button>
          <button
            type="button"
            className={units === "imperial" ? "on" : ""}
            onClick={() => setUnits("imperial")}
          >
            °F
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
