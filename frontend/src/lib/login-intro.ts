export const INTRO_COOKIE = "intro_seen";

export function markIntroSeen() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${INTRO_COOKIE}=1; Path=/login; SameSite=Lax${secure}`;
}
