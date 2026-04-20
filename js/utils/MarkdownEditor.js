(function() {

// Shared EasyMDE config
var MDE_CONFIG = {
  spellChecker: false,
  autofocus: false,
  status: false,
  forceSync: true,
  tabSize: 2,
  toolbar: [
    "bold", "italic", "strikethrough", "|",
    "heading", "quote", "code", "|",
    "unordered-list", "ordered-list", "|",
    "link", "image"
  ],
  toolbarTips: true
};

// Patch jQuery .val() on a textarea element so existing code that does
// $("#comment_body").val() or .val("...") transparently proxies through the
// EasyMDE instance — no changes needed in TopicList.js / TopicShow.js.
function patchVal(el, mde) {
  var proto = $.fn.val;
  var $el = $(el);

  $el.data("mde", mde);

  // Override .val on this specific element
  var originalVal = $.fn.val;
  var elNode = el;

  // We hook at the element level via a data-flag so the global $.fn.val
  // still works normally for every other element.
  Object.defineProperty(el, "_mdeInstance", { value: mde, writable: false });
}

// Intercept jQuery .val() globally, but only for elements that have an MDE
var _origVal = $.fn.val;
$.fn.val = function(value) {
  if (this.length === 1 && this[0]._mdeInstance) {
    var mde = this[0]._mdeInstance;
    if (arguments.length === 0) {
      return mde.value();
    } else {
      mde.value(value == null ? "" : String(value));
      return this;
    }
  }
  return _origVal.apply(this, arguments);
};

// Also intercept .trigger("input") so the size counter in TopicShow still fires
var _origTrigger = $.fn.trigger;
$.fn.trigger = function(event) {
  if (this.length === 1 && this[0]._mdeInstance && event === "input") {
    // Dispatch a native input event on the underlying CodeMirror textarea
    // (forceSync keeps it up-to-date) then trigger on it
    this[0]._mdeInstance.codemirror.getInputField().dispatchEvent(new Event("input", { bubbles: true }));
    return this;
  }
  return _origTrigger.apply(this, arguments);
};

// Create an EasyMDE instance for a textarea, hiding the old markdown-help
// toggle since EasyMDE has its own built-in guide button.
function createEditor(textarea, extraConfig) {
  var config = Object.assign({}, MDE_CONFIG, extraConfig || {}, { element: textarea });
  var mde = new EasyMDE(config);

  // Patch val() proxy
  patchVal(textarea, mde);

  // Keep underlying textarea in sync on every CM change (forceSync helps but
  // we add this for the .trigger("input") size-counter path in TopicShow)
  mde.codemirror.on("change", function() {
    $(textarea).trigger("input");
  });

  return mde;
}

// Initialise editors. Called after the page sections are shown.
var editors = {};

window.MarkdownEditor = {
  // Call when the new-topic form becomes visible
  initTopicEditor: function() {
    var el = document.getElementById("topic_body");
    if (!el || el._mdeInstance) return;
    editors.topic = createEditor(el, {
      placeholder: _("Topic description"),
      minHeight: "120px"
    });
    $(".topic-new-help-row").hide();
  },

  // Call when the comment form becomes visible (topic page)
  initCommentEditor: function() {
    var el = document.getElementById("comment_body");
    if (!el || el._mdeInstance) return;
    editors.comment = createEditor(el, {
      placeholder: _("new comment"),
      minHeight: "100px"
    });
  },

  // Destroy and recreate comment editor (needed when navigating between topics)
  resetCommentEditor: function() {
    var el = document.getElementById("comment_body");
    if (!el) return;
    if (el._mdeInstance) {
      el._mdeInstance.toTextArea();
      delete el._mdeInstance;
    }
    editors.comment = createEditor(el, {
      placeholder: _("new comment"),
      minHeight: "100px"
    });
  },

  // Append text to the comment editor (used by reply-quote in TopicShow)
  appendToComment: function(text) {
    var mde = editors.comment;
    if (!mde) return;
    var current = mde.value();
    mde.value(current + text);
    mde.codemirror.focus();
    // Move cursor to end
    var cm = mde.codemirror;
    cm.setCursor(cm.lineCount(), 0);
  },

  editors: editors
};

})();
