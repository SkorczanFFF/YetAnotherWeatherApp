import { useEffect, useState } from "react";
import { formatToLocalTime } from "../utils/format";

interface LiveClock {
  /** "Friday, 16 October 2026" in the location's zone. */
  datePart: string;
  /** "14:36" in the location's zone. */
  timePart: string;
  nowSeconds: number;
}

const read = (timezone: string): LiveClock => {
  const nowSeconds = Date.now() / 1000;
  return {
    datePart: formatToLocalTime(nowSeconds, timezone, "cccc, dd LLLL yyyy"),
    timePart: formatToLocalTime(nowSeconds, timezone, "HH:mm"),
    nowSeconds,
  };
};

/** The current date and time at the location, refreshed every 15 s. */
export function useLiveClock(timezone: string): LiveClock {
  const [live, setLive] = useState(() => read(timezone));
  useEffect(() => {
    const tick = () => setLive(read(timezone));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [timezone]);
  return live;
}
