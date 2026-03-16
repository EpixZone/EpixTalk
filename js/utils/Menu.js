(function() {
class Menu {
  constructor(button) {
    this.button = button;
    this.elem = $(".menu.template").clone().removeClass("template");
    this.elem.appendTo("body");
    this.items = [];
  }

  show() {
    if (window.visible_menu && window.visible_menu.button[0] === this.button[0]) {
      // Same menu visible then hide it
      window.visible_menu.hide();
      this.hide();
    } else {
      var button_pos = this.button.offset();
      var left = button_pos.left;
      if (left + this.elem.outerWidth() > $(document.body).width()) {
        left = button_pos.left - this.elem.outerWidth() + this.button.outerWidth();
      }
      this.elem.css({"top": button_pos.top + this.button.outerHeight() + 10, "left": left});
      this.button.addClass("menu-active");
      this.elem.addClass("visible");
      if (window.visible_menu) window.visible_menu.hide();
      window.visible_menu = this;
    }
  }

  hide() {
    this.elem.removeClass("visible");
    this.button.removeClass("menu-active");
    window.visible_menu = null;
  }

  addItem(title, cb) {
    var item = $(".menu-item.template", this.elem).clone().removeClass("template");
    item.text(title);
    var self = this;
    item.on("click", function() {
      if (!cb || !cb(item)) {
        self.hide();
      }
      return false;
    });
    item.appendTo(this.elem);
    this.items.push(item);
    return item;
  }

  log() {
    var args = ["[Menu]"];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    console.log.apply(console, args);
  }
}

window.Menu = Menu;

// Hide menu on outside click
$("body").on("click", function(e) {
  if (window.visible_menu && e.target !== window.visible_menu.button[0] && $(e.target).parent()[0] !== window.visible_menu.elem[0]) {
    window.visible_menu.hide();
  }
});
})();
