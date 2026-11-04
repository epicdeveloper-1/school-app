import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase-client";

function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.weeklyStrategy?.isDesktop);
}

/** Desktop uses a popup (redirect never returns cleanly in Electron). Web keeps redirect. */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  if (isDesktopApp()) {
    try {
      return await signInWithPopup(auth, provider);
    } catch (err) {
      // Popup can fail in some Electron builds; fall back to same-window redirect.
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        throw err;
      }
      await signInWithRedirect(auth, provider);
      return null;
    }
  }

  await signInWithRedirect(auth, provider);
  return null;
}

export function googleSignInErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "auth/unauthorized-domain") {
      return "This app address is not allowed for Google sign-in yet. Add 127.0.0.1 / localhost in Firebase Auth settings.";
    }
    if (code === "auth/popup-blocked" || code === "auth/web-storage-unsupported") {
      return "Google sign-in was blocked. Allow popups/cookies for this app, then try again.";
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return "Sign-in was closed before it finished. Try again.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Google sign-in is disabled in the Firebase console.";
    }
  }
  return "Google sign-in did not finish. Try again.";
}
