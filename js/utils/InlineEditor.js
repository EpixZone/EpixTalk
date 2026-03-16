(function() {
class InlineEditor {
  constructor(elem, getContent, saveContent, getObject) {
    this.elem = elem;
    this.getContent = getContent;
    this.saveContent = saveContent;
    this.getObject = getObject;
    this.edit_button = $("<a href='#Edit' class='editable-edit icon-edit'></a>");
    this.edit_button.on("click", () => this.startEdit());
    this.elem.addClass("editable").before(this.edit_button);
    this.editor = null;
    this.content_before = null;

    this.elem.on("mouseenter", (e) => {
      this.edit_button.css("opacity", "0.4");
      // Keep in display
      var scrolltop = $(window).scrollTop();
      var top = this.edit_button.offset().top - parseInt(this.edit_button.css("margin-top"));
      if (scrolltop > top) {
        this.edit_button.css("margin-top", scrolltop - top + e.clientY - 20);
      } else {
        this.edit_button.css("margin-top", "");
      }
    });
    this.elem.on("mouseleave", () => {
      this.edit_button.css("opacity", "");
    });

    if (this.elem.is(":hover")) this.elem.trigger("mouseenter");
  }

  startEdit() {
    this.content_before = this.elem.html(); // Save current to restore on cancel

    this.editor = $("<textarea class='editor'></textarea>");
    this.editor.val(this.getContent(this.elem, "raw"));
    this.elem.after(this.editor);
    $(".editbg").css("display", "block").cssLater("opacity", 0.9, 10);
    this.elem.html(Array.from({length: 50}, (_, i) => i + 1).join("fill the width")); // To make sure we span the editor as far as we can
    this.copyStyle(this.elem, this.editor); // Copy elem style to editor
    this.elem.html(this.content_before); // Restore content

    this.autoExpand(this.editor); // Set editor to autoexpand
    this.elem.css("display", "none"); // Hide elem

    if ($(window).scrollTop() === 0) { // Focus textfield if scroll on top
      this.editor[0].selectionEnd = 0;
      this.editor.focus();
    }

    $(".editable-edit").css("display", "none"); // Hide all edit button until its not finished

    $(".editbar").css("display", "inline-block").addClassLater("visible", 10);
    $(".publishbar").css("opacity", 0); // Hide publishbar
    $(".editbar .object").text(this.getObject(this.elem).data("object") + "." + this.elem.data("editable"));
    $(".editbar .button").removeClass("loading");

    $(".editbar .save").off("click").on("click", () => this.saveEdit());
    $(".editbar .delete").off("click").on("click", () => this.deleteObject());
    $(".editbar .cancel").off("click").on("click", () => this.cancelEdit());

    // Deletable button show/hide
    if (this.getObject(this.elem).data("deletable")) {
      $(".editbar .delete").css("display", "").html("Delete " + this.getObject(this.elem).data("object").split(":")[0]);
    } else {
      $(".editbar .delete").css("display", "none");
    }

    window.onbeforeunload = function() {
      return 'Your unsaved blog changes will be lost!';
    };

    return false;
  }

  stopEdit() {
    if (this.editor) {
      this.editor.remove();
    }
    this.editor = null;
    this.elem.css("display", "");
    $(".editbg").css("opacity", 0).cssLater("display", "none", 300);

    $(".editable-edit").css("display", ""); // Show edit buttons

    $(".editbar").cssLater("display", "none", 1000).removeClass("visible"); // Hide editbar
    $(".publishbar").css("opacity", 1); // Show publishbar

    window.onbeforeunload = null;
  }

  saveEdit() {
    var content = this.editor.val();
    $(".editbar .save").addClass("loading");
    this.saveContent(this.elem, content, (content_html) => {
      if (content_html) { // File write ok
        $(".editbar .save").removeClass("loading");
        this.stopEdit();
        if (typeof content_html === "string") { // Returned the new content
          this.elem.html(content_html);
        }
        $('pre code').each(function(i, block) { // Highlight code blocks
          hljs.highlightBlock(block);
        });
      } else {
        $(".editbar .save").removeClass("loading");
      }
    });
    return false;
  }

  deleteObject() {
    var object_type = this.getObject(this.elem).data("object").split(":")[0];
    Page.cmd("wrapperConfirm", ["Are you sure you sure to delete this " + object_type + "?", "Delete"], (confirmed) => {
      $(".editbar .delete").addClass("loading");
      Page.saveContent(this.getObject(this.elem), null, () => {
        this.stopEdit();
      });
    });
    return false;
  }

  cancelEdit() {
    this.stopEdit();
    this.elem.html(this.content_before);

    $('pre code').each(function(i, block) { // Highlight code blocks
      hljs.highlightBlock(block);
    });

    return false;
  }

  copyStyle(elem_from, elem_to) {
    elem_to.addClass(elem_from[0].className);
    var from_style = getComputedStyle(elem_from[0]);

    elem_to.css({
      fontFamily: from_style.fontFamily,
      fontSize: from_style.fontSize,
      fontWeight: from_style.fontWeight,
      marginTop: from_style.marginTop,
      marginRight: from_style.marginRight,
      marginBottom: from_style.marginBottom,
      marginLeft: from_style.marginLeft,
      paddingTop: from_style.paddingTop,
      paddingRight: from_style.paddingRight,
      paddingBottom: from_style.paddingBottom,
      paddingLeft: from_style.paddingLeft,
      lineHeight: from_style.lineHeight,
      textAlign: from_style.textAlign,
      color: from_style.color,
      letterSpacing: from_style.letterSpacing
    });

    if (elem_from.innerWidth() < 1000) { // inline elems fix
      elem_to.css("minWidth", elem_from.innerWidth());
    }
  }

  autoExpand(elem) {
    var editor = elem[0];
    elem.height(1);
    elem.on("input", function() {
      if (editor.scrollHeight > elem.height()) {
        elem.height(1).height(editor.scrollHeight + parseFloat(elem.css("borderTopWidth")) + parseFloat(elem.css("borderBottomWidth")));
      }
    });
    elem.trigger("input");

    // Tab key support
    elem.on("keydown", function(e) {
      if (e.which === 9) {
        e.preventDefault();
        var s = this.selectionStart;
        var val = elem.val();
        elem.val(val.substring(0, this.selectionStart) + "\t" + val.substring(this.selectionEnd));
        this.selectionEnd = s + 1;
      }
    });
  }
}

window.InlineEditor = InlineEditor;
})();
