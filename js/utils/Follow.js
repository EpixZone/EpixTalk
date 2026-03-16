(function() {
class Follow {
  constructor(elem) {
    this.elem = elem;
    this.menu = new Menu(this.elem);
    this.feeds = {};
    this.follows = {};
    this.elem.off("click");
    this.elem.on("click", () => {
      if (this.elem.hasClass("following")) {
        this.showFeeds();
      } else {
        this.followDefaultFeeds();
      }
      return false;
    });
    this.elem.css("display", "inline-block");
    this.width_following = this.elem.find(".text-following").width();
    this.width_follow = this.elem.find(".text-follow").width();
    this.elem.css("display", "none");
  }

  init(cb) {
    if (!this.feeds) {
      if (cb) cb(false);
      return;
    }

    Page.cmd("feedListFollow", [], (follows) => {
      this.follows = follows;
      // Recover renamed queries (eg language change)
      var queries = {};
      for (var title in this.feeds) {
        var feed = this.feeds[title];
        queries[feed[0]] = title; // feed[0] = query
      }
      for (var title in this.follows) {
        var follow = this.follows[title];
        if (queries[follow[0]] && title !== queries[follow[0]]) {
          this.log("Renamed query", title, "->", queries[follow[0]]);
          this.follows[queries[follow[0]]] = this.follows[title];
          delete this.follows[title];
        }
      }

      // Check selected queries
      for (var title in this.feeds) {
        var feed = this.feeds[title];
        var query = feed[0], menu_item = feed[1], is_default_feed = feed[2], param = feed[3];
        if (this.follows[title] && this.follows[title][1].includes(param)) {
          menu_item.addClass("selected");
        } else {
          menu_item.removeClass("selected");
        }
      }
      this.updateListitems();
      this.elem.css("display", "inline-block");
      if (cb) cb(true);
    });

    setTimeout(() => {
      if (typeof Page.site_info.feed_follow_num !== "undefined" && Page.site_info.feed_follow_num === null) {
        this.log("Following default feeds");
        this.followDefaultFeeds();
      }
    }, 100);
  }

  addFeed(title, query, is_default_feed, param) {
    if (is_default_feed == null) is_default_feed = false;
    if (param == null) param = "";
    var menu_item = this.menu.addItem(title, (item) => {
      return this.handleMenuClick(item);
    });
    this.feeds[title] = [query, menu_item, is_default_feed, param];
  }

  handleMenuClick(item) {
    item.toggleClass("selected");
    this.updateListitems();
    this.saveFeeds();
    return true;
  }

  showFeeds() {
    this.menu.show();
  }

  followDefaultFeeds() {
    for (var title in this.feeds) {
      var feed = this.feeds[title];
      var query = feed[0], menu_item = feed[1], is_default_feed = feed[2], param = feed[3];
      if (is_default_feed) {
        menu_item.addClass("selected");
        this.log("Following", title);
      }
    }
    this.updateListitems();
    this.saveFeeds();
  }

  updateListitems() {
    if (this.menu.elem.find(".selected").length > 0) {
      this.elem.addClass("following");
      this.elem.find(".text-follow").width(0);
      this.elem.find(".text-following").width(this.width_following + 5);
    } else {
      this.elem.removeClass("following");
      this.elem.find(".text-following").width(0);
      this.elem.find(".text-follow").width(this.width_follow + 5);
    }
  }

  saveFeeds() {
    for (var title in this.feeds) {
      var feed = this.feeds[title];
      var query = feed[0], menu_item = feed[1], is_default_feed = feed[2], param = feed[3];
      var params;
      if (this.follows[title]) {
        params = this.follows[title][1].filter(function(item) { return item !== param; });
      } else {
        params = [];
      }

      if (menu_item.hasClass("selected")) {
        params.push(param);
      }

      if (params.length === 0) {
        delete this.follows[title];
      } else {
        this.follows[title] = [query, params];
      }
    }

    Page.cmd("feedFollow", [this.follows]);
  }
}

Object.assign(Follow.prototype, LogMixin);
window.Follow = Follow;
})();
