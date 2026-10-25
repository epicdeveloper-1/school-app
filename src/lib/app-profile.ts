/** Friend installer. Personal dev/builds leave this unset. */
export function isBlankProfile(): boolean {
  return process.env.NEXT_PUBLIC_APP_PROFILE === "blank";
}
