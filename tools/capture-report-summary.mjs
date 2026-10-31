/** Full traces remain in <video>.json; relay only needs identity and verdicts. */
export function captureReportSummary(report) {
  return { ...report, videos: Object.fromEntries(Object.entries(report.videos ?? {}).map(([name, video]) => {
    const { trace, ...summary } = video;
    return [name, { ...summary, ...(Array.isArray(trace) ? { traceFile: `${name}.json`, traceSamples: trace.length } : {}) }];
  })) };
}
