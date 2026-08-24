// Scales every fixed 1728px-wide ".stage" canvas to fit the viewport,
// the same way Figma's own preview scales a frame to fit — this is what
// keeps the layout pixel-accurate to the Figma file at any screen size
// without having to rewrite every position for mobile. Home is split into
// #stageTop and #stageBottom (see index.html) around the pinned gallery,
// so this scales all ".stage" elements together, in sync.
//
// Each content .stage sits inside a ".stage-frame" wrapper (overflow:
// hidden). `transform: scale()` only affects paint, not layout, so
// left alone the page would keep reserving every stage's full native
// (unscaled) height — this is what actually sizes each .stage-frame to
// the real, scaled height so no dead space is left below the visibly-
// shrunk content. The menu overlay's own ".stage" (.menu-stage) isn't
// wrapped in a .stage-frame — it's position:fixed and never
// contributes to page height — so it's just scaled, no height fix
// needed; the `frame &&` check below is what skips it safely.
(function () {
  var STAGE_WIDTH = 1728;

  // Below this width, a .stage marked `data-reflow` in its HTML stops
  // being uniformly `transform: scale()`d down and instead renders at
  // real, native document width/flow — letting a matching
  // `@media (max-width: MOBILE_BREAKPOINT)` block in styles.css give it
  // a genuinely different mobile layout (reordered/resized/restacked)
  // instead of just a shrunk desktop. A still-scaled ancestor would
  // otherwise re-shrink any "fixed" mobile CSS right back down
  // regardless of what's set on its descendants, so this JS-side skip
  // is required, not just a CSS media query alone. Keep this constant
  // in sync with every `@media (max-width: 768px)` block added for
  // mobile-reflow sections in styles.css.
  var MOBILE_BREAKPOINT = 768;

  var stages = Array.prototype.slice.call(document.querySelectorAll('.stage'));
  if (!stages.length) return;

  // Home's hero background (see .hero-bg in styles.css) is asked to end
  // exactly at the fold — the bottom of the viewport before any scroll
  // — regardless of how tall the hero content underneath it ends up
  // being. Since .hero-bg lives inside a .stage that's scaled down by
  // the same `scale` factor as everything else here, its *unscaled*
  // (stage-space) height has to be window.innerHeight / scale so that,
  // once the transform shrinks it back down, it lands on exactly
  // window.innerHeight of real screen space — one viewport, no more.
  var heroBg = document.querySelector('.hero-bg');

  function fit() {
    var vw = window.innerWidth;
    var scale = Math.min(vw / STAGE_WIDTH, 1); // never scale up beyond 1x
    var isMobile = vw <= MOBILE_BREAKPOINT;

    // Exposed as a CSS custom property so touch-target sizing (see the
    // ::after hit-area rules in styles.css, e.g. .menu-link/.menu-close/
    // .social-icon/.project-nav-btn) can work out how much a small icon
    // has shrunk and invisibly pad its clickable area back out — every
    // element inside a ".stage" shares this exact same scale, so one
    // shared value covers all of them.
    document.documentElement.style.setProperty('--stage-scale', scale);

    // Every mobile-reflow font-size (styles.css, calc(Npx * var(--mobile-
    // scale, 1))) was originally tuned at a single ~375px reference
    // width (iPhone SE) — reused verbatim, that same px value reads
    // noticeably smaller on a wider phone (iPhone 16 Pro Max etc.) since
    // there's proportionally more empty space around it ("queda muy
    // pequeña la tipografia... en el iphone 16", her note testing the
    // actual current lineup, not just SE). This ramps text up to 15%
    // larger by MOBILE_SCALE_MAX_WIDTH and holds flat past it — floored
    // at 1 (never shrinks below the original tuned size on anything
    // narrower than the reference) and capped at 1.15 (a modest, still-
    // proportional bump, not full-on desktop-sized text creeping in as
    // width climbs toward the 768px tablet boundary).
    var MOBILE_SCALE_MIN_WIDTH = 375;
    var MOBILE_SCALE_MAX_WIDTH = 430;
    var MOBILE_SCALE_MAX = 1.15;
    var mobileScale = 1 + Math.min(
      Math.max(vw - MOBILE_SCALE_MIN_WIDTH, 0) / (MOBILE_SCALE_MAX_WIDTH - MOBILE_SCALE_MIN_WIDTH),
      1
    ) * (MOBILE_SCALE_MAX - 1);
    document.documentElement.style.setProperty('--mobile-scale', mobileScale);

    stages.forEach(function (stage) {
      var frame = stage.parentElement;
      var reflow = isMobile && stage.hasAttribute('data-reflow');

      if (reflow) {
        // Real mobile layout: let the stage render at native width/
        // flow (no transform at all) so the matching styles.css media
        // query can actually reflow it, instead of just repainting a
        // shrunk copy of the desktop version.
        stage.style.transform = 'none';
        if (frame && frame.classList.contains('stage-frame')) {
          frame.style.height = 'auto';
        }
        return;
      }

      stage.style.transform = 'scale(' + scale + ')';

      if (frame && frame.classList.contains('stage-frame')) {
        // stage.offsetHeight is the stage's native, pre-transform
        // layout height (transform never changes it) — exactly what's
        // needed here, multiplied down to the visible, scaled height.
        // marginTop (e.g. #projectStage's mobile-only header-clearance
        // margin — see styles.css) is real, unscaled px: margin is
        // resolved by layout before transform ever paints, so unlike
        // everything else in this box it does NOT shrink with `scale`
        // — added on top, un-multiplied, or .stage-frame would reserve
        // too little height and clip the bottom of the stage by
        // whatever the margin's real height is.
        var marginTop = parseFloat(getComputedStyle(stage).marginTop) || 0;
        frame.style.height = (marginTop + stage.offsetHeight * scale) + 'px';
      }
    });

    if (heroBg) {
      var heroStage = heroBg.closest('.stage');
      if (isMobile && heroStage && heroStage.hasAttribute('data-reflow')) {
        // #stageTop is unscaled and reflowed on mobile (see above) —
        // the hero content is no longer clipped to one viewport, it's
        // whatever height the stacked mobile layout naturally needs,
        // so the background has to cover that same real height instead
        // of the old one-viewport-tall crop. Collapse hero-bg first:
        // it's position:absolute but still tall enough (its own old
        // height, or the 1220px CSS fallback) to inflate stageTop's
        // *own* scrollHeight if left in place while measuring — a
        // self-referential loop that would just re-read back whatever
        // height was already set instead of the real content height.
        heroBg.style.height = '0px';
        heroBg.style.height = heroStage.scrollHeight + 'px';
      } else {
        heroBg.style.height = (window.innerHeight / scale) + 'px';
      }
    }
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  document.addEventListener('DOMContentLoaded', fit);
  fit();
})();

// =========================================================
// Hero background — mouse parallax (index.html) — same shape as the
// Figma Make reference's own App.tsx: `offset` state written from a
// window `mousemove` listener (rAF-throttled, one write per frame),
// normalized to -1..1 across the viewport, applied as a translate3d on
// the whole blob field. Only a fine pointer (mouse) drives this — touch
// devices keep the blobs' own autonomous zj-* keyframe motion with the
// field resting at its centered default (transform never set). The
// 250ms ease-out catch-up comes from the `transition` on
// .hero-blob-field in styles.css, not from anything here.
//
// One deliberate deviation from the reference's literal 22%: at extreme
// cursor positions (e.g. a corner) 22% translates the field further
// than its `inset: -25%` overflow can cover, so the flat .hero-bg
// background peeks out as a hard-edged strip — visible, reported as
// "se mueve el contenedor". The field's own box is 150% of the hero
// (inset -25% each side), so a translate of T% shifts it by T*1.5% of
// the hero — safe up to T ≈ 16.7 before that 25% margin runs out.
// MAX_PERCENT is capped at 15 (shift ≈ 22.5%) for a safety buffer,
// keeping the parallax clearly perceptible but never exposing an edge.
// =========================================================
(function () {
  var field = document.querySelector('.hero-blob-field');
  if (!field) return;
  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;

  var MAX_PERCENT = 15;
  var raf = 0;

  function onMove(e) {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      var x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
      var y = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2));
      field.style.transform = 'translate3d(' + (x * MAX_PERCENT) + '%, ' + (y * MAX_PERCENT) + '%, 0)';
    });
  }

  window.addEventListener('mousemove', onMove);
})();

// =========================================================
// Anchor-link scrolling (e.g. the menu's "Services" link, which points
// at #servicesTop) — handled by hand instead of leaving it to the
// browser's native fragment-jump for two reasons: (1) the fixed header
// (see .header-fixed in styles.css) floats above everything at
// scrollY, so a plain jump lands the target's top edge flush with the
// viewport top and right underneath it; (2) every page position lives
// inside a `transform: scale()`'d .stage, and the amount of extra
// clearance needed to clear the header scales down with it too. Both
// same-page clicks (already on proyects.html, clicking Services again)
// and cross-page loads (clicking Services from another page, landing
// on proyects.html#servicesTop) go through the same scrollToHash so
// they land in the same place.
// =========================================================
(function () {
  var STAGE_WIDTH = 1728;
  // Reference (1728px-canvas) px of clearance to leave above the
  // target: roughly the fixed header's own height (logo/menu sit
  // around y=80-116) plus some breathing room.
  var HEADER_CLEARANCE = 170;

  function scale() {
    return Math.min(window.innerWidth / STAGE_WIDTH, 1);
  }

  function scrollToHash(hash, smooth) {
    if (!hash || hash.length < 2) return;
    var el;
    try {
      el = document.querySelector(hash);
    } catch (err) {
      return;
    }
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var targetY = window.scrollY + rect.top - HEADER_CLEARANCE * scale();
    window.scrollTo({ top: Math.max(targetY, 0), behavior: smooth ? 'smooth' : 'auto' });
  }

  // Same-page hash links: intercept so the browser's own instant jump
  // (which would land under the fixed header) never happens.
  document.querySelectorAll('a[href*="#"]').forEach(function (a) {
    var url;
    try {
      url = new URL(a.getAttribute('href'), window.location.href);
    } catch (err) {
      return;
    }
    if (!url.hash || url.hash.length < 2) return; // skip bare "#" (e.g. the menu toggle)
    if (url.pathname !== window.location.pathname) return; // cross-page, handled below on load

    a.addEventListener('click', function (e) {
      e.preventDefault();
      history.pushState(null, '', url.hash);
      var overlay = document.getElementById('menuOverlay');
      if (overlay && overlay.classList.contains('is-visible')) {
        var closeBtn = document.getElementById('menuClose');
        if (closeBtn) closeBtn.click();
      }
      scrollToHash(url.hash, true);
    });
  });

  // Cross-page landings: e.g. index.html's menu links to
  // proyects.html#servicesTop. A tiny inline script in <head> already
  // stripped the real URL hash into window.__pendingHash before the
  // browser could act on it (see that script for why) — read it from
  // there, not window.location.hash (which is empty by now). This
  // script tag sits at the end of the body, so by the time it runs,
  // `load` may already have fired (no heavy assets to wait on) —
  // listening for it unconditionally would then wait forever. Run right
  // away if so; otherwise wait for it.
  if (window.__pendingHash) {
    var pendingHash = window.__pendingHash;
    var correctHashScroll = function () {
      setTimeout(function () { scrollToHash(pendingHash, false); }, 60);
    };
    if (document.readyState === 'complete') {
      correctHashScroll();
    } else {
      window.addEventListener('load', correctHashScroll);
    }
  }
})();


// =========================================================
// Circular work gallery — literal port of the reference prototype
// (Figma Make: "Animación de imágenes circulares", App.tsx):
//  - RADIUS=340, CARD_SIZE=218, cards evenly spaced 36° apart, same as
//    `cardPositions` in the source (no re-derived/organic positions)
//  - a tall scroll track (380vh) with a sticky, full-viewport stage
//  - cards assemble into the circle progressively as you scroll through
//    the track, in fixed 10 steps (revealedCount), and un-assemble if
//    you scroll back up — bidirectional, exactly like the source
//  - once all 10 are assembled, they "breathe" continuously via RAF,
//    reacting to cursor proximity and movement speed — same amp/freq/
//    phase table and same physics constants (0.025, 380, 0.12, 0.035,
//    0.6/0.4, decay 0.92) as the source
// The source itself doesn't scale, and neither did this port at
// first — it just rendered at real px and let `overflow: hidden` on
// .work-sticky crop it on narrow viewports. On an actual phone that
// meant most of the outer ring of thumbnails was sliced clean off,
// invisible past the screen edge — not a design choice, just an
// unhandled case — so a mobile-only scale-down was added below
// (fitCircle) using the same "shrink, never stretch past 1x" approach
// as fit() for the main .stage, so the whole circle (and its centered
// "See more work" text, since that's a child too) stays fully visible
// and in proportion instead of being cropped.
// =========================================================
(function () {
  var section = document.getElementById('workScroll');
  var circleWrap = document.getElementById('circleWrap');
  if (!section || !circleWrap) return;

  var CIRCLE_SIZE = 1116; // (RADIUS 340 + CARD_SIZE 218) * 2, same as .circle-wrap's own CSS
  var CIRCLE_SIDE_PADDING = 24; // breathing room so cards don't touch the screen edge
  function fitCircle() {
    var avail = window.innerWidth - CIRCLE_SIDE_PADDING * 2;
    var scale = Math.min(1, avail / CIRCLE_SIZE);
    circleWrap.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    // Exposed so .work-cluster-text's mobile font-size (styles.css) can
    // lock in a real, constant ON-SCREEN size via calc(Npx / var(--circle-
    // scale)) — same trick as --stage-scale. Bumping the *source* font-
    // size alone (tried first) still shrinks by this same factor, so on
    // a narrow phone it barely moved ("sigue pequeño", her note) — the
    // circle itself has to shrink a lot more than the main .stage does
    // (1116px wide vs. a phone's ~375-430px), so a fixed source size was
    // never going to read as "bigger" without this compensation.
    document.documentElement.style.setProperty('--circle-scale', scale);
  }
  fitCircle();
  window.addEventListener('resize', fitCircle);

  var darkZone = document.getElementById('workDarkZone');
  var headerFixed = document.querySelector('.header-fixed');
  var heroStickyWrap = document.querySelector('.hero-sticky-wrap');

  // ---- header flips to white text, and the hero un-sticks, once the
  // dark zone reaches the top ----
  // .work-dark-zone (and #stageBottom below it) are now permanently
  // black — the Home background never goes back to white after the
  // hero — so this only needs to flip the header ONE way and leave it
  // there: once darkZone's top has scrolled to/above the viewport top,
  // everything from that point to the bottom of the page is black, so
  // the header stays white-text for the rest of the scroll. No more
  // "&& rect.bottom > 0" upper bound (that was for the old crossfade
  // back to a light section further down, which no longer happens).
  //
  // Same check also releases .hero-sticky-wrap (see styles.css): CSS
  // position:sticky only auto-releases once its CONTAINING BLOCK has
  // been scrolled past, and here that containing block is effectively
  // the whole rest of the page (there's no shorter wrapper bounding
  // it) — so left alone it would stay sticky for the entire remaining
  // scroll and bleed through later sections wherever they don't happen
  // to out-rank its z-index. Flipping it to position:relative the
  // instant darkZone's top reaches the viewport top makes it release
  // at exactly the moment it's fully covered — visually seamless,
  // since that's precisely when .work-dark-zone's opaque black is
  // already painting over the whole viewport — and it re-engages
  // (goes sticky again) the moment you scroll back up past that point.
  var isDark = false;
  function updateDarkSection() {
    if (!darkZone) return;
    var rect = darkZone.getBoundingClientRect();
    var next = rect.top <= 0;
    if (next === isDark) return;
    isDark = next;
    if (headerFixed) headerFixed.classList.toggle('is-on-dark', isDark);
    if (heroStickyWrap) heroStickyWrap.classList.toggle('is-covered', isDark);
  }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PARAMS = [
    { amp: 0.025, freq: 0.38, phase: 0.00 },
    { amp: 0.032, freq: 0.44, phase: 1.20 },
    { amp: 0.018, freq: 0.52, phase: 2.40 },
    { amp: 0.028, freq: 0.35, phase: 0.80 },
    { amp: 0.022, freq: 0.48, phase: 3.50 },
    { amp: 0.035, freq: 0.41, phase: 1.80 },
    { amp: 0.020, freq: 0.56, phase: 4.20 },
    { amp: 0.030, freq: 0.39, phase: 2.60 },
    { amp: 0.024, freq: 0.45, phase: 5.00 },
    { amp: 0.027, freq: 0.50, phase: 0.50 }
  ];

  var cards = Array.prototype.slice.call(circleWrap.querySelectorAll('.card-wrap')).map(function (wrap, i) {
    return {
      wrap: wrap,
      reveal: wrap.querySelector('.card-reveal'),
      breathe: wrap.querySelector('.card-breathe'),
      cx: parseFloat(wrap.dataset.cx || '0'),
      cy: parseFloat(wrap.dataset.cy || '0'),
      rot: parseFloat(wrap.dataset.rot || '0'),
      params: PARAMS[i % PARAMS.length]
    };
  });

  if (reducedMotion) {
    cards.forEach(function (c) {
      c.reveal.style.setProperty('--tx', '0px');
      c.reveal.style.setProperty('--ty', '0px');
      c.reveal.style.setProperty('--rot', c.rot + 'deg');
      c.reveal.classList.add('is-revealed');
    });
    // Card assembly is skipped under reduced motion, but the dark
    // background swap is a color crossfade, not motion — still runs.
    function onScrollReduced() {
      updateDarkSection();
    }
    window.addEventListener('scroll', onScrollReduced, { passive: true });
    onScrollReduced();
    return;
  }

  // ---- scroll -> revealedCount (0..10), exactly like the reference ----
  var revealedCount = 0;

  function applyCards() {
    cards.forEach(function (c, i) {
      var isRevealed = i < revealedCount;
      var delay = isRevealed ? (i * 0.10) + 's' : '0s';
      // Final position is translate(cx, cy); scattered start is 1.55x
      // further out along the same radial line — exactly like the source.
      var tx = isRevealed ? c.cx : c.cx * 1.55;
      var ty = isRevealed ? c.cy : c.cy * 1.55;

      c.reveal.style.transitionDelay = delay;
      c.reveal.style.setProperty('--tx', tx + 'px');
      c.reveal.style.setProperty('--ty', ty + 'px');
      c.reveal.style.setProperty('--rot', c.rot + 'deg');
      c.reveal.classList.toggle('is-revealed', isRevealed);
    });
  }
  applyCards();

  function onScroll() {
    var rect = section.getBoundingClientRect();
    updateDarkSection();

    var scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var progress = Math.max(0, Math.min(1, -rect.top / scrollable));
    // images 0-9 reveal at progress 0.02, 0.06, 0.10, ... 0.38 (same steps as source)
    var revealed = Math.min(10, Math.floor(progress / 0.04) + (progress > 0.01 ? 1 : 0));
    if (revealed !== revealedCount) {
      revealedCount = revealed;
      applyCards();
      if (revealedCount === 10) {
        startBreathing();
      } else {
        stopBreathing();
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- cursor tracking, relative to the circle's own center, real px ----
  var cursor = { x: 99999, y: 99999 };
  var cursorSpeed = 0;
  var prevClient = null;

  window.addEventListener('mousemove', function (e) {
    var rect = circleWrap.getBoundingClientRect();
    cursor.x = e.clientX - (rect.left + rect.width / 2);
    cursor.y = e.clientY - (rect.top + rect.height / 2);

    var now = performance.now();
    if (prevClient) {
      var dt = now - prevClient.t;
      if (dt > 0) {
        var dx = e.clientX - prevClient.x;
        var dy = e.clientY - prevClient.y;
        cursorSpeed = Math.hypot(dx, dy) / dt;
      }
    }
    prevClient = { x: e.clientX, y: e.clientY, t: now };
  }, { passive: true });

  // ---- breathing (RAF), only while all 10 cards are assembled ----
  var rafId = 0;
  var breathStart = null;

  function startBreathing() {
    if (rafId) return;
    breathStart = null;

    function animate(now) {
      if (!breathStart) breathStart = now;
      var t = (now - breathStart) / 1000;

      cursorSpeed *= 0.92;

      cards.forEach(function (c) {
        var dist = Math.hypot(cursor.x - c.cx, cursor.y - c.cy);
        var proximity = Math.max(0, 1 - dist / 380);
        var speedBoost = Math.min(cursorSpeed * 0.12, 0.035);
        var effectiveAmp = c.params.amp + proximity * 0.025 + speedBoost * (0.6 + 0.4 * proximity);
        var scale = 1 + effectiveAmp * Math.sin(2 * Math.PI * c.params.freq * t + c.params.phase);
        c.breathe.style.transform = 'scale(' + scale.toFixed(4) + ')';
      });

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
  }

  function stopBreathing() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
    cards.forEach(function (c) { c.breathe.style.transform = ''; });
  }
})();

// =========================================================
// Menu overlay — opens/closes the half-screen slide-in menu (see the
// "menu-overlay" markup at the end of index.html and its styles in
// styles.css). Triggers: the "MENU [+]" link in the header, the close
// (X) icon, clicking outside the panel, or pressing Escape.
// Two classes drive the slide animation: "is-open" mounts it
// (display:block) and "is-visible" triggers the transform transition
// a frame later, so the panel actually slides in from off-screen
// instead of just appearing. Closing reverses the same steps so it
// slides back out before unmounting.
// =========================================================
(function () {
  var toggle = document.getElementById('menuToggle');
  var overlay = document.getElementById('menuOverlay');
  var closeBtn = document.getElementById('menuClose');
  var backdrop = document.getElementById('menuBackdrop');
  if (!toggle || !overlay) return;

  var CLOSE_DURATION = 450; // matches .menu-reveal transition duration
  var closeTimer = 0;

  function openMenu(e) {
    if (e) e.preventDefault();
    clearTimeout(closeTimer);
    overlay.classList.add('is-open');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('is-visible');
      });
    });
    overlay.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      overlay.classList.remove('is-open');
    }, CLOSE_DURATION);
  }

  toggle.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (backdrop) backdrop.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-visible')) closeMenu();
  });
})();

// =========================================================
// Menu hover flow-text effect setup — the animated gradient overlay on
// each .menu-nav-item (see styles.css) is a ::before with
// content: attr(data-text), so it can share the exact same text as the
// real link without duplicating markup by hand. This just copies each
// item's own text into that attribute once on load.
// =========================================================
(function () {
  document.querySelectorAll('.menu-nav-item').forEach(function (el) {
    el.setAttribute('data-text', el.textContent);
  });
})();

// =========================================================
// Contact form (contact.html) — there's no backend for this static
// site, so instead of actually posting anywhere, Submit opens a Gmail
// compose window pre-filled with the form's values, the same trick
// already used for the footer email link elsewhere on the site. The
// visitor still reviews and sends it themselves from their own Gmail.
// =========================================================
(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstName = form.firstName.value.trim();
    var lastName = form.lastName.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();

    var subject = 'New message from ' + (firstName + ' ' + lastName).trim();
    var body = 'Name: ' + firstName + ' ' + lastName + '\n' +
      'Email: ' + email + '\n\n' +
      message;

    var url = 'https://mail.google.com/mail/?view=cm&fs=1'
      + '&to=' + encodeURIComponent('analauralga21@gmail.com')
      + '&su=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);

    window.open(url, '_blank', 'noopener');
  });
})();

// =========================================================
// About — 3D photo cube (about.html) — literal port of the reference
// prototype (Figma Make: "Cubo 3D interactivo", App.tsx): continuous
// gentle auto-rotation on two axes (+0.12deg/+0.32deg per frame, same
// as the source) via rAF, imperatively setting the cube's transform
// (same pattern as the hero mouse-parallax near the top of this file)
// instead of going through a framework. Clicking a face opens a local
// file picker and
// swaps that face's placeholder for the chosen photo via a blob URL —
// client-side only, exactly like the source, no backend involved.
// =========================================================
(function () {
  var cube = document.getElementById('cube');
  if (!cube) return;

  var rot = { x: -18, y: 24 };
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply() {
    cube.style.transform = 'rotateX(' + rot.x + 'deg) rotateY(' + rot.y + 'deg)';
  }
  apply();

  if (!reducedMotion) {
    (function tick() {
      rot.x += 0.12;
      rot.y += 0.32;
      apply();
      requestAnimationFrame(tick);
    })();
  }

  Array.prototype.slice.call(cube.querySelectorAll('.cube-face')).forEach(function (face) {
    var input = face.querySelector('.cube-face-input');
    var img = face.querySelector('.cube-face-photo');
    var currentUrl = null;

    face.addEventListener('click', function () { input.click(); });
    input.addEventListener('click', function (e) { e.stopPropagation(); });

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(file);
      img.src = currentUrl;
      img.hidden = false;
      face.classList.add('has-photo');
    });
  });
})();

// =========================================================
// Scroll reveal — any element with [data-reveal] (the About bio
// paragraphs, plus headings/paragraphs/footer copy across the other
// pages now — see the [data-reveal] markup on each page) fades and
// drifts up into place the first time it scrolls into view, instead
// of just being there on load. One-time per element (unobserved once
// revealed); skipped entirely under reduced motion (see the CSS,
// which shows revealed elements at full opacity with no transition in
// that case).
// =========================================================
(function () {
  var targets = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (!('IntersectionObserver' in window)) {
    // No IntersectionObserver support: reveal immediately, and make any
    // later-injected [data-reveal] elements (e.g. real project copy,
    // built dynamically by the project-nav script below) reveal
    // immediately too via the shared helper.
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    window.__revealObserve = function (el) { el.classList.add('is-visible'); };
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  targets.forEach(function (el) { observer.observe(el); });

  // Exposed so script elsewhere (project.html's dynamically-injected
  // project-intro paragraphs, which don't exist yet when the
  // querySelectorAll above runs) can register themselves with this same
  // observer instead of needing their own separate reveal wiring.
  window.__revealObserve = function (el) { observer.observe(el); };
})();

// =========================================================
// Proyects — project carousel (proyects.html) — literal port of the
// reference prototype (Figma Make: "Carrusel de proyectos", App.tsx):
// a native horizontal scroll-snap track (so it also works with a
// trackpad/wheel and on touch, not just the pointer drag) with pointer
// drag-to-scroll layered on top, and two round arrow buttons that each
// scroll by ~2 cards and disable themselves at either end. Same
// "step = card width + gap, scrollBy(direction * step * 2)" math as
// the source.
// =========================================================
(function () {
  var viewport = document.getElementById('carouselViewport');
  var track = document.getElementById('carouselTrack');
  var prevBtn = document.getElementById('carouselPrev');
  var nextBtn = document.getElementById('carouselNext');
  if (!viewport || !track) return;

  function updateArrows() {
    if (prevBtn) prevBtn.disabled = viewport.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 4;
  }

  function scrollByCards(direction) {
    var card = track.querySelector('[data-card]');
    var gap = 46;
    var step = card ? card.offsetWidth + gap : viewport.clientWidth * 0.8;
    viewport.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { scrollByCards(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { scrollByCards(1); });
  viewport.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();

  // Pointer drag-to-scroll — same as the source: track the pointer,
  // move scrollLeft opposite the drag, no inertia beyond native
  // momentum scrolling.
  var drag = { active: false, startX: 0, startScroll: 0 };

  track.addEventListener('pointerdown', function (e) {
    drag.active = true;
    drag.startX = e.clientX;
    drag.startScroll = viewport.scrollLeft;
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', function (e) {
    if (!drag.active) return;
    var dx = e.clientX - drag.startX;
    viewport.scrollLeft = drag.startScroll - dx;
  });

  function endDrag(e) {
    drag.active = false;
    if (track.hasPointerCapture && track.hasPointerCapture(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
})();

// =========================================================
// Proyects — "services" card stack (proyects.html) — scroll-driven,
// replacing the earlier drag-to-dismiss deck. #servicesScroll is a
// real-viewport, real-vh tall track (see .services-scroll in
// styles.css); #servicesDeck stays pinned via position:sticky the
// whole time you're inside it, and how far you've scrolled through the
// track maps directly to a continuous "progress" value (0 at the top,
// n-1 — 3, for 4 cards — once fully scrolled through).
//
// For each card i, d = progress - i:
//   d >= 0  → this card has already had its turn (or is having it right
//             now, at d = 0): it recedes into the stack — smaller and
//             shifted up the further past its turn we've scrolled
//             (capped at MAX_DEPTH so far-back cards don't shrink to
//             nothing) — it stays visible, it doesn't disappear, so the
//             pile visibly grows.
//   d < 0   → this card's turn hasn't come yet: it waits below,
//             partly faded, and eases up into place as its turn nears.
// The card's own opacity (its colored shell) and its TEXT's opacity are
// tracked separately: the shell stays visible once arrived (so the
// stack is visible behind the front card), but the title/number/body
// text fades out quickly as soon as a card is no longer front — with
// two neighboring cards both partway through their transition, showing
// both cards' full paragraph text at once just reads as an illegible
// double-exposure. Only the card nearest d = 0 keeps readable text.
// This runs every frame via rAF while scrolling, applying transform/
// opacity directly with no CSS transition — an un-eased, direct link
// between scroll position and transform is what makes this kind of
// effect actually feel smooth (a transition on top of live scroll input
// fights the input and reads as laggy/stepped instead).
// =========================================================
(function () {
  var section = document.getElementById('servicesScroll');
  var deck = document.getElementById('servicesDeck');
  if (!section || !deck) return;

  var CARD_Y_STEP = 26; // px moved up per receded step, once a card's had its turn
  var CARD_SCALE_STEP = 0.05; // scale reduction per receded step
  var MAX_DEPTH = 3; // caps how small/far-back a long-receded card gets
  var INCOMING_OFFSET = 70; // px an upcoming card waits below before easing in
  var CONTENT_FADE_RANGE = 0.55; // |d| beyond which a card's text is fully faded — a touch over half a "step" so neighboring cards' readable windows just crossfade instead of leaving a gap where neither is legible
  var TRANSITION_SPAN = 0.7; // fraction of each card-to-card scroll segment spent actively animating; the remaining tail is a held pause before the next card's turn starts — see mapProgress()

  var cards = Array.prototype.slice.call(deck.querySelectorAll('.services-card'))
    .sort(function (a, b) { return parseInt(a.dataset.card, 10) - parseInt(b.dataset.card, 10); })
    .map(function (card) {
      return {
        el: card,
        content: Array.prototype.slice.call(
          card.querySelectorAll('.services-card-title, .services-card-number, .services-card-body')
        )
      };
    });
  var n = cards.length;
  if (!n) return;

  // Keeps the pinned heading+deck column clear of the fixed header/logo
  // above it — that header scales with viewport width just like the
  // rest of the site (see fit() at the top of this file), so a fixed
  // CSS padding-top can't track it. This measures the header's own
  // rendered bottom edge on load/resize and sets the sticky's
  // padding-top to clear it, with a small buffer — otherwise a receded
  // card sliding up (see CARD_Y_STEP below) can end up drawn right
  // under the header, which reads as a broken/overlapping page instead
  // of a clean pinned section.
  var sticky = document.querySelector('.services-sticky');
  var headerLogo = document.querySelector('.header-fixed .logo');
  var headingEl = document.querySelector('.services-heading');

  // ---- mobile: scale the whole deck to fit narrow viewports ----
  // .services-deck is real px (1257x681 — it doesn't live inside the
  // scaled .stage, see the file comment above), so on any viewport
  // narrower than that it used to just get sliced off on both sides by
  // .services-sticky's overflow:hidden — cutting card titles/body text
  // off mid-word instead of shrinking. Scaling the whole deck down
  // (same "shrink, never stretch past 1x" approach as fit() for the
  // main stage) keeps every card's full composition intact, just
  // smaller — and since each card's own per-frame transform (see
  // applyProgress below) is applied to the card, not the deck, nesting
  // this scale on the deck's own transform composes with it for free,
  // no extra math needed. Height is checked too, not just width: on a
  // short landscape-ish viewport the deck could still overflow
  // vertically even at full viewport width.
  var DECK_WIDTH = 1257, DECK_HEIGHT = 681;
  var DECK_SIDE_PADDING = 24; // breathing room so cards don't touch the screen edge
  var DECK_BOTTOM_BUFFER = 24;
  // Below this, the deck stops being Figma's 1257x681 composition
  // shrunk down (which left a small island of cards surrounded by a
  // lot of leftover black space — "servicios... se ve chico con mucho
  // espacio negro alrededor", her exact note) and instead becomes a
  // real mobile card sized to the actual available space, with its
  // title/number/body restacked by the matching styles.css media
  // query (position:static, real document flow) instead of just
  // scaled-down absolute coordinates. Matches the project's shared
  // mobile breakpoint (see MOBILE_BREAKPOINT in the fit() IIFE above).
  var DECK_MOBILE_BREAKPOINT = 768;
  function fitDeck() {
    var availW = window.innerWidth - DECK_SIDE_PADDING * 2;
    var paddingTop = sticky ? parseFloat(sticky.style.paddingTop) || 0 : 0;
    // Read the heading's REAL margin-bottom instead of assuming the
    // desktop 64px value — styles.css gives it a smaller 32px margin
    // on mobile, and hardcoding 64 here was over-reserving 32px of
    // height the mobile card could otherwise use (part of why the
    // cards read short/cramped — "la alargaría un poco más", her note).
    var headingMarginBottom = headingEl ? parseFloat(getComputedStyle(headingEl).marginBottom) || 0 : 0;
    var headingSpace = headingEl ? headingEl.getBoundingClientRect().height + headingMarginBottom : 0;
    var isMobileDeck = window.innerWidth <= DECK_MOBILE_BREAKPOINT;
    // Mobile gets a tighter bottom buffer too — every extra px here
    // directly shortens the card, and there's already generous
    // internal padding around the card's own text (see .services-card
    // in the matching styles.css media query).
    var bottomBuffer = isMobileDeck ? 12 : DECK_BOTTOM_BUFFER;
    var availH = window.innerHeight - paddingTop - headingSpace - bottomBuffer;

    if (isMobileDeck) {
      deck.style.width = availW + 'px';
      deck.style.height = availH + 'px';
      deck.style.transform = '';
      return;
    }

    // Explicitly reset back to the desktop composition's real size in
    // case the viewport was just resized back up past the breakpoint
    // (e.g. rotating a tablet) — otherwise the mobile-sized inline
    // width/height above would linger and get scaled instead of the
    // real 1257x681 desktop box.
    deck.style.width = DECK_WIDTH + 'px';
    deck.style.height = DECK_HEIGHT + 'px';
    var scale = Math.min(1, availW / DECK_WIDTH, availH / DECK_HEIGHT);
    deck.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
  }
  deck.style.transformOrigin = 'top center';

  function updateStickyClearance() {
    if (!sticky || !headerLogo) return;
    var headerBottom = headerLogo.getBoundingClientRect().bottom;
    sticky.style.paddingTop = Math.max(24, headerBottom + 20) + 'px';
    fitDeck();
  }
  updateStickyClearance();
  window.addEventListener('resize', updateStickyClearance);

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyProgress(p) {
    cards.forEach(function (card, i) {
      var d = p - i;
      var ty, sc, op;

      if (d >= 0) {
        var depth = Math.min(d, MAX_DEPTH);
        sc = 1 - depth * CARD_SCALE_STEP;
        ty = -depth * CARD_Y_STEP;
        op = 1;
      } else {
        var amount = Math.min(1, -d);
        sc = 1 - amount * 0.03;
        ty = amount * INCOMING_OFFSET;
        op = 1 - amount;
      }

      var contentOp = Math.max(0, 1 - Math.abs(d) / CONTENT_FADE_RANGE);

      card.el.style.transform = 'translate3d(0,' + ty + 'px,0) scale(' + sc + ')';
      card.el.style.opacity = String(op);
      card.el.style.zIndex = String(i);
      card.content.forEach(function (el) { el.style.opacity = String(contentOp); });
    });
  }

  if (reducedMotion) {
    applyProgress(n - 1); // settle straight into the final stacked state, no scroll-linked motion
    return;
  }

  // Turns the raw, continuous 0..(n-1) scroll fraction into a "stepped"
  // progress: each 0..1 card-to-card segment spends its first
  // TRANSITION_SPAN actively moving (still a direct, un-eased scroll
  // link — same reasoning as applyProgress's own comment above), then
  // holds flat for the rest of the segment. That flat tail is what
  // reads as a small pause between each card's transition instead of
  // them all feeling fused together.
  function mapProgress(raw) {
    var segments = n - 1;
    if (segments <= 0) return 0;
    var seg = Math.min(segments - 1, Math.floor(raw));
    var local = raw - seg;
    var eased = local < TRANSITION_SPAN ? (local / TRANSITION_SPAN) : 1;
    return seg + eased;
  }

  applyProgress(0);

  var ticking = false;
  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var total = rect.height - window.innerHeight; // scrollable distance inside the pinned track
    if (total <= 0) { applyProgress(0); return; }
    var scrolled = Math.min(total, Math.max(0, -rect.top));
    applyProgress(mapProgress((scrolled / total) * (n - 1)));
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// =========================================================
// Individual project page — real case-study content, prev/next arrows,
// and dynamic layout (project.html). One shared template, driven by a
// ?p= index into PROJECT_COPY below (same order as the Gallery grid).
// On load: sets the real title, rebuilds .project-intro from the
// project's real paragraphs (each becomes its own <p data-reveal>,
// registered with the shared reveal observer exposed above as
// window.__revealObserve since these elements don't exist yet when
// that observer does its own querySelectorAll), then reflows the
// layout to fit however long the real title/copy turns out to be:
// title is fixed at top:220 (from CSS) and just grows downward when it
// wraps to 2 lines; the intro is positioned right under it; and the
// footer/stage height are pushed down to clear whichever is taller,
// the intro copy or the fixed photo column. Photos stay the shared
// Unsplash placeholders until each project gets its own real
// photography.
// =========================================================
(function () {
  var titleEl = document.querySelector('.project-title');
  var introEl = document.querySelector('.project-intro');
  var prevBtn = document.getElementById('projectPrev');
  var nextBtn = document.getElementById('projectNext');
  if (!prevBtn || !nextBtn) return; // not on project.html

  var PROJECT_COPY = [
    { title: 'Level Home Investment', paragraphs: [
      `Level Home Investment was building its real estate business and needed a presence that reflected its ambitions — professional, credible, and built to grow. The project focused on developing a website that would elevate the brand's image and support client acquisition.`,
      `The design approach prioritized clarity and confidence: a clean, structured layout that communicates reliability and expertise at every touchpoint. Visual decisions were made with the end client in mind — someone evaluating a significant investment who needs to trust the people behind it. The result is a digital presence that positions Level Home Investment as a serious, established player ready to scale.`
    ] },
    { title: 'Blockbuster App', paragraphs: [
      `A UX design project reimagining Blockbuster as a modern streaming and rental app — exploring what the iconic brand could look like if it made a comeback in today's digital landscape.`,
      `The process was research-driven from the start: user interviews were conducted to understand how people currently navigate streaming platforms, what frustrates them, and what they genuinely miss about the physical rental experience. Those insights shaped every design decision that followed.`,
      `The result is an interface that blends nostalgia with contemporary usability — keeping the warmth and personality of the Blockbuster brand while delivering the clarity and ease modern users expect from a digital product.`
    ] },
    { title: 'Nopalogy', paragraphs: [
      `For Nopalogy, I led a complete rebrand focused on making the brand feel more Mexican, expressive, and approachable. The goal was to move away from a more polished and generic look and embrace the warmth and personality of traditional Mexican lettering, while keeping it fresh, playful, and contemporary.`,
      `I developed the brand's visual system from the ground up, including its typography, color palette, graphic language, and overall art direction. The new identity was then extended across the brand's packaging, social media, and website, creating a cohesive system that feels unmistakably Mexican, fun, and close to its audience.`
    ] },
    { title: 'Raina Kattelson', paragraphs: [
      `Raina Kattelson is a New York-based prop and interior stylist who has worked with numerous notable people and recognized brands, creating rich and human visual worlds. The project involved building an identity that evokes her personality and highlights her work, connecting with new audiences.`,
      `Raina's vision was to refresh her image to have a more recognizable and consistent brand, showcasing her projects and character in an organic and contemporary way. The logo combines a "handwritten" typeface with an imperfect enclosing shape, evoking her curiosity, creativity and sense of freedom.`,
      `The logo is accompanied by a graphic system that picks up tones recurring throughout her work and interact in a harmonious and balanced way, along with a more experimental typographic approach — combining two very different typefaces and replacing the word "and" with "&" in all instances. Other elements such as rules, color blocks and the use of the shape are carried through to formalize the graphic outputs.`,
      `With that system in place, the look & feel of her website, promotional postcards, and presentations for creative briefs came together. The result is an interesting, organic and modern brand.`
    ] },
    { title: 'Astro Cold Brew', paragraphs: [
      `Astro Cold Brew was born as part of the Shake Shack family in Mexico — an innovative, energizing drink in a can designed to inspire and fuel its consumers. The project covered everything from strategic foundation to visual execution.`,
      `The process began by defining the core concepts guiding the brand: the quality of the drink, its role as a companion to new consumers, the pleasure of an indulgent moment, and the energy that keeps you moving toward your goals. From these pillars, the name Astro Cold Brew was developed — a drink that elevates the good, recharges you, and lets you launch toward your objectives.`,
      `The communication aligned with an "out of this world" narrative, with messaging like "we are a comet of quality, flavor and energy" — striking a friendly and dynamic tone. This universe translated visually through a bold, approachable logo, paired with equally strong typography, vivid and disruptive colors, and an illustration system that positions the brand as a fun ally in the cold brew adventure.`
    ] },
    { title: 'Mordisko', paragraphs: [
      `Mordisko, under the Holanda umbrella, is one of Mexico's most iconic brands — recognized as the pioneer of ice cream sandwiches. Its essence is elevating consumers through innovative, refreshing combinations. The project involved working alongside advertising agency DDB to refresh its identity and maintain relevance and impact with new generations.`,
      `The main goal of this rebranding was to update Mordisko's image, which hadn't been renewed in many years and had become predictable. Its personality is fun, disruptive and dynamic, so the new identity was built to evoke exactly that — especially for Gen Z.`,
      `The logotype brings back a playful mouth inside the first "o," combined with bold typography where the letters dance and escape the monotony of a uniform baseline. For the packaging, a brighter, bolder color palette was developed to stand out inside refrigerators, with waves in different tones that draw the consumer in while highlighting the mix of textures and flavors the brand is known for. Stickers were introduced as a contemporary visual language using symbols tied to positivity and enjoyment, while photography embraced the dazzling palette featuring younger consumers reveling in the Mordisko experience.`
    ] },
    { title: 'Siete Machos', paragraphs: [
      `Siete Machos is a nationally recognized brand with decades of history, perfuming generations of Mexican households. The project involved refreshing their web presence — for both the cosmetics and spirits lines — and redesigning the tequila label to connect with younger audiences.`,
      `The project began with the tequila packaging redesign, where key elements such as the goats, agave plants, and logotype needed to be preserved. Drawing from the celebration at the heart of the drink, an illustration was crafted featuring seven dancing billy goats alongside other festive elements, turning the label into a communal celebration.`,
      `With the tequila's new visual style established, the look and feel was translated to the spirits website — incorporating illustrative elements for iconography, a warm and elegant updated palette, and more contemporary typography. For the cosmetics site, the focus was on preserving the brand's essence by highlighting the ritualistic and esoteric qualities of the products, modernizing typography, bringing consistency to the photographic style, and carefully crafting the user experience as they explore the world of Siete Machos.`
    ] },
    { title: 'Aromandia - Scented Candles', paragraphs: [
      `Aromandia is a premium candle brand set to launch this year — a project built from the ground up with the attention to detail that a product at this level demands. The work covered packaging design and full print production management for the brand's core collection, which includes the Nicho and Anthology lines, available year-round.`,
      `Every decision — from material to typography to finish — was made to reflect the premium positioning of the brand. The packaging is designed to be as much an object as the candle itself: something you want to keep, display, and give. Aromandia enters the market as a brand that already knows exactly who it is.`
    ] },
    { title: 'Shelter Studios', paragraphs: [
      `Shelter Studios was created as an initiative to promote both emerging and established artists through audiovisual production — building community and an intimate space for audiences to truly know them. The project involved developing the name and full identity for the program.`,
      `The vision was to create a space for concerts and interviews with musicians in a warm, home-like setting — humanizing them and opening a dialogue between music lovers. From the beginning, the team envisioned a program diverse in genres, origins, and styles: a platform for discovering the most exciting music happening in Mexico.`,
      `From these concepts, Shelter Studios was born — a name that captures the essence of the project: a warm refuge for music. This translated visually into the logotype, where an armchair serves as the primary icon and brand identifier. The symbol also carried through into the set design, with each recording always featuring a different armchair or sofa. The broader visual territory is built on silhouettes — the armchair alongside domestic living room elements and musical instruments becomes an enveloping frame for imagery, completed by expressive typography that creates a flexible, contemporary, and compelling visual system.`
    ] },
    { title: 'Tom Kubik Photography', paragraphs: [
      `Tom Kubik is a Los Angeles-based photographer whose practice centers on creating authentic images that capture the lifestyle of real people. The project involved refreshing his identity to expand his reach and grow his audience.`,
      `What makes Tom's practice so unique is the connection he builds between his lens and his subjects — a recognition that goes beyond the image. One of his core priorities is creating a space where people feel comfortable and free to share their stories and their lives.`,
      `Understanding how central authenticity is to his work, a handwritten-style logotype was chosen to function as a signature — lending a personal, intimate quality to the brand. The color palette remained neutral (black and white) to let the photographs remain the protagonists of every communication. Curved strokes coexist harmoniously with Tom's visual world, interacting with his images without overshadowing them. Business cards carry his unique tone with messaging that seeks genuine, open connection — always within a minimalist but distinctly original aesthetic.`
    ] },
    { title: 'Effecty', paragraphs: [
      `Effecty is a digital telehealth platform promoting wellness through medication-assisted weight loss — helping users on their journey toward a healthier, fuller, and happier life. The project involved developing both the name and identity around the brand's key pillars: trust, companionship, and positivity.`,
      `The name Effecty was built around the concepts of quality and reliability — drawing from "effect" and "effective" to reference the positive impact of the service, softened and made approachable with the "-y" ending. The logotype captures that same lightness through a classic typeface with an italic accent on the "f" letters, creating a diagonal dynamism that speaks to progress and movement toward goals.`,
      `The identity lives within a palette of greens, blues, soft beiges, and whites — evoking peace and lightness. Photography, illustration style, and typography all work together to achieve a human, trustworthy approach that feels as good as the product promises to make you feel.`
    ] },
    { title: 'Paws', paragraphs: [
      `Paws is a line designed for Petco created to address one of every pet owner's most relatable challenges: masking pet odors at home. The product line includes scented candles crafted specifically to neutralize the smells that come with sharing your space with the animals you love.`,
      `The packaging design balances warmth and playfulness — nodding to the pet owner lifestyle while feeling elevated enough to live comfortably in any home. The result is a line that feels both functional and giftable, fitting naturally within Petco's retail environment while standing out on shelf.`
    ] },
    { title: 'USG', paragraphs: [
      `USG is a leading construction materials brand with a presence across Latin America. The project involved a comprehensive rebranding that touched every dimension of the brand — from digital to physical, from the warehouse to the street.`,
      `The scope was extensive: a complete brand identity manual built to work consistently across LATAM markets, covering the website, social media, transportation, uniforms, signage, and the bags used for concrete materials. Each application required careful consideration of how the identity would perform across vastly different contexts and scales — from a screen to the side of a truck.`,
      `The result is a cohesive, scalable system that gives USG the visual authority and consistency its regional presence demands, ensuring the brand communicates with the same strength whether encountered online or on a construction site.`
    ] },
    { title: 'Señor Mango', paragraphs: [
      `Señor Mango is a dried mango brand determined to stand out in a market where most players look exactly alike. The project covered packaging design and management, motion graphics, and ongoing website review and improvement — all aimed at attracting new customers through design that does something different.`,
      `The packaging breaks from category conventions: bold, distinctive, and crafted to stop someone mid-aisle. Motion graphics extended the brand's personality into digital channels, adding energy and dynamism to the way the product shows up online. The website was continuously refined to improve the user experience and strengthen the brand's commercial appeal. The overall result is a brand that has carved out its own visual territory in a crowded market.`
    ] },
    { title: 'Grace Sepulveda', paragraphs: [
      `Grace Sepúlveda, an expert with decades of experience in hospitality, decided to channel her knowledge into a consulting agency specializing in the timeshare industry. The project covered brand strategy, identity, and website — all built to reflect her professional personality and the quality of her services.`,
      `One of the most important goals was generating trust: clients needed to know they were hiring results-driven experts. The work focused on projecting Grace's innovative and creative attitude, the collaborative character of her team, and the deeply human and passionate side behind her dedication and trajectory.`,
      `A logotype was developed communicating the elegance and modernity associated with the founder — using a contemporary sans serif alongside an isotype built from the repetition of the letter S (for Sepúlveda), evoking the serenity of a sunrise and a clean, fluid aesthetic. The visual system pairs a sans serif with a high-personality serif, evoking Grace's strength and subtlety. A palette of light, airy tones and photography of spaces, landscapes, and team moments reinforce the collaborative and human nature of the brand — coming together most powerfully on the website.`
    ] },
    { title: 'Aer by Armella', paragraphs: [
      `Aer by Armella sells air conditioning — a product category not typically associated with aspiration or beauty. The project involved building the brand from the ground up: logo, website, outdoor posters, and the full range of brand applications.`,
      `The design challenge was to elevate a utilitarian product into something that felt considered and premium. The visual identity communicates freshness, modernity, and reliability — qualities that matter to someone making a significant purchase for their home or business. The website translates that identity into a clear, confident digital experience, while the outdoor posters give the brand a strong physical presence in the city. The result is a brand that makes Aer by Armella impossible to ignore and easy to trust.`
    ] },
    { title: 'Vita Blip', paragraphs: [
      `Vita Blip is a vitamin brand whose identity needed to feel as good as the product promises to make you feel. The packaging design focused on creating a visual presence that is clean, vibrant, and trustworthy — communicating health and quality at a glance.`,
      `In a category crowded with clinical-looking packaging, Vita Blip was designed to feel approachable and energetic without sacrificing credibility. Every detail — from color to typography to structure — was considered to make the product feel like a daily ritual worth looking forward to.`
    ] },
    { title: 'English Sprint', paragraphs: [
      `English Sprint is a learning platform and community dedicated to English language acquisition. The project involved working alongside founder Mercedes Medina to build an identity that evokes quality, warmth, and confidence — connecting with the right audience.`,
      `The platform offers expert-led lessons focused on achieving IELTS certification. To meet the brand's goals, the identity needed to communicate a friendly, reliable, professional, and accessible attitude. A logotype was created inspired by British metro signage — featuring an underlined sans serif typeface within a circular enclosure. The offset between elements transmits movement, dynamism, and agility: all essential qualities in an educational environment.`,
      `Throughout the rest of the visual system, structured grid-based elements and color blocks coexist with rounded accents and organic strokes, balancing the playful with the organized. The color palette combines neutrals (black and white) with primaries (yellow, blue, and red) for a classic, timeless, and memorable system.`
    ] },
    { title: 'Nos Vemos de Noche', paragraphs: [
      `Nos Vemos de Noche is the artistic project of Chilean artist Paulina Silva Hauyon. The work involved developing the full visual proposal for her project — encompassing her book design and website — creating a cohesive world that reflects her artistic voice.`,
      `The visual identity was built to feel intimate and evocative, matching the emotional register of Paulina's work. The book design treated every detail as an extension of her artistic practice, while the website creates a digital space where her audience can enter her world. The result is a visual system that doesn't just represent the project — it becomes part of it.`
    ] },
    { title: 'Debajo de un ciruelo', paragraphs: [
      `Debajo de un Ciruelo was a real exhibition held at Centro de Diseño, born from a color workshop in Oaxaca exploring natural pigments — cochineal and black bean — and their expressive possibilities.`,
      `The project sits at the intersection of research, craft, and visual experimentation. Developed from an investigation into traditional Mexican dyeing techniques, the work translated material and process into a cohesive exhibition identity that honored both the artisanal origins and the conceptual depth of the exploration. The result is a project that is as much about the act of making as it is about the final image.`
    ] },
    { title: 'Toda Fest', paragraphs: [
      `Toda Fest was conceived as a music festival with an entirely female lineup — a celebration of women in music built around the idea that this space was long overdue. Though the event was ultimately not realized, the visual identity was fully developed.`,
      `The brand needed to feel bold and celebratory without being reductive — capturing the energy of a festival while centering the intention behind it. Typography, color, and graphic elements were chosen to feel powerful, joyful, and unmistakably intentional. The identity stands as a complete vision for what the festival would have looked and felt like.`
    ] },
    { title: 'Garabatos', paragraphs: [
      `Garabatos is a beloved Mexican restaurant brand whose positioning had typecast it as a place for older audiences and breakfast only. The redesign transformed uniforms, printed materials, and digital assets for the Querétaro location to reflect the brand's real personality and evoke its versatility — a change set to extend across all locations.`,
      `The project developed a new messaging and visual identity strategy communicating that Garabatos is a space for everyone, at any time of day. The logotype's legibility was refined first, then a fresh palette of whites, creams, browns, and greens was introduced — evoking freshness, cleanliness, and the organic. Classic complementary typefaces reinforce the brand's quality and refinement, while photography showcases delicious food, consumer enjoyment, and the overall Garabatos experience. Graphic elements like frames, rules, and textures using the logo monogram were added to create a memorable impact and consolidate the new positioning.`
    ] },
    { title: 'Triangulo de Oro', paragraphs: [
      `Triángulo de Oro is a Costa Rican brand looking to bring its product to Mexico — and to adapt its image to compete on Mexican supermarket shelves. The project involved packaging redesign with a clear commercial goal: to resonate with a new market without losing the brand's essence.`,
      `The work required understanding both what makes the brand distinctive and what Mexican consumers expect to see in this category. The resulting packaging adapts the brand's visual identity to meet those expectations — with the shelf presence, clarity, and appeal needed to earn a place in a new market.`
    ] },
    { title: 'SUMA', paragraphs: [
      `SUMA is a collective and community platform built around the vision of José Ramón Ruíz — a space where art, nature, discussion, and the transcendent come together through unique shared experiences.`,
      `The name reflects the project's core idea: a whole made up of distinct parts, always adding something meaningful to the lives of its members through exploration. That adventurous spirit carried into the logotype — a lowercase typeface for approachability, paired with an icon that transforms the "S" into a labyrinth of layered lines, evoking the many paths and people that make up the platform.`,
      `The visual system was built from clean, adaptable typography, warm and deep colors, and an emphasis on textures, close-up imagery, and visuals that evoke the creative, spiritual, rich, and diverse universe at SUMA's core.`
    ] },
    { title: 'Velavita', paragraphs: [
      `Velavita is a candle brand built around the idea that a candle can do more than fill a room with scent — it can mark a moment. The project involved developing the brand identity and packaging, creating a visual world as considered and intentional as the product itself.`,
      `The design approach is warm, refined, and sensorial — communicating the quality of the product through every detail. Typography, color, and material choices work together to position Velavita as a brand that belongs in the homes of people who care about the way things feel.`
    ] },
    { title: 'Alpez', paragraphs: [
      `Alpez is an energy and gas distribution company operating in Mexico. The project involved developing a visual identity that communicates reliability, efficiency, and professionalism — the qualities that matter most when clients depend on you for something essential.`,
      `The brand was built to feel trustworthy and modern: clear enough to work across vehicles, uniforms, signage, and digital touchpoints, and strong enough to establish Alpez as a serious player in its category.`
    ] },
    { title: 'Oasis Decoraciones', paragraphs: [
      `Oasis Decoraciones is a candle brand with its sights set on expanding into fragrances — a brand at the beginning of something. The project involved developing an identity and visual presence that could grow alongside the product line.`,
      `The design needed to feel evocative and warm, rooted in the sensorial experience the products promise. Every visual decision was made with longevity in mind: a system flexible enough to accommodate new products and categories as the brand evolves, while staying consistent and recognizable from day one.`
    ] },
    { title: 'Aromandia - Seasonalities', paragraphs: [
      `The Seasonalities collection is Aromandia's seasonal chapter — limited releases designed around Mother's Day, autumn, and the holiday season. Each collection required its own visual identity while remaining cohesive with the broader brand.`,
      `Packaging design and print production management were handled throughout, ensuring each release met the premium standard Aromandia is built on. The seasonal collections give the brand a reason to show up differently at key moments in the year — creating anticipation, gifting relevance, and keeping the brand feeling alive and current across seasons.`
    ] },
    { title: 'Sunshine Bagels', paragraphs: [
      `Sunshine Bagels is a bagel brand based in Los Angeles with the kind of personality that belongs in your feed. The project focused on social media design — building a visual language that translates the brand's warmth and energy into content that connects.`,
      `Every piece was designed to feel consistent with the brand while staying fresh and engaging — using color, typography, and layout to create a scrollable world that makes people hungry and happy in equal measure.`
    ] }
  ];

  // Real project photography, same order as PROJECT_COPY above — a
  // variable number of photos per project (2 to 6), all exported at
  // the same 942x588 (~1.6:1) crop, which is why a single fixed
  // PHOTO_HEIGHT below works for all of them. A path ending in .mp4 is
  // rendered as a silent autoplay/loop/muted <video> instead of an
  // <img> (see the media-column render loop below) — used for Astro
  // Cold Brew and Level Home Investment's site-walkthrough clips.
  var PROJECT_MEDIA = [
    ['images/projects/level-home-investment/img-01.jpg', 'images/projects/level-home-investment/img-02.jpg', 'images/projects/level-home-investment/img-03.jpg', 'images/projects/level-home-investment/img-04.jpg', 'images/projects/level-home-investment/img-05.jpg', 'images/projects/level-home-investment/video.mp4'],
    ['images/projects/blockbuster-app/img-01.jpg', 'images/projects/blockbuster-app/img-02.jpg', 'images/projects/blockbuster-app/img-03.jpg', 'images/projects/blockbuster-app/img-04.jpg', 'images/projects/blockbuster-app/img-05.jpg', 'images/projects/blockbuster-app/img-06.jpg'],
    ['images/projects/nopalogy/img-01.jpg', 'images/projects/nopalogy/img-02.jpg', 'images/projects/nopalogy/img-03.jpg', 'images/projects/nopalogy/img-04.jpg'],
    ['images/projects/raina-kattelson/img-01.jpg', 'images/projects/raina-kattelson/img-02.jpg', 'images/projects/raina-kattelson/img-03.jpg', 'images/projects/raina-kattelson/img-04.jpg', 'images/projects/raina-kattelson/img-05.jpg', 'images/projects/raina-kattelson/img-06.jpg'],
    ['images/projects/astro-cold-brew/img-01.jpg', 'images/projects/astro-cold-brew/img-02.jpg', 'images/projects/astro-cold-brew/img-03.jpg', 'images/projects/astro-cold-brew/img-04.jpg', 'images/projects/astro-cold-brew/img-05.jpg', 'images/projects/astro-cold-brew/video.mp4'],
    ['images/projects/mordisko/img-01.jpg', 'images/projects/mordisko/img-02.jpg', 'images/projects/mordisko/img-03.jpg', 'images/projects/mordisko/img-04.jpg', 'images/projects/mordisko/img-05.jpg', 'images/projects/mordisko/img-06.jpg'],
    ['images/projects/siete-machos/img-01.jpg', 'images/projects/siete-machos/img-02.jpg', 'images/projects/siete-machos/img-03.jpg', 'images/projects/siete-machos/img-04.jpg', 'images/projects/siete-machos/img-05.jpg', 'images/projects/siete-machos/img-06.jpg'],
    ['images/projects/aromandia-scented-candles/img-01.jpg', 'images/projects/aromandia-scented-candles/img-02.jpg', 'images/projects/aromandia-scented-candles/img-03.jpg', 'images/projects/aromandia-scented-candles/img-04.jpg', 'images/projects/aromandia-scented-candles/img-05.jpg', 'images/projects/aromandia-scented-candles/img-06.jpg'],
    ['images/projects/shelter-studios/img-01.jpg', 'images/projects/shelter-studios/img-02.jpg', 'images/projects/shelter-studios/img-03.jpg', 'images/projects/shelter-studios/img-04.jpg', 'images/projects/shelter-studios/img-05.jpg', 'images/projects/shelter-studios/img-06.jpg'],
    ['images/projects/tom-kubik/img-01.jpg', 'images/projects/tom-kubik/img-02.jpg', 'images/projects/tom-kubik/img-03.jpg', 'images/projects/tom-kubik/img-04.jpg', 'images/projects/tom-kubik/img-05.jpg', 'images/projects/tom-kubik/img-06.jpg'],
    ['images/projects/effecty/img-01.jpg', 'images/projects/effecty/img-02.jpg', 'images/projects/effecty/img-03.jpg', 'images/projects/effecty/img-04.jpg', 'images/projects/effecty/img-05.jpg', 'images/projects/effecty/img-06.jpg'],
    ['images/projects/paws/img-01.jpg', 'images/projects/paws/img-02.jpg', 'images/projects/paws/img-03.jpg', 'images/projects/paws/img-04.jpg', 'images/projects/paws/img-05.jpg', 'images/projects/paws/img-06.jpg'],
    ['images/projects/usg/img-01.jpg', 'images/projects/usg/img-02.jpg', 'images/projects/usg/img-03.jpg', 'images/projects/usg/img-04.jpg', 'images/projects/usg/img-05.jpg', 'images/projects/usg/img-06.jpg'],
    ['images/projects/senor-mango/img-01.jpg', 'images/projects/senor-mango/img-02.jpg', 'images/projects/senor-mango/img-03.jpg', 'images/projects/senor-mango/img-04.jpg', 'images/projects/senor-mango/img-05.jpg', 'images/projects/senor-mango/img-06.jpg'],
    ['images/projects/grace-sepulveda/img-01.jpg', 'images/projects/grace-sepulveda/img-02.jpg', 'images/projects/grace-sepulveda/img-03.jpg', 'images/projects/grace-sepulveda/img-04.jpg', 'images/projects/grace-sepulveda/img-05.jpg', 'images/projects/grace-sepulveda/img-06.jpg'],
    ['images/projects/aer-by-armella/img-01.jpg', 'images/projects/aer-by-armella/img-02.jpg', 'images/projects/aer-by-armella/img-03.jpg', 'images/projects/aer-by-armella/img-04.jpg', 'images/projects/aer-by-armella/img-05.jpg', 'images/projects/aer-by-armella/img-06.jpg'],
    ['images/projects/vita-blip/img-01.jpg', 'images/projects/vita-blip/img-02.jpg'],
    ['images/projects/english-sprint/img-01.jpg', 'images/projects/english-sprint/img-02.jpg', 'images/projects/english-sprint/img-03.jpg', 'images/projects/english-sprint/img-04.jpg', 'images/projects/english-sprint/img-05.jpg'],
    ['images/projects/nos-vemos-de-noche/img-01.jpg', 'images/projects/nos-vemos-de-noche/img-02.jpg', 'images/projects/nos-vemos-de-noche/img-03.jpg'],
    ['images/projects/debajo-de-un-ciruelo/img-01.jpg', 'images/projects/debajo-de-un-ciruelo/img-02.jpg', 'images/projects/debajo-de-un-ciruelo/img-03.jpg'],
    ['images/projects/toda-fest/img-01.jpg', 'images/projects/toda-fest/img-02.jpg', 'images/projects/toda-fest/img-03.jpg', 'images/projects/toda-fest/img-04.jpg', 'images/projects/toda-fest/img-05.jpg', 'images/projects/toda-fest/img-06.jpg'],
    ['images/projects/garabatos/img-01.jpg', 'images/projects/garabatos/img-02.jpg', 'images/projects/garabatos/img-03.jpg'],
    ['images/projects/triangulo-de-oro/img-01.jpg', 'images/projects/triangulo-de-oro/img-02.jpg', 'images/projects/triangulo-de-oro/img-03.jpg', 'images/projects/triangulo-de-oro/img-04.jpg'],
    ['images/projects/suma/img-01.jpg', 'images/projects/suma/img-02.jpg', 'images/projects/suma/img-03.jpg', 'images/projects/suma/img-04.jpg'],
    ['images/projects/velavita/img-01.jpg', 'images/projects/velavita/img-02.jpg', 'images/projects/velavita/img-03.jpg', 'images/projects/velavita/img-04.jpg', 'images/projects/velavita/img-05.jpg', 'images/projects/velavita/img-06.jpg'],
    ['images/projects/alpez/img-01.jpg', 'images/projects/alpez/img-02.jpg', 'images/projects/alpez/img-03.jpg'],
    ['images/projects/oasis-decoraciones/img-01.jpg', 'images/projects/oasis-decoraciones/img-02.jpg', 'images/projects/oasis-decoraciones/img-03.jpg', 'images/projects/oasis-decoraciones/img-04.jpg', 'images/projects/oasis-decoraciones/img-05.jpg', 'images/projects/oasis-decoraciones/img-06.jpg'],
    ['images/projects/aromandia-seasonalities/img-01.jpg', 'images/projects/aromandia-seasonalities/img-02.jpg', 'images/projects/aromandia-seasonalities/img-03.jpg', 'images/projects/aromandia-seasonalities/img-04.jpg', 'images/projects/aromandia-seasonalities/img-05.jpg', 'images/projects/aromandia-seasonalities/img-06.jpg'],
    ['images/projects/sunshine-bagels/img-01.jpg', 'images/projects/sunshine-bagels/img-02.jpg', 'images/projects/sunshine-bagels/img-03.jpg']
  ];

  var PROJECTS = PROJECT_COPY.map(function (p) { return p.title; });

  var params = new URLSearchParams(location.search);
  var i = parseInt(params.get('p'), 10);
  if (isNaN(i) || i < 0 || i >= PROJECTS.length) i = 0;

  var project = PROJECT_COPY[i];
  var media = PROJECT_MEDIA[i] || [];

  if (titleEl) titleEl.textContent = project.title;

  if (introEl) {
    introEl.innerHTML = '';
    project.paragraphs.forEach(function (text) {
      var p = document.createElement('p');
      p.textContent = text;
      p.setAttribute('data-reveal', '');
      introEl.appendChild(p);
      if (window.__revealObserve) window.__revealObserve(p);
    });
  }

  // ---- Photo column ----
  // Every real project photo (and the shared Unsplash fallback) is
  // exported/cropped at the same ~1.6:1 ratio, so a single fixed
  // PHOTO_HEIGHT at the fixed 870px column width works for all of
  // them — but the NUMBER of photos varies per project (2 to 6), so
  // the column is built here instead of living as fixed markup.
  var mediaCol = document.getElementById('projectMedia');
  var PHOTO_TOP = 403;   // matches the old .project-media-1 top
  var PHOTO_WIDTH = 870;
  var PHOTO_HEIGHT = 543; // 870 / (942/588), same ratio every export uses
  var PHOTO_GAP = 48;
  // #projectStage is now a data-reflow stage (see fit()): below the
  // 768px breakpoint it renders at real, unscaled document flow and
  // styles.css switches .project-media-item to position:static, full-
  // width, auto-height (aspect-ratio keeps the crop). The inline top/
  // height below are the fixed-px absolute-position scheme the DESKTOP
  // scale-to-fit layout still needs — setting them on mobile too would
  // just fight the CSS (a stray inline height forcing every photo to a
  // flat unscaled 543px tall regardless of width), so they're skipped
  // there entirely instead of relying on !important to override them.
  var isMobileProject = window.innerWidth <= 768;

  if (mediaCol) {
    mediaCol.innerHTML = '';
    media.forEach(function (src, idx) {
      var item = document.createElement('div');
      item.className = 'project-media-item';
      if (!isMobileProject) {
        item.style.top = (PHOTO_TOP + idx * (PHOTO_HEIGHT + PHOTO_GAP)) + 'px';
        item.style.height = PHOTO_HEIGHT + 'px';
      }
      if (/\.mp4$/i.test(src)) {
        // Silent site-walkthrough clip — autoplay/loop/muted so it just
        // plays as a moving photo, no controls needed. `poster` (same
        // filename, -poster.jpg) paints instantly instead of a blank
        // frame while the video buffers. Two <source>s (WebM/VP9 first,
        // MP4/H.264 fallback) so every browser finds one it can decode.
        var video = document.createElement('video');
        video.poster = src.replace(/\.mp4$/i, '-poster.jpg');
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('aria-label', 'Project video ' + (idx + 1));
        var sourceWebm = document.createElement('source');
        sourceWebm.src = src.replace(/\.mp4$/i, '.webm');
        sourceWebm.type = 'video/webm';
        var sourceMp4 = document.createElement('source');
        sourceMp4.src = src;
        sourceMp4.type = 'video/mp4';
        video.appendChild(sourceWebm);
        video.appendChild(sourceMp4);
        item.appendChild(video);
      } else {
        var img = document.createElement('img');
        img.src = src;
        img.alt = 'Project photo ' + (idx + 1);
        img.loading = 'lazy';
        item.appendChild(img);
      }
      mediaCol.appendChild(item);
    });
  }

  var prevIndex = (i - 1 + PROJECTS.length) % PROJECTS.length;
  var nextIndex = (i + 1) % PROJECTS.length;
  prevBtn.href = 'project.html?p=' + prevIndex;
  nextBtn.href = 'project.html?p=' + nextIndex;

  // ---- Dynamic reflow ----
  // Titles/copy now vary a lot in length (a 2-line wrapped title, a
  // 2-paragraph vs. 4-paragraph intro) and so does the photo count (2
  // to 6), so the layout below the title can no longer be fixed-pixel
  // like the rest of the site. Measured in the .stage's own unscaled
  // 1728px-wide coordinate system (see the .stage scale-to-fit comment
  // near fit() — offsetTop/offsetHeight return true unscaled px
  // regardless of the CSS transform), same technique used for the
  // About page's bio-driven layout.
  var INTRO_GAP = 56;             // title bottom -> intro top
  var FOOTER_GAP = 140;           // intro/photo bottom -> footer top
  var FOOTER_HEIGHT = 590;        // .project-footer-bg / footer band height

  function reflow() {
    if (!titleEl || !introEl) return;
    // Mobile: #projectStage is a data-reflow stage now (real document
    // flow, no transform), and its mobile CSS puts title/intro/nav/
    // photos/footer all in normal static flow — none of them need (or
    // want) an inline absolute `top`/explicit `height` computed from
    // the old fixed-pixel desktop scheme below. Recomputing it anyway
    // would force #projectStage to a stale desktop-space height (e.g.
    // ~3000px+) regardless of how short the real stacked mobile layout
    // is, leaving a huge dead gap — or clip it, if too short.
    if (window.innerWidth <= 768) return;
    var introTop = titleEl.offsetTop + titleEl.offsetHeight + INTRO_GAP;
    introEl.style.top = introTop + 'px';
    var introBottom = introTop + introEl.offsetHeight;
    var photoCount = media.length;
    var photoColumnBottom = photoCount
      ? PHOTO_TOP + photoCount * PHOTO_HEIGHT + (photoCount - 1) * PHOTO_GAP
      : 0;
    var footerTop = Math.max(photoColumnBottom, introBottom) + FOOTER_GAP;
    var footerBg = document.querySelector('.project-footer-bg');
    var siteFooter = document.querySelector('#projectStage .site-footer');
    var stage = document.getElementById('projectStage');
    if (footerBg) footerBg.style.top = footerTop + 'px';
    if (siteFooter) siteFooter.style.top = footerTop + 'px';
    if (stage) stage.style.height = (footerTop + FOOTER_HEIGHT) + 'px';
  }

  reflow();
  // Web fonts can finish loading after this first measurement and
  // change the title/intro's wrapped line count — reflow again once
  // they're ready (and once more on full load, as a safety net).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reflow);
  }
  window.addEventListener('load', reflow);
})();
