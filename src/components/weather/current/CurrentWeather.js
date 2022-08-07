import React from "react";
import ReactTooltip from 'react-tooltip'
import { WiHumidity, WiStrongWind, WiBarometer, WiSunrise, WiSunset, WiThermometerExterior, WiThermometer, WiThermometerInternal } from 'react-icons/wi'
import { formatToLocalTime, iconUrlFromCode } from "../../../services/weatherService";
import './CurrentWeather.scss'
//import '../../../assets/icons/04d'
const CurrentWeather = ({
  weather: {dt, timezone, name, country, temp, temp_max, temp_min, pressure, feels_like, sunrise, sunset, humidity, speed, details, icon }}) => 
  {
  console.table(timezone)
  return (
    <>

      <div className='main-info border' >
        <p className="date-time">
          {formatToLocalTime(dt, timezone)}
        </p>
        <div className="wrapper">
          <div className='left-wing wing'>
            <div data-tip data-for='wind' className='wing-item left'>
            {`${speed.toFixed()} km/h`} <WiStrongWind className='wing-icon'/>
            </div>
            <ReactTooltip id='wind' type='light' textColor="#000e3d9d;">
              <span>Wind strength</span>
            </ReactTooltip>

            <div data-tip data-for='feels-like' className='wing-item left'>
            {`${feels_like.toFixed()}°C`} <WiThermometerInternal className='wing-icon'/> 
            </div>
            <ReactTooltip id='feels-like' type='light' textColor="#000e3d9d;">
              <span>Perceived temperature</span>
            </ReactTooltip>

            <div data-tip data-for='max-temp' className='wing-item left'>
            {`${temp_max.toFixed()}°C`} <WiThermometer className='wing-icon'/>
            </div>
            <ReactTooltip id='max-temp' type='light' textColor="#000e3d9d;">
              <span>Maximum temperature</span>
            </ReactTooltip>

            <div data-tip data-for='sunrise' className='wing-item left'>
            {formatToLocalTime(sunrise, timezone, "HH:mm")} <WiSunrise className='wing-icon'/>
            </div>
            <ReactTooltip id='sunrise' type='light' textColor="#000e3d9d;">
              <span>Sunrise</span>
            </ReactTooltip>
          </div>

          <div className='main-middle-info'>
          <img src={iconUrlFromCode(icon)} alt=""  className='weather-icon' />
            <p className='main-condition'>
              {details} 
            </p>
            <h1 className='main-degrees'>{`${temp.toFixed()}°C`}</h1>
            {/*<p className='main-location'>{`${name}, ${country}`}</p>*/}
          </div>

          <div className='right-wing wing' >
          <div data-tip data-for='pressure' className='wing-item'>
              <WiBarometer className='wing-icon'/> {`${pressure.toFixed()}hPa`} 
            </div>
            <ReactTooltip id='pressure' type='light' textColor="#000e3d9d;">
              <span>Pressure</span>
            </ReactTooltip>

            <div data-tip data-for='humidity' className='wing-item'>
              <WiHumidity className='wing-icon'/> {`${humidity.toFixed()}%`}
            </div>
            <ReactTooltip id='humidity' type='light' textColor="#000e3d9d;">
              <span>Humidity</span>
            </ReactTooltip>

            <div data-tip data-for='min-temp' className='wing-item'>
              <WiThermometerExterior className='wing-icon'/> {`${temp_min.toFixed()}°C`}
            </div>
            <ReactTooltip id='min-temp' type='light' textColor="#000e3d9d;">
              <span>Minimum temperature</span>
            </ReactTooltip>

            <div data-tip data-for='sunset' className='wing-item'>
              <WiSunset className='wing-icon'/> {formatToLocalTime(sunset, timezone, "HH:mm")}
            </div>
            <ReactTooltip id='sunset' type='light' textColor="#000e3d9d;">
              <span>Sunset</span>
            </ReactTooltip>
          </div>
        </div>
        <p className='main-location'>{`${name}, ${country}`}</p>
      </div>
    </>
  )
}

export default CurrentWeather