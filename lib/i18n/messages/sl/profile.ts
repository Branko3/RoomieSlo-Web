import { pluralForms } from "../plural";

// Slovenian "profile" namespace: /profile, the profile header and form, and
// the availability setting.
export const profile = {
  title: "Profil",
  deleteAccount: "Izbriši račun",
  verified: "Preverjen študent",
  // Shown only without a Supabase configuration (local preview).
  preview: {
    name: "Amar H.",
    faculty: "FRI, Univerza v Ljubljani",
  },
  age: pluralForms({
    one: "{count} leto",
    two: "{count} leti",
    few: "{count} leta",
    other: "{count} let",
  }),
  loading: "Nalaganje profila …",
  loadFailedTitle: "Profila ni bilo mogoče naložiti",
  retry: "Poskusi znova",
  signedOutTitle: "Nisi prijavljen",
  signedOutBody: "Prijavi se, da vidiš in urejaš svoj profil.",
  signIn: "Prijava",
  missingTitle: "Profil še ni pripravljen",
  missingBody:
    "Tvoj račun še nima profila. Osveži stran čez nekaj trenutkov ali se obrni na podporo.",
  edit: "Uredi",
  saved: "Profil je shranjen.",
  form: {
    title: "Uredi profil",
    displayName: "Ime in priimek",
    faculty: "Fakulteta",
    facultyPlaceholder: "FRI, Univerza v Ljubljani",
    age: "Starost",
    bio: "O meni",
    cancel: "Prekliči",
    saving: "Shranjevanje …",
    save: "Shrani",
  },
  // Keyed by ProfileFieldError (lib/profile/own-profile.ts).
  validation: {
    "display-name-short": "Vnesi ime z vsaj {min} znakoma.",
    "display-name-long": "Ime je lahko dolgo največ {max} znakov.",
    "faculty-long": "Fakulteta je lahko dolga največ {max} znakov.",
    "bio-long": "Opis je lahko dolg največ {max} znakov.",
    "age-range": "Starost mora biti celo število med {min} in {max}.",
  },
  errors: {
    permission: "Nimaš dovoljenja za ta profil. Odjavi se in se prijavi znova.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    unknown: "Profila ni bilo mogoče naložiti ali shraniti. Poskusi znova.",
  },
  availability: {
    title: "Iščem sostanovalca / sobo",
    body: "Ko je vklopljeno, se tvoj profil prikazuje med priporočenimi.",
    toggle: "Preklopi razpoložljivost",
  },
};
