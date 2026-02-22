import {
  getSceneConfigFromWeatherCode,
  getTimeOfDayPhase,
} from "./weatherSceneLogic";

describe("getSceneConfigFromWeatherCode", () => {
  it("returns clear for code 0", () => {
    const config = getSceneConfigFromWeatherCode(0);
    expect(config.type).toBe("clear");
    expect(config.particleCount).toBe(0);
    expect(config.fogDensity).toBe(0);
    expect(config.thunderstorm).toBe(false);
  });

  it("returns fog for code 45 and 48", () => {
    expect(getSceneConfigFromWeatherCode(45).type).toBe("fog");
    expect(getSceneConfigFromWeatherCode(48).type).toBe("fog");
    expect(getSceneConfigFromWeatherCode(45).fogDensity).toBeGreaterThan(0);
  });

  it("returns rain with intensity for codes 61, 63, 65", () => {
    const slight = getSceneConfigFromWeatherCode(61);
    expect(slight.type).toBe("rain");
    expect(slight.intensity).toBe("light");
    expect(slight.particleCount).toBeGreaterThan(0);

    const moderate = getSceneConfigFromWeatherCode(63);
    expect(moderate.intensity).toBe("moderate");

    const heavy = getSceneConfigFromWeatherCode(65);
    expect(heavy.intensity).toBe("heavy");
  });

  it("returns snow for codes 71, 73, 75", () => {
    expect(getSceneConfigFromWeatherCode(71).type).toBe("snow");
    expect(getSceneConfigFromWeatherCode(73).type).toBe("snow");
    expect(getSceneConfigFromWeatherCode(75).type).toBe("snow");
  });

  it("returns thunderstorm for codes 95-99", () => {
    expect(getSceneConfigFromWeatherCode(95).type).toBe("thunderstorm");
    expect(getSceneConfigFromWeatherCode(95).thunderstorm).toBe(true);
    expect(getSceneConfigFromWeatherCode(99).type).toBe("thunderstorm");
  });
});

describe("getTimeOfDayPhase", () => {
  const dawnWindow = 30 * 60;
  const sunrise = 10000;
  const sunset = 20000;

  it("returns night when dt is well before sunrise", () => {
    expect(getTimeOfDayPhase(sunrise - dawnWindow - 1, sunrise, sunset)).toBe(
      "night"
    );
  });

  it("returns night when dt is well after sunset", () => {
    expect(getTimeOfDayPhase(sunset + dawnWindow + 1, sunrise, sunset)).toBe(
      "night"
    );
  });

  it("returns day when dt is between sunrise and sunset (outside dawn/dusk)", () => {
    expect(getTimeOfDayPhase(15000, sunrise, sunset)).toBe("day");
  });
});
