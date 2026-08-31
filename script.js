/**
 * AIR FRYER 50 RECETAS - Interactive Scripts
 * Optimized for high conversions, fast performance, and smooth mobile UX
 */

document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initFaqAccordion();
  initFloatingBar();
  initDynamicYear();
  initSmoothScroll();
});

/**
 * 1. Urgency Countdown Timer (3 hours, 42 mins cycle)
 */
function initCountdown() {
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');

  if (!hoursEl || !minutesEl || !secondsEl) return;

  // Set 4 hours from now or load stored deadline
  let countdownKey = 'airfryer_cd_time';
  let targetTime = localStorage.getItem(countdownKey);

  if (!targetTime || new Date(targetTime).getTime() <= new Date().getTime()) {
    const now = new Date();
    now.setHours(now.getHours() + 3);
    now.setMinutes(now.getMinutes() + 45);
    targetTime = now.toISOString();
    localStorage.setItem(countdownKey, targetTime);
  }

  function updateTimer() {
    const totalMs = new Date(targetTime).getTime() - new Date().getTime();

    if (totalMs <= 0) {
      // Reset if expired to keep urgency active
      const now = new Date();
      now.setHours(now.getHours() + 2);
      now.setMinutes(now.getMinutes() + 30);
      targetTime = now.toISOString();
      localStorage.setItem(countdownKey, targetTime);
      return;
    }

    const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
    const seconds = Math.floor((totalMs / 1000) % 60);

    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

/**
 * 2. Interactive FAQ Accordion
 */
function initFaqAccordion() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');

      // Close all items
      document.querySelectorAll('.accordion-item').forEach((otherItem) => {
        otherItem.classList.remove('active');
        const otherBtn = otherItem.querySelector('.accordion-header');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });

      // Toggle clicked item
      if (!isActive) {
        item.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/**
 * 3. Sticky Bottom Floating Bar (Appears when scrolled past hero)
 */
function initFloatingBar() {
  const floatingBar = document.getElementById('floating-bar');
  const heroSection = document.getElementById('hero');
  const finalOfferSection = document.getElementById('oferta');

  if (!floatingBar || !heroSection) return;

  function checkScroll() {
    const heroBottom = heroSection.getBoundingClientRect().bottom;
    let inFinalOffer = false;

    if (finalOfferSection) {
      const offerTop = finalOfferSection.getBoundingClientRect().top;
      const offerBottom = finalOfferSection.getBoundingClientRect().bottom;
      if (offerTop <= window.innerHeight && offerBottom >= 0) {
        inFinalOffer = true;
      }
    }

    // Show floating bar only after scrolling past hero and when not already on final offer card
    if (heroBottom < 0 && !inFinalOffer) {
      floatingBar.classList.add('is-visible');
    } else {
      floatingBar.classList.remove('is-visible');
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();
}

/**
 * 4. Current Year in Footer
 */
function initDynamicYear() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/**
 * 5. Smooth Scroll for in-page anchors
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 70;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    });
  });
}
