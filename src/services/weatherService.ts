import { DateTime } from "luxon";

interface WeatherParams {
  q?: string;
  lat?: number;
  lon?: number;
  units?: string;
  exclude?: string;
}

interface WeatherData {
  coord: {
    lat: number;
    lon: number;
  };
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  name: string;
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  weather: Array<{
    main: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
}

interface FormattedCurrentWeather {
  lat: number;
  lon: number;
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  pressure: number;
  humidity: number;
  name: string;
  dt: number;
  country: string;
  sunrise: number;
  sunset: number;
  details: string;
  icon: string;
  speed: number;
}

interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

interface FormattedWeeklyWeather {
  timezone: string;
  daily: DailyWeather[];
}

interface FormattedWeatherData
  extends FormattedCurrentWeather,
    FormattedWeeklyWeather {}

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;

const getWeatherData = (
  infoType: string,
  searchParams: WeatherParams
): Promise<any> => {
  const url = new URL(BASE_URL + "/" + infoType);
  const searchParamsObj = new URLSearchParams();

  // Add search params
  Object.entries({ ...searchParams, appid: API_KEY as string }).forEach(
    ([key, value]) => {
      if (value !== undefined) {
        searchParamsObj.append(key, value.toString());
      }
    }
  );

  url.search = searchParamsObj.toString();

  return fetch(url).then((res) => res.json());
};

const formatCurrentWeather = (data: WeatherData): FormattedCurrentWeather => {
  const {
    coord: { lat, lon },
    main: { temp, feels_like, temp_min, temp_max, pressure, humidity },
    name,
    dt,
    sys: { country, sunrise, sunset },
    weather,
    wind: { speed },
  } = data;

  const { main: details, icon } = weather[0];

  return {
    lat,
    lon,
    temp,
    feels_like,
    temp_min,
    temp_max,
    pressure,
    humidity,
    name,
    dt,
    country,
    sunrise,
    sunset,
    details,
    icon,
    speed,
  };
};

const formatWeeklyWeather = (data: any): FormattedWeeklyWeather => {
  let { timezone, daily } = data;
  daily = daily.slice(1, 8).map((d: any) => {
    return {
      title: formatToLocalTime(d.dt, timezone, "cccc"),
      temp: d.temp.day,
      temp_min: d.temp.min,
      icon: d.weather[0].icon,
    };
  });
  return { timezone, daily };
};

const getFormattedWeatherData = async (
  searchParams: WeatherParams
): Promise<FormattedWeatherData> => {
  const formattedCurrentWeather = await getWeatherData(
    "weather",
    searchParams
  ).then(formatCurrentWeather);

  const { lat, lon } = formattedCurrentWeather;

  const formattedWeeklyWeather = await getWeatherData("onecall", {
    lat,
    lon,
    exclude: "current,minutely,alerts",
    units: searchParams.units,
  }).then(formatWeeklyWeather);

  return { ...formattedCurrentWeather, ...formattedWeeklyWeather };
};

const iconUrlFromCode = (code: string): string =>
  `http://openweathermap.org/img/wn/${code}@4x.png`;

const formatToLocalTime = (
  secs: number,
  zone: string,
  format: string = "cccc, dd LLLL yyyy', 'HH:mm"
): string => DateTime.fromSeconds(secs).setZone(zone).toFormat(format);

export default getFormattedWeatherData;

export { formatToLocalTime, iconUrlFromCode };
