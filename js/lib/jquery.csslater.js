jQuery.fn.readdClass = function(className) {
  var elem = this;
  elem.removeClass(className);
  setTimeout(function() {
    elem.addClass(className);
  }, 1);
  return this;
};

jQuery.fn.removeLater = function(time) {
  if (time == null) time = 500;
  var elem = this;
  setTimeout(function() {
    elem.remove();
  }, time);
  return this;
};

jQuery.fn.hideLater = function(time) {
  if (time == null) time = 500;
  var elem = this;
  setTimeout(function() {
    elem.css("display", "none");
  }, time);
  return this;
};

jQuery.fn.addClassLater = function(className, time) {
  if (time == null) time = 5;
  var elem = this;
  setTimeout(function() {
    elem.addClass(className);
  }, time);
  return this;
};

jQuery.fn.removeClassLater = function(className, time) {
  if (time == null) time = 500;
  var elem = this;
  setTimeout(function() {
    elem.removeClass(className);
  }, time);
  return this;
};

jQuery.fn.cssLater = function(name, val, time) {
  if (time == null) time = 500;
  var elem = this;
  setTimeout(function() {
    elem.css(name, val);
  }, time);
  return this;
};

jQuery.fn.toggleClassLater = function(name, val, time) {
  if (time == null) time = 10;
  var elem = this;
  setTimeout(function() {
    elem.toggleClass(name, val);
  }, time);
  return this;
};
