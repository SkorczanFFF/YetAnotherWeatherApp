import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MapPicker.scss";

const DRAWER_WIDTH_MIN = 385;
const DRAWER_WIDTH_MAX = 800;

const PIN_SIZE = 36;

function createMarkerIcon(pinSvgHtml: string): L.DivIcon {
  return L.divIcon({
    className: "map-picker-marker",
    html: pinSvgHtml,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
  });
}

const PinSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z"
      fill="oklch(0.82 0.14 62)"
      stroke="oklch(0.34 0.06 240)"
    />
    <circle cx="12" cy="9" r="2.6" fill="oklch(0.34 0.06 240)" stroke="none" />
  </svg>
);

const DEFAULT_CENTER: [number, number] = [52, 21];
const DEFAULT_ZOOM = 4;

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onPickLocation: (lat: number, lon: number) => void;
  /** Optional initial center from current weather */
  initialCenter?: [number, number];
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/** Calls map.invalidateSize() when drawer width changes so the map fills the resized container. */
function MapInvalidateSize({ drawerWidth }: { drawerWidth: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, drawerWidth]);
  return null;
}

export function MapPicker({
  open,
  onClose,
  onPickLocation,
  initialCenter,
}: MapPickerProps) {
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_WIDTH_MIN);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const center = initialCenter ?? DEFAULT_CENTER;

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = drawerWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const next = Math.min(DRAWER_WIDTH_MAX, Math.max(DRAWER_WIDTH_MIN, startWidth + delta));
      setDrawerWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [drawerWidth]);

  const pinIconHtml = useMemo(
    () =>
      renderToStaticMarkup(
        <span
          aria-hidden="true"
          className="map-picker-marker__pin"
          style={{ width: PIN_SIZE, height: PIN_SIZE, display: "block" }}
        >
          <PinSvg />
        </span>
      ),
    []
  );
  const markerIcon = useMemo(() => createMarkerIcon(pinIconHtml), [pinIconHtml]);

  const handlePick = useCallback((lat: number, lon: number) => {
    setPicked({ lat, lon });
  }, []);

  const handleConfirm = useCallback(() => {
    if (picked) {
      onPickLocation(picked.lat, picked.lon);
      onClose();
      setPicked(null);
    }
  }, [picked, onPickLocation, onClose]);

  useEffect(() => {
    if (!open) {
      setPicked(null);
      if (triggerRef.current) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    } else {
      triggerRef.current = document.activeElement as HTMLElement;
      if (initialCenter) {
        setPicked({ lat: initialCenter[0], lon: initialCenter[1] });
      }
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [open, initialCenter]);

  useEffect(() => {
    if (!open) return;
    const drawer = document.querySelector(".map-picker-drawer") as HTMLElement;
    if (!drawer) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = drawer.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <div
      className={`map-picker-backdrop ${open ? "map-picker-backdrop--open" : ""}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="map-picker-backdrop__overlay"
        onClick={onClose}
        aria-label="Close map panel"
      />
      <aside
        className={`map-picker-drawer ${open ? "map-picker-drawer--open" : ""}`}
        style={{ width: drawerWidth }}
        role="dialog"
        aria-modal="true"
        aria-label="Pick a location on the map"
      >
        <div
          className="map-picker-drawer__resize-handle"
          onMouseDown={handleResizeMouseDown}
          role="presentation"
          aria-hidden
        >
          <span className="map-picker-drawer__resize-grip" aria-hidden>
            <span /><span /><span />
          </span>
        </div>
        <header className="map-picker-header">
          <span className="map-picker-header__pin" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </span>
          <h2>Pick location</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="map-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="map-picker-body">
          {open && (
            <div className="map-picker-map-container">
              <MapContainer
                center={center}
                zoom={DEFAULT_ZOOM}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <MapInvalidateSize drawerWidth={drawerWidth} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPick={handlePick} />
                {picked && (
                  <Marker
                    key={`${picked.lat}-${picked.lon}`}
                    position={[picked.lat, picked.lon]}
                    icon={markerIcon}
                  >
                    <Popup>
                      {picked.lat.toFixed(4)}, {picked.lon.toFixed(4)}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          )}
          <div className="map-picker-actions">
            <div className="map-picker-coords" aria-live="polite">
              <span className="k">Selected</span>
              {picked ? (
                <span className="v">
                  Lat {picked.lat.toFixed(3)} · Lon {picked.lon.toFixed(3)}
                </span>
              ) : (
                <span className="v map-picker-coords--empty">Click on the map to pick</span>
              )}
            </div>
            <button
              type="button"
              className="map-picker-confirm"
              onClick={handleConfirm}
              disabled={!picked}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              Use this location
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
