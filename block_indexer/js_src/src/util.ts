export function obfuscateUrl(url: string) {
  const lastSlashIndex = url.lastIndexOf("/");
  const urlStart = url.substring(0, lastSlashIndex + 1);
  const urlEnd = url.slice(-4);
  const toObfuscate = url.substring(lastSlashIndex + 1, url.length - 4);
  const obfuscatedPart = "*".repeat(toObfuscate.length);
  return urlStart + obfuscatedPart + urlEnd;
}

export function buildEventsReport(eventsBySourceAndType: {
  [id: string]: { [id: string]: number };
}): string {
  let eventsReport = "";

  const sortedSources = Object.keys(eventsBySourceAndType).sort();

  sortedSources.forEach((source) => {
    let sourceReport = "";
    const eventsByType = eventsBySourceAndType[source];

    const sortedTypes = Object.keys(eventsByType).sort();
    sortedTypes.forEach((type) => {
      if (sourceReport.length > 0) sourceReport += ", ";
      sourceReport += `${type}: ${eventsByType[type]}`;
    });

    if (eventsReport.length > 0) eventsReport += ", ";
    eventsReport += `${source}: [${sourceReport}]`;
  });

  return eventsReport;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function now(): string {
  return new Date().toLocaleTimeString("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
