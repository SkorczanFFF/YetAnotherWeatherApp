import React, { useState, useEffect, useCallback, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { VscClose } from "react-icons/vsc";
import { IoPinSharp } from "react-icons/io5";
import { BsGripVertical } from "react-icons/bs";
import "leaflet/dist/leaflet.css";
import "./MapPicker.scss";

const DRAWER_WIDTH_MIN = 385;
const DRAWER_WIDTH_MAX = 800;

const PIN_SIZE = 32;

function createMarkerIcon(pinSvgHtml: string): L.DivIcon {
  return L.divIcon({
    className: "map-picker-marker",
    html: pinSvgHtml,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
  });
}

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
        <span aria-hidden="true" className="map-picker-marker__pin">
          <IoPinSharp size={PIN_SIZE} color="#dc2626" />
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
    if (!open) setPicked(null);
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
          <BsGripVertical className="map-picker-drawer__resize-handle-icon" aria-hidden />
        </div>
        <header className="map-picker-header">
          <h2>Pick location</h2>
          <button
            type="button"
            className="map-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <VscClose size={20} />
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
            <button
              type="button"
              className="map-picker-confirm"
              onClick={handleConfirm}
              disabled={!picked}
            >
              Use this location
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
