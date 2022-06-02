import React, { useEffect, useState, useRef } from 'react'
import './Weather.scss'
import ReactTooltip from 'react-tooltip'
import { WiHumidity, WiStrongWind, WiBarometer, WiSunrise, WiSunset, WiThermometerExterior, WiThermometer, WiThermometerInternal } from 'react-icons/wi'
import { WiDaySunnyOvercast, WiDaySunny, WiRain, WiDayCloudy } from 'react-icons/wi'

const Weather = () => {
  const [lat, setLat] = useState([]);
  const [long, setLong] = useState([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(function(position) {
      setLat(position.coords.latitude);
      setLong(position.coords.longitude);
    });
    console.log("Your latitude is:", lat)
    console.log("Your longitude is:", long)
  }, [lat, long]);

  return (
    <section className="weather">
      <div className='main-info border' >
        <div className='left-wing wing'>
          <div data-tip data-for='wind' className='wing-item left'>
            7km/h <WiStrongWind className='wing-icon'/>
          </div>
          <ReactTooltip id='wind' type='light' textColor="#000e3d9d;">
            <span>Wind strength</span>
          </ReactTooltip>

          <div data-tip data-for='feels-like' className='wing-item left'>
            18°C <WiThermometerInternal className='wing-icon'/> 
          </div>
          <ReactTooltip id='feels-like' type='light' textColor="#000e3d9d;">
            <span>Perceived temperature</span>
          </ReactTooltip>

          <div data-tip data-for='max-temp' className='wing-item left'>
            20°C <WiThermometer className='wing-icon'/>
          </div>
          <ReactTooltip id='max-temp' type='light' textColor="#000e3d9d;">
            <span>Maximum temperature</span>
          </ReactTooltip>

          <div data-tip data-for='sunrise' className='wing-item left'>
            5:32 <WiSunrise className='wing-icon'/>
          </div>
          <ReactTooltip id='sunrise' type='light' textColor="#000e3d9d;">
            <span>Sunrise</span>
          </ReactTooltip>

        </div>

        <div className='main-middle-info'>
          <WiDayCloudy className='weather-icon'/>
          <p className='main-condition'>
            Few clouds
          </p>
          <h1 className='main-degrees'>19°C</h1>
          <p className='main-location'>Utah, USA</p>
        </div>

        <div className='right-wing wing' >
        <div data-tip data-for='pressure' className='wing-item'>
            <WiBarometer className='wing-icon'/> 998hPa 
          </div>
          <ReactTooltip id='pressure' type='light' textColor="#000e3d9d;">
            <span>Pressure</span>
          </ReactTooltip>

          <div data-tip data-for='humidity' className='wing-item'>
            <WiHumidity className='wing-icon'/> 15%
          </div>
          <ReactTooltip id='humidity' type='light' textColor="#000e3d9d;">
            <span>Humidity</span>
          </ReactTooltip>

          <div data-tip data-for='min-temp' className='wing-item'>
            <WiThermometerExterior className='wing-icon'/> 9°C
          </div>
          <ReactTooltip id='min-temp' type='light' textColor="#000e3d9d;">
            <span>Minimum temperature</span>
          </ReactTooltip>

          <div data-tip data-for='sunset' className='wing-item'>
            <WiSunset className='wing-icon'/> 21:41
          </div>
          <ReactTooltip id='sunset' type='light' textColor="#000e3d9d;">
            <span>Sunset</span>
          </ReactTooltip>

        </div>
      </div>

      <div className='weekly-info'>
        <div className='atom atom-left border-light'>
          <p className='weekday'>Monday</p>
          <WiDayCloudy className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>21°C</h5>
            <h5 className='feels-like-temp'>9°C</h5>
          </div>
        </div>
        <div className='atom atom-left border-light' >
          <p className='weekday'>Tuesday</p>
          <WiDaySunny className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>25°C</h5>
            <h5 className='feels-like-temp'>11°C</h5>
          </div>
        </div>
        <div className='atom atom-left border-light'>
          <p className='weekday'>Wednesday</p>
          <WiDayCloudy className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>24°C</h5>
            <h5 className='feels-like-temp'>12°C</h5>
          </div>
        </div>
        <div className='atom border-light'>
          <p className='weekday'>Thursday</p>
          <WiRain className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>26°C</h5>
            <h5 className='feels-like-temp'>8°C</h5>
          </div>
        </div>
        <div className='atom atom-right border-light'>
          <p className='weekday'>Friday</p>
          <WiDayCloudy className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>22°C</h5>
            <h5 className='feels-like-temp'>10°C</h5>
          </div>
        </div>
        <div className='atom atom-right border-light'>
          <p className='weekday'>Saturday</p>
          <WiDaySunny className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>21°C</h5>
            <h5 className='feels-like-temp'>9°C</h5>
          </div>
        </div>
        <div className='atom atom-right border-light'>
          <p className='weekday'>Sunday</p>
          <WiDayCloudy className='weekly-weather-icon' />
          <div className='weekly-temp-container'>
            <h5 className='weekly-temp'>27°C</h5>
            <h5 className='feels-like-temp'>14°C</h5>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Weather;
