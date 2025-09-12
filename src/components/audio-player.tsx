"use client";

import { Pause, Play } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";

export function AudioPlayer(props: { file: File }) {
  const { file } = props;
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [current, setCurrent] = React.useState(0);

  // Create and clean up object URL
  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    };
  }, [file]);

  // Tick current time
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-bind when URL (src) changes.
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime || 0);
    const onLoaded = () => {
      setDuration(el.duration || 0);
      setReady(true);
    };
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnd);
    // If metadata already available (e.g., cache), initialize immediately
    if (el.readyState >= 1 /* HAVE_METADATA */) {
      onLoaded();
    }
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnd);
    };
  }, [url]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  const onScrub = (vals: number[]) => {
    const el = audioRef.current;
    if (!el || !vals?.length) return;
    const t = Math.max(0, Math.min(duration || 0, vals[0] || 0));
    el.currentTime = t;
    setCurrent(t);
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <div className="w-full rounded border p-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          {ready ? (
            <Slider
              value={[Math.min(current, duration || 0)]}
              max={Math.max(duration || 0, 0)}
              step={0.1}
              onValueChange={onScrub}
              aria-label="Seek"
            />
          ) : (
            <div className="py-1">
              <Skeleton className="h-2 w-full" />
            </div>
          )}
        </div>
        {ready ? (
          <div className="tabular-nums text-xs text-muted-foreground shrink-0">
            {fmt(current)} / {fmt(duration)}
          </div>
        ) : (
          <div className="shrink-0 w-14">
            <Skeleton className="h-3 w-full" />
          </div>
        )}
      </div>
      {/* Hidden native element for playback */}
      {url ? (
        // biome-ignore lint/a11y/useMediaCaption: Custom controls with no external captions file.
        <audio ref={audioRef} src={url} preload="metadata" />
      ) : null}
    </div>
  );
}
