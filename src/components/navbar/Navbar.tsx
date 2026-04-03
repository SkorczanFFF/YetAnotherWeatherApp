import React, { useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { BsSearch, BsMap } from "react-icons/bs";
import { WeatherQuery } from "../../weather/types";
import "./Navbar.scss";

interface NavbarProps {
  setQuery: (query: WeatherQuery) => void;
  isDebugMode?: boolean;
  onOpenMapPicker?: () => void;
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
}) => {
  const [city, setCity] = useState<string>("");

  const handleSearch = (): void => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;
    if (!isValidCityName(trimmedCity)) return;
    setQuery({ q: trimmedCity });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    handleSearch();
  };

  const handleLocation = (): void => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setQuery({ lat, lon });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
  };

  return (
    <nav className="navbar">
      <a href="https://mskorus.pl/" className="logo">
        {isDebugMode ? (
          "DEBUG"
        ) : (
          <>
            <u>YET ANOTHER</u>
            <br />
            WEATHER APP
          </>
        )}
      </a>
      <form className="search-container" onSubmit={handleSubmit}>
        <div className="location-icon-container" onClick={handleLocation}>
          <IoLocationSharp className="location-icon" />
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.currentTarget.value)}
          type="text"
          placeholder="Enter city"
          className="search-input"
        />
        <div className="search-button" onClick={handleSearch}>
          <BsSearch />
        </div>
        {onOpenMapPicker && (
          <button
            type="button"
            className="map-icon-container"
            onClick={onOpenMapPicker}
            aria-label="Pick location on map"
          >
            <BsMap className="map-icon" />
          </button>
        )}
      </form>
    </nav>
  );
};

export default Navbar;
