import React, { useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { BsGithub, BsSearch, BsMap } from "react-icons/bs";
import { toast } from "react-toastify";
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

const Navbar: React.FC<NavbarProps> = ({ setQuery, isDebugMode = false, onOpenMapPicker }) => {
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setQuery({ lat, lon });
        },
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
    } else {
      toast.error("Geolocation is not supported by your browser.");
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
        <button type="button" className="location-icon-container" onClick={handleLocation} aria-label="Use my location">
          <IoLocationSharp className="location-icon" />
        </button>
        <input
          value={city}
          onChange={(e) => setCity(e.currentTarget.value)}
          type="text"
          placeholder="Enter city"
          aria-label="Search city"
          className="search-input"
        />
        <button type="submit" className="search-button" aria-label="Search">
          <BsSearch />
        </button>
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
      <div className="git">
        <a
          href="https://github.com/SkorczanFFF/YetAnotherWeatherApp"
          className="git-a"
        >
          SkorczanFFF
        </a>
        <BsGithub className="git-icon" />
      </div>
    </nav>
  );
};

export default Navbar;
