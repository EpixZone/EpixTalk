(function() {

// Stores user preferences and read/unread state in EpixNet's private
// userGetSettings/userSetSettings (users.json per site) instead of browser
// localStorage, so settings persist across devices and browsers.
class UserPrefs {
  constructor() {
    this._cache = null;      // null = not yet loaded
    this._dirty = false;
    this._saveTimer = null;
    this._readyCallbacks = [];
  }

  // Load from private storage. cb() called when ready.
  load(cb) {
    if (this._cache !== null) { if (cb) cb(); return; }
    Page.cmd("userGetSettings", [], (settings) => {
      settings = settings || {};
      if (!settings.epix_talk) settings.epix_talk = {};
      this._cache = settings.epix_talk;
      if (cb) cb();
      for (var fn of this._readyCallbacks) fn();
      this._readyCallbacks = [];
    });
  }

  // Queue a callback to fire once loaded (or immediately if already loaded).
  ready(cb) {
    if (this._cache !== null) { cb(); return; }
    this._readyCallbacks.push(cb);
  }

  get(key, defaultVal) {
    if (this._cache === null) return defaultVal;
    return (key in this._cache) ? this._cache[key] : defaultVal;
  }

  set(key, value) {
    if (this._cache === null) this._cache = {};
    this._cache[key] = value;
    this._scheduleSave();
  }

  del(key) {
    if (this._cache === null) return;
    delete this._cache[key];
    this._scheduleSave();
  }

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 800);
  }

  _flush() {
    this._saveTimer = null;
    Page.cmd("userGetSettings", [], (settings) => {
      settings = settings || {};
      settings.epix_talk = this._cache;
      Page.cmd("userSetSettings", [settings]);
    });
  }
}

window.UserPrefs = new UserPrefs();
})();
