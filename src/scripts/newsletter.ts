// Client-side wiring for the newsletter inline form + modal. Loaded once on
// /blog/[slug] pages.

type Source = "inline" | "modal";
type DismissMethod = "close_btn" | "backdrop" | "esc" | "no_thanks";

interface Init {
  slug: string;
  category: string;
}

const KEY_GLOBAL = "newsletter:any";
const keyForSlug = (slug: string) => `newsletter:${slug}`;

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked — silently ignore */
  }
}

function track(event: string, props: Record<string, unknown>) {
  // PostHog is loaded only in production via Base.astro. window.posthog
  // may be undefined in dev — that's fine.
  // deno-lint-ignore no-explicit-any
  (window as any).posthog?.capture?.(event, props);
}

function showSuccess(root: HTMLElement, celebrate = false) {
  const formWrap = root.querySelector<HTMLElement>("[data-newsletter-form-wrap]");
  const success = root.querySelector<HTMLElement>("[data-newsletter-success]");
  if (formWrap) formWrap.classList.add("hidden");
  if (success) {
    success.classList.remove("hidden");
    // Pop the success card in only on a fresh signup, not when re-rendering
    // the subscribed state on page load.
    if (celebrate) success.classList.add("newsletter-pop");
  }
}

function shakeInput(input: HTMLElement | null) {
  if (!input) return;
  input.classList.remove("input-shake");
  // Force a reflow so the animation can replay on repeated errors.
  void input.offsetWidth;
  input.classList.add("input-shake");
}

function setLoading(btn: HTMLButtonElement, loading: boolean) {
  btn.disabled = loading;
  btn.setAttribute("aria-busy", String(loading));
  if (loading) {
    btn.dataset.label = btn.textContent ?? "subscribe";
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
  } else {
    btn.textContent = btn.dataset.label ?? "subscribe";
  }
}

function setStatus(root: HTMLElement, message: string, tone: "info" | "error" = "info") {
  const status = root.querySelector<HTMLElement>("[data-newsletter-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.remove("text-red-500", "text-(--text-secondary)");
  status.classList.add(tone === "error" ? "text-red-500" : "text-(--text-secondary)");
}

async function submit(
  root: HTMLElement,
  source: Source,
  slug: string,
): Promise<void> {
  const emailInput = root.querySelector<HTMLInputElement>("[data-newsletter-email]");
  const firstNameInput = root.querySelector<HTMLInputElement>("[data-newsletter-firstname]");
  const honeypot = root.querySelector<HTMLInputElement>("[data-newsletter-website]");
  const submitBtn = root.querySelector<HTMLButtonElement>("[data-newsletter-submit]");
  if (!emailInput || !submitBtn) return;

  const email = emailInput.value.trim();
  const firstName = firstNameInput?.value.trim() ?? "";
  if (!email) {
    setStatus(root, "an email would help.", "error");
    shakeInput(emailInput);
    emailInput.focus();
    return;
  }

  setLoading(submitBtn, true);
  setStatus(root, "subscribing…");
  track("newsletter_signup_attempt", { slug, source });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        firstName,
        source,
        slug,
        website: honeypot?.value ?? "",
      }),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (res.ok && data.ok) {
      writeFlag(KEY_GLOBAL, "subscribed");
      writeFlag(keyForSlug(slug), "subscribed");
      track("newsletter_signup_success", { slug, source });
      // Update both surfaces if present (other surface may already be open).
      document
        .querySelectorAll<HTMLElement>('[data-newsletter]')
        .forEach((el) => showSuccess(el, true));
      // Close the modal after a beat so they can read the success card.
      if (source === "modal") {
        setTimeout(closeModal, 1500);
      }
      return;
    }

    const reason = data.error ?? "upstream";
    track("newsletter_signup_failed", { slug, source, reason });

    if (reason === "invalid_email") {
      setStatus(root, "that email looks off — mind double-checking?", "error");
      shakeInput(emailInput);
    } else if (reason === "rate_limited") {
      setStatus(root, "too many tries — give it a minute and try again.", "error");
    } else {
      setStatus(root, "something broke on my end. try again in a bit?", "error");
    }
  } catch (err) {
    track("newsletter_signup_failed", {
      slug,
      source,
      reason: (err as Error).name === "AbortError" ? "timeout" : "network",
    });
    setStatus(root, "something broke on my end. try again in a bit?", "error");
  } finally {
    clearTimeout(timer);
    setLoading(submitBtn, false);
  }
}

// --- modal helpers --------------------------------------------------------

let lastFocused: HTMLElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let activeSlug = "";

function getModal(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-newsletter="modal"]');
}

function openModal(slug: string, category: string) {
  const modal = getModal();
  if (!modal) return;
  if (!modal.classList.contains("hidden")) return;

  lastFocused = document.activeElement as HTMLElement | null;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  modal.setAttribute("aria-hidden", "false");

  // Focus the email input on hover-capable devices; on touch screens focus
  // the dialog itself so the on-screen keyboard doesn't pop up uninvited.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    modal.querySelector<HTMLInputElement>("[data-newsletter-email]")?.focus();
  } else {
    modal.querySelector<HTMLElement>("[data-newsletter-card]")?.focus();
  }

  escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      dismissModal("esc");
    } else if (e.key === "Tab") {
      // Simple focus trap.
      const focusables = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      const visibleFocusables = Array.from(focusables).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (visibleFocusables.length === 0) return;
      const first = visibleFocusables[0];
      const last = visibleFocusables[visibleFocusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener("keydown", escHandler);

  track("newsletter_modal_shown", { slug, category });
}

function closeModal() {
  const modal = getModal();
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  modal.setAttribute("aria-hidden", "true");
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  lastFocused?.focus?.();
}

function dismissModal(method: DismissMethod) {
  if (activeSlug) {
    writeFlag(keyForSlug(activeSlug), "dismissed");
    track("newsletter_modal_dismissed", { slug: activeSlug, dismiss_method: method });
  }
  closeModal();
}

// Throttle a callback so it fires at most once per `wait` ms.
function throttle<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

// --- public init ----------------------------------------------------------

// initNewsletter can run more than once per browsing session (view
// transitions re-init on every post). Track the active scroll listener so a
// stale closure from a previous post never opens the modal.
let activeScrollHandler: (() => void) | null = null;

export function initNewsletter({ slug, category }: Init): void {
  const globallySubscribed = readFlag(KEY_GLOBAL) === "subscribed";
  const perSlug = readFlag(keyForSlug(slug));

  // Wire up forms (both inline and modal, if present).
  document
    .querySelectorAll<HTMLElement>('[data-newsletter]')
    .forEach((root) => {
      const source = (root.getAttribute("data-newsletter") as Source) || "inline";
      if (globallySubscribed) {
        showSuccess(root);
      }
      const form = root.querySelector<HTMLFormElement>("[data-newsletter-form]");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        submit(root, source, slug);
      });
    });

  // Modal-specific wiring.
  activeSlug = slug;
  const modal = getModal();
  if (modal) {
    modal
      .querySelector<HTMLButtonElement>("[data-newsletter-close]")
      ?.addEventListener("click", () => dismissModal("close_btn"));
    modal
      .querySelector<HTMLButtonElement>("[data-newsletter-dismiss]")
      ?.addEventListener("click", () => dismissModal("no_thanks"));
    modal
      .querySelector<HTMLElement>("[data-newsletter-backdrop]")
      ?.addEventListener("click", () => dismissModal("backdrop"));
  }

  // Scroll trigger (modal only).
  if (activeScrollHandler) {
    window.removeEventListener("scroll", activeScrollHandler);
    activeScrollHandler = null;
  }
  if (globallySubscribed || perSlug === "subscribed" || perSlug === "dismissed") {
    return;
  }
  if (!modal) return;
  if (document.body.scrollHeight < window.innerHeight * 1.5) {
    // Post is too short to bother — never show modal.
    return;
  }

  const onScroll = throttle(() => {
    const denominator = document.body.scrollHeight - window.innerHeight;
    if (denominator <= 0) return;
    const scrolled = window.scrollY / denominator;
    if (scrolled >= 0.5) {
      window.removeEventListener("scroll", onScroll);
      if (activeScrollHandler === onScroll) activeScrollHandler = null;
      openModal(slug, category);
    }
  }, 150);

  activeScrollHandler = onScroll;
  window.addEventListener("scroll", onScroll, { passive: true });
}
