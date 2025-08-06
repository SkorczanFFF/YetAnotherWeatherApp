import React, { useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { BsGithub, BsSearch } from "react-icons/bs";
import "./Navbar.scss";

interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

type Units = "metric" | "imperial";

interface NavbarProps {
  setQuery: (query: WeatherQuery) => void;
  units: Units;
  setUnits: (units: Units) => void;
}

const Navbar: React.FC<NavbarProps> = ({ setQuery, units, setUnits }) => {
  const [city, setCity] = useState<string>("");

  const handleSearch = (): void => {
    if (city !== "") setQuery({ q: city });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    handleSearch();
  };

  const handleLocation = (): void => {
    if (navigator.geolocation) {
      console.log("Fetching users location.");
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setQuery({ lat, lon });
        console.log("Location fetched!" + lat + " " + lon);
      });
    }
  };

  return (
    <nav className="navbar">
      <a href="https://mskorus.pl/" className="logo">
        <u>YET ANOTHER</u>
        <br />
        WEATHER APP
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