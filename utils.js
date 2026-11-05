// Formatters

function formatInt(value) {
  if (value == null || isNaN(value)) return '-';
  return parseInt(value);
}

function formatBatteryInt(value) {
  if (value == null || isNaN(value)) return '-';
  // Handle both ratio (e.g. 0.85) and percentage (e.g. 85)
  var val = value;
  if (val <= 1.0) {
    val = val * 100;
  }
  return parseInt(val); 
}
