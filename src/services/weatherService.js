import { DateTime } from "luxon"

const BASE_URL = "https://api.openweathermap.org/data/2.5"
const API_KEY = "b31adbaf38bee31bcbf1958df347eaf1"

const getWeatherData = (infoType, searchParams) => {
  const url = new URL(BASE_URL + "/" + infoType)
  url.search = new URLSearchParams({ ...searchParams, appid: API_KEY })

  return fetch(url).then((res) => res.json())
}

const formatCurrentWeather = (data) => {
  const {
    coord: { lat, lon },
    main: { temp, feels_like, temp_min, temp_max, pressure, humidity },
    name,
    dt,
    sys: { country, sunrise, sunset },
    weather,
    wind: { speed }
  } = data

  const { main: details, icon } = weather[0]

  return {
    lat, lon,
    temp, feels_like, temp_min, temp_max, pressure, humidity,
    name,
    dt,
    country, sunrise, sunset,
    details, icon,
    speed
  };
};

const formatWeeklyWeather = (data) => {
  let { timezone, daily } = data
  daily = daily.slice(1, 8).map((d) => {
    return {
      title: formatToLocalTime(d.dt, timezone, "cccc"),
      temp: d.temp.day,
      temp_min: d.temp.min,
      icon: d.weather[0].icon
    };
  });
  return { timezone, daily }
}

const getFormattedWeatherData = async (searchParams) => {
  const formattedCurrentWeather = await getWeatherData(
    "weather",
    searchParams
  ).then(formatCurrentWeather)

  const { lat, lon } = formattedCurrentWeather

  const formattedWeeklyWeather = await getWeatherData("onecall", {
    lat,
    lon,
    exclude: "current,minutely,alerts",
    units: searchParams.units
  }).then(formatWeeklyWeather)

  return { ...formattedCurrentWeather, ...formattedWeeklyWeather }
}

const iconUrlFromCode = (code) => 
  `http://openweathermap.org/img/wn/${code}@4x.png`

const formatToLocalTime = (secs, zone, format = "cccc, dd LLLL yyyy', 'HH:mm") => 
  DateTime.fromSeconds(secs).setZone(zone).toFormat(format)

export default getFormattedWeatherData

export { formatToLocalTime, iconUrlFromCode }
