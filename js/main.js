/**
 * STMS Mountain Bike Team - Main JavaScript
 * Mobile-first, no dependencies
 */

(function () {
  'use strict';

  /* --------------------------------------------------
     Navigation (hamburger menu)
  -------------------------------------------------- */
  function initNav() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      const isOpen = menu.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when a link is clicked
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Mark active link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    menu.querySelectorAll('a').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  /* --------------------------------------------------
     Tabs
  -------------------------------------------------- */
  function initTabs() {
    document.querySelectorAll('.tabs').forEach(function (tabContainer) {
      const buttons = tabContainer.querySelectorAll('.tab-btn');
      const panelContainer = tabContainer.closest('.tab-wrapper') ||
        tabContainer.parentElement;
      const panels = panelContainer ? panelContainer.querySelectorAll('.tab-panel') : [];

      buttons.forEach(function (btn, index) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) { b.classList.remove('active'); });
          panels.forEach(function (p) { p.classList.remove('active'); });
          btn.classList.add('active');
          if (panels[index]) panels[index].classList.add('active');
        });
      });
    });
  }

  /* --------------------------------------------------
     Netlify form submission helper
  -------------------------------------------------- */
  function submitToNetlify(form, successId) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function () {
        form.style.display = 'none';
        var success = document.getElementById(successId);
        if (success) {
          success.classList.add('show');
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        alert('There was a problem submitting the form. Please try again or email coach@stingersmtb.com directly.');
      });
  }

  /* --------------------------------------------------
     Registration Form
  -------------------------------------------------- */
  function initRegistrationForm() {
    const form = document.getElementById('registration-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Basic client-side validation
      let isValid = true;
      const required = form.querySelectorAll('[required]');
      required.forEach(function (field) {
        const parent = field.closest('.form-group');
        if (field.type === 'checkbox' ? !field.checked : !field.value.trim()) {
          isValid = false;
          field.style.borderColor = 'var(--accent)';
          if (parent && !parent.querySelector('.error-msg')) {
            const err = document.createElement('span');
            err.className = 'error-msg';
            err.style.cssText = 'color:var(--accent);font-size:0.78rem;margin-top:0.25rem;display:block;';
            err.textContent = 'This field is required.';
            parent.appendChild(err);
          }
        } else {
          field.style.borderColor = '';
          if (parent) {
            const err = parent.querySelector('.error-msg');
            if (err) err.remove();
          }
        }
      });

      if (!isValid) return;

      submitToNetlify(form, 'form-success');
    });

    // Real-time validation on blur
    form.querySelectorAll('[required]').forEach(function (field) {
      field.addEventListener('blur', function () {
        const parent = field.closest('.form-group');
        if (!field.value.trim()) {
          field.style.borderColor = 'var(--accent)';
        } else {
          field.style.borderColor = 'var(--primary)';
          if (parent) {
            const err = parent.querySelector('.error-msg');
            if (err) err.remove();
          }
        }
      });
      field.addEventListener('input', function () {
        if (field.value.trim()) {
          field.style.borderColor = '';
        }
      });
    });
  }

  /* --------------------------------------------------
     Volunteer Sign-up
  -------------------------------------------------- */
  function initVolunteerForm() {
    const form = document.getElementById('volunteer-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitToNetlify(form, 'volunteer-success');
    });
  }

  /* --------------------------------------------------
     Sponsor inquiry form
  -------------------------------------------------- */
  function initSponsorForm() {
    const form = document.getElementById('sponsor-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitToNetlify(form, 'sponsor-success');
    });
  }

  /* --------------------------------------------------
     Smooth scroll for anchor links
  -------------------------------------------------- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* --------------------------------------------------
     Race card expand/collapse details
  -------------------------------------------------- */
  function initRaceCards() {
    document.querySelectorAll('.race-details-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const isOpen = target.style.display !== 'none';
        target.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? 'Show Details ▼' : 'Hide Details ▲';
      });
    });
  }

  /* --------------------------------------------------
     Scroll-based animation for cards
  -------------------------------------------------- */
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const cards = document.querySelectorAll('.card, .race-card, .volunteer-card, .sponsor-card, .quick-link-item');
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(function (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px)';
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease, box-shadow 0.25s ease';
      observer.observe(card);
    });
  }

  /* --------------------------------------------------
     Homepage sponsor rail, spotlight, and section
  -------------------------------------------------- */
  function initHomepageSponsors() {
    var railWrap     = document.getElementById('sponsor-rail-wrap');
    var railTrack    = document.getElementById('sponsor-rail-track');
    var railSkeleton = document.getElementById('sponsor-rail-skeleton');
    var spotlightEl  = document.getElementById('sponsor-spotlight-sidebar');
    var sectionGold  = document.getElementById('homepage-sponsors-gold');
    var sectionSilv  = document.getElementById('homepage-sponsors-silver');
    var sectionBronz = document.getElementById('homepage-sponsors-bronze');
    var sectionFoot  = document.getElementById('homepage-sponsors-footer');
    var sectionSkel  = document.getElementById('sponsor-section-skeleton');

    if (!railTrack && !spotlightEl && !sectionGold) return;

    var CACHE_KEY = 'stms_sponsors_v1';
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch (e) {}

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function safeLogoUrl(url) {
      return url && (url.startsWith('https://') || url.startsWith('/')) ? url : '';
    }

    function trackClick(id) {
      if (!id) return;
      try {
        navigator.sendBeacon('/.netlify/functions/track-sponsor-click',
          JSON.stringify({ sponsor_id: id, page: 'homepage' }));
      } catch (e) {}
    }

    function trackImpressions(ids) {
      if (!ids || !ids.length) return;
      try {
        navigator.sendBeacon('/.netlify/functions/track-sponsor-impression',
          JSON.stringify({ sponsor_ids: ids, page: 'homepage' }));
      } catch (e) {}
    }

    function logoImg(s, h) {
      var src = safeLogoUrl(s.logo_url);
      if (src) {
        return '<img src="' + esc(src) + '" alt="' + esc(s.name) + ' logo"'
          + ' class="sponsor-logo-img" loading="lazy" decoding="async"'
          + (h ? ' style="height:' + h + 'px;max-height:' + h + 'px;"' : '')
          + ' data-fallback="' + esc(s.logo_text || s.name) + '"'
          + ' onerror="this.parentNode.textContent=this.dataset.fallback;" />';
      }
      return '<span>' + esc(s.logo_text || s.name) + '</span>';
    }

    // --- Rail ---
    function renderRail(gold, silver) {
      if (!railTrack) return;
      var all = gold.concat(silver);
      if (!all.length) {
        if (railSkeleton) railSkeleton.style.display = 'none';
        var railSection = document.getElementById('homepage-sponsor-rail');
        if (railSection) railSection.style.display = 'none';
        return;
      }

      function buildItems(list) {
        return list.map(function (s) {
          var href = s.website_url || 'sponsors.html';
          var ext  = !!s.website_url;
          return '<a href="' + esc(href) + '"'
            + (ext ? ' target="_blank" rel="noopener noreferrer sponsored"' : '')
            + ' class="sponsor-rail-logo-link" aria-label="Visit ' + esc(s.name) + '"'
            + ' data-sponsor-id="' + esc(s.id || '') + '" role="listitem">'
            + '<div class="sponsor-rail-logo-wrap">' + logoImg(s, 56) + '</div>'
            + '</a>';
        }).join('');
      }

      var items = buildItems(all);
      // Duplicate set for desktop drift seamless loop
      railTrack.innerHTML = items + items;
      if (all.length >= 3) railTrack.classList.add('has-drift');

      if (railSkeleton) railSkeleton.style.display = 'none';
      if (railWrap) railWrap.style.display = '';

      railTrack.addEventListener('click', function (e) {
        var link = e.target.closest('[data-sponsor-id]');
        if (link && link.dataset.sponsorId) trackClick(link.dataset.sponsorId);
      });
    }

    // --- Spotlight ---
    function renderSpotlight(gold) {
      if (!spotlightEl) return;
      if (!gold.length) {
        spotlightEl.innerHTML = '<div class="card">'
          + '<div class="card-body" style="text-align:center;padding:1.25rem;">'
          + '<div style="font-size:2rem;margin-bottom:0.5rem;">⭐</div>'
          + '<h4 style="font-size:0.9rem;margin-bottom:0.5rem;color:var(--primary-dark);">Become Our Title Sponsor</h4>'
          + '<p style="font-size:0.8rem;color:var(--text-medium);margin-bottom:0.75rem;">Gold sponsors get premium homepage visibility.</p>'
          + '<a href="sponsors.html#become-sponsor" class="btn btn-sm btn-primary">Learn More →</a>'
          + '</div></div>';
        return;
      }
      var s = gold[0];
      var desc = s.description
        ? s.description.substring(0, 100) + (s.description.length > 100 ? '…' : '')
        : '';
      var visitBtn = s.website_url
        ? '<a href="' + esc(s.website_url) + '" target="_blank" rel="noopener noreferrer sponsored"'
          + ' class="btn btn-sm btn-outline-dark"'
          + ' data-sponsor-id="' + esc(s.id || '') + '"'
          + '>Visit Sponsor →</a>'
        : '';
      spotlightEl.innerHTML = '<div class="sponsor-card gold" aria-label="Title sponsor: ' + esc(s.name) + '">'
        + '<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#B8860B;margin-bottom:0.25rem;">⭐ Title Sponsor</div>'
        + '<div class="sponsor-logo-placeholder">' + logoImg(s, 60) + '</div>'
        + '<h4>' + esc(s.name) + '</h4>'
        + (desc ? '<p style="font-size:0.78rem;color:var(--text-medium);">' + esc(desc) + '</p>' : '')
        + visitBtn
        + '</div>';
      spotlightEl.addEventListener('click', function (e) {
        var link = e.target.closest('[data-sponsor-id]');
        if (link && link.dataset.sponsorId) trackClick(link.dataset.sponsorId);
      });
    }

    // --- Section ---
    function sponsorCard(s, tier) {
      var src = safeLogoUrl(s.logo_url);
      var logo = src
        ? '<div class="sponsor-logo-placeholder">'
            + '<img src="' + esc(src) + '" alt="' + esc(s.name) + ' logo"'
            + ' class="sponsor-logo-img" loading="lazy" decoding="async"'
            + ' data-fallback="' + esc(s.logo_text || s.name) + '"'
            + ' onerror="this.parentNode.textContent=this.dataset.fallback;" /></div>'
        : '<div class="sponsor-logo-placeholder">' + esc(s.logo_text || s.name) + '</div>';
      var desc = s.description
        ? '<p style="font-size:0.82rem;color:var(--text-medium);">' + esc(s.description) + '</p>'
        : '';
      var link = s.website_url
        ? '<a href="' + esc(s.website_url) + '" target="_blank" rel="noopener noreferrer sponsored"'
          + ' class="btn btn-sm btn-outline-dark" data-sponsor-id="' + esc(s.id || '') + '"'
          + '>Visit →</a>'
        : '';
      return '<div class="sponsor-card ' + esc(tier) + '">' + logo + '<h4>' + esc(s.name) + '</h4>' + desc + link + '</div>';
    }

    function bronzeTile(s) {
      var src  = safeLogoUrl(s.logo_url);
      var href = s.website_url || 'sponsors.html';
      var ext  = !!s.website_url;
      var inner = src
        ? '<img src="' + esc(src) + '" alt="' + esc(s.name) + ' logo"'
          + ' class="sponsor-logo-img" loading="lazy" decoding="async"'
          + ' style="height:40px;max-height:40px;"'
          + ' data-fallback="' + esc(s.logo_text || s.name) + '"'
          + ' onerror="this.style.display=\'none\';" />'
        : '<span style="font-size:0.78rem;font-weight:600;color:var(--text-medium);">' + esc(s.logo_text || s.name) + '</span>';
      return '<a href="' + esc(href) + '"'
        + (ext ? ' target="_blank" rel="noopener noreferrer sponsored"' : '')
        + ' class="sponsor-card bronze sponsor-bronze-tile"'
        + ' aria-label="' + esc(s.name) + '"'
        + ' data-sponsor-id="' + esc(s.id || '') + '">'
        + '<div class="sponsor-logo-placeholder" style="height:50px;">' + inner + '</div>'
        + '<span style="font-size:0.72rem;font-weight:600;color:var(--text-medium);">' + esc(s.name) + '</span>'
        + '</a>';
    }

    function openGoldSpot() {
      return '<div class="sponsor-card" style="border-style:dashed;background:var(--bg-light);box-shadow:none;opacity:0.6;">'
        + '<div class="sponsor-logo-placeholder" style="border-color:#FFD700;color:#B8860B;">+ Your Business</div>'
        + '<h4 style="color:var(--text-medium);font-size:0.82rem;">Gold Spot Available</h4>'
        + '<a href="sponsors.html#become-sponsor" class="btn btn-sm btn-primary">Claim Spot</a>'
        + '</div>';
    }

    function renderSection(gold, silver, bronze) {
      var hasAny = gold.length || silver.length || bronze.length;
      if (sectionSkel) sectionSkel.style.display = 'none';
      if (!hasAny) {
        var sec = document.getElementById('homepage-sponsors-section');
        if (sec) sec.style.display = 'none';
        return;
      }

      if (sectionGold) {
        var goldCards = gold.slice(0, 2).map(function (s) { return sponsorCard(s, 'gold'); });
        goldCards.push(openGoldSpot());
        sectionGold.innerHTML = '<div class="sponsor-tier">'
          + '<div class="sponsor-tier-title"><span class="tier-icon">🥇</span>Gold Title Tier</div>'
          + '<div class="sponsor-grid tier-gold">' + goldCards.join('') + '</div>'
          + '</div>';
      }

      if (sectionSilv && silver.length) {
        sectionSilv.innerHTML = '<div class="sponsor-tier">'
          + '<div class="sponsor-tier-title"><span class="tier-icon">🥈</span>Silver Top Tier</div>'
          + '<div class="sponsor-grid tier-silver">'
          + silver.slice(0, 3).map(function (s) { return sponsorCard(s, 'silver'); }).join('')
          + '</div></div>';
      }

      if (sectionBronz && bronze.length) {
        sectionBronz.innerHTML = '<div class="sponsor-tier">'
          + '<div class="sponsor-tier-title"><span class="tier-icon">🥉</span>Bronze Base Tier</div>'
          + '<div class="sponsor-grid tier-bronze">'
          + bronze.slice(0, 4).map(function (s) { return bronzeTile(s); }).join('')
          + '</div></div>';
      }

      if (sectionFoot) sectionFoot.style.display = '';

      // Click tracking delegation for section
      ['homepage-sponsors-gold', 'homepage-sponsors-silver', 'homepage-sponsors-bronze'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('click', function (e) {
            var link = e.target.closest('[data-sponsor-id]');
            if (link && link.dataset.sponsorId) trackClick(link.dataset.sponsorId);
          });
        }
      });
    }

    function renderAll(data) {
      var byTier = { gold: [], silver: [], bronze: [] };
      (data.sponsors || []).forEach(function (s) {
        if (byTier[s.tier]) byTier[s.tier].push(s);
      });
      renderRail(byTier.gold, byTier.silver);
      renderSpotlight(byTier.gold);
      renderSection(byTier.gold, byTier.silver, byTier.bronze);
      var ids = byTier.gold.concat(byTier.silver).concat(byTier.bronze)
        .map(function (s) { return s.id; }).filter(Boolean);
      trackImpressions(ids);
    }

    function hideSkeleton() {
      if (railSkeleton) railSkeleton.style.display = 'none';
      if (sectionSkel) sectionSkel.style.display = 'none';
    }

    if (cached) {
      renderAll(cached);
      return;
    }

    var ctrl = new AbortController();
    var tid  = setTimeout(function () { ctrl.abort(); }, 8000);
    fetch('/.netlify/functions/sponsors', { signal: ctrl.signal })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false }; })
          .then(function (d) { if (!r.ok || !d.ok) throw new Error(); return d; });
      })
      .then(function (d) {
        clearTimeout(tid);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) {}
        renderAll(d);
      })
      .catch(function () {
        clearTimeout(tid);
        hideSkeleton();
        var railSection = document.getElementById('homepage-sponsor-rail');
        if (railSection) railSection.style.display = 'none';
        var sec = document.getElementById('homepage-sponsors-section');
        if (sec) sec.style.display = 'none';
      });
  }

  /* --------------------------------------------------
     Initialize all modules
  -------------------------------------------------- */
  function init() {
    initNav();
    initTabs();
    initRegistrationForm();
    initVolunteerForm();
    initSponsorForm();
    initSmoothScroll();
    initRaceCards();
    initScrollAnimations();
    initHomepageSponsors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
