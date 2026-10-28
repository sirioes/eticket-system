export const INTRO_COOKIE = "intro_seen";

export const INTRO_COOKIE_MAX_AGE = 12 * 60 * 60;

export function markIntroSeen() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${INTRO_COOKIE}=1; Path=/login; Max-Age=${INTRO_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
