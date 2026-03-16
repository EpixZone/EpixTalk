(function() {
class Moderation {
  constructor() {
    this.reported_topics = {};   // target_uri -> [{report_id, reporter, reason, added}]
    this.reported_comments = {}; // target_uri -> [{report_id, reporter, reason, added}]
    this.admin_settings = {};    // Cached data/admin/admin-settings.json
    this.loaded = false;
  }

  // Load admin settings from data/admin/admin-settings.json
  loadAdminSettings(cb) {
    Page.cmd("fileGet", {"inner_path": "data/admin/admin-settings.json", "required": false}, (raw) => {
      if (raw) {
        try {
          this.admin_settings = JSON.parse(raw);
        } catch (e) {
          this.admin_settings = {};
        }
      } else {
        this.admin_settings = {};
      }
      if (cb) cb();
    });
  }

  // Get current user's role: "owner", "admin", "mod", or null
  getRole() {
    if (!Page.site_info) return null;
    if (Page.site_info.settings?.own) return "owner";
    var user_dir = Page.site_info.xid_directory || Page.site_info.auth_address;
    if (!user_dir) return null;
    // Check admin list from root content.json settings
    var settings = Page.site_info.content?.settings;
    if (settings?.admins && settings.admins.includes(user_dir)) return "admin";
    // Mods are stored in admin-settings.json (writable by admins)
    var mods = this.admin_settings.mods || [];
    if (mods.length > 0 && mods.includes(user_dir)) return "mod";
    return null;
  }

  isOwner() { return this.getRole() === "owner"; }
  isAdmin() { var role = this.getRole(); return role === "owner" || role === "admin"; }
  isMod() { var role = this.getRole(); return role === "owner" || role === "admin" || role === "mod"; }

  // Load all reports from the database
  loadReports(cb) {
    var query = `
      SELECT
       report.*,
       reporter_json.directory AS reporter_address
      FROM report
       LEFT JOIN json AS reporter_json ON (reporter_json.json_id = report.json_id)
      ORDER BY report.added DESC
    `;
    Page.cmd("dbQuery", [query], (reports) => {
      this.reported_topics = {};
      this.reported_comments = {};
      if (!Array.isArray(reports)) {
        this.log("Report query error:", reports?.error || reports);
        reports = [];
      }
      for (let report of reports) {
        var entry = {
          report_id: report.report_id,
          reporter: report.reporter_address,
          reason: report.reason,
          added: report.added
        };
        if (report.type === "topic") {
          if (!this.reported_topics[report.target_uri]) this.reported_topics[report.target_uri] = [];
          this.reported_topics[report.target_uri].push(entry);
        } else if (report.type === "comment") {
          if (!this.reported_comments[report.target_uri]) this.reported_comments[report.target_uri] = [];
          this.reported_comments[report.target_uri].push(entry);
        }
      }
      this.loaded = true;
      if (cb) cb();
    });
  }

  // Check if a topic or comment has been reported
  isReported(type, uri) {
    if (type === "topic") {
      return this.reported_topics[uri]?.length > 0;
    } else {
      return this.reported_comments[uri]?.length > 0;
    }
  }

  // Get report entries for a specific item
  getReportsFor(type, uri) {
    if (type === "topic") {
      return this.reported_topics[uri] || [];
    } else {
      return this.reported_comments[uri] || [];
    }
  }

  // Report a topic or comment (writes to current user's data.json)
  reportContent(type, target_uri, reason, cb) {
    User.getData((data) => {
      if (!data.report) data.report = [];
      if (!data.next_report_id) data.next_report_id = 1;
      data.report.push({
        "report_id": data.next_report_id,
        "type": type,
        "target_uri": target_uri,
        "reason": reason,
        "added": Time.timestamp()
      });
      data.next_report_id += 1;
      User.publishData(data, (res) => {
        if (res === true) {
          Page.cmd("wrapperNotification", ["done", "Content reported successfully."]);
          this.loadReports();
        } else {
          Page.cmd("wrapperNotification", ["error", "Failed to submit report."]);
        }
        if (cb) cb(res);
      });
    });
  }

  // Remove own report for a topic or comment
  unreportContent(type, target_uri, cb) {
    User.getData((data) => {
      if (!data.report) data.report = [];
      data.report = data.report.filter(function(r) {
        return !(r.type === type && r.target_uri === target_uri);
      });
      User.publishData(data, (res) => {
        if (res === true) {
          this.loadReports();
        }
        if (cb) cb(res);
      });
    });
  }

  // Delete a topic or comment from the author's data.json (requires admin)
  deleteContent(type, target_uri, cb) {
    if (!this.isAdmin()) {
      Page.cmd("wrapperNotification", ["error", "Only admins can delete content."]);
      if (cb) cb(false);
      return;
    }

    var parts = target_uri.split("_");
    var user_address, topic_id, comment_id;
    if (type === "topic") {
      topic_id = parseInt(parts[0]);
      user_address = parts.slice(1).join("_");
    } else if (type === "comment") {
      comment_id = parseInt(parts[0]);
      user_address = parts.slice(1).join("_");
    }

    var inner_path = "data/users/" + user_address + "/data.json";
    Page.cmd("fileGet", {"inner_path": inner_path, "required": false}, (raw) => {
      if (!raw) {
        Page.cmd("wrapperNotification", ["error", "Could not load user data file."]);
        if (cb) cb(false);
        return;
      }

      var original_raw = raw; // Save original for rollback on sign failure
      var data = JSON.parse(raw);
      if (type === "topic") {
        var original_len = data.topic.length;
        data.topic = data.topic.filter(function(t) { return t.topic_id !== topic_id; });
        if (data.topic.length === original_len) {
          Page.cmd("wrapperNotification", ["error", "Topic not found in user data."]);
          if (cb) cb(false);
          return;
        }
        // Also remove all comments on this topic from this user's data
        for (var topic_uri_key in data.comment) {
          if (topic_uri_key === target_uri) {
            delete data.comment[topic_uri_key];
          }
        }
      } else if (type === "comment") {
        var found = false;
        for (var topic_uri_key in data.comment) {
          var comments = data.comment[topic_uri_key];
          if (Array.isArray(comments)) {
            var original_len = comments.length;
            data.comment[topic_uri_key] = comments.filter(function(c) { return c.comment_id !== comment_id; });
            if (data.comment[topic_uri_key].length < original_len) {
              found = true;
              break;
            }
          }
        }
        if (!found) {
          Page.cmd("wrapperNotification", ["error", "Comment not found in user data."]);
          if (cb) cb(false);
          return;
        }
      }

      // Write back and publish
      var json_raw = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, '\t'))));
      Page.cmd("fileWrite", [inner_path, json_raw], (res) => {
        if (res !== "ok") {
          Page.cmd("wrapperNotification", ["error", "File write error: " + (res?.error || res)]);
          if (cb) cb(false);
          return;
        }

        // Sign the user's content.json (admin signs with own key as include signer)
        var content_inner_path = "data/users/" + user_address + "/content.json";
        Page.cmd("siteSign", {"inner_path": content_inner_path}, (sign_res) => {
          if (sign_res !== "ok") {
            // Restore original data.json to prevent corruption
            var restore_raw = btoa(unescape(encodeURIComponent(original_raw)));
            Page.cmd("fileWrite", [inner_path, restore_raw], function(restore_res) {
              Page.cmd("wrapperNotification", ["error", "Signing error: " + (sign_res?.error || sign_res)]);
              if (cb) cb(false);
            });
            return;
          }

          Page.cmd("sitePublish", {"inner_path": content_inner_path}, (pub_res) => {
            if (pub_res === "ok") {
              Page.cmd("wrapperNotification", ["done", "Content deleted and published."]);
              this.loadReports();
            } else {
              Page.cmd("wrapperNotification", ["error", "Publish error: " + (pub_res?.error || pub_res)]);
            }
            if (cb) cb(pub_res === "ok");
          });
        });
      });
    });
  }
}

Object.assign(Moderation.prototype, LogMixin);
window.Moderation = new Moderation();
})();
