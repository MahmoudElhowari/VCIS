/* View Canada Immigration Services — site interactions */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* Header shadow on scroll */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 1101px)").addEventListener("change", function (mq) {
      if (mq.matches) setOpen(false);
    });
  }

  /* Reveal on scroll */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Services: highlight current section in the table of contents */
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
          var link = byId[entry.target.id];
          if (link) link.classList.add("is-active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll(".svc[id]").forEach(function (s) { spy.observe(s); });
  }

  /* Services: mobile jump menu */
  var jump = document.getElementById("svc-jump");
  if (jump) {
    jump.addEventListener("change", function () {
      if (!jump.value) return;
      var target = document.getElementById(jump.value);
      if (target) {
        target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        history.replaceState(null, "", "#" + jump.value);
      }
    });
  }

  /* Contact form: pre-select service from ?service= and accessible validation */
  var form = document.querySelector("form[data-validate]");
  if (form) {
    var params = new URLSearchParams(window.location.search);
    var svc = params.get("service");
    var select = form.querySelector("#service");
    if (svc && select) {
      Array.prototype.forEach.call(select.options, function (o) { if (o.value === svc) select.value = svc; });
    }

    var showError = function (field) {
      var wrap = field.closest(".field");
      if (!wrap) return;
      var invalid = !field.validity.valid;
      wrap.classList.toggle("has-error", invalid);
      field.setAttribute("aria-invalid", String(invalid));
    };

    form.querySelectorAll("input, select, textarea").forEach(function (field) {
      field.addEventListener("blur", function () { if (field.value || field.required) showError(field); });
      field.addEventListener("input", function () {
        if (field.closest(".field.has-error")) showError(field);
      });
    });

    form.addEventListener("submit", function (e) {
      var firstInvalid = null;
      form.querySelectorAll("input, select, textarea").forEach(function (field) {
        if (field.type === "hidden" || field.closest(".hidden-field")) return;
        showError(field);
        if (!field.validity.valid && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        e.preventDefault();
        firstInvalid.focus();
        return;
      }
      var btn = form.querySelector("[type=submit]");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    });
  }

  /* Land on the right section when arriving via a #link (smooth scrolling can cancel the native jump) */
  if (window.location.hash.length > 1) {
    var jumpToHash = function () {
      var el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    };
    window.addEventListener("load", function () { setTimeout(jumpToHash, 0); });
  }

  /* Footer year */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
