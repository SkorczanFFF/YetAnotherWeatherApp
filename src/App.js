import React, { useState, useEffect } from 'react'
import CLOUDS from 'vanta/dist/vanta.clouds.min'
import * as THREE from "three"
import Navbar from './components/navbar/Navbar'
import CurrentWeather from './components/weather/current/CurrentWeather'
import WeeklyForecast from './components/weather/weekly/WeeklyForecast'
import Footer from './components/footer/Footer'
import getFormattedWeatherData from "./services/weatherService"

function App() {
  const [query, setQuery] = useState({q: "katowice"})
  const [units, setUnits] = useState("metric")
  const [weather, setWeather] = useState(null)
  const [vantaEffect, setVantaEffect] = useState(0)
  
  useEffect(() => {
    const fetchWeather = async () => {
      console.log("fetching weather for " + query.q)
      await getFormattedWeatherData({ ...query, units }).then((data) => {
        setWeather(data)
        console.log(`Fetched weather for ${data.name}, ${data.country}.`)
      })
    }
    fetchWeather();
  }, [query, units]);
  
  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(CLOUDS({
        el: "#App",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 850.00,
        minWidth: 1150.00,
        skyColor: 0x5bb4d7,
        cloudColor: 0xb5c1e1,
        cloudShadowColor: 0xd2c4a,
        sunColor: 0xf29c30,
        sunGlareColor: 0xf05c2b,
        sunlightColor: 0xffd3bc,
        speed: 0.5,
        THREE: THREE
      }))
    }
    return () => { 
      if (vantaEffect) vantaEffect.destroy()
    }
  }, [vantaEffect])

  return (
    <div className="App" id="App" >
      <Navbar setQuery={setQuery} units={units} setUnits={setUnits}/>
        <section className="weather">
          {weather && (
            <>
              <CurrentWeather weather={weather} />
              <WeeklyForecast items={weather.daily} />
            </>
          )}
        </section>
      <Footer />
    </div>
  )
}

export default App