export type WeatherErrorCode = "GEOCODE_FAILED" | "API_ERROR" | "NETWORK_ERROR";

export class WeatherError extends Error {
  constructor(
    message: string,
    public readonly code: WeatherErrorCode,
  ) {
    super(message);
    this.name = "WeatherError";
  }
}
