import React, { useState, useEffect, useRef } from 'react'
import CLOUDS from 'vanta/dist/vanta.clouds.min'
import Navbar from './components/search/Navbar'
import Weather from './components/weather/Weather'
import Footer from './components/footer/Footer'
import * as THREE from "three"

const App = () => {
  const [vantaEffect, setVantaEffect] = useState(0)
  useEffect(() => {
    if (!vantaEffect) {
      setVantaEffect(CLOUDS({
        el: "#App",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
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
  return <div className="App" id="App" >
    <Navbar />
      <Weather />
    <Footer />
  </div>
}

export default App