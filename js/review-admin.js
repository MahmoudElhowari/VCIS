/* View Canada Immigration Services — review moderation page */
(function () {
  "use strict";

  var API = "/api/reviews";
  var KEY = "vcis-review-admin";
  var password = "";
  try { password = sessionStorage.getItem(KEY) || ""; } catch (e) {}
  var reviews = [];
  var filter = "pending";

  var login = document.getElementById("login");
  var panel = document.getElementById("panel");
  var list = document.getElementById("admin-list");
  var panelStatus = document.getElementById("panel-status");
  var loginStatus = document.getElementById("login-status");
  var signOut = document.getElementById("sign-out");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function api(method, query, body) {
    return fetch(API + (query || ""), {
      method: method,
      headers: Object.assign({ authorization: "Bearer " + password }, body ? { "content-type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) throw Object.assign(new Error("Incorrect password."), { auth: true });
        if (!res.ok) throw new Error(data.error || "Request failed.");
        return data;
      });
    });
  }

  function showPanel(show) {
    login.hidden = show;
    panel.hidden = !show;
    signOut.hidden = !show;
  }

  function render() {
    list.textContent = "";
    ["pending", "approved"].forEach(function (s) {
      var c = document.querySelector('[data-count="' + s + '"]');
      if (c) c.textContent = "(" + reviews.filter(function (r) { return r.status === s; }).length + ")";
    });
    document.querySelectorAll(".admin-tab").forEach(function (t) {
      t.setAttribute("aria-selected", String(t.getAttribute("data-filter") === filter));
    });

    var shown = reviews.filter(function (r) { return r.status === filter; });
    if (!shown.length) {
      list.appendChild(el("p", "reviews-empty", filter === "pending" ? "No reviews are waiting for approval." : "No reviews are published yet."));
      return;
    }
    shown.forEach(function (r) {
      var card = el("article", "review admin-review");
      card.appendChild(el("p", "admin-review__rating", "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + "  " + r.rating + "/5"));
      card.appendChild(el("p", "review__text", r.text));
      var meta = [r.name, r.location, r.service, new Date(r.createdAt).toLocaleString("en-CA")].filter(Boolean).join(" · ");
      card.appendChild(el("p", "review__details", meta));

      var actions = el("div", "admin-review__actions");
      var primary = el("button", "btn " + (r.status === "pending" ? "btn--primary" : "btn--outline"), r.status === "pending" ? "Approve & publish" : "Unpublish");
      primary.type = "button";
      primary.addEventListener("click", function () {
        primary.disabled = true;
        api("PATCH", "", { id: r.id, action: r.status === "pending" ? "approve" : "unpublish" })
          .then(function () { panelStatus.textContent = r.status === "pending" ? "Review published." : "Review unpublished."; return refresh(); })
          .catch(handleError);
      });
      var del = el("button", "btn btn--outline admin-delete", "Delete");
      del.type = "button";
      del.addEventListener("click", function () {
        if (!window.confirm("Delete this review permanently? This cannot be undone.")) return;
        del.disabled = true;
        api("DELETE", "?id=" + encodeURIComponent(r.id))
          .then(function () { panelStatus.textContent = "Review deleted."; return refresh(); })
          .catch(handleError);
      });
      actions.appendChild(primary);
      actions.appendChild(del);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function handleError(err) {
    if (err.auth) {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      password = "";
      showPanel(false);
      loginStatus.className = "form-status form-status--error";
      loginStatus.textContent = err.message;
      return;
    }
    panelStatus.className = "form-status form-status--error";
    panelStatus.textContent = err.message;
  }

  function refresh() {
    return api("GET", "?all=1").then(function (data) {
      reviews = data.reviews || [];
      showPanel(true);
      render();
    });
  }

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    password = document.getElementById("password").value;
    loginStatus.className = "form-status";
    loginStatus.textContent = "Signing in…";
    refresh()
      .then(function () {
        try { sessionStorage.setItem(KEY, password); } catch (err) {}
        loginStatus.textContent = "";
      })
      .catch(handleError);
  });

  document.querySelectorAll(".admin-tab").forEach(function (t) {
    t.addEventListener("click", function () { filter = t.getAttribute("data-filter"); panelStatus.textContent = ""; render(); });
  });

  signOut.addEventListener("click", function () {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    password = "";
    reviews = [];
    showPanel(false);
  });

  if (password) refresh().catch(handleError);
})();
