import  React, { useState } from 'react'
import { IoLocationSharp } from 'react-icons/io5'
import { BsGithub, BsSearch } from 'react-icons/bs'
import './Navbar.scss'

const Navbar = ({setQuery}) => {
  const [city, setCity] = useState("")
  
  const handleSearch = () => {
    if (city !== "") setQuery({q: city}) 
  }

  const handleLocation = () => {
    if (navigator.geolocation) {
      console.log("Fetching users location.");
      navigator.geolocation.getCurrentPosition((pos) => {
        let lat = pos.coords.latitude
        let lon = pos.coords.longitude
        setQuery({lat, lon})
        console.log("Location fetched!" + lat + " " + lon);
      })
    }
  }

  return (
    <nav className='navbar'>
      <a href="https://mskorus.pl/" className='logo'>
        <u>YET ANOTHER</u><br/>WEATHER APP
      </a>
      <form className='search-container'>
        <div className='location-icon-container' onClick={handleLocation}>
          <IoLocationSharp className='location-icon' />
        </div>
        <input value={city}
          onChange={(e) => setCity(e.currentTarget.value)} type='text' placeholder='Enter city' className='search-input'
        />
        <div className='search-button' onClick={handleSearch}><BsSearch /></div>
      </form>
      <div className='git'>
        <a href="https://github.com/SkorczanFFF/YetAnotherWeatherApp" className='git-a'>GitHub</a><BsGithub className='git-icon' />
      </div>
    </nav> 
  )
}

export default Navbar