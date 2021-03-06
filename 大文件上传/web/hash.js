(function (e) {
  var t,
    n = {},
    r = /[=\[\]\&]/,
    i = /(.*)\[\]=(.*)/,
    s = /(.*)=(.*)/;
  n.parseHash = function () {
    var n = {},
      r = e.location.hash.slice(2).split("&");
    for (var o = 0; o < r.length; o++) {
      var u = null,
        a = r[o];
      if (a === "") {
        continue;
      }
      if ((u = a.match(i))) {
        if (n[u[1]]) {
          n[u[1]].push(u[2]);
        } else {
          n[u[1]] = [u[2]];
        }
      } else if ((u = a.match(s))) {
        n[u[1]] = u[2];
      }
    }
    t = n;
  };
  n.updateUrl = function () {
    var r = "#!";
    for (var i in t) {
      if (t[i] instanceof Array) {
        for (var s = 0; s < t[i].length; s++) {
          r += "&" + i + "[]=" + t[i][s];
        }
      } else {
        r += "&" + i + "=" + t[i];
      }
    }
    e.onhashchange = null;
    e.location.hash = r;
    e.onhashchange = n.parseHash;
  };
  n.parseHash();
  e.onhashchange = n.parseHash;
  hash = function (e, i) {
    if (!arguments.length) {
      return t;
    }
    if (e.match(r)) {
      throw (
        "Cannot use key '" + e + "', because it contains special characters."
      );
    }
    if (arguments.length == 2) {
      if (i === undefined) {
        delete t[e];
      } else {
        t[e] = i;
      }
      n.updateUrl();
    } else {
      return t[e];
    }
  };
})(window);
