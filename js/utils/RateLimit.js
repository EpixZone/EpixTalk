(function() {
var _rateLimits = {};
var _rateLimitCallAfter = {};

window.RateLimit = function(interval, fn) {
  if (!_rateLimits[fn]) {
    _rateLimitCallAfter[fn] = false;
    fn(); // First call is not delayed
    _rateLimits[fn] = setTimeout(function() {
      if (_rateLimitCallAfter[fn]) {
        fn();
      }
      delete _rateLimits[fn];
      delete _rateLimitCallAfter[fn];
    }, interval);
  } else {
    // Called within interval, delay the call
    _rateLimitCallAfter[fn] = true;
  }
};
})();
