import React, { useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { BsGithub, BsSearch } from "react-icons/bs";
import "./Navbar.scss";

interface NavbarProps {
  setQuery: (query: { q?: string; lat?: number; lon?: number }) => void;
  units: "metric" | "imperial";
  setUnits: (units: "metric" | "imperial") => void;
}

const Navbar: React.FC<NavbarProps> = ({ setQuery, units, setUnits }) => {
  const [city, setCity] = useState("");

  const handleSearch = () => {
    if (city !== "") {
      console.log("Searching for city:", city);
      setQuery({ q: city });
      setCity(""); // Clear the input after search
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter key is pressed
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent form submission
      handleSearch();
    }
  };

  const handleLocation = () => {
    if (navigator.geolocation) {
      console.log("Fetching user's location.");
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setQuery({
          lat,
          lon,
        });
      });
    }
  };

  const handleUnitsChange = () => {
    setUnits(units === "metric" ? "imperial" : "metric");
  };

  return (
    <div className="nav-bar border">
      <div className="left-logo">
        <span>Yet</span>
        <p>Another</p>
        <span>Weather</span>
        <p>App</p>
      </div>
      <div className="right-search">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for a city..."
        />
        <div className="nav-btns">
          <BsSearch className="search-btn" onClick={handleSearch} />
          <IoLocationSharp className="loc-btn" onClick={handleLocation} />
          <button className="units-btn" onClick={handleUnitsChange}>
            {units === "metric" ? "°C" : "°F"}
          </button>
          <a
            href="https://github.com/GarrettPilgrim/weather-app-react"
            target="_blank"
            rel="noreferrer"
          >
            <BsGithub className="github-btn" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
