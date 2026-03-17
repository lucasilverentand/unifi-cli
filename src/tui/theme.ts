export const colors = {
  primary: "#4FC3F7",
  secondary: "#81C784",
  accent: "#FFB74D",
  error: "#EF5350",
  warning: "#FFA726",
  success: "#66BB6A",
  muted: "#78909C",
  border: "#546E7A",
  bg: "#263238",
  text: "#ECEFF1",
  textDim: "#90A4AE",

  // Status colors
  online: "#66BB6A",
  offline: "#EF5350",
  pending: "#FFA726",
  upgrading: "#4FC3F7",

  // Signal strength
  signalGood: "#66BB6A",
  signalFair: "#FFA726",
  signalPoor: "#EF5350",

  // Tab active/inactive
  tabActive: "#4FC3F7",
  tabInactive: "#546E7A",
} as const;

export const symbols = {
  bullet: "\u2022",
  check: "\u2714",
  cross: "\u2718",
  arrow: "\u25B6",
  arrowDown: "\u25BC",
  arrowUp: "\u25B2",
  dash: "\u2500",
  verticalLine: "\u2502",
  corner: "\u2514",
  tee: "\u251C",
  dot: "\u00B7",
  signal: ["\u2581", "\u2582", "\u2584", "\u2586", "\u2588"],
} as const;
