import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Headphones, WifiOff, AlertCircle, Loader2 } from "lucide-react";

export type LiveListenProps = {
  listenUrl: string | null;
};

const DEFAULT_SAMPLE_RATE = 16000;

export default function LiveListen({ listenUrl }: LiveListenProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const remoteSampleRateRef = useRef<number | null>(null);
  const remoteChannelsRef = useRef<number>(1);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const PREBUFFER_SEC = 0.15;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      disconnect();
    };
  }, []);

  function disconnect(options?: { suppressStatusReset?: boolean }) {
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;
    if (audioCtxRef.current) {
      // Closing AudioContext stops all scheduled playback
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    nextStartTimeRef.current = 0;
    remoteSampleRateRef.current = null;
    remoteChannelsRef.current = 1;
    if (!options?.suppressStatusReset) {
      setStatus("idle");
    }
  }

  async function connect() {
    if (!listenUrl) {
      setError("No listen URL available");
      setStatus("error");
      return;
    }
    try {
      setError(null);
      setStatus("connecting");
      // Ensure prior connections are closed
      disconnect({ suppressStatusReset: true });
      remoteSampleRateRef.current = null;
      remoteChannelsRef.current = 1;

      const AudioCtxCtor: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      let ctx: AudioContext;
      try {
        ctx = new AudioCtxCtor({ sampleRate: DEFAULT_SAMPLE_RATE });
      } catch {
        ctx = new AudioCtxCtor();
      }
      audioCtxRef.current = ctx;

      const ws = new WebSocket(listenUrl);
      ws.binaryType = "arraybuffer";
      ws.onopen = async () => {
        setStatus("connected");
        try {
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
        } catch {}
      };
      ws.onerror = () => {
        setError("WebSocket error");
        setStatus("error");
      };
      ws.onclose = () => {
        setStatus((s) => (s === "error" ? s : "idle"));
      };
      ws.onmessage = async (evt) => {
        try {
          let arrayBuffer: ArrayBuffer | null = null;
          if (evt.data instanceof ArrayBuffer) {
            arrayBuffer = evt.data as ArrayBuffer;
          } else if (evt.data instanceof Blob) {
            arrayBuffer = await (evt.data as Blob).arrayBuffer();
          } else if (typeof evt.data === "string") {
            handleControlMessage(evt.data);
            return;
          }
          if (!arrayBuffer) return;
          const ctxNow = audioCtxRef.current;
          if (!ctxNow) return;
          enqueuePcmChunk(ctxNow, arrayBuffer);
        } catch (err) {
          console.error("Listen playback error", err);
        }
      };
      wsRef.current = ws;
    } catch (err) {
      console.error("Listen connect error", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setStatus("error");
    }
  }

  function handleControlMessage(message: string) {
    try {
      const data = JSON.parse(message);
      if (typeof data.sampleRate === "number" && Number.isFinite(data.sampleRate) && data.sampleRate > 0) {
        if (remoteSampleRateRef.current !== data.sampleRate) {
          remoteSampleRateRef.current = data.sampleRate;
          nextStartTimeRef.current = 0;
        }
      }
      if (typeof data.channels === "number" && Number.isFinite(data.channels) && data.channels > 0) {
        remoteChannelsRef.current = Math.max(1, Math.floor(data.channels));
      }
    } catch {
      // Non-JSON control payloads can be ignored safely
    }
  }

  function enqueuePcmChunk(ctx: AudioContext, chunk: ArrayBuffer) {
    const channels = remoteChannelsRef.current ?? 1;
    const sampleRate = remoteSampleRateRef.current ?? DEFAULT_SAMPLE_RATE;

    if (chunk.byteLength === 0 || channels < 1) {
      return;
    }

    const int16 = new Int16Array(chunk);
    const totalFrames = Math.floor(int16.length / channels);
    if (totalFrames <= 0) {
      return;
    }

    const float32 = new Float32Array(totalFrames);
    if (channels === 1) {
      for (let i = 0; i < totalFrames; i++) {
        float32[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
      }
    } else {
      for (let frame = 0; frame < totalFrames; frame++) {
        let sum = 0;
        for (let ch = 0; ch < channels; ch++) {
          const sample = int16[frame * channels + ch];
          sum += sample;
        }
        const averaged = sum / channels;
        float32[frame] = Math.max(-1, Math.min(1, averaged / 32768));
      }
    }

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const base = Math.max(ctx.currentTime + PREBUFFER_SEC, nextStartTimeRef.current || ctx.currentTime);
    source.start(base);
    nextStartTimeRef.current = base + buffer.duration;
  }

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="rounded-lg border border-[hsl(var(--border)/0.4)] bg-gradient-to-br from-[hsl(var(--surface-raised)/0.9)] to-[hsl(var(--surface-muted)/0.8)] backdrop-blur-sm p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border backdrop-blur-sm ${
            status === "connected"
              ? "bg-gradient-to-br from-[hsl(var(--success)/0.25)] to-[hsl(var(--success)/0.15)] border-[hsl(var(--success)/0.4)]"
              : status === "connecting"
              ? "bg-gradient-to-br from-[hsl(var(--primary)/0.25)] to-[hsl(var(--primary)/0.15)] border-[hsl(var(--primary)/0.4)]"
              : status === "error"
              ? "bg-gradient-to-br from-[hsl(var(--destructive)/0.25)] to-[hsl(var(--destructive)/0.15)] border-[hsl(var(--destructive)/0.4)]"
              : "bg-gradient-to-br from-[hsl(var(--muted)/0.25)] to-[hsl(var(--muted)/0.15)] border-[hsl(var(--border)/0.4)]"
          }`}>
            {status === "connected" ? (
              <Headphones className="h-5 w-5 text-[hsl(var(--success))]" />
            ) : status === "connecting" ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : status === "error" ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {status === "connected"
                ? "Live Audio Connected"
                : status === "connecting"
                ? "Connecting to Audio Stream"
                : status === "error"
                ? "Connection Error"
                : "Audio Stream Inactive"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "connected"
                ? "Receiving live audio feed"
                : status === "connecting"
                ? "Establishing WebSocket connection"
                : status === "error"
                ? "Failed to connect to audio stream"
                : "Ready to connect"}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={connect}
          disabled={status === "connecting" || status === "connected" || !listenUrl}
          className="btn-primary px-5 py-2.5"
        >
          {status === "connecting" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Headphones className="mr-2 h-4 w-4" />
              Connect
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => disconnect()}
          disabled={status !== "connected" && status !== "connecting"}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface-muted))] text-foreground hover:bg-[hsl(var(--surface-raised))] hover:border-[hsl(var(--border))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <WifiOff className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>

      {/* No URL Warning */}
      {!listenUrl && (
        <div className="rounded-lg border border-[hsl(var(--primary)/0.3)] bg-gradient-to-br from-[hsl(var(--primary)/0.12)] to-[hsl(var(--primary)/0.06)] backdrop-blur-sm p-4 shadow-md">
          <p className="text-sm text-foreground/90 leading-relaxed">
            No listen URL available. The audio stream will become available once the call is active.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-[hsl(var(--destructive)/0.4)] bg-gradient-to-br from-[hsl(var(--destructive)/0.15)] to-[hsl(var(--destructive)/0.08)] backdrop-blur-sm shadow-md">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <AlertDescription className="text-sm font-medium text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
