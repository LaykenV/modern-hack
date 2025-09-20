"use client";

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
    if (type.includes("started") || type.includes("running")) {
      return (
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      );
    }
    if (type.includes("completed") || type.includes("complete")) {
      return (
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      );
    }
    if (type.includes("error") || type.includes("failed")) {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      );
    }
    return (
      <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
    );
  };

  if (!lastEvent) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
          <span>No recent activity</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {getEventIcon(lastEvent.type)}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {lastEvent.message}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {formatTimestamp(lastEvent.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}
