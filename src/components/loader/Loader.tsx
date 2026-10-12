import React from "react";
import "./Loader.scss";

/** Glass ring with a warm comet; sized by `--spinner-size` (default 1em). */
export const Spinner = (): React.ReactElement => (
  <span className="loader-spinner" aria-hidden="true" />
);

interface LoaderPillProps {
  label: string;
  /** Kept mounted while hidden so it can fade out with its last label. */
  visible: boolean;
}

/** Floating liquid-glass capsule: spinner + short status label. */
export const LoaderPill = ({ label, visible }: LoaderPillProps): React.ReactElement => (
  <div
    className="loader-pill"
    data-visible={visible}
    role="status"
    aria-live="polite"
  >
    <Spinner />
    {/* The visible label survives the fade-out; screen readers only get it while shown. */}
    <span className="loader-pill__label" aria-hidden="true">{label}</span>
    <span className="loader-sr-only">{visible ? label : ""}</span>
  </div>
);

interface LoaderPanelProps {
  label: string;
  detail?: string;
}

/** Larger glass card for the first load, when there is no data to show yet. */
export const LoaderPanel = ({ label, detail }: LoaderPanelProps): React.ReactElement => (
  <div className="loader-panel" role="status" aria-live="polite" aria-busy="true">
    <Spinner />
    <div className="loader-panel__text">
      <span className="loader-panel__label">{label}</span>
      {detail && <span className="loader-panel__detail">{detail}</span>}
    </div>
  </div>
);
