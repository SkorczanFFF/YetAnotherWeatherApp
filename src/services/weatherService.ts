import { DateTime } from "luxon";

interface WeatherParams {
  q?: string;
  lat?: number;
  lon?: number;
  units?: string;
  timezone?: string;
}

interface OpenMeteoCurrentData {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  pressure_msl: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  is_day: number;
}

interface OpenMeteoDailyData {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current: OpenMeteoCurrentData;
  daily: OpenMeteoDailyData;
  current_units: Record<string, string>;
  daily_units: Record<string, string>;
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  timezone: string;
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
  weather_code: number;
  is_day: number;
  wind_direction?: number;
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

interface OpenMeteoQueryParams {
  latitude: number;
  longitude: number;
  timezone: string;
  temperature_unit: string;
  wind_speed_unit: string;
  current: string;
  daily: string;
}

const BASE_URL = "https://api.open-meteo.com/v1";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

const getWeatherData = async (
  endpoint: string,
  searchParams: OpenMeteoQueryParams
): Promise<OpenMeteoResponse> => {
  const url = new URL(BASE_URL + "/" + endpoint);

  // Add search params to URL
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check if the API returned an error
    if (data.error) {
      throw new Error(`API returned error: ${data.reason || "Unknown error"}`);
    }

    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
};

const geocodeCity = async (city: string): Promise<GeocodingResult | null> => {
  try {
    const url = new URL(GEOCODING_URL);
    url.searchParams.append("name", city);
    url.searchParams.append("count", "1");
    url.searchParams.append("language", "en");
    url.searchParams.append("format", "json");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Geocoding API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0];
  } catch (error) {
    console.error("Error geocoding city:", error);
    throw error;
  }
};

// Map weather codes from Open-Meteo to descriptive text and icon codes
const weatherCodeMap: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "01d" },
  1: { description: "Mainly clear", icon: "02d" },
  2: { description: "Partly cloudy", icon: "03d" },
  3: { description: "Overcast", icon: "04d" },
  45: { description: "Fog", icon: "50d" },
  48: { description: "Depositing rime fog", icon: "50d" },
  51: { description: "Light drizzle", icon: "09d" },
  53: { description: "Moderate drizzle", icon: "09d" },
  55: { description: "Dense drizzle", icon: "09d" },
  56: { description: "Light freezing drizzle", icon: "09d" },
  57: { description: "Dense freezing drizzle", icon: "09d" },
  61: { description: "Slight rain", icon: "10d" },
  63: { description: "Moderate rain", icon: "10d" },
  65: { description: "Heavy rain", icon: "10d" },
  66: { description: "Light freezing rain", icon: "13d" },
  67: { description: "Heavy freezing rain", icon: "13d" },
  71: { description: "Slight snow fall", icon: "13d" },
  73: { description: "Moderate snow fall", icon: "13d" },
  75: { description: "Heavy snow fall", icon: "13d" },
  77: { description: "Snow grains", icon: "13d" },
  80: { description: "Slight rain showers", icon: "09d" },
  81: { description: "Moderate rain showers", icon: "09d" },
  82: { description: "Violent rain showers", icon: "09d" },
  85: { description: "Slight snow showers", icon: "13d" },
  86: { description: "Heavy snow showers", icon: "13d" },
  95: { description: "Thunderstorm", icon: "11d" },
  96: { description: "Thunderstorm with slight hail", icon: "11d" },
  99: { description: "Thunderstorm with heavy hail", icon: "11d" },
};

// Add is_day detection to get day/night icons
const getIconCode = (weatherCode: number, is_day: number): string => {
  const weather = weatherCodeMap[weatherCode] || {
    description: "Unknown",
    icon: "01d",
  };

  // Convert day icons to night icons if is_day is 0
  if (is_day === 0) {
    // Replace 'd' with 'n' at the end of the icon code
    return weather.icon.replace("d", "n");
  }

  return weather.icon;
};

const formatCurrentWeather = (
  data: OpenMeteoResponse,
  locationName?: string,
  countryCode?: string
): FormattedCurrentWeather => {
  const { latitude: lat, longitude: lon, timezone, current, daily } = data;

  // Extract current weather data
  const {
    temperature_2m: temp,
    apparent_temperature: feels_like,
    relative_humidity_2m: humidity,
    pressure_msl: pressure,
    weather_code,
    wind_speed_10m: speed,
    wind_direction_10m: wind_direction,
    time: dt_str,
    is_day,
  } = current;

  // Extract daily data (for min/max temps and sunrise/sunset)
  const { temperature_2m_max, temperature_2m_min, sunrise, sunset } = daily;

  // Get weather details from the code
  const weatherInfo = weatherCodeMap[weather_code] || {
    description: "Unknown",
    icon: "01d",
  };
  const { description: details } = weatherInfo;

  // Use is_day to get correct day/night icon
  const icon = getIconCode(weather_code, is_day);

  // Convert ISO strings to timestamp in seconds
  const dt = DateTime.fromISO(dt_str).toSeconds();
  const sunrise_time = DateTime.fromISO(sunrise[0]).toSeconds();
  const sunset_time = DateTime.fromISO(sunset[0]).toSeconds();

  // Use the first value from arrays
  const temp_max = temperature_2m_max[0];
  const temp_min = temperature_2m_min[0];

  // Use provided location name and country or extract from timezone
  const name =
    locationName || timezone.split("/").pop()?.replace(/_/g, " ") || "Unknown";
  const country = countryCode || timezone.split("/")[0] || "";

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
    sunrise: sunrise_time,
    sunset: sunset_time,
    details,
    icon,
    speed,
    weather_code,
    is_day,
    wind_direction,
  };
};

const formatWeeklyWeather = (
  data: OpenMeteoResponse
): FormattedWeeklyWeather => {
  const { timezone, daily } = data;

  // Skip first day (today)
  const weeklyData = daily.time.slice(1, 8).map((date, index) => {
    const i = index + 1; // offset by 1 since we skip today
    return {
      title: formatToLocalTime(
        DateTime.fromISO(date).toSeconds(),
        timezone,
        "cccc"
      ),
      temp: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      icon: weatherCodeMap[daily.weather_code[i]]?.icon || "01d",
    };
  });

  return {
    timezone,
    daily: weeklyData,
  };
};

const getFormattedWeatherData = async (
  searchParams: WeatherParams
): Promise<FormattedWeatherData> => {
  try {
    let lat = searchParams.lat;
    let lon = searchParams.lon;
    let locationName: string | undefined;
    let countryCode: string | undefined;

    if (searchParams.q && (!lat || !lon)) {
      const geocodingResult = await geocodeCity(searchParams.q);

      if (!geocodingResult) {
        throw new Error(
          `Could not find coordinates for city: ${searchParams.q}`
        );
      }

      lat = geocodingResult.latitude;
      lon = geocodingResult.longitude;
      locationName = geocodingResult.name;
      countryCode = geocodingResult.country_code;
    }

    // After geocoding, we should have coordinates
    if (!lat || !lon) {
      throw new Error("Latitude and longitude are required");
    }

    // Set default timezone if not provided
    const params = {
      ...searchParams,
      timezone: searchParams.timezone || "auto",
    };

    // Convert units to Open-Meteo format
    let temperature_unit = "celsius";
    let wind_speed_unit = "kmh";

    if (params.units === "imperial") {
      temperature_unit = "fahrenheit";
      wind_speed_unit = "mph";
    }

    // Create query parameters for Open-Meteo API
    const openMeteoParams = {
      latitude: lat,
      longitude: lon,
      timezone: params.timezone,
      temperature_unit,
      wind_speed_unit,
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m,wind_direction_10m,is_day",
      daily:
        "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,weather_code,sunrise,sunset,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max",
    };

    // Fetch data from Open-Meteo API
    const data = await getWeatherData("forecast", openMeteoParams);

    const formattedCurrentWeather = formatCurrentWeather(
      data,
      locationName,
      countryCode
    );
    const formattedWeeklyWeather = formatWeeklyWeather(data);

    return { ...formattedCurrentWeather, ...formattedWeeklyWeather };
  } catch (error) {
    console.error("Error in getFormattedWeatherData:", error);
    throw error;
  }
};

const iconUrlFromCode = (code: string): string => {
  // Use OpenWeatherMap icons for compatibility with existing code
  return `http://openweathermap.org/img/wn/${code}@4x.png`;
};

const formatToLocalTime = (
  secs: number,
  zone: string,
  format: string = "cccc, dd LLLL yyyy', 'HH:mm"
): string => DateTime.fromSeconds(secs).setZone(zone).toFormat(format);

export default getFormattedWeatherData;

export { formatToLocalTime, iconUrlFromCode };
