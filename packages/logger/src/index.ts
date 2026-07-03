export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(context: Record<string, unknown>, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

function write(level: LogLevel, context: Record<string, unknown>, message: string) {
  const payload = {
    level,
    message,
    context,
    timestamp: new Date().toISOString()
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function createLogger(): Logger {
  return {
    debug: (context, message) => write("debug", context, message),
    info: (context, message) => write("info", context, message),
    warn: (context, message) => write("warn", context, message),
    error: (context, message) => write("error", context, message)
  };
}
