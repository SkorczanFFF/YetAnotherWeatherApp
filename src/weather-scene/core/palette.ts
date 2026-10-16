/**
 * Scene palette (sRGB hex → linear via Color). Read-only: copy into a scratch
 * colour before changing it. Look-alike pairs differ on purpose, as noted.
 */
import { Color } from "three";

// Horizon haze and fog → signals.horizonColor (SceneDriver).
export const DAY_HAZE = new Color("#c8d8e6");
export const TWILIGHT = new Color("#eda476");
export const NIGHT_HAZE = new Color("#141c30");
/** Darker than the sky's overcast veil: the horizon sits under far more cloud. */
export const HAZE_OVERCAST_DAY = new Color("#a3abb5");
export const HAZE_OVERCAST_NIGHT = new Color("#1b1f28");
/** Under a deck whose base glows at sunset: a dimmed, desaturated cousin of the cloud light. */
export const HAZE_OVERCAST_DUSK = new Color("#6e4038");
export const RIME_FOG = new Color("#e2e8ef");
export const HEAT_HAZE = new Color("#dccdb0");

// Sun disc and glow → signals.sunColor, over the real altitude 0…20°.
export const SUN_LOW = new Color("#ff8f4d");
export const SUN_HIGH = new Color("#fff3df");

// Ambient → signals.hemiSky / hemiGround.
export const HEMI_DAY = new Color("#a9c6e8");
export const HEMI_NIGHT = new Color("#1c2740");
export const HEMI_OVERCAST = new Color("#8f98a3");
export const GROUND_DAY = new Color("#5b5a55");
export const GROUND_NIGHT = new Color("#0d1018");

// Sky overlay (SkyGrade): night gradient and the overcast veil.
export const SKY_NIGHT_ZENITH = new Color("#05081a");
export const SKY_NIGHT_HORIZON = new Color("#172443");
export const SKY_OVERCAST_DAY = new Color("#b2bac4");
export const SKY_OVERCAST_NIGHT = new Color("#1a1e27");
export const SKY_OVERCAST_DUSK = new Color("#6a3a33");

// Cloud key light (VolumetricClouds). Redder low end than the sun disc, over
// −3…22°: light reaching a cloud base at dusk has crossed far more air.
export const CLOUD_SUN_LOW = new Color("#ff5f2e");
export const CLOUD_SUN_HIGH = new Color("#fff3e4");
export const CLOUD_MOON = new Color("#a9bedf");
/** Faint warm town glow on cloud undersides at night (linear, added to the ambient). */
export const CLOUD_NIGHT_GLOW = new Color(0.03, 0.022, 0.017);
/** Lightning lighting a cloud from inside (linear, GLSL in the march). */
export const CLOUD_LIGHTNING = new Color(0.8, 0.85, 1.0);

// Potato-tier deck (CloudDeck): lit day/night, the shade multiplier, storm grey.
export const DECK_DAY_LIT = new Color("#f4f6f9");
export const DECK_NIGHT_LIT = new Color("#2b3244");
export const DECK_SHADE = new Color("#7d8796");
export const DECK_STORM = new Color("#3c4049");

// Sky overlay literals (linear, GLSL in SkyGrade): the ground band under the horizon and the lightning flash.
export const SKY_GROUND = new Color(0.012, 0.014, 0.018);
export const SKY_FLASH = new Color(0.86, 0.9, 1.0);

// Night sky and moon.
export const STAR = new Color(0.92, 0.95, 1.0);
/** Moon disc albedo tint (Moon). */
export const MOON_DISC = new Color("#f4f1ea");
/** Moon lens flare, used as display values like the sun's (LensFlare). */
export const MOON_FLARE = new Color("#dfe7ff");

// Lightning bolt: glow and core (Thunder).
export const BOLT_GLOW = new Color("#c9d6ff");
export const BOLT_CORE = new Color("#f4f7ff");

// Frost on the pane, by day and dimmed at night (FrostGlass).
export const FROST_DAY = new Color("#e9f2fb");
export const FROST_NIGHT = new Color("#5d6b82");

export const DIAMOND_DUST = new Color("#ffffff");
