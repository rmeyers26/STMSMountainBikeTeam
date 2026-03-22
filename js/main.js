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
     Announcement bar dismiss
  -------------------------------------------------- */
  function initAnnouncementBar() {
    const closeBtn = document.getElementById('announcement-close');
    const bar = document.getElementById('announcement-bar');
    if (!closeBtn || !bar) return;

    const dismissed = sessionStorage.getItem('announcement-dismissed');
    if (dismissed) {
      bar.style.display = 'none';
      return;
    }

    closeBtn.addEventListener('click', function () {
      bar.style.display = 'none';
      sessionStorage.setItem('announcement-dismissed', '1');
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
        alert('There was a problem submitting the form. Please try again or email us directly.');
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
     Initialize all modules
  -------------------------------------------------- */
  function init() {
    initNav();
    initAnnouncementBar();
    initTabs();
    initRegistrationForm();
    initVolunteerForm();
    initSmoothScroll();
    initRaceCards();
    initScrollAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
