// Formatters

function formatInt(value) {
  if (value == null || isNaN(value)) return '-';
  return parseInt(value);
}

function formatBatteryInt(value) {
  // batteryLevel is already a percentage (0-100)
  return formatInt(value);
}
