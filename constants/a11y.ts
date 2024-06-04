export const messageColor = {
  boldForeground: "\x1b[1m%s\x1b[0m",
  cyanForeground: "\x1b[1m\x1b[36m%s\x1b[0m",
  yellowForeground: "\x1b[1m\x1b[33m%s\x1b[0m",
  redForeground: "\x1b[1m\x1b[31m%s\x1b[0m",
};

export const violationColor = {
  minor: messageColor.cyanForeground, // bold, cyan foreground
  moderate: messageColor.yellowForeground, // bold, yellow foreground
  serious: messageColor.yellowForeground, // bold, yellow foreground
  critical: messageColor.redForeground, // bold, red foreground
};
