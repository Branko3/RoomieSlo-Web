// Slovenian "cohabitation" namespace: "Živiva skupaj" in the chat and
// "Moje sobivanje" on /profile.
export const cohabitation = {
  declareAction: "Živiva skupaj",
  declareTitle: "Živita skupaj?",
  declareHint:
    "Izberi mesec, ko sta se vselila. Druga oseba mora to potrditi. Sobivanje vidita samo vidva. Ko živita skupaj, se lahko po dveh mesecih anonimno ocenita.",
  startedMonthLabel: "Mesec vselitve",
  endedMonthLabel: "Mesec izselitve",
  submitDeclare: "Pošlji v potrditev",
  confirm: "Potrdi",
  decline: "Ne drži",
  endAction: "Ne živiva več skupaj",
  endTitle: "Od kdaj ne živita več skupaj?",
  submitEnd: "Potrdi konec",
  cancel: "Prekliči",
  loading: "Nalaganje sobivanja …",
  signIn: "Prijava",
  retry: "Poskusi znova",
  banner: "{name} pravi, da živita skupaj od {month}.",
  active: "Živita skupaj od {month}",
  awaitingPeer: "Čakamo, da {name} potrdi, da živita skupaj od {month}.",
  cooldown: "Znova lahko predlagaš od {date} dalje.",
  attention: "Čaka na tvoj odgovor o sobivanju",
  // Month spans: "okt. 2026 – jan. 2027", or "od okt. 2026" while it lasts.
  monthSpan: "{from} – {to}",
  monthSince: "od {from}",
  announcements: {
    declare: "Poslano v potrditev.",
    confirm: "Potrjeno.",
    decline: "Označeno, da ne drži.",
    end: "Sobivanje je zaključeno.",
  },
  // Keyed by CohabitationStatusKey (lib/cohabitation/cohabitation.ts).
  status: {
    active: "Živita skupaj",
    ended: "Ne živita več skupaj",
    declined: "Ni potrjeno",
    awaitingPeer: "Čaka na potrditev",
    awaitingMe: "Čaka na tvoj odgovor",
  },
  // Keyed by CohabitationErrorKind.
  errors: {
    "signed-out": "Za to dejanje se prijavi.",
    permission: "Tega v tem klepetu zdaj ni mogoče narediti.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    conflict: "Stanje se je medtem spremenilo. Prikazujemo novo stanje.",
    cooldown: "Po zavrnitvi lahko znova predlagaš šele po {days} dneh.",
    "invalid-month":
      "Izberi mesec, ki ni v prihodnosti in ni pred začetkom vajinega ujemanja.",
    unknown: "Dejanja ni bilo mogoče izvesti. Poskusi znova.",
  },
  // Keyed by CohabitationLoadFailure.
  loadErrors: {
    "signed-out": "Za to dejanje se prijavi.",
    permission: "Tega v tem klepetu zdaj ni mogoče narediti.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    unknown: "Podatkov o sobivanju ni bilo mogoče naložiti.",
  },
  mine: {
    title: "Moje sobivanje",
    intro: "Sobivanje vidita samo ti in druga oseba.",
    suggestion:
      "Živita skupaj. Ali želiš izklopiti »Iščem sostanovalca / sobo«, da se tvoj profil ne prikazuje več med priporočenimi?",
    notNow: "Ne zdaj",
    turnOff: "Izklopi",
    empty:
      "Še nimaš zabeleženega sobivanja. V klepetu z osebo, s katero živiš, izberi »Živiva skupaj«.",
    openChat: "Odpri klepet",
    unknownPeer: "Uporabnik",
    openChatWith: "Odpri klepet z osebo {name}",
  },
};
