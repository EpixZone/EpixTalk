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
    var fab = $('<a href="#" class="xid-fab nolink" style="background: linear-gradient(135deg, #e67e22, #f39c12); display: block; padding: 13px; margin-left: -10px; color: #fff; font-size: 20px; text-transform: uppercase; line-height: 1em; font-family: consolas, menlo, monospace; text-decoration: none; cursor: pointer; text-align: center; box-shadow: 0 2px 8px rgba(243,156,18,0.4);" title="Register xID">xID</a>');
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
    var bgColor2 = "hsl(" + hue + ", 40%, 18%)";
    var textColor = "hsl(" + hue + ", 80%, 80%)";
    var avatar = this.xid_avatar;
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    var tag;
    if (avatar) {
      tag = $('<a href="?User:' + user_dir + '" class="xid-tag nolink" style="display: block; padding: 8px; margin-left: -10px; background: linear-gradient(135deg, ' + bgColor + ', ' + bgColor2 + '); box-shadow: 0 2px 8px rgba(0,0,0,0.3); text-align: center; cursor: pointer; text-decoration: none;">' +
        '<img src="' + avatar + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid ' + textColor + '; display: block; margin: 0 auto 6px;" onerror="this.style.display=\'none\'">' +
        '<span style="color: ' + textColor + '; font-size: 12px; line-height: 1em; font-family: consolas, menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">' + display + '</span>' +
      '</a>');
    } else {
      tag = $('<a href="?User:' + user_dir + '" class="xid-tag nolink" style="display: block; padding: 13px; margin-left: -10px; background: linear-gradient(135deg, ' + bgColor + ', ' + bgColor2 + '); box-shadow: 0 2px 8px rgba(0,0,0,0.3); text-align: center; cursor: pointer; text-decoration: none;">' +
        '<span style="color: ' + textColor + '; font-size: 15px; line-height: 1em; font-family: consolas, menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">' + display + '</span>' +
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
      var percent = 100 * current_size / this.rules.max_size;
      var $track = $(".user-size").not(".user-size-used").first();
      var trackWidth = $track.outerWidth() || 120;
      var fillPx = Math.max(0, trackWidth * percent / 100);
      $(".user-size-used").css("width", fillPx + "px");
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

  getData(cb) {
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    var inner_path = "data/users/" + user_dir + "/data.json";
    Page.cmd("fileGet", {"inner_path": inner_path, "required": false}, function(data) {
      if (data) {
        data = JSON.parse(data);
      } else { // Default data
        data = {"next_topic_id": 1, "topic": [], "topic_vote": {}, "next_comment_id": 1, "comment": {}, "comment_vote": {}, "next_report_id": 1, "report": []};
      }
      cb(data);
    });
  }

  publishData(data, cb) {
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    var inner_path = "data/users/" + user_dir + "/data.json";
    Page.writePublish(inner_path, Text.jsonEncode(data), (res) => {
      this.checkCert("updaterules"); // Update used space
      if (cb) cb(res);
    });
  }
}

Object.assign(User.prototype, LogMixin);
window.User = new User();
})();
