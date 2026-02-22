import React, { useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { BsGithub, BsSearch } from "react-icons/bs";
import { WeatherQuery } from "../../types/weather";
import "./Navbar.scss";

interface NavbarProps {
  setQuery: (query: WeatherQuery) => void;
  isDebugMode?: boolean;
}

const isValidCityName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 100) return false;
  return /^[\p{L}\s\-'.]+$/u.test(trimmed);
};

const Navbar: React.FC<NavbarProps> = ({ setQuery, isDebugMode = false }) => {
  const [city, setCity] = useState<string>("");

  const handleSearch = (): void => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return;
    if (!isValidCityName(trimmedCity)) {
      alert("Please enter a valid city name.");
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
          alert(messages[err.code] || "Unable to get location.");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <nav className="navbar xray">
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
      </form>
      <div className="git">
        <a
          href="https://github.com/SkorczanFFF/YetAnotherWeatherApp"
          className="git-a"
        >
          GitHub
        </a>
        <BsGithub className="git-icon" />
      </div>
    </nav>
  );
};

export default Navbar;
