import React, { useState } from "react";
import { toast } from "react-toastify";
import { LoadSource, WeatherQuery, Units } from "../../weather/types";
import { UNITS } from "../../weather/units";
import { Spinner } from "../loader/Loader";
import { LineIcon, PinIcon } from "../icons";
import "./Navbar.scss";

interface NavbarProps {
  setQuery: (query: WeatherQuery, source: LoadSource) => void;
  isDebugMode: boolean;
  onOpenMapPicker: () => void;
  units: Units;
  setUnits: (units: Units) => void;
  /** Source of the weather fetch in flight, if any. */
  pending: LoadSource | null;
}

const isValidCityName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 100) return false;
  return /^[\p{L}\s\-'.]+$/u.test(trimmed);
};

const Navbar: React.FC<NavbarProps> = ({
  setQuery,
  isDebugMode,
  onOpenMapPicker,
  units,
  setUnits,
  pending,
}) => {
  const [city, setCity] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const locBusy = locating || pending === "location";
  const searchBusy = pending === "search";

  const handleSearch = (): void => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;
    if (!isValidCityName(trimmedCity)) {
      toast.error("Please enter a valid city name.");
      return;
    }
    setQuery({ q: trimmedCity }, "search");
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
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setQuery({ lat: pos.coords.latitude, lon: pos.coords.longitude }, "location");
      },
      (err) => {
        setLocating(false);
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
      <a className="brand" href="https://skoftware.pl/" aria-label="Yet Another Weather App">
        <span className="logo-mark" aria-hidden="true">
          <LineIcon strokeWidth={1.6}>
            <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </LineIcon>
        </span>
        <span className="brand-text">
          <span className="brand-line brand-line--top">
            {isDebugMode ? "DEBUG" : "YET ANOTHER"}
          </span>
          <span className="brand-line">{isDebugMode ? "MODE" : "WEATHER APP"}</span>
        </span>
      </a>

      <form className="search-group" role="search" onSubmit={handleSubmit}>
        <button
          type="button"
          className="icon-btn loc-btn"
          onClick={handleLocation}
          disabled={locBusy}
          aria-busy={locBusy}
          aria-label={locBusy ? "Locating…" : "Use my location"}
        >
          {locBusy ? (
            <Spinner />
          ) : (
            <PinIcon strokeWidth={1.8} />
          )}
        </button>
        <div className="search">
          <input
            value={city}
            onChange={(e) => setCity(e.currentTarget.value)}
            type="text"
            placeholder="Search city…"
            aria-label="Search city"
          />
          <button
            type="submit"
            className="search-submit"
            aria-label={searchBusy ? "Searching…" : "Search"}
            aria-busy={searchBusy}
          >
            {searchBusy ? (
              <Spinner />
            ) : (
              <LineIcon strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </LineIcon>
            )}
          </button>
        </div>
        <button
          type="button"
          className="icon-btn map-btn"
          onClick={onOpenMapPicker}
          aria-label="Pick location from map"
        >
          <LineIcon strokeWidth={1.6}>
            <path d="M9 3 3 5.5v15.5L9 18l6 3 6-2.5V3l-6 2.5L9 3Z" />
            <path d="M9 3v15" />
            <path d="M15 5.5V21" />
          </LineIcon>
        </button>
      </form>

      <div className="tools">
        <div className="unit-toggle" role="group" aria-label="Units" aria-busy={pending === "units"}>
          <button
            type="button"
            className={units === "metric" ? "on" : ""}
            onClick={() => setUnits("metric")}
          >
            {UNITS.metric.tempSymbol}
          </button>
          <button
            type="button"
            className={units === "imperial" ? "on" : ""}
            onClick={() => setUnits("imperial")}
          >
            {UNITS.imperial.tempSymbol}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
