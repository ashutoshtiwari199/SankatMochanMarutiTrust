/* ============================================================
   SANKAT MOCHAN MARUTI TRUST – Main Script
   ============================================================ */

(function () {
  'use strict';

  // ── Sticky header shadow on scroll ────────────────────────
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // ── Mobile hamburger menu ─────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('main-nav');
  const overlay   = document.getElementById('nav-overlay');

  function openMenu() {
    mainNav.classList.add('open');
    overlay.classList.add('visible');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mainNav.classList.remove('open');
    overlay.classList.remove('visible');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hamburger && mainNav && overlay) {
    hamburger.addEventListener('click', () => {
      mainNav.classList.contains('open') ? closeMenu() : openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    // Close on nav link click
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  // ── Carousel ──────────────────────────────────────────────
  const track    = document.getElementById('carousel-track');
  const prevBtn  = document.getElementById('carousel-prev');
  const nextBtn  = document.getElementById('carousel-next');
  const dotsWrap = document.getElementById('carousel-dots');

  if (track && prevBtn && nextBtn) {
    const slides     = track.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;
    let current  = 0;
    let autoTimer = null;
    let isPaused  = false;

    // Build dots
    if (dotsWrap) {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `चित्र ${i + 1} पर जाएँ`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      });
    }

    function updateDots() {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === current);
      });
    }

    function goTo(index) {
      current = (index + totalSlides) % totalSlides;
      track.style.transform = `translateX(${-current * 100}%)`;
      updateDots();
    }

    function startAuto() {
      if (autoTimer) return;
      autoTimer = setInterval(() => {
        if (!isPaused) goTo(current + 1);
      }, 3500);
    }

    function stopAuto() {
      clearInterval(autoTimer);
      autoTimer = null;
    }

    prevBtn.addEventListener('click', () => { goTo(current - 1); stopAuto(); startAuto(); });
    nextBtn.addEventListener('click', () => { goTo(current + 1); stopAuto(); startAuto(); });

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      isPaused = document.hidden;
    });

    // Pause on hover
    const carouselEl = document.getElementById('carousel');
    if (carouselEl) {
      carouselEl.addEventListener('mouseenter', () => { isPaused = true; });
      carouselEl.addEventListener('mouseleave', () => { isPaused = false; });
    }

    // Touch swipe support
    let touchStartX = 0;
    track.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    track.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(dx) > 50) {
        dx < 0 ? goTo(current + 1) : goTo(current - 1);
        stopAuto(); startAuto();
      }
    }, { passive: true });

    startAuto();
  }

  // ── Intersection Observer – scroll animations ─────────────
  if ('IntersectionObserver' in window) {
    const animItems = document.querySelectorAll(
      '.fade-up, .slide-in-left, .slide-in-right, .animate-member'
    );

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // fire once
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    animItems.forEach(el => observer.observe(el));
  } else {
    // Fallback: just make everything visible
    document.querySelectorAll('.fade-up, .slide-in-left, .slide-in-right, .animate-member')
      .forEach(el => el.classList.add('is-visible'));
  }

  // ── Members role filter ───────────────────────────────────
  const filterBtns  = document.querySelectorAll('.filter-btn');
  const memberCards = document.querySelectorAll('.member-card');

  if (filterBtns.length && memberCards.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.dataset.filter;

        // Update active button
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show / hide cards
        memberCards.forEach(card => {
          const match = role === 'all' || card.dataset.role === role;
          if (match) {
            card.removeAttribute('hidden');
            // Re-trigger animation
            card.classList.remove('is-visible');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => card.classList.add('is-visible'));
            });
          } else {
            card.setAttribute('hidden', '');
          }
        });
      });
    });
  }

})();
