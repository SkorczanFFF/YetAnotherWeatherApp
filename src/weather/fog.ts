/** Visibility thresholds, m. */

/** WMO definition of fog: visibility under 1 km. */
export const FOG_VISIBILITY_M = 1000;
/** Upper bound on visibility under a fog code — the API reading is often optimistic. */
export const FOG_MAX_VISIBILITY_M = 700;
/** Rime needs supercooled fog: caps visibility when only the rime flag is pinned. */
export const RIME_VISIBILITY_M = 400;
/** Visibility assumed when the API sends none (and pinned by the clear presets). */
export const CLEAR_VISIBILITY_M = 24000;
