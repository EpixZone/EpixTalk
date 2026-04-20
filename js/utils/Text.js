(function() {
class Renderer extends marked.Renderer {
  image(href, title, text) {
    // Sanitize: only allow http/https/data URIs, block javascript: etc.
    if (!/^https?:\/\/|^data:image\//i.test(href)) {
      return `<code>![${text}](${href})</code>`;
    }
    var safe_href = href.replace(/"/g, "%22");
    var safe_text = text ? text.replace(/"/g, "&quot;") : "";
    var safe_title = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
    return `<img src="${safe_href}" alt="${safe_text}"${safe_title} style="max-width:100%">`;
  }
}

class Text {
  toColor(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i++) {
      hash += text.charCodeAt(i) * i;
    }
    if (Page.server_info?.user_settings?.theme === "dark") {
      return "hsl(" + (hash % 360) + ",80%,80%)";
    } else {
      return "hsl(" + (hash % 360) + ",30%,50%)";
    }
  }

  toMarked(text, options) {
    if (!options) options = {};
    options["gfm"] = true;
    options["breaks"] = true;
    options["renderer"] = window.renderer;
    text = this.fixReply(text);
    text = marked(text, options);
    text = this.fixHtmlLinks(text);
    text = this.fixMentions(text);
    return text;
  }

  toMarkedInline(text, options) {
    if (!options) options = {};
    options["gfm"] = true;
    options["breaks"] = true;
    options["renderer"] = window.renderer;
    var html = marked(text, options);
    // Strip block-level tags so CSS text truncation works
    html = html.replace(/<\/?(p|blockquote|ul|ol|li|h[1-6]|pre|div|hr)[^>]*>/g, "").trim();
    html = this.fixHtmlLinks(html);
    html = this.fixMentions(html);
    return html;
  }

  // Convert @username mentions to clickable links (runs after markdown so sanitize won't strip them)
  fixMentions(text) {
    return text.replace(/(?<![\/\w"=])@([a-zA-Z][a-zA-Z0-9_.]{0,30})(?![a-zA-Z0-9_.])/g, function(match, name) {
      return '<a class="mention-link" data-mention="' + name + '">@' + name + '</a>';
    });
  }

  // Convert epixnet html links to relative
  fixHtmlLinks(text) {
    if (window.is_proxy) {
      var back = text.replace(/href="http:\/\/(127.0.0.1|localhost):43110/g, 'href="http://epix');
      return back.replace(/http:\/\/epix\/([^\/]+\.bit)/g, "http://$1");
    } else {
      return text.replace(/href="http:\/\/(127.0.0.1|localhost):43110/g, 'href="');
    }
  }

  // Convert a single link to relative
  fixLink(link) {
    if (window.is_proxy) {
      var back = link.replace(/http:\/\/(127.0.0.1|localhost):43110/, 'http://epix');
      return back.replace(/http:\/\/epix\/([^\/]+\.bit)/, "http://$1");
    } else {
      return link.replace(/http:\/\/(127.0.0.1|localhost):43110/, '');
    }
  }

  toUrl(text) {
    return text.replace(/[^A-Za-z0-9]/g, "+").replace(/[+]+/g, "+").replace(/[+]+$/, "");
  }

  fixReply(text) {
    return text.replace(/(>.*\n)([^\n>])/gm, "$1\n$2");
  }

  toEpixAddress(text) {
    return text.replace(/[^A-Za-z0-9.]/g, "");
  }

  jsonEncode(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj, undefined, '\t'))));
  }

  formatUsername(username) {
    if (!username) return "Anonymous";
    if (username.match(/^epix1[a-z0-9]{38,}$/)) {
      return username.substring(0, 16) + "...";
    }
    return username;
  }
}

window.is_proxy = (window.location.pathname === "/");
window.renderer = new Renderer();
window.Text = new Text();
})();
