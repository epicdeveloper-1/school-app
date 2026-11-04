export type AppProfile = "blank" | "personal";

/** Friend installer/site. Personal desktop/web leave this unset. */
export function getAppProfile(): AppProfile {
  return process.env.NEXT_PUBLIC_APP_PROFILE === "blank" ? "blank" : "personal";
}

export function isBlankProfile(): boolean {
  return getAppProfile() === "blank";
}
