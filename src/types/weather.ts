export interface WeatherQuery {
  q?: string;
  lat?: number;
  lon?: number;
}

export type Units = "metric" | "imperial";

export interface DailyWeather {
  title: string;
  temp: number;
  temp_min: number;
  icon: string;
}

export interface WeatherData {
  dt: number;
  timezone: string;
  name: string;
  country: string;
  temp: number;
  temp_max: number;
  temp_min: number;
  pressure: number;
  feels_like: number;
  sunrise: number;
  sunset: number;
  humidity: number;
  speed: number;
  details: string;
  icon: string;
  daily: DailyWeather[];
}
