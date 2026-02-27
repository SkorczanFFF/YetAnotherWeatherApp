import {
  getEffectTypeAndIntensity,
  getCloudCoverFromWeatherCode,
} from "./codes";

describe("getEffectTypeAndIntensity", () => {
  it("returns valid result for every code 0–99 (no throw, no undefined)", () => {
    for (let code = 0; code <= 99; code++) {
      const result = getEffectTypeAndIntensity(code);
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.intensity).toBeDefined();
      expect(["clear", "rain", "snow", "fog", "thunderstorm"]).toContain(
        result.type,
      );
      expect(["light", "moderate", "heavy"]).toContain(result.intensity);
    }
  });

  it("returns clear with distinct intensity for codes 0–3 (1.7)", () => {
    expect(getEffectTypeAndIntensity(0)).toEqual({
      type: "clear",
      intensity: "light",
    });
    expect(getEffectTypeAndIntensity(1)).toEqual({
      type: "clear",
      intensity: "light",
    });
    expect(getEffectTypeAndIntensity(2)).toEqual({
      type: "clear",
      intensity: "moderate",
    });
    expect(getEffectTypeAndIntensity(3)).toEqual({
      type: "clear",
      intensity: "heavy",
    });
  });

  it("returns fog for 45, 48, 40", () => {
    expect(getEffectTypeAndIntensity(45).type).toBe("fog");
    expect(getEffectTypeAndIntensity(48).type).toBe("fog");
    expect(getEffectTypeAndIntensity(40).type).toBe("fog");
  });

  it("returns rain with intensity for 51, 61, 65, 66, 67, 80, 82", () => {
    expect(getEffectTypeAndIntensity(51)).toEqual({
      type: "rain",
      intensity: "light",
    });
    expect(getEffectTypeAndIntensity(61).type).toBe("rain");
    expect(getEffectTypeAndIntensity(65)).toEqual({
      type: "rain",
      intensity: "heavy",
    });
    expect(getEffectTypeAndIntensity(66).intensity).toBe("light");
    expect(getEffectTypeAndIntensity(67).intensity).toBe("heavy");
    expect(getEffectTypeAndIntensity(80).intensity).toBe("light");
    expect(getEffectTypeAndIntensity(82).intensity).toBe("heavy");
  });

  it("keeps snow and rain physics ordering consistent", () => {
    const rain = getEffectTypeAndIntensity(61);
    const snow = getEffectTypeAndIntensity(71);
    expect(rain.type).toBe("rain");
    expect(snow.type).toBe("snow");
  });

  it("returns snow for 71, 73, 75, 85, 86", () => {
    expect(getEffectTypeAndIntensity(71).type).toBe("snow");
    expect(getEffectTypeAndIntensity(73).type).toBe("snow");
    expect(getEffectTypeAndIntensity(75).type).toBe("snow");
    expect(getEffectTypeAndIntensity(85).type).toBe("snow");
    expect(getEffectTypeAndIntensity(86).type).toBe("snow");
  });

  it("returns thunderstorm for 95, 96, 99", () => {
    expect(getEffectTypeAndIntensity(95).type).toBe("thunderstorm");
    expect(getEffectTypeAndIntensity(96).type).toBe("thunderstorm");
    expect(getEffectTypeAndIntensity(99).type).toBe("thunderstorm");
    expect(getEffectTypeAndIntensity(99).intensity).toBe("heavy");
  });

  it("returns clear/light for out-of-range codes", () => {
    expect(getEffectTypeAndIntensity(-1)).toEqual({
      type: "clear",
      intensity: "light",
    });
    expect(getEffectTypeAndIntensity(100)).toEqual({
      type: "clear",
      intensity: "light",
    });
  });
});

describe("getCloudCoverFromWeatherCode", () => {
  it("returns 0, 0.2, 0.55, 0.95 for codes 0–3", () => {
    expect(getCloudCoverFromWeatherCode(0)).toBe(0);
    expect(getCloudCoverFromWeatherCode(1)).toBe(0.2);
    expect(getCloudCoverFromWeatherCode(2)).toBe(0.55);
    expect(getCloudCoverFromWeatherCode(3)).toBe(0.95);
  });

  it("returns high cloud cover for fog and precipitation", () => {
    expect(getCloudCoverFromWeatherCode(45)).toBe(0.9);
    expect(getCloudCoverFromWeatherCode(61)).toBe(0.85);
    expect(getCloudCoverFromWeatherCode(95)).toBe(0.85);
  });
});
