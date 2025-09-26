import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type LiveListenProps = {
  listenUrl: string | null;
};

export default function LiveListen({ listenUrl }: LiveListenProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const SAMPLE_RATE = 16000;
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

      const AudioCtxCtor: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AudioCtxCtor({ sampleRate: SAMPLE_RATE });
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
        const ctxNow = audioCtxRef.current;
        if (!ctxNow) return;
        try {
          let arrayBuffer: ArrayBuffer | null = null;
          if (evt.data instanceof ArrayBuffer) {
            arrayBuffer = evt.data as ArrayBuffer;
          } else if (evt.data instanceof Blob) {
            arrayBuffer = await (evt.data as Blob).arrayBuffer();
          } else if (typeof evt.data === "string") {
            // Ignore text control messages for now
            return;
          }
          if (!arrayBuffer) return;
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

  function enqueuePcmChunk(ctx: AudioContext, chunk: ArrayBuffer) {
    // Convert 16-bit PCM (little-endian) mono to Float32
    const int16 = new Int16Array(chunk);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
    }

    const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const base = Math.max(ctx.currentTime + PREBUFFER_SEC, nextStartTimeRef.current || ctx.currentTime);
    source.start(base);
    nextStartTimeRef.current = base + buffer.duration;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={connect}
          disabled={status === "connecting" || status === "connected" || !listenUrl}
        >
          {status === "connecting" ? "Connecting…" : "Connect"}
        </Button>
        <Button
          variant="outline"
          onClick={() => disconnect()}
          disabled={status !== "connected" && status !== "connecting"}
        >
          Disconnect
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Status: {status}
        </span>
      </div>
      {!listenUrl && (
        <p className="text-sm text-slate-500">No listen URL provided.</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
