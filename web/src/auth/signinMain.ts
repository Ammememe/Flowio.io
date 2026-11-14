import { getCurrentUser, signIn } from "./devAuth.js";

const params = new URLSearchParams(location.search);
const returnTo = params.get("returnTo") ?? "/dashboard.html";

if (getCurrentUser()) {
  location.href = returnTo;
}

const form = document.querySelector<HTMLFormElement>("#signin-form")!;
const emailInput = document.querySelector<HTMLInputElement>("#email")!;
const errorEl = document.querySelector<HTMLParagraphElement>("#signin-error")!;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    signIn(emailInput.value);
    location.href = returnTo;
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
    errorEl.hidden = false;
  }
});
