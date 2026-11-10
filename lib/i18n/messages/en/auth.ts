import type { Messages } from "../../types";

export const auth: Messages["auth"] = {
  login: {
    title: "Sign in to your account",
    deleted: "Your account has been deleted.",
    subtitle: "Pick up your search for your ideal home.",
    email: "Email",
    emailPlaceholder: "name@example.com",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in ...",
    noAccount: "Don't have an account?",
    register: "Sign up",
    errors: {
      invalid_email: "Enter a valid email address.",
      missing_password: "Enter your password.",
      invalid_credentials: "The email or password is incorrect.",
      email_not_confirmed:
        "Your email isn't confirmed yet. Check the confirmation email.",
      network:
        "Couldn't connect. Check your internet connection and try again.",
      failed: "Sign-in failed. Check your details and try again.",
      unreachable: "Sign-in failed. Check your connection and try again.",
    },
  },
  register: {
    title: "Create your account",
    subtitle: "Connect with people looking for a home like yours.",
    displayName: "Full name",
    email: "Email",
    password: "Password",
    adultStudent: "I confirm that I'm at least 18 and a university student.",
    submit: "Create account",
    submitting: "Creating account…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    created:
      "Your account has been created. We've sent a confirmation link to {email}. Check your email, then sign in.",
    errors: {
      display_name_required: "Enter your full name.",
      email_required: "Enter your email address.",
      email_invalid: "Enter a valid email address.",
      password_too_short: "Your password must be at least 8 characters long.",
      adult_student_required:
        "RoomieSlo is for students aged 18 or over. Confirm this to continue.",
      exists: "An account with this email already exists. Try signing in.",
      failed: "We can't complete your sign-up right now. Try again.",
    },
  },
  confirmation: {
    title: "Check your email",
    failedTitle: "Confirmation failed",
    sent: "We've sent you a link to confirm your account. Open it on this device, then you can sign in.",
    email: "Email",
    emailPlaceholder: "name@student.uni-lj.si",
    sending: "Sending …",
    cooldown: "Resend in {seconds} s",
    resend: "Resend the confirmation email",
    alreadyConfirmed: "Already confirmed your email?",
    signIn: "Sign in",
    errors: {
      missing:
        "The confirmation link is incomplete. Open the link from the latest email or send a new one.",
      expired:
        "The confirmation link has expired. Send a new confirmation email.",
      invalid:
        "The confirmation link isn't valid or has already been used. Try signing in or send a new one.",
      unknown:
        "We couldn't confirm your email right now. Try again in a few minutes.",
    },
    resendResult: {
      sent: "If an account for {email} is waiting for confirmation, we've sent a new link.",
      invalid_email: "Enter a valid email address.",
      unavailable: "Sign-in isn't available right now. Try again later.",
      rate_limited:
        "We've already sent several emails. Wait a few minutes and try again.",
      failed: "We couldn't send the email. Try again later.",
      offline:
        "We couldn't send the email. Check your connection and try again.",
    },
  },
  session: {
    checking: "Checking sign-in ...",
    unavailableTitle: "Sign-in unavailable",
    restoreFailed: "We couldn't restore your session. Sign in again.",
    fallbackName: "User",
    errors: {
      session: "We couldn't verify your session. Try again.",
      configuration:
        "Supabase configuration failed. Sign-in isn't available right now.",
    },
  },
  authError: {
    metaTitle: "Sign-in error",
    title: "Sign-in unavailable",
    configuration:
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    session: "We couldn't verify your session. Try again.",
  },
  logout: {
    submit: "Sign out",
    pending: "Signing out …",
    failed: "Sign-out failed. Check your connection and try again.",
  },
};
