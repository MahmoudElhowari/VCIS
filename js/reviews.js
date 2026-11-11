/* View Canada Immigration Services — customer reviews (display + submission) */
(function () {
  "use strict";

  var API = "/api/reviews";
  var STAR = "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function stars(rating, label) {
    var wrap = el("span", "stars");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", label || ("Rated " + rating + " out of 5"));
    for (var i = 1; i <= 5; i++) {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("class", i <= Math.round(rating) ? "is-on" : "");
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", STAR);
      svg.appendChild(path);
      wrap.appendChild(svg);
    }
    return wrap;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "long" });
  }

  function reviewCard(r) {
    var card = el("article", "review");
    card.appendChild(stars(r.rating));
    var quote = el("blockquote", "review__text");
    quote.appendChild(el("p", null, r.text));
    card.appendChild(quote);
    var meta = el("footer", "review__meta");
    meta.appendChild(el("span", "review__name", r.name));
    var details = [r.location, r.service].filter(Boolean).join(" · ");
    if (details) meta.appendChild(el("span", "review__details", details));
    var date = formatDate(r.createdAt);
    if (date) {
      var time = el("time", "review__date", date);
      time.setAttribute("datetime", r.createdAt);
      meta.appendChild(time);
    }
    card.appendChild(meta);
    return card;
  }

  function renderSummary(target, reviews) {
    if (!target) return;
    target.textContent = "";
    if (!reviews.length) { target.hidden = true; return; }
    var avg = reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length;
    var rounded = Math.round(avg * 10) / 10;
    target.appendChild(stars(avg, "Average rating " + rounded + " out of 5"));
    target.appendChild(el("strong", null, rounded.toFixed(1)));
    target.appendChild(el("span", null, "from " + reviews.length + (reviews.length === 1 ? " client review" : " client reviews")));
    target.hidden = false;
  }

  function loadReviews() {
    var lists = document.querySelectorAll("[data-reviews-list]");
    if (!lists.length) return;
    fetch(API, { headers: { accept: "application/json" } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (data) {
        var reviews = (data && data.reviews) || [];
        lists.forEach(function (list) {
          var limit = parseInt(list.getAttribute("data-limit"), 10) || reviews.length;
          list.textContent = "";
          list.setAttribute("aria-busy", "false");
          var empty = document.getElementById(list.getAttribute("data-empty"));
          if (empty) empty.hidden = reviews.length > 0;
          reviews.slice(0, limit).forEach(function (r) { list.appendChild(reviewCard(r)); });
          var more = document.getElementById(list.getAttribute("data-more"));
          if (more) more.hidden = reviews.length <= limit;
        });
        document.querySelectorAll("[data-reviews-summary]").forEach(function (t) { renderSummary(t, reviews); });
      })
      .catch(function () {
        lists.forEach(function (list) {
          list.setAttribute("aria-busy", "false");
          list.textContent = "";
          var empty = document.getElementById(list.getAttribute("data-empty"));
          if (empty) empty.hidden = false;
        });
      });
  }

  function setupForm() {
    var form = document.querySelector("form[data-review-form]");
    if (!form) return;
    var status = form.querySelector("[data-form-status]");
    var button = form.querySelector("[type=submit]");
    var ratingField = form.querySelector(".rating-field");

    function fieldError(name, message) {
      var wrap = name === "rating" ? ratingField : (form.elements[name] && form.elements[name].closest(".field"));
      if (!wrap) return;
      wrap.classList.toggle("has-error", !!message);
      var msg = wrap.querySelector(".field__error");
      if (msg && message) msg.textContent = message;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var payload = {
        name: (fd.get("name") || "").trim(),
        location: (fd.get("location") || "").trim(),
        service: fd.get("service") || "",
        rating: fd.get("rating"),
        text: (fd.get("review") || "").trim(),
        consent: fd.get("consent") === "yes",
        website: fd.get("website") || "",
      };

      var errors = {};
      if (payload.name.length < 2) errors.name = "Please enter your name.";
      if (!payload.rating) errors.rating = "Please choose a star rating.";
      if (payload.text.length < 20) errors.review = "Please write at least 20 characters.";
      if (!payload.consent) errors.consent = "Please confirm we may publish your review.";
      ["name", "rating", "review", "consent"].forEach(function (k) { fieldError(k, errors[k]); });
      var first = Object.keys(errors)[0];
      if (first) {
        var focusTarget = first === "rating" ? form.querySelector("input[name=rating]") : form.elements[first];
        if (focusTarget) focusTarget.focus();
        return;
      }

      button.disabled = true;
      button.textContent = "Sending…";
      status.className = "form-status";
      status.textContent = "";

      fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
            return data;
          });
        })
        .then(function () {
          // Also send a copy through Netlify Forms so Nadia gets an email notification.
          var notify = new URLSearchParams();
          notify.append("form-name", "review");
          ["name", "location", "service", "rating", "review"].forEach(function (k) { notify.append(k, fd.get(k) || ""); });
          fetch("/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: notify.toString() }).catch(function () {});

          form.reset();
          status.className = "form-status form-status--ok";
          status.textContent = "Thank you! Your review was received and will appear on the website once it has been approved.";
          status.focus();
        })
        .catch(function (err) {
          status.className = "form-status form-status--error";
          status.textContent = err.message || "Something went wrong. Please try again.";
          status.focus();
        })
        .then(function () {
          button.disabled = false;
          button.textContent = "Submit review";
        });
    });

    // Live character count
    var textarea = form.elements.review;
    var counter = form.querySelector("[data-char-count]");
    if (textarea && counter) {
      var update = function () { counter.textContent = textarea.value.length + " / 1500"; };
      textarea.addEventListener("input", update);
      update();
    }
  }

  loadReviews();
  setupForm();
})();
