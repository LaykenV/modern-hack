"use client";

import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";

interface EventLogProps {
  lastEvent?: {
    type: string;
    message: string;
    timestamp: number;
  };
}

export function EventLog({ lastEvent }: EventLogProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const getEventIcon = (type: string) => {
    if (type.includes("started") || type.includes("running") || type.toLowerCase().includes("onboarding started")) {
      return (
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
      );
    }
    if (type.includes("completed") || type.includes("complete")) {
      return (
        <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
      );
    }
    if (type.includes("error") || type.includes("failed")) {
      return (
        <XCircle className="w-4 h-4 text-destructive" />
      );
    }
    return (
      <Circle className="w-4 h-4 text-muted-foreground" />
    );
  };

  if (!lastEvent) {
    return (
      <div className="bg-surface-muted/50 border border-border/40 rounded-lg p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Circle className="w-4 h-4" />
          <span className="font-medium">No recent activity</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-muted/50 border border-border/40 rounded-lg p-3">
      <div className="flex items-center gap-3">
        {getEventIcon(lastEvent.type)}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">
            {lastEvent.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimestamp(lastEvent.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}
