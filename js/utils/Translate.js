(function() {
var _translations = {};

window.loadLanguage = function(lang, cb) {
  if (!lang || lang === "en") {
    if (cb) cb();
    return;
  }
  Page.cmd("fileGet", {"inner_path": "languages/" + lang + ".json", "required": false}, function(data) {
    if (data) {
      try {
        _translations = JSON.parse(data);
      } catch (e) {
        _translations = {};
      }
    } else {
      _translations = {};
    }
    if (cb) cb();
  });
};

window._ = function(s) {
  if (_translations && _translations[s]) {
    return _translations[s];
  }
  return s;
};

window.translateDOM = function() {
  var selectors = {
    ".topics-title": "Newest topics",
    ".topics-loading": "Loading...",
    ".topics-more": "More topics",
    ".topic-new-link": " + Start new topic",
    ".topic-new #topic_title": {"attr": "placeholder", "text": "Topic title"},
    ".topic-new #topic_body": {"attr": "placeholder", "text": "Topic description"},
    ".topic-new .button-submit": "Create topic",
    ".topic-new .added": "new topic",
    ".text-follow": "Follow in Newsfeed",
    ".text-following": "Following",
    ".comment-new .button-submit-form": "Submit comment",
    ".comment-new .added": "new comment",
    ".reply-text": "Reply",
    ".sticky-title": "stickied",
    ".comments-more": "More comments",
    ".button-certselect": "Connect xID",
    ".topic_type_label": "Topic",
    // Topic-list toolbar: sort order
    'label[for="toolbar-topic_list_order_by-last_activity"]': "Last Comment",
    'label[for="toolbar-topic_list_order_by-topic_creation"]': "Creation",
    'label[for="toolbar-topic_list_order_by-comments_num"]': "Most Comments",
    'label[for="toolbar-topic_list_order_by-votes_num"]': "Most Votes",
    // Topic-list toolbar: display mode
    'label[for="toolbar-topic_list_mode-tiny"]': "Tiny",
    'label[for="toolbar-topic_list_mode-brief"]': "Brief",
    'label[for="toolbar-topic_list_mode-normal"]': "Normal",
    'label[for="toolbar-topic_list_mode-full"]': "Full",
    // Search
    ".topic-search": {"attr": "placeholder", "text": "Search topics..."},
    ".topic-search-button": "Search",
    // Xite link warning
    ".xite-link-title": "This link opens on EpixNet",
    ".xite-link-text": "Xite addresses are not part of the regular internet, so an ordinary browser cannot open them. To follow this link you need the Epix Browser installed.",
    ".xite-link-get": "Get the Epix Browser"
  };
  for (var sel in selectors) {
    var val = selectors[sel];
    if (typeof val === "object") {
      $(sel).attr(val.attr, _(val.text));
    } else {
      $(sel).not(".template " + sel).each(function() {
        var $el = $(this);
        if ($el.children().length === 0) {
          $el.text(_(val));
        }
      });
    }
  }
};
})();
