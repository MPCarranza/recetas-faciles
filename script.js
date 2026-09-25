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
  if (!supportLink) return;

  supportLink.addEventListener("click", (event) => {
    event.preventDefault();
    alert(
      "Si realizaste la compra hace pocos minutos, no te preocupes: la acreditación y el envío del recetario pueden demorar según el método de pago.\n\nSi la compra ya fue aprobada y todavía no recibiste el recetario, adjuntá al correo el comprobante de compra que Mercado Pago mostró para descargar.",
    );
    window.location.href = supportLink.href;
  });
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
