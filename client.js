COBI.init('token');

// Make clock appear in upper right corner
COBI.app.clockVisible.write(false);
// Also listen to standard controller events
COBI.devkit.overrideThumbControllerMapping.write(false);

// Allow user to zoom in and out
COBI.hub.externalInterfaceAction.subscribe(function(action) {
  // Listen to inputs
  if ((action == 'RIGHT')) {
     // Reserved for future zoom function / view selection
  }
  if ((action == 'LEFT')) {
     // Reserved for future zoom function / view selection
  }
});

// Display detailed item names if touch interaction is allowed
COBI.app.touchInteractionEnabled.subscribe(function(touchInteractionEnabled) {
  var elements = document.getElementsByClassName('label');
  for (var i in elements) {
    if (elements[i].style) {
      elements[i].style.visibility = touchInteractionEnabled ? 'visible' : 'hidden';
    }
  }
});

// Configure metrics and ranges
var definitions = [
  {
    id: 'cadence',
    subscribe: COBI.rideService.cadence.subscribe,
    unsubscribe: COBI.rideService.cadence.unsubscribe,
    formatter: formatInt,
    min: 0,
    max: 110
  },
  {
    id: 'heart_rate',
    subscribe: COBI.rideService.heartRate.subscribe,
    unsubscribe: COBI.rideService.heartRate.unsubscribe,
    formatter: formatInt,
    min: 60,
    max: 160
  },
  {
    id: 'user_power',
    subscribe: COBI.rideService.userPower.subscribe,
    unsubscribe: COBI.rideService.userPower.unsubscribe,
    formatter: formatInt,
    min: 0,
    max: 160
  },
  {
    id: 'battery',
    subscribe: function(callback) {
      COBI.battery.state.subscribe(function(batteryCondition) {
        callback(batteryCondition.batteryLevel);
      });
    },
    unsubscribe: COBI.battery.state.unsubscribe,
    formatter: formatInt,
    min: 5,
    max: 100
  },
  {
    id: 'ascent',
    subscribe: COBI.tourService.ascent.subscribe,
    unsubscribe: COBI.tourService.ascent.unsubscribe,
    formatter: formatInt,
    min: 0,
    max: 1500
  },
  {
    id: 'calories',
    subscribe: COBI.tourService.calories.subscribe,
    unsubscribe: COBI.tourService.calories.unsubscribe,
    formatter: formatInt,
    min: 0,
    max: 1800
  }
];

// Initialize subscriptions
$(window).on('load', function() {
    definitions.forEach(function(def) {
        def.subscribe(function(value) {
            
            // Format for display
            var formattedValue = def.formatter(value);
            $('#' + def.id + '_value').html(formattedValue);
            
            // Calculate percentage for progress bar
            var numValue = parseFloat(value);
            if (isNaN(numValue)) numValue = 0;
            
            // Special handling for battery returning ratio e.g., 0.85
            //if (def.id === 'battery' && numValue <= 1.0) {
              //  numValue = numValue * 100;
            }

            // Map value to percentage bounds
            var percentage = ((numValue - def.min) / (def.max - def.min)) * 100;
            
            // Clamp percentage between 0 and 100
            percentage = Math.max(0, Math.min(100, percentage));
            
            $('#' + def.id + '_bar').css('width', percentage + '%');
        });
    });
});
