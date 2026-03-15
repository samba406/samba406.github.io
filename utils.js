// Formatters

function formatInt(value) {
  if (value == null || isNaN(value)) return '-';
  return parseInt(value);
}

function formatBatteryInt(value) {
  if (value == null || isNaN(value)) return '-';
  return parseInt(value * 100); 
}
