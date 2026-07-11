(function() {
// Variable namings:
// comment_uri: #{comment_id}_#{topic_id}_#{topic_user_id}
// topic_uri: #{topic_id}_#{topic_user_id}

var EpixFrame = window.EpixFrame;

class EpixTalk extends EpixFrame {
  constructor() {
    super();
    this.MIN_VERSION = "0.0.2";
  }

  init() {
    this.log("inited!");
    this.site_info = null;  // Last site info response
    this.server_info = null;  // Last server info response
    this.site_address = null;  // Site address

    // Autoexpand
    var textareas = $("textarea");
    for (var i = 0; i < textareas.length; i++) {
      this.autoExpand($(textareas[i]));
    }

    // Horizontal-scroll hint for the toolbar groups (phone widths)
    $(".radio-group").on("scroll", () => this.updateScrollHints());
    $(window).on("resize", () => this.updateScrollHints());
    // Tapping an end cap advances the strip in that direction (clicks on
    // the cap pseudo-elements target the wrap itself, never a chip
    // underneath; the side is told apart by the tap position)
    $(".radio-group-wrap").on("click", function(e) {
      if (e.target !== this) return;
      var group = $(".radio-group", this)[0];
      var step = Math.round(group.clientWidth * 0.7);
      var rect = this.getBoundingClientRect();
      if ($(this).hasClass("has-prev") && e.clientX - rect.left < 40) {
        group.scrollBy({ left: -step, behavior: "smooth" });
        return false;
      }
      if ($(this).hasClass("has-more")) {
        group.scrollBy({ left: step, behavior: "smooth" });
        return false;
      }
    });

    // Markdown help (editbar)
    $(".editbar .icon-help").on("click", () => {
      $(".editbar .markdown-help").css("display", "block");
      $(".editbar .markdown-help").toggleClassLater("visible", 10);
      $(".editbar .icon-help").toggleClass("active");
      return false;
    });

    // Markdown help (new topic form)
    $(".topic-new-help, .topic-new-help-label").on("click", (e) => {
      e.preventDefault();
      var help = $(".topic-new-markdown-help");
      var btn = $(".topic-new-help");
      if (help.is(":visible")) {
        help.removeClass("visible");
        btn.removeClass("active");
        setTimeout(() => help.css("display", "none"), 300);
      } else {
        var offset = btn.offset();
        help.css({ display: "block", top: offset.top + btn.outerHeight() + 6, left: offset.left });
        setTimeout(() => help.addClass("visible"), 10);
        btn.addClass("active");
      }
      return false;
    });

    // Markdown help close button
    $(".topic-new-markdown-close").on("click", (e) => {
      e.preventDefault();
      var help = $(".topic-new-markdown-help");
      help.removeClass("visible");
      $(".topic-new-help").removeClass("active");
      setTimeout(() => help.css("display", "none"), 300);
      return false;
    });
  }

  // Show the "more options" end cap on toolbar groups whose segments extend
  // past the right edge (phones); hide it once scrolled to the end. The cap
  // lives on the wrap, outside the scroll container, so toggling it never
  // reflows the strip mid-scroll.
  updateScrollHints() {
    $(".radio-group").each(function() {
      var wrap = $(this).closest(".radio-group-wrap");
      wrap.toggleClass("has-more", this.scrollWidth - this.clientWidth - this.scrollLeft > 2);
      wrap.toggleClass("has-prev", this.scrollLeft > 2);
    });
  }

  setLoadingProgress(percent, label) {
    var bar = document.getElementById("loading-bar-fill");
    var step = document.getElementById("loading-step");
    if (bar) bar.style.width = percent + "%";
    if (step) step.textContent = label;
  }

  hideLoading() {
    var overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("fade-out");
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 500);
    }
  }

  // Wrapper websocket connection ready
  onOpenWebsocket() {
    this.cmd("wrapperSetViewport", "width=device-width, initial-scale=1");

    this.setLoadingProgress(10, "Fetching server info...");
    this.cmd("serverInfo", {}, (ret) => { // Get server info
      this.server_info = ret;
      this.checkVersion(ret.version);
      this.setLoadingProgress(25, "Loading language...");
      var afterLang = () => {
        translateDOM();
        this.setLoadingProgress(40, "Loading site info...");
        this.cmd("siteInfo", {}, (site) => {
          this.site_address = site.address;
          this.setSiteinfo(site);
          Tipping.init();
          this.setLoadingProgress(55, "Resolving xID identity...");
          User.updateMyInfo(() => {
            this.setLoadingProgress(70, "Loading admin settings...");
            // Load admin settings then moderation data then route
            Moderation.loadAdminSettings(() => {
              this.setLoadingProgress(85, "Loading moderation data...");
              Moderation.loadReports(() => {
                this.setLoadingProgress(100, "Ready!");
                this.updateAdminLink();
                UserPrefs.load(() => {
                  this.routeUrl(window.location.search.substring(1));
                  this.hideLoading();
                });
              });
            });
          });
        });
      };
      if (ret.language) {
        loadLanguage(ret.language, afterLang);
      } else {
        afterLang();
      }
    });
  }

  // All page content loaded
  onPageLoaded() {
    if (!$("body").hasClass("loaded")) {
      $("body").addClass("loaded"); // Back/forward button keep position support
      Page.cmd("wrapperInnerLoaded");
    }
  }

  routeUrl(url) {
    this.log("Routing url:", url);
    var match;
    if (match = url.match(/Topic:([0-9]+)_([0-9a-zA-Z.]+)/)) { // Topic
      $("body").addClass("page-topic");
      TopicShow.actionShow(parseInt(match[1]), Text.toEpixAddress(match[2]));
    } else if (match = url.match(/Topics:([0-9]+)_([0-9a-zA-Z.]+)/)) { // Sub-topics
      $("body").addClass("page-topics");
      TopicList.actionList(parseInt(match[1]), Text.toEpixAddress(match[2]));
    } else if (match = url.match(/User:([0-9a-zA-Z.]+)/)) {
      $("body").addClass("page-user");
      UserProfile.actionShow(Text.toEpixAddress(match[1]));
    } else if (url.match(/Admin/)) { // Admin page
      $("body").addClass("page-admin");
      Admin.actionShow();
    } else { // Main
      $("body").addClass("page-main");
      TopicList.actionList();
    }
  }

  addInlineEditors() {
    this.logStart("Adding inline editors");
    var elems = $("[data-editable]");
    for (var i = 0; i < elems.length; i++) {
      var elem = $(elems[i]);
      if (!elem.data("editor") && !elem.hasClass("editor")) {
        var editor = new InlineEditor(elem, this.getContent.bind(this), this.saveContent.bind(this), this.getObject.bind(this));
        elem.data("editor", editor);
      }
    }
    this.logEnd("Adding inline editors");
  }

  // Get content
  getContent(elem, raw) {
    return elem.data("content");
  }

  // Returns the elem parent object
  getObject(elem) {
    if (elem.data("object")) {
      return elem;
    } else {
      return elem.parents("[data-object]");
    }
  }

  // Save content
  saveContent(elem, content, cb) {
    if (!cb) cb = false;
    var delete_object;
    if (elem.data("deletable") && content == null) { // Its a delete request
      delete_object = true;
    } else {
      delete_object = false;
    }

    var object = this.getObject(elem);
    var parts = object.data("object").split(":");
    var type = parts[0], id = parts[1];

    User.getData((data) => {
      if (type === "Topic") {
        var id_parts = id.split("_");
        var topic_id = parseInt(id_parts[0]);
        var user_address = id_parts.slice(1).join("_");

        var topic = null;
        for (var i = 0; i < data.topic.length; i++) {
          if (data.topic[i].topic_id === topic_id) {
            topic = data.topic[i];
            break;
          }
        }

        if (delete_object) { // Delete
          data.topic.splice(data.topic.indexOf(topic), 1);
        } else { // Update
          topic[elem.data("editable")] = content;
          topic.modified = Math.floor(Date.now() / 1000);
        }
      }

      if (type === "Comment") {
        var id_parts = id.split("@");
        var comment_uri = id_parts[0], topic_uri = id_parts[1];
        var comment_parts = comment_uri.split("_");
        var comment_id = parseInt(comment_parts[0]);
        var user_address = comment_parts.slice(1).join("_");

        var comment = null;
        if (data.comment[topic_uri]) {
          for (var i = 0; i < data.comment[topic_uri].length; i++) {
            if (data.comment[topic_uri][i].comment_id === comment_id) {
              comment = data.comment[topic_uri][i];
              break;
            }
          }
        }

        if (delete_object) { // Delete
          data.comment[topic_uri].splice(data.comment[topic_uri].indexOf(comment), 1);
        } else { // Update
          comment[elem.data("editable")] = content;
          comment.modified = Math.floor(Date.now() / 1000);
        }
      }

      User.publishData(data, (res) => {
        if (res) {
          if (delete_object) { // Delete
            if (cb) cb(true);
            elem.fancySlideUp();
          } else { // Update
            if (type === "Topic") {
              if ($("body").hasClass("page-main") || $("body").hasClass("page-topics")) TopicList.loadTopics("list", function() { if (cb) cb(true); });
              if ($("body").hasClass("page-topic")) TopicShow.loadTopic(function() { if (cb) cb(true); });
            }
            if (type === "Comment") {
              TopicShow.loadComments("normal", function() { if (cb) cb(true); });
            }
          }
        } else {
          if (cb) cb(false);
        }
      });
    });
  }

  // Incoming request from EpixNet API
  onRequest(cmd, message) {
    if (cmd === "setSiteInfo") { // Site updated
      this.actionSetSiteInfo(message);
    } else if (cmd === "setAnnouncerInfo") {
      // Ignore announcer updates silently
    } else {
      this.log("Unknown command", cmd);
    }
  }

  writePublish(inner_path, data, cb) {
    this.cmd("fileWrite", [inner_path, data], (res) => {
      if (res !== "ok") { // fileWrite failed
        this.cmd("wrapperNotification", ["error", "File write error: " + (res.error || res)]);
        cb(false);
        return false;
      }

      this.cmd("sitePublish", {"inner_path": inner_path}, function(res) {
        if (res === "ok") {
          cb(true);
        } else {
          cb(res);
        }
      });
    });
  }

  // Show/hide admin link based on user role, update report badge
  updateAdminLink() {
    if (Moderation.isAdmin()) {
      $(".admin-link").css("display", "block");
      // Count reported items (unique target URIs)
      var count = Object.keys(Moderation.reported_topics).length + Object.keys(Moderation.reported_comments).length;
      var badge = $(".report-badge");
      if (count > 0) {
        badge.text(count).css("display", "inline-block");
      } else {
        badge.css("display", "none");
      }
    } else {
      $(".admin-link").css("display", "none");
    }
  }

  // Siteinfo changed
  actionSetSiteInfo(res) {
    var site_info = res.params;
    this.setSiteinfo(site_info);
    User.updateRole();
    this.updateAdminLink();
    if (site_info.event && site_info.event[0] === "file_done") {
      var changed_file = site_info.event[1];
      // Reload admin settings when admin data changes
      if (changed_file.match(/data\/admin\//)) {
        Moderation.loadAdminSettings(() => {
          User.updateRole();
          this.updateAdminLink();
          // Refresh pinned topic URIs from updated admin settings
          TopicList.topic_pinned_uris = {};
          if (Moderation.admin_settings?.pinned_topic_uris) {
            for (let pinned_uri of Moderation.admin_settings.pinned_topic_uris) {
              TopicList.topic_pinned_uris[pinned_uri] = 1;
            }
          }
          if ($("body").hasClass("page-admin")) {
            Admin.loadRoles();
            Admin.loadReportedContent();
          }
          // Refresh views to reflect dismiss/pin changes
          if ($("body").hasClass("page-topic")) {
            TopicShow.loadTopic();
            TopicShow.loadComments("noanim");
          }
          if ($("body").hasClass("page-main") || $("body").hasClass("page-topics")) {
            TopicList.loadTopics("noanim");
          }
        });
      }
      if (changed_file.match(/.*users.*data.json$/)) { // User data changed
        // Reload moderation reports when user data changes
        Moderation.loadReports(() => {
          this.updateAdminLink();
          if ($("body").hasClass("page-admin")) {
            Admin.loadReportedContent();
          }
        });
      }
      // Background sync refresh: no per-row animations (each slide-down reads
      // as flicker when many files arrive, and animations defeat the
      // browser's scroll anchoring), and a slower cadence while the initial
      // download is still fetching files.
      var refresh_interval = site_info.bad_files > 0 ? 2000 : 500;
      RateLimit(refresh_interval, () => {
        if ($("body").hasClass("page-topic")) {
          TopicShow.loadTopic();
          TopicShow.loadComments("noanim");
        }
        if ($("body").hasClass("page-main") || $("body").hasClass("page-topics")) {
          TopicList.loadTopics("noanim");
        }
      });
    }
  }

  setSiteinfo(site_info) {
    this.site_info = site_info;
    User.checkCert();
  }

  checkVersion(version) {
    if (!version) return;
    var min = this.MIN_VERSION.split(".").map(Number);
    var cur = version.split(".").map(Number);
    for (var i = 0; i < Math.max(min.length, cur.length); i++) {
      var m = min[i] || 0;
      var c = cur[i] || 0;
      if (c > m) return;
      if (c < m) {
        this.cmd("wrapperNotification", ["error", "EpixTalk requires EpixNet " + this.MIN_VERSION + " or newer. You are running " + version + ". Please update your EpixNet client."]);
        return;
      }
    }
  }

  autoExpand(elem) {
    var editor = elem[0];
    // Autoexpand
    if (elem.height() > 0) elem.height(1);

    elem.on("input", function() {
      if (editor.scrollHeight > elem.height()) {
        var old_height = elem.height();
        elem.height(1);
        var new_height = editor.scrollHeight;
        new_height += parseFloat(elem.css("borderTopWidth"));
        new_height += parseFloat(elem.css("borderBottomWidth"));
        new_height -= parseFloat(elem.css("paddingTop"));
        new_height -= parseFloat(elem.css("paddingBottom"));

        var min_height = parseFloat(elem.css("lineHeight")) * 2; // 2 line minimum
        if (new_height < min_height) new_height = min_height + 4;

        elem.height(new_height - 4);
      }
    });
    if (elem.height() > 0) elem.trigger("input");
    else elem.height("48px");
  }
}

window.Page = new EpixTalk();
})();
