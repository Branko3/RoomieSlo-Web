// Slovenian "chat" namespace: the chat list, conversations, messages and safety.
export const chat = {
  list: {
    title: "Ujemanja in klepeti",
    recommendedTitle: "Priporočeni profili",
    recommendedBody: "Na podlagi tvojih odgovorov",
    recommendedLink: "Poglej",
  },
  conversation: {
    back: "Nazaj na klepete",
    unavailable: "Klepet trenutno ni na voljo.",
    opening: "Odpiranje klepeta …",
    failedTitle: "Klepeta ni mogoče odpreti",
    errors: {
      offline: "Ni povezave. Klepeta ni bilo mogoče odpreti.",
      failed: "Klepeta ni bilo mogoče odpreti.",
    },
    signedOutTitle: "Nisi prijavljen",
    signedOutBody: "Za ogled klepeta se moraš prijaviti.",
    signIn: "Prijava",
    notFoundTitle: "Klepet ni na voljo",
    notFoundBody: "Ta pogovor ne obstaja ali vanj nisi vključen.",
    toChats: "Na klepete",
    verified: "Preverjen študent",
    unknownUser: "Uporabnik",
    peerListings: "Oglasi te osebe",
    listingPrice: "{price} € / mesec",
    openRequests: "Odpri zahteve",
    region: "Pogovor z osebo {name}",
    deletedPeer: "Ta uporabnik je izbrisal račun.",
    notices: {
      pendingIncoming:
        "Ta oseba ti je poslala zahtevo za ujemanje. Sprejmi jo med klepeti, da odpreš pogovor.",
      pendingOutgoing:
        "Zahteva še čaka na odgovor. Pogovor se odpre, ko jo druga oseba sprejme.",
      rejected:
        "Zahteva za ujemanje je bila zavrnjena, zato pogovor ni na voljo.",
    },
  },
  messages: {
    loading: "Nalaganje sporočil …",
    errors: {
      "signed-out": "Za ogled sporočil se moraš prijaviti.",
      offline: "Ni povezave. Sporočil ni bilo mogoče naložiti.",
      failed: "Napaka pri nalaganju sporočil.",
    },
    empty: "Še ni sporočil. Pozdravi osebo {name}.",
    log: "Sporočila z osebo {name}",
    you: "Ti",
    sending: "Pošiljanje …",
    notSent: "Ni poslano",
    discard: "Zavrzi",
    today: "Danes",
    yesterday: "Včeraj",
    delivery: {
      sent: "Poslano",
      delivered: "Dostavljeno",
      read: "Prebrano",
    },
  },
  composer: {
    label: "Sporočilo",
    placeholder: "Napiši sporočilo …",
    send: "Pošlji",
    errors: {
      "signed-out": "Za pošiljanje sporočil se moraš prijaviti.",
      "not-allowed": "V ta pogovor ne moreš pisati.",
      "too-long": "Sporočilo je lahko dolgo največ {max} znakov.",
      offline: "Ni povezave. Sporočilo ni bilo poslano.",
      failed: "Sporočila ni bilo mogoče poslati.",
      "already-sent": "Sporočilo je že bilo poslano.",
    },
  },
  live: {
    waiting: "Povezava v živo je prekinjena. Ponovni poskus čez {seconds} s.",
    disconnected:
      "Povezava v živo je prekinjena. Nova sporočila se prikažejo, ko se povezava obnovi.",
  },
  safety: {
    menu: "Varnost: prijavi ali blokiraj",
    report: "Prijavi",
    block: "Blokiraj",
    unblock: "Odblokiraj",
    cancel: "Prekliči",
    blocked:
      "Blokiral(a) si to osebo. Sporočil si ne moreta pošiljati, dokler je ne odblokiraš.",
    confirm:
      "Blokiraj to osebo? Ne bosta si mogla pošiljati sporočil ali novih zahtev za ujemanje.",
    errors: {
      "signed-out": "Za to dejanje se moraš prijaviti.",
      self: "Dejanja ni bilo mogoče izvesti. Poskusi znova.",
      offline: "Ni povezave. Poskusi znova.",
      failed: "Dejanja ni bilo mogoče izvesti. Poskusi znova.",
    },
  },
};
