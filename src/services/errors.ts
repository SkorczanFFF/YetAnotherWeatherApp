/** Anything else thrown (fetch TypeError) is shown as a network error. */
type WeatherErrorCode = "GEOCODE_FAILED" | "API_ERROR";

export class WeatherError extends Error {
  constructor(
    message: string,
    public readonly code: WeatherErrorCode,
  ) {
    super(message);
    this.name = "WeatherError";
  }
}
