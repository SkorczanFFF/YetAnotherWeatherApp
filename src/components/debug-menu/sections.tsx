import * as SunCalc from "suncalc";
import { DateTime } from "luxon";
import { getFrostAmount } from "../../weather/frost";
import { WEATHER_PRESETS } from "../../weather/scenePresets";
import type { Auto } from "../../weather/overrides";
import { QUALITY_TIERS, type QualityTier } from "../../weather-scene/core/quality";
import { DEFAULT_PARALLAX, facingFor } from "../../weather-scene/core/worldFrame";
import { formatToLocalTime, toCardinal } from "../../utils/format";
import { FlagChip, NumericField, OptionButton, PerfReadout } from "./fields";
import { describeScreenDrift, fmt, moonPhaseName, useDebug } from "./helpers";

const COMPASS = [0, 45, 90, 135, 180, 225, 270, 315];
const QUALITY_OPTIONS: Auto<QualityTier>[] = ["auto", ...QUALITY_TIERS];

interface PresetSectionProps {
  /** Id of the preset the pins match, "custom", or null with no weather pinned. */
  active: string | null;
  onApply: (id: string | null) => void;
}

export function PresetSection({ active, onApply }: PresetSectionProps) {
  return (
    <div className="debug-menu-group">
      <label>Weather preset</label>
      <div className="debug-menu-button-group">
        <OptionButton active={active === null} onClick={() => onApply(null)}>
          auto
        </OptionButton>
        {WEATHER_PRESETS.map((p) => (
          <OptionButton key={p.id} active={active === p.id} onClick={() => onApply(p.id)} title={p.note}>
            {p.label}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

export function TimeSection() {
  const { o, set, effective: e } = useDebug();
  const time = e.time ?? Date.now();
  const sunAlt = SunCalc.getPosition(new Date(time), e.lat, e.lon).altitude;
  const moon = SunCalc.getMoonIllumination(new Date(time));
  const hourValue = typeof o.hour === "number" ? o.hour : null;
  const local = DateTime.fromMillis(time).setZone(e.timezone);
  const liveHour = local.hour + local.minute / 60;
  return (
    <>
      <div className="debug-menu-group">
        <label>
          Local hour{" "}
          <span className="debug-menu-current">
            ({hourValue === null ? "live" : "pinned"} {formatToLocalTime(time / 1000, e.timezone, "HH:mm")})
          </span>
        </label>
        <div className="debug-menu-row">
          <input
            type="range"
            min={0}
            max={24}
            step={0.25}
            value={hourValue ?? liveHour}
            onChange={(ev) => set("hour", parseFloat(ev.target.value))}
          />
          <OptionButton active={hourValue === null} onClick={() => set("hour", "auto")}>
            live
          </OptionButton>
        </div>
      </div>
      <div className="debug-menu-row">
        <div className="debug-menu-group debug-menu-group--half">
          <label>
            Date
            <input
              type="text"
              placeholder="auto (today) YYYY-MM-DD"
              value={typeof o.date === "string" && o.date !== "auto" ? o.date : ""}
              onChange={(ev) => set("date", ev.target.value.trim() === "" ? "auto" : ev.target.value.trim())}
            />
          </label>
        </div>
        <div className="debug-menu-group debug-menu-group--half">
          <label>Sky</label>
          <div className="debug-menu-readout">
            sun {fmt(sunAlt)}° · moon {moonPhaseName(moon.phase)} {Math.round(moon.fraction * 100)}%
          </div>
        </div>
      </div>
    </>
  );
}

export function CloudSection() {
  const { current: c, effective: e } = useDebug();
  const p = e.cloudPhysics;
  return (
    <>
      <div className="debug-menu-row">
        <NumericField label="Cloud low" field="cloudLow" step={0.05} min={0} max={1} current={fmt(c.clouds.low, 2)} />
        <NumericField label="mid" field="cloudMid" step={0.05} min={0} max={1} current={fmt(c.clouds.mid, 2)} />
        <NumericField label="high" field="cloudHigh" step={0.05} min={0} max={1} current={fmt(c.clouds.high, 2)} />
      </div>
      <div className="debug-menu-row">
        <NumericField label="Base m" field="cloudBase" step={100} min={0} current={fmt(c.cloudPhysics.baseM, 0)} />
        <NumericField label="Top m" field="cloudTop" step={250} min={0} current={fmt(c.cloudPhysics.topM, 0)} />
        <NumericField label="CAPE J/kg" field="cape" step={100} min={0} current={fmt(c.cloudPhysics.cape, 0)} />
        <NumericField label="τ" field="opticalDepth" step={2} min={0} current={fmt(c.cloudPhysics.opticalDepth)} />
      </div>
      <div className="debug-menu-group">
        <div className="debug-menu-readout">
          {p.midDeck
            ? `mid deck ${fmt(p.deckBaseM, 0)}–${fmt(p.deckTopM, 0)} m (LCL ${fmt(p.baseM, 0)} m)`
            : `clouds ${fmt(p.baseM, 0)}–${fmt(p.topM, 0)} m`}
          {p.midLayer && ` + mid layer ~${fmt(p.midAltM, 0)} m`}
          {` · τ ${fmt(p.opticalDepth)}`}
          {p.opticalDepthMeasured ? " (radiation)" : " (estimated)"} · convection {Math.round(p.convection * 100)}%
          {p.liftedIndex != null && ` · LI ${fmt(p.liftedIndex)}`}
          {p.boundaryLayerM != null && ` · BL ${fmt(p.boundaryLayerM, 0)} m`}
          {` · 0 °C at ${fmt(p.freezingLevelM, 0)} m`}
          {p.directFraction != null && ` · sun through clouds ${Math.round(p.directFraction * 100)}%`}
          {` · frost ${Math.round(getFrostAmount(e) * 100)}%`}
        </div>
      </div>
    </>
  );
}

export function WindSection() {
  const { o, set, current: c, effective: e } = useDebug();
  const facing = facingFor(e.lat);
  const { windLow, windHigh } = e.cloudPhysics;
  return (
    <>
      <div className="debug-menu-row">
        <NumericField label="Wind m/s" field="windSpeed" step={1} min={0} current={fmt(c.wind.speedMs)} />
        <NumericField label="Gust m/s" field="windGust" step={1} min={0} current={fmt(c.wind.gustMs)} />
        <NumericField label="From °" field="windFrom" step={15} min={0} max={360} current={`${Math.round(c.wind.fromDeg)} ${toCardinal(c.wind.fromDeg)}`} />
      </div>
      <div className="debug-menu-group">
        <div className="debug-menu-button-group">
          {COMPASS.map((deg) => (
            <OptionButton key={deg} active={o.windFrom === deg} onClick={() => set("windFrom", deg)}>
              {toCardinal(deg)}
            </OptionButton>
          ))}
        </div>
        <div className="debug-menu-readout">
          surface from {toCardinal(e.wind.fromDeg)} · 850 hPa {fmt(windLow.speedMs)} m/s from {toCardinal(windLow.fromDeg)} → clouds drift {describeScreenDrift(windLow.fromDeg, facing)} · 300 hPa (cirrus) {fmt(windHigh.speedMs)} m/s from {toCardinal(windHigh.fromDeg)} (facing {facing})
        </div>
      </div>
    </>
  );
}

export function PrecipSection({ onForceLightning }: { onForceLightning: () => void }) {
  const { current: c, effective: e } = useDebug();
  return (
    <>
      <div className="debug-menu-row">
        <NumericField label="Rain mm/h" field="rain" step={0.5} min={0} current={fmt(c.precip.rainMmH)} />
        <NumericField label="Snow cm/h" field="snow" step={0.25} min={0} current={fmt(c.precip.snowCmH, 2)} />
      </div>
      <div className="debug-menu-group">
        <div className="debug-menu-button-group">
          <FlagChip label="drizzle" field="drizzle" effective={e.precip.drizzle} />
          <FlagChip label="freezing" field="freezing" effective={e.precip.freezing} />
          <FlagChip label="showers" field="showers" effective={e.precip.showers} />
          <FlagChip label="hail" field="hail" effective={e.precip.hail} />
          <FlagChip label="grains" field="grains" effective={e.precip.grains} />
          <FlagChip label="thunder" field="thunder" effective={e.thunder} />
          <OptionButton onClick={onForceLightning}>⚡ force lightning</OptionButton>
        </div>
      </div>
    </>
  );
}

export function AtmosphereSection() {
  const { current: c, effective: e } = useDebug();
  return (
    <>
      <div className="debug-menu-row">
        <NumericField label="Visibility m" field="visibility" step={100} min={50} current={fmt(c.fog.visibilityM, 0)} />
        <NumericField label="Temp °C" field="temperature" step={1} current={fmt(c.temperatureC)} />
        <NumericField label="Humidity" field="humidity" step={0.05} min={0} max={1} current={fmt(c.humidity, 2)} />
      </div>
      <div className="debug-menu-row">
        <NumericField label="Parallax 0–1" field="parallax" step={0.05} min={0} max={1} current={fmt(DEFAULT_PARALLAX, 2)} />
        <div className="debug-menu-group debug-menu-group--half">
          <label>Rime</label>
          <div className="debug-menu-button-group">
            <FlagChip label="rime" field="rime" effective={e.fog.rime} />
          </div>
        </div>
      </div>
    </>
  );
}

interface ToolsSectionProps {
  showPerf: boolean;
  onShowPerfChange: (show: boolean) => void;
}

export function ToolsSection({ showPerf, onShowPerfChange }: ToolsSectionProps) {
  const { o, set } = useDebug();
  return (
    <>
      <div className="debug-menu-group">
        <label>Quality tier</label>
        <div className="debug-menu-button-group">
          {QUALITY_OPTIONS.map((q) => (
            <OptionButton key={q} active={(o.quality ?? "auto") === q} onClick={() => set("quality", q)}>
              {q}
            </OptionButton>
          ))}
        </div>
      </div>
      <div className="debug-menu-group">
        <label>Tools</label>
        <div className="debug-menu-button-group">
          <OptionButton active={showPerf} onClick={() => onShowPerfChange(!showPerf)}>
            perf
          </OptionButton>
        </div>
        {showPerf && <PerfReadout />}
      </div>
    </>
  );
}
