(function() {

// A link to a xite host (`https://epix1….epix/videos.html`, `https://name.epix/`)
// only resolves in a browser that speaks EpixNet. A reader on the public
// gateway, or on a plain browser pointed at a local node, gets a DNS error and
// no explanation - so intercept the click and say what is missing.

var BROWSER_URL = "https://epixnet.io";

var overlay = null;
var is_open = false;

function getOverlay() {
  if (!overlay || overlay.length === 0) {
    overlay = $(".xite-link-overlay");
  }
  return overlay;
}

// A host only EpixNet resolves: a xID name (`talk.epix`), or a bech32 address
// either bare or in its dotted `<epix1…>.epix` alias form.
function isXiteHost(hostname) {
  hostname = (hostname || "").toLowerCase();
  if (!hostname) {
    return false;
  }
  if (hostname.slice(-5) === ".epix") {
    return true;
  }
  return /^epix1[a-z0-9]{20,}$/.test(hostname);
}

// Whether this browser can follow a xite host at all. Two independent signals,
// either one is enough:
//  - the page itself came from a xite host, so the reader's browser already
//    resolves them (the Epix Browser's PAC, or a hand-configured proxy);
//  - the node was launched by the Epix Browser, which installs that PAC.
// A reader on the public gateway matches neither. The mobile shells serve
// xites in path form off loopback and cannot follow a `.epix` host either, so
// warning there is correct rather than a false alarm.
function canOpenXiteLinks() {
  if (isXiteHost(window.location.hostname)) {
    return true;
  }
  return !!(window.Page && Page.server_info && Page.server_info.epix_browser);
}

function show(href) {
  var $overlay = getOverlay();
  if ($overlay.length === 0) { // markup missing: don't swallow the click
    return false;
  }
  is_open = true;
  $(".xite-link-url", $overlay).text(href);
  $overlay.css("display", "flex");
  setTimeout(function() {
    $overlay.addClass("visible");
  }, 10);
  return true;
}

function hide() {
  var $overlay = getOverlay();
  is_open = false;
  $overlay.removeClass("visible");
  setTimeout(function() {
    $overlay.css("display", "none");
  }, 250);
}

// The url this click would navigate to, if it is one we should warn about.
function guardedUrl(link) {
  var url;
  try {
    url = new URL(link.href, window.location.href);
  } catch (e) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (!isXiteHost(url.hostname)) {
    return null;
  }
  // Same host as this page: however we got here, this link gets there too.
  if (url.hostname.toLowerCase() === window.location.hostname.toLowerCase()) {
    return null;
  }
  return url.href;
}

$(document).on("click", "a[href]", function(e) {
  // Leave the browser's own gestures alone: a modified click (new tab, save,
  // download) never navigates this page, so there is nothing to warn about.
  if (e.which > 1 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return;
  }
  if (canOpenXiteLinks()) {
    return;
  }
  var href = guardedUrl(this);
  if (!href) {
    return;
  }
  if (!show(href)) {
    return;
  }
  e.preventDefault();
  return false;
});

$(document).on("click", ".xite-link-close, .xite-link-overlay", function(e) {
  if (e.target !== this) { // a click inside the modal is not a dismiss
    return;
  }
  e.preventDefault();
  hide();
  return false;
});

$(document).on("keydown", function(e) {
  if (e.keyCode === 27 && is_open) {
    hide();
  }
});

window.XiteLinkGuard = {
  isXiteHost: isXiteHost,
  canOpenXiteLinks: canOpenXiteLinks,
  guardedUrl: guardedUrl,
  browserUrl: BROWSER_URL,
  hide: hide
};

})();
