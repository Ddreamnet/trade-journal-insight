import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  createSeriesMarkers,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type AreaData,
  type LineData,
  type UTCTimestamp,
  type SeriesMarker,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";

import type { PricePoint } from "@/hooks/useStockHistory";

/**
 * PriceChart — touch-first price series renderer built on lightweight-charts.
 *
 * What this primitive gets right for mobile:
 *   - Real touch gestures (pan + pinch zoom) out of the box
 *   - A dedicated crosshair callback so the *page header* can double as the
 *     tooltip readout — fingers never obscure the tip
 *   - Markers plotted at exact timestamps for buy / sell events
 *   - Optional overlay series for benchmark comparison, each with a distinct
 *     dashed style so the main series stays visually dominant
 *
 * Time format: we pass ISO 'YYYY-MM-DD' strings through as `Time`; the
 * library treats these as business days in the viewer's local zone, which
 * is what we want for end-of-day data.
 */

export interface PriceMarker {
  /** ISO date 'YYYY-MM-DD'. */
  time: string;
  side: "buy" | "sell";
  /** Short tooltip text (lot quantity, price, etc.). */
  text?: string;
  /** Opaque id the parent can use to route a click. */
  id: string;
}

export interface OverlaySeries {
  id: string;
  label: string;
  color: string;
  points: PricePoint[];
}

export interface CrosshairReadout {
  /** ISO date. */
  date: string;
  /** Primary series value at this point. */
  value: number | null;
  /** Values for each overlay series, keyed by overlay id. */
  overlays: Record<string, number | null>;
}

interface PriceChartProps {
  points: PricePoint[];
  markers?: PriceMarker[];
  overlays?: OverlaySeries[];
  /** Fired while the user scrubs. `null` means pointer left the chart. */
  onCrosshairMove?: (readout: CrosshairReadout | null) => void;
  onMarkerClick?: (markerId: string) => void;
  /** CSS height. Parent controls. */
  height?: number | string;
  /** Lock to a visible time window — defaults to fit all data. */
  visibleRange?: { from: string; to: string };
  className?: string;
}

const THEME = {
  background: "transparent",
  textColor: "hsl(220, 9%, 62%)",
  gridColor: "hsl(222, 10%, 13%)",
  borderColor: "hsl(222, 10%, 18%)",
  crosshair: "hsl(217, 91%, 60%)",
  seriesLine: "hsl(217, 91%, 60%)",
  seriesTopArea: "hsla(217, 91%, 60%, 0.28)",
  seriesBottomArea: "hsla(217, 91%, 60%, 0.00)",
  profit: "hsl(151, 64%, 43%)",
  loss: "hsl(0, 78%, 58%)",
};

function toAreaData(points: PricePoint[]): AreaData<Time>[] {
  return points.map((p) => ({ time: p.date as Time, value: p.value }));
}

function toLineData(points: PricePoint[]): LineData<Time>[] {
  return points.map((p) => ({ time: p.date as Time, value: p.value }));
}

function buildMarkers(markers: PriceMarker[]): SeriesMarker<Time>[] {
  return markers
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map<SeriesMarker<Time>>((m) => ({
      time: m.time as Time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: m.side === "buy" ? THEME.profit : THEME.loss,
      shape: m.side === "buy" ? "arrowUp" : "arrowDown",
      text: m.text,
      id: m.id,
    }));
}

/** Turn a Time (string|BusinessDay|UTCTimestamp) into an ISO date. */
function timeToIsoDate(t: Time): string {
  if (typeof t === "string") return t;
  if (typeof t === "number") {
    // UTCTimestamp = seconds since epoch
    return new Date((t as UTCTimestamp) * 1000).toISOString().slice(0, 10);
  }
  // BusinessDay { year, month, day }
  const bd = t as { year: number; month: number; day: number };
  const mm = String(bd.month).padStart(2, "0");
  const dd = String(bd.day).padStart(2, "0");
  return `${bd.year}-${mm}-${dd}`;
}

export function PriceChart({
  points,
  markers = [],
  overlays = [],
  onCrosshairMove,
  onMarkerClick,
  height = 380,
  visibleRange,
  className,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  // Stable handler refs so we don't re-init the chart on parent re-renders
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  const onMarkerClickRef = useRef(onMarkerClick);
  onCrosshairMoveRef.current = onCrosshairMove;
  onMarkerClickRef.current = onMarkerClick;

  // ── 1. Init chart once ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: THEME.background },
        textColor: THEME.textColor,
        fontFamily: "Inter, system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: THEME.gridColor, style: LineStyle.Dotted },
        horzLines: { color: THEME.gridColor, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: THEME.borderColor,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: THEME.borderColor,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 4,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: THEME.crosshair,
          width: 1,
          style: LineStyle.Solid,
          labelVisible: false,
        },
        horzLine: {
          color: THEME.crosshair,
          width: 1,
          style: LineStyle.Solid,
          labelVisible: false,
        },
      },
      autoSize: true,
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    const mainSeries = chart.addSeries(AreaSeries, {
      lineColor: THEME.seriesLine,
      topColor: THEME.seriesTopArea,
      bottomColor: THEME.seriesBottomArea,
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: THEME.seriesLine,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: THEME.seriesLine,
      crosshairMarkerBackgroundColor: THEME.seriesLine,
    });

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;

    // Crosshair subscription → fire readout callback
    const handleCrosshair = (param: MouseEventParams<Time>) => {
      const cb = onCrosshairMoveRef.current;
      if (!cb) return;

      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        cb(null);
        return;
      }

      const isoDate = timeToIsoDate(param.time);
      const mainPoint = mainSeriesRef.current
        ? param.seriesData.get(mainSeriesRef.current)
        : null;

      const mainValue =
        mainPoint && "value" in mainPoint
          ? (mainPoint.value as number)
          : null;

      const overlayValues: Record<string, number | null> = {};
      overlaySeriesRef.current.forEach((series, id) => {
        const p = param.seriesData.get(series);
        overlayValues[id] = p && "value" in p ? (p.value as number) : null;
      });

      cb({ date: isoDate, value: mainValue, overlays: overlayValues });
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    // Marker click subscription
    const handleClick = (param: MouseEventParams<Time>) => {
      const cb = onMarkerClickRef.current;
      if (!cb) return;
      // MouseEventParams exposes `hoveredObjectId` for markers in v5
      const id = (param as unknown as { hoveredObjectId?: unknown }).hoveredObjectId;
      if (typeof id === "string") cb(id);
    };
    chart.subscribeClick(handleClick);

    // Capture the ref value for cleanup — guards against the React-hooks
    // lint warning about stale ref-access on unmount, and documents intent.
    const overlayMap = overlaySeriesRef.current;

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.unsubscribeClick(handleClick);
      overlayMap.clear();
      markersApiRef.current = null;
      mainSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  // ── 2. Main series data ───────────────────────────────────────
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;
    series.setData(toAreaData(points));
    if (points.length > 0 && !visibleRange) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [points, visibleRange]);

  // ── 3. Explicit visible range ─────────────────────────────────
  useEffect(() => {
    if (!visibleRange || !chartRef.current) return;
    chartRef.current.timeScale().setVisibleRange({
      from: visibleRange.from as Time,
      to: visibleRange.to as Time,
    });
  }, [visibleRange]);

  // ── 4. Markers ────────────────────────────────────────────────
  const memoizedMarkers = useMemo(() => buildMarkers(markers), [markers]);
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;

    if (!markersApiRef.current) {
      markersApiRef.current = createSeriesMarkers(series, memoizedMarkers);
    } else {
      markersApiRef.current.setMarkers(memoizedMarkers);
    }
  }, [memoizedMarkers]);

  // ── 5. Overlay series (add/update/remove) ────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const existing = overlaySeriesRef.current;
    const wantedIds = new Set(overlays.map((o) => o.id));

    // Remove overlays no longer wanted
    existing.forEach((series, id) => {
      if (!wantedIds.has(id)) {
        chart.removeSeries(series);
        existing.delete(id);
      }
    });

    // Add or update the rest
    overlays.forEach((o) => {
      let series = existing.get(o.id);
      if (!series) {
        series = chart.addSeries(LineSeries, {
          color: o.color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        existing.set(o.id, series);
      } else {
        series.applyOptions({ color: o.color });
      }
      series.setData(toLineData(o.points));
    });
  }, [overlays]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    />
  );
}
