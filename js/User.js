(function() {
class User {
  constructor() {
    this.my_topic_votes = {};
    this.my_comment_votes = {};
    this.rules = {};  // Last result for fileRules command
    this.xid_name = null;  // Resolved xID primary name
    this.xid_tld = null;
    this.xid_avatar = null;
    this.xid_loading = false;
    this.role = null;  // "owner", "admin", "mod", or null
    this.xid_prompt_shown = false;

    this.initXidButtons();
  }

  updateMyInfo(cb) {
    this.log("Updating user info...", this.my_address);
    this.updateRole();
    this.updateMyVotes(cb);
  }

  updateRole() {
    this.role = Moderation.getRole();
    this.log("User role:", this.role);
  }

  // Load my votes
  updateMyVotes(cb) {
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    var query = `
      SELECT 'topic_vote' AS type, topic_uri AS uri FROM json LEFT JOIN topic_vote USING (json_id) WHERE directory = "${user_dir}" AND file_name = 'data.json'
      UNION
      SELECT 'comment_vote' AS type, comment_uri AS uri FROM json LEFT JOIN comment_vote USING (json_id) WHERE directory = "${user_dir}" AND file_name = 'data.json'
    `;
    Page.cmd("dbQuery", [query], (votes) => {
      for (let vote of votes) {
        if (vote.type === "topic_vote") {
          this.my_topic_votes[vote.uri] = true;
        } else {
          this.my_comment_votes[vote.uri] = true;
        }
      }
      if (cb) cb();
    });
  }

  initXidButtons() {
    $(".certselect").on("click", () => {
      if (!Page.site_info?.auth_address) {
        Page.cmd("wrapperNotification", ["info", "Please connect to EpixNet first."]);
      } else if (!this.xid_name) {
        this.triggerCertXid();
      } else {
        var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
        window.top.location = "?User:" + user_dir;
      }
      return false;
    });
  }

  // Resolve xID primary name for an auth_address via EpixNet xidResolve plugin
  resolveXidName(authAddress, cb) {
    if (!authAddress) {
      if (cb) cb(null);
      return;
    }

    Page.cmd("xidResolve", [authAddress], (result) => {
      if (result?.name) {
        if (cb) cb(result.name, result.tld, result.avatar || "");
      } else {
        if (cb) cb(null);
      }
    });
  }

  // Resolve and store my own xID name
  resolveMyXidName(cb) {
    if (this.xid_loading) {
      if (cb) cb(this.xid_name);
      return;
    }
    this.xid_loading = true;
    this.resolveXidName(Page.site_info.auth_address, (name, tld, avatar) => {
      this.xid_name = name;
      this.xid_tld = tld;
      this.xid_avatar = avatar || "";
      this.xid_loading = false;
      if (cb) cb(name);
    });
  }

  checkCert(type) {
    if (Page.site_info.auth_address) {
      if (!Page.site_info.cert_user_id) {
        // No cert selected — show connect prompt
        $(".user_name-my").text("Connect xID").css({"color": "#f39c12"});
        $(".comment-new").addClass("comment-nocert");
        $(".topic-new-link").css({"display": "none"});
        $(".topic-new").css({"display": "none"});
        this.showXidFab();
        if (!this.xid_prompt_shown) {
          this.xid_prompt_shown = true;
          this.triggerCertXid();
        }
      } else {
        this.resolveMyXidName((name) => {
          if (name) {
            var display = name + "." + this.xid_tld;
            $(".user_name-my").text(display).css({"color": Text.toColor(display)});
            $(".comment-new").removeClass("comment-nocert");
            $(".topic-new-link").css({"display": ""});
            this.showXidTag(display);
          } else {
            $(".user_name-my").text("Connect xID").css({"color": "#f39c12"});
            $(".comment-new").addClass("comment-nocert");
            $(".topic-new-link").css({"display": "none"});
            $(".topic-new").css({"display": "none"});
            this.showXidFab();
            if (!this.xid_prompt_shown) {
              this.xid_prompt_shown = true;
              this.triggerCertXid();
            }
          }
        });
      }
      var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
      Page.cmd("fileRules", "data/users/" + user_dir + "/content.json", (rules) => {
        this.rules = rules;
        if (rules.max_size) this.setCurrentSize(rules.current_size); else this.setCurrentSize(0);
      });
    } else {
      $(".comment-new").addClass("comment-nocert");
      $(".user_name-my").text("Not connected");
      this.setCurrentSize(0);
    }
  }

  triggerCertXid() {
    Page.cmd("certXid", [], (result) => {
      if (result === "ok") {
        this.xid_loading = false;
        this.resolveMyXidName((name) => {
          if (name) {
            var display = name + "." + this.xid_tld;
            $(".user_name-my").text(display).css({"color": Text.toColor(display)});
            $(".comment-new").removeClass("comment-nocert");
            $(".topic-new-link").css({"display": ""});
            Page.cmd("wrapperNotification", ["done", "Connected as " + display]);
            this.showXidTag(display);
          }
        });
      }
    });
  }

  showXidFab() {
    $(".xid-fab, .xid-tag").remove();
    var fab = $('<a href="#" class="xid-fab nolink" title="Register xID">xID</a>');
    fab.on("click", (e) => {
      e.preventDefault();
      this.triggerCertXid();
      return false;
    });
    $(".head").append(fab);
  }

  showXidTag(display) {
    $(".xid-fab, .xid-tag").remove();
    // Compute hue from display name for consistent color
    var hash = 0;
    for (var i = 0; i < display.length; i++) {
      hash += display.charCodeAt(i) * i;
    }
    var hue = hash % 360;
    var bgColor = "hsl(" + hue + ", 50%, 25%)";
    var textColor = "hsl(" + hue + ", 80%, 80%)";
    var avatar = this.xid_avatar;
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    var tag;
    if (avatar) {
      tag = $('<a href="?User:' + user_dir + '" class="xid-tag nolink" style="background-color: ' + bgColor + ';">' +
        '<img src="' + avatar + '" style="border: 2px solid ' + textColor + ';" onerror="this.style.display=\'none\'">' +
        '<span style="color: ' + textColor + ';">' + display + '</span>' +
      '</a>');
    } else {
      tag = $('<a href="?User:' + user_dir + '" class="xid-tag nolink" style="background-color: ' + bgColor + ';">' +
        '<span style="color: ' + textColor + ';">' + display + '</span>' +
      '</a>');
    }
    $(".head").append(tag);
  }

  // Check if user has xID name (required to post)
  requireXid(cb) {
    if (!Page.site_info?.auth_address) {
      Page.cmd("wrapperNotification", ["info", "Please connect to EpixNet first."]);
      return false;
    }
    if (this.xid_name) {
      return true;
    }
    // Try to resolve again in case it was just registered
    this.xid_loading = false;
    this.resolveMyXidName((name) => {
      if (name) {
        cb();
      } else {
        // No xID found — start the cert acquisition flow
        Page.cmd("certXid", [], (result) => {
          if (result === "ok") {
            // Cert acquired, re-resolve and continue
            this.xid_loading = false;
            this.resolveMyXidName(function(name2) {
              if (name2) {
                cb();
              }
            });
          }
        });
      }
    });
    return false;
  }

  setCurrentSize(current_size) {
    if (current_size) {
      var current_size_kb = current_size / 1000;
      var label = "used: " + current_size_kb.toFixed(1) + "k/" + Math.round(this.rules.max_size / 1000) + "k";
      $(".user-size").not(".user-size-used").text(label).attr("title",
        "Every new user has limited space to store comments, topics and votes.\n" +
        "This indicator shows your used/total allowed KBytes.\n" +
        "The site admin can increase it if you about to run out of it."
      );
      // Overlay is a pure visual bar — keep it empty so copy/paste only picks
      // up the track's label once.
      $(".user-size.user-size-used").text("");
      var percent = Math.min(100, 100 * current_size / this.rules.max_size);
      var $track = $(".user-size").not(".user-size-used").first();
      var trackWidth = $track.outerWidth() || 120;
      var fillPx = current_size > 0 ? Math.max(3, trackWidth * percent / 100) : 0;
      $(".user-size-used")
        .css("width", fillPx + "px")
        .toggleClass("is-high", percent >= 90)
        .toggleClass("is-mid", percent >= 70 && percent < 90);
      if (percent > 80 && Page.site_info.content?.settings?.admin) {
        $(".user-size-warning")
          .css("display", "block")
          .find("a")
          .text(Page.site_info.content.settings.admin)
          .attr("href", Text.fixLink(Page.site_info.content.settings.admin_href));
      }
    } else {
      $(".user-size").text("");
    }
  }

  dataInnerPath() {
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    return "data/users/" + user_dir + "/data.json";
  }

  // Blank/default data.json used only when a user genuinely has no data yet.
  getDefaultData() {
    return {"next_topic_id": 1, "topic": [], "topic_vote": {}, "next_comment_id": 1, "comment": {}, "comment_vote": {}, "next_report_id": 1, "report": []};
  }

  getData(cb) {
    Page.cmd("fileGet", {"inner_path": this.dataInnerPath(), "required": false}, (data) => {
      cb(data ? JSON.parse(data) : this.getDefaultData());
    });
  }

  // Guarded read for any action that mutates the user's data.json.
  //
  // data.json is a single last-writer-wins file read with required:false. On a
  // device that has not synced it yet, the plain read misses; if the caller
  // then falls back to a blank default and publishes, the fileWrite +
  // sitePublish signs that blank over the network and wipes the user's real
  // topics/comments/votes everywhere. So on a MISSED read we do not hand back a
  // blank right away: we force a sync (siteUpdate) and re-read a few times.
  //  - If the real file arrives, use it (no clobber).
  //  - If it is still absent AND this is a first-time creation AND the site is
  //    fully synced (no bad_files), there is genuinely nothing to overwrite, so
  //    seed a default (a brand-new account's first post/comment/vote/report).
  //  - Otherwise (a mutation of existing data, or the site is still syncing)
  //    abort the write and ask the user to retry, rather than risk a clobber.
  //
  // options: { allowCreate: bool, onAbort: fn }
  getDataForWrite(cb, options) {
    options = options || {};
    var allowCreate = !!options.allowCreate;
    var onAbort = options.onAbort;
    var inner_path = this.dataInnerPath();
    var self = this;
    Page.cmd("fileGet", {"inner_path": inner_path, "required": false}, function(data) {
      if (data) { // Present on this device - normal path, no clobber risk
        cb(JSON.parse(data));
        return;
      }
      // Missed read: try to fetch the real file before deciding anything.
      self.syncAndReread(inner_path, function(synced) {
        if (synced) { // Real data arrived - use it, never clobber
          cb(JSON.parse(synced));
          return;
        }
        var fully_synced = !Page.site_info || !Page.site_info.bad_files;
        if (allowCreate && fully_synced) {
          cb(self.getDefaultData()); // Genuinely new account: safe to seed
          return;
        }
        Page.cmd("wrapperNotification", ["info", "Your data is still syncing, please try again in a moment."]);
        if (onAbort) onAbort();
      });
    });
  }

  // Force a re-sync of the site (siteUpdate runs in the background and returns
  // immediately), then poll the file back a few times. cb(raw) once it arrives,
  // or cb(null) if still missing after the attempts.
  syncAndReread(inner_path, cb) {
    var address = Page.site_address || (Page.site_info && Page.site_info.address);
    if (address) {
      Page.cmd("siteUpdate", {"address": address});
    } else {
      Page.cmd("siteUpdate", {});
    }
    var attempts = 0;
    var max_attempts = 6;
    var tryRead = function() {
      setTimeout(function() {
        Page.cmd("fileGet", {"inner_path": inner_path, "required": false}, function(data) {
          if (data) { cb(data); return; }
          attempts += 1;
          if (attempts >= max_attempts) { cb(null); return; }
          tryRead();
        });
      }, 700);
    };
    tryRead();
  }

  publishData(data, cb) {
    Page.writePublish(this.dataInnerPath(), Text.jsonEncode(data), (res) => {
      this.checkCert("updaterules"); // Update used space
      if (cb) cb(res);
    });
  }
}

Object.assign(User.prototype, LogMixin);
window.User = new User();
})();
