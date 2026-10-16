import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LoaderPill } from "../loader/Loader";
import { CloseIcon, LineIcon, PIN_PATH, PinIcon } from "../icons";
import { formatCoords, formatLatLon } from "../../utils/format";
import { DEFAULT_LOCATION } from "../../weather/sceneParams";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useDrawerResize, useSlowTileLoading } from "./hooks";
import "./MapPicker.scss";

const DRAWER_WIDTH_MIN = 385;
const DRAWER_WIDTH_MAX = 800;

const PIN_SIZE = 36;
const TILES_LOADER_DELAY_MS = 250;
/** Outline and dot of the map pin (its fill is the accent). */
const PIN_INK = "oklch(0.34 0.06 240)";

const MARKER_ICON = L.divIcon({
  className: "map-picker-marker",
  html:
    `<span aria-hidden="true" class="map-picker-marker__pin" style="width:${PIN_SIZE}px;height:${PIN_SIZE}px;display:block">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${PIN_PATH}" stroke="${PIN_INK}" style="fill:var(--accent-warm)" />` +
    `<circle cx="12" cy="9" r="2.6" fill="${PIN_INK}" />` +
    `</svg></span>`,
  iconSize: [PIN_SIZE, PIN_SIZE],
  iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
});

const DEFAULT_CENTER: [number, number] = [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon];
const DEFAULT_ZOOM = 4;

interface MapPickerProps {
  open: boolean;
  onClose: () => void;
  onPickLocation: (lat: number, lon: number) => void;
  /** Map centre and pre-picked pin, applied when the drawer opens (else DEFAULT_CENTER). */
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
  const { width: drawerWidth, onResizeMouseDown } = useDrawerResize(DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX);
  const { loading: tilesLoading, tileEvents } = useSlowTileLoading(open, TILES_LOADER_DELAY_MS);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useDialogFocus(open, drawerRef, onClose, closeButtonRef);
  const center = initialCenter ?? DEFAULT_CENTER;
  // Read on open only: App passes a new tuple every render.
  const centerRef = useRef(initialCenter);
  centerRef.current = initialCenter;

  // Opening pre-picks the current location; closing forgets the pick.
  useEffect(() => {
    const c = centerRef.current;
    setPicked(open && c ? { lat: c[0], lon: c[1] } : null);
  }, [open]);

  const handleConfirm = () => {
    if (picked) {
      onPickLocation(picked.lat, picked.lon);
      onClose();
    }
  };

  return (
    <div
      className={`map-picker-backdrop ${open ? "map-picker-backdrop--open" : ""}`}
      aria-hidden={!open}
      inert={!open}
    >
      <button
        type="button"
        className="map-picker-backdrop__overlay"
        onClick={onClose}
        aria-label="Close map panel"
      />
      <aside
        ref={drawerRef}
        className={`map-picker-drawer ${open ? "map-picker-drawer--open" : ""}`}
        style={{ width: drawerWidth }}
        role="dialog"
        aria-modal="true"
        aria-label="Pick a location on the map"
      >
        <div
          className="map-picker-drawer__resize-handle"
          onMouseDown={onResizeMouseDown}
          role="presentation"
          aria-hidden
        >
          <span className="map-picker-drawer__resize-grip" aria-hidden>
            <span /><span /><span />
          </span>
        </div>
        <header className="map-picker-header">
          <span className="map-picker-header__pin">
            <PinIcon />
          </span>
          <h2>Pick location</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="map-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon strokeWidth={1.8} />
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
                  eventHandlers={tileEvents}
                />
                <MapClickHandler onPick={(lat, lon) => setPicked({ lat, lon })} />
                {picked && (
                  <Marker
                    key={`${picked.lat}-${picked.lon}`}
                    position={[picked.lat, picked.lon]}
                    icon={MARKER_ICON}
                  >
                    <Popup>
                      {formatCoords(picked.lat, picked.lon, 4)}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
              <div className="map-picker-loading">
                <LoaderPill label="Loading map" visible={tilesLoading} />
              </div>
            </div>
          )}
          <div className="map-picker-actions">
            <div className="map-picker-coords" aria-live="polite">
              <span className="k">Selected</span>
              {picked ? (
                <span className="v">
                  {formatLatLon(picked.lat, picked.lon, 3)}
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
              <LineIcon strokeWidth={2}>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </LineIcon>
              Use this location
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
