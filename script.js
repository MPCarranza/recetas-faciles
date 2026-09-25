/** AIR FRYER 365 RECETAS - Interactive Scripts */
document.addEventListener("DOMContentLoaded", () => {
  initCountdown();
  initFaqAccordion();
  initFloatingBar();
  initDynamicYear();
  initSmoothScroll();
  initCheckoutButtons();
  initSupportEmail();
});

function initSupportEmail() {
  const supportLink = document.getElementById("support-email-link");
  const modal = document.getElementById("support-alert");
  const intro = document.getElementById("support-alert-intro");
  const continueButton = document.getElementById("support-alert-continue");
  const form = document.getElementById("support-form");
  const backButton = document.getElementById("support-form-back");
  const status = document.getElementById("support-form-status");
  const success = document.getElementById("support-success");
  if (
    !supportLink ||
    !modal ||
    !intro ||
    !continueButton ||
    !form ||
    !backButton ||
    !status ||
    !success
  ) return;

  let previousFocus = null;

  function showIntro() {
    intro.hidden = false;
    form.hidden = true;
    success.hidden = true;
    status.textContent = "";
    status.classList.remove("is-success");
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("support-modal-open");
    previousFocus?.focus();
    window.setTimeout(showIntro, 150);
  }

  function openModal() {
    previousFocus = document.activeElement;
    showIntro();
    const query = new URLSearchParams(window.location.search);
    const paymentId = query.get("payment_id");
    if (paymentId && /^\d+$/.test(paymentId)) {
      form.elements.paymentId.value = paymentId;
    }
    modal.hidden = false;
    document.body.classList.add("support-modal-open");
    continueButton.focus();
  }

  supportLink.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  modal.querySelectorAll("[data-support-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  continueButton.addEventListener("click", () => {
    intro.hidden = true;
    form.hidden = false;
    form.querySelector('input[name="name"]')?.focus();
  });

  backButton.addEventListener("click", () => {
    showIntro();
    continueButton.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("is-success");

    if (!form.reportValidity()) return;
    const receipt = form.elements.receipt?.files?.[0];
    if (receipt && receipt.size > 5 * 1024 * 1024) {
      status.textContent = "El comprobante supera el máximo permitido de 5 MB.";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No pudimos enviar tu consulta.");

      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.querySelector("[data-support-close]")?.focus();
    } catch (error) {
      status.textContent = error.message || "No pudimos enviar tu consulta. Intentá nuevamente.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar consulta →";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  const initialQuery = new URLSearchParams(window.location.search);
  if (initialQuery.get("support") === "1") {
    window.setTimeout(openModal, 100);
  }
}

function initCheckoutButtons() {
  const checkoutBtn = document.getElementById("btn-final-checkout");
  if (!checkoutBtn) return;
  checkoutBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (checkoutBtn.classList.contains("is-loading")) return;
    checkoutBtn.classList.add("is-loading");
    checkoutBtn.setAttribute("aria-disabled", "true");
    try {
      // Producto, precio y moneda se definen únicamente en el servidor.
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "URL de pago no disponible.");
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      console.error(error);
      alert("No pudimos iniciar el pago. Por favor, intentá nuevamente.");
      checkoutBtn.classList.remove("is-loading");
      checkoutBtn.removeAttribute("aria-disabled");
    }
  });
}

function initCountdown() {
  const hoursEl = document.getElementById("cd-hours");
  const minutesEl = document.getElementById("cd-minutes");
  const secondsEl = document.getElementById("cd-seconds");
  if (!hoursEl || !minutesEl || !secondsEl) return;
  const countdownKey = "airfryer_cd_time";
  let targetTime = localStorage.getItem(countdownKey);
  if (!targetTime || new Date(targetTime).getTime() <= Date.now()) {
    targetTime = new Date(Date.now() + 3.75 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(countdownKey, targetTime);
  }
  function updateTimer() {
    let totalMs = new Date(targetTime).getTime() - Date.now();
    if (totalMs <= 0) {
      targetTime = new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(countdownKey, targetTime);
      totalMs = new Date(targetTime).getTime() - Date.now();
    }
    hoursEl.textContent = String(Math.floor(totalMs / 3_600_000)).padStart(2, "0");
    minutesEl.textContent = String(Math.floor((totalMs / 60_000) % 60)).padStart(2, "0");
    secondsEl.textContent = String(Math.floor((totalMs / 1000) % 60)).padStart(2, "0");
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function initFaqAccordion() {
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.parentElement;
      const shouldOpen = !item.classList.contains("active");
      document.querySelectorAll(".accordion-item").forEach((otherItem) => {
        otherItem.classList.remove("active");
        otherItem.querySelector(".accordion-header")?.setAttribute("aria-expanded", "false");
      });
      if (shouldOpen) {
        item.classList.add("active");
        header.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function initFloatingBar() {
  const floatingBar = document.getElementById("floating-bar");
  const heroSection = document.getElementById("hero");
  const finalOfferSection = document.getElementById("oferta");
  const footerSection = document.querySelector(".site-footer");
  if (!floatingBar || !heroSection) return;
  function checkScroll() {
    const offerRect = finalOfferSection?.getBoundingClientRect();
    const footerRect = footerSection?.getBoundingClientRect();
    const inFinalOffer =
      offerRect && offerRect.top <= window.innerHeight && offerRect.bottom >= 0;
    const footerIsVisible =
      footerRect && footerRect.top <= window.innerHeight && footerRect.bottom >= 0;
    floatingBar.classList.toggle(
      "is-visible",
      heroSection.getBoundingClientRect().bottom < 0 &&
        !inFinalOffer &&
        !footerIsVisible,
    );
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  checkScroll();
}

function initDynamicYear() {
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (event) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;
      event.preventDefault();
      window.scrollTo({
        top: targetEl.getBoundingClientRect().top + window.scrollY - 70,
        behavior: "smooth",
      });
    });
  });
}
