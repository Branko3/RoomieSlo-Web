// Slovenian "auth" namespace: sign-in, registration, e-mail confirmation,
// session errors and sign-out.
// "Prijava" here always means signing in (never a report).
export const auth = {
  login: {
    title: "Prijavi se v svoj račun",
    deleted: "Račun je izbrisan.",
    subtitle: "Nadaljuj z iskanjem svojega idealnega doma.",
    email: "E-naslov",
    emailPlaceholder: "ime@primer.si",
    password: "Geslo",
    submit: "Prijava",
    submitting: "Prijavljanje ...",
    noAccount: "Še nimaš računa?",
    register: "Registriraj se",
    errors: {
      invalid_email: "Vnesite veljaven e-naslov.",
      missing_password: "Vnesite geslo.",
      invalid_credentials: "E-naslov ali geslo nista pravilna.",
      email_not_confirmed:
        "E-naslov še ni potrjen. Preverite potrditveno sporočilo.",
      network:
        "Povezava ni uspela. Preverite internetno povezavo in poskusite znova.",
      failed: "Prijava ni uspela. Preverite podatke in poskusite znova.",
      unreachable: "Prijava ni uspela. Preverite povezavo in poskusite znova.",
    },
  },
  register: {
    title: "Ustvari svoj račun",
    subtitle: "Poveži se s ljudmi, ki iščejo podoben dom.",
    displayName: "Ime in priimek",
    email: "E-naslov",
    password: "Geslo",
    adultStudent: "Potrjujem, da imam vsaj 18 let in sem študent(ka) univerze.",
    submit: "Ustvari račun",
    submitting: "Ustvarjam račun…",
    haveAccount: "Že imaš račun?",
    signIn: "Prijava",
    created:
      "Račun je ustvarjen. Na {email} smo poslali potrditveno povezavo. Preveri e-pošto in nato nadaljuj na prijavo.",
    errors: {
      display_name_required: "Vnesi ime in priimek.",
      email_required: "Vnesi e-naslov.",
      email_invalid: "Vnesi veljaven e-naslov.",
      password_too_short: "Geslo mora vsebovati najmanj 8 znakov.",
      adult_student_required:
        "RoomieSlo je namenjen študentom, starim vsaj 18 let. Potrdi to za nadaljevanje.",
      exists: "Račun s tem e-naslovom že obstaja. Poskusi s prijavo.",
      failed: "Registracije trenutno ni mogoče dokončati. Poskusi znova.",
    },
  },
  confirmation: {
    title: "Preveri svojo e-pošto",
    failedTitle: "Potrditev ni uspela",
    sent: "Poslali smo ti povezavo za potrditev računa. Odpri jo na tej napravi, nato se lahko prijaviš.",
    email: "E-naslov",
    emailPlaceholder: "ime@student.uni-lj.si",
    sending: "Pošiljanje …",
    cooldown: "Ponovno pošlji čez {seconds} s",
    resend: "Pošlji potrditveno e-sporočilo znova",
    alreadyConfirmed: "Si že potrdil e-naslov?",
    signIn: "Prijava",
    errors: {
      missing:
        "Potrditvena povezava ni popolna. Odpri povezavo iz zadnjega e-sporočila ali pošlji novo.",
      expired:
        "Potrditvena povezava je potekla. Pošlji novo potrditveno e-sporočilo.",
      invalid:
        "Potrditvena povezava ni veljavna ali je bila že uporabljena. Poskusi se prijaviti ali pošlji novo.",
      unknown:
        "E-naslova trenutno ni bilo mogoče potrditi. Poskusi znova čez nekaj minut.",
    },
    resendResult: {
      sent: "Če račun za {email} čaka na potrditev, smo poslali novo povezavo.",
      invalid_email: "Vnesi veljaven e-naslov.",
      unavailable: "Prijava trenutno ni na voljo. Poskusi znova kasneje.",
      rate_limited:
        "Poslali smo že več e-sporočil. Počakaj nekaj minut in poskusi znova.",
      failed: "E-sporočila ni bilo mogoče poslati. Poskusi znova kasneje.",
      offline:
        "E-sporočila ni bilo mogoče poslati. Preveri povezavo in poskusi znova.",
    },
  },
  session: {
    checking: "Preverjanje prijave ...",
    unavailableTitle: "Prijava ni na voljo",
    restoreFailed: "Seje ni bilo mogoče obnoviti. Prijavi se znova.",
    fallbackName: "Uporabnik",
    errors: {
      session: "Seje ni mogoče preveriti. Poskusite znova.",
      configuration:
        "Supabase configuration failed. Prijava trenutno ni na voljo.",
    },
  },
  authError: {
    metaTitle: "Napaka prijave",
    title: "Prijava ni na voljo",
    configuration:
      "Supabase ni konfiguriran. Nastavi NEXT_PUBLIC_SUPABASE_URL in NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    session: "Seje ni mogoče preveriti. Poskusi znova.",
  },
  logout: {
    submit: "Odjava",
    pending: "Odjavljanje …",
    failed: "Odjava ni uspela. Preveri povezavo in poskusi znova.",
  },
};
