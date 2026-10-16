import React, { useMemo, useRef } from "react";
import type { SceneParams } from "../../weather/sceneParams";
import type { SceneOverrides } from "../../weather/overrides";
import { WEATHER_PRESETS } from "../../weather/scenePresets";
import { CloseIcon, LineIcon } from "../icons";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { DebugContext, type DebugState } from "./helpers";
import {
  AtmosphereSection,
  CloudSection,
  PrecipSection,
  PresetSection,
  TimeSection,
  ToolsSection,
  WindSection,
} from "./sections";
import "./DebugMenu.scss";

interface DebugMenuProps {
  open: boolean;
  onClose: () => void;
  overrides: SceneOverrides | null;
  /** A state setter: updates go through the latest overrides, so two in one tick both land. */
  onOverridesChange: React.Dispatch<React.SetStateAction<SceneOverrides | null>>;
  /** Weather-driven values (no overrides) — shown as the "auto" hint. */
  currentParams: SceneParams;
  /** What the scene is actually rendering. */
  effectiveParams: SceneParams;
  showPerf: boolean;
  onShowPerfChange: (show: boolean) => void;
  onForceLightning: () => void;
}

/** Keys a preset owns — "Auto" preset clears exactly these. */
const PRESET_KEYS = Object.keys(WEATHER_PRESETS[0].overrides) as (keyof SceneOverrides)[];

export const DebugMenu: React.FC<DebugMenuProps> = ({
  open,
  onClose,
  overrides,
  onOverridesChange,
  currentParams,
  effectiveParams,
  showPerf,
  onShowPerfChange,
  onForceLightning,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(open, panelRef, onClose, closeRef);
  const o = useMemo(() => overrides ?? {}, [overrides]);
  const state = useMemo<DebugState>(
    () => ({
      o,
      set: (key, value) => onOverridesChange((prev) => ({ ...prev, [key]: value })),
      current: currentParams,
      effective: effectiveParams,
    }),
    [o, onOverridesChange, currentParams, effectiveParams],
  );

  if (!open) return null;

  // Derived, so editing any weather field after picking a preset unhighlights it.
  const activePreset = PRESET_KEYS.every((k) => o[k] === undefined || o[k] === "auto")
    ? null
    : (WEATHER_PRESETS.find((p) => PRESET_KEYS.every((k) => o[k] === p.overrides[k]))?.id ?? "custom");

  const applyPreset = (id: string | null) =>
    onOverridesChange((prev) => {
      const cleared: SceneOverrides = { ...prev };
      PRESET_KEYS.forEach((k) => delete cleared[k]);
      const preset = WEATHER_PRESETS.find((p) => p.id === id);
      return preset ? { ...cleared, ...preset.overrides } : cleared;
    });

  return (
    <div className="debug-menu-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="debug-menu-panel"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Debug menu"
      >
        <div className="debug-menu-header">
          <h2>Debug panel</h2>
          <div className="debug-menu-header-actions">
            <button type="button" className="debug-menu-icon-btn" onClick={() => onOverridesChange(null)} title="Reset all to auto" aria-label="Reset all to auto">
              <LineIcon strokeWidth={2}>
                <path d="M4 12a8 8 0 1 0 2.3-5.6" />
                <path d="M4 4v4h4" />
              </LineIcon>
            </button>
            <button ref={closeRef} type="button" className="debug-menu-icon-btn" onClick={onClose} title="Close" aria-label="Close debug menu">
              <CloseIcon />
            </button>
          </div>
        </div>
        <DebugContext.Provider value={state}>
          <div className="debug-menu-body">
            <PresetSection active={activePreset} onApply={applyPreset} />
            <TimeSection />
            <CloudSection />
            <WindSection />
            <PrecipSection onForceLightning={onForceLightning} />
            <AtmosphereSection />
            <ToolsSection showPerf={showPerf} onShowPerfChange={onShowPerfChange} />
          </div>
        </DebugContext.Provider>
      </div>
    </div>
  );
};
