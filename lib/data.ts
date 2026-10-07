export type Listing = {
  id: string;
  title: string;
  district: string;
  price: number;
  available: string;
  roomType: string;
  details: string;
  image: string;
  favorite?: boolean;
  isNew?: boolean;
};

export const listings: Listing[] = [
  {
    id: "l1",
    title: "Svetla soba blizu FRI",
    district: "Bežigrad, Ljubljana",
    price: 320,
    available: "1. sep",
    roomType: "soba",
    details: "16 m² · 2 sostanovalca · stroški vključeni",
    image: "🌿",
    isNew: true,
  },
  {
    id: "l2",
    title: "Garsonjera v starem mestnem jedru",
    district: "Center, Ljubljana",
    price: 450,
    available: "1. okt",
    roomType: "garsonjera",
    details: "28 m² · opremljeno · varščina 450 €",
    image: "🏡",
  },
  {
    id: "l3",
    title: "Soba v stanovanju s tremi študenti",
    district: "Šiška, Ljubljana",
    price: 280,
    available: "po dogovoru",
    roomType: "deljeno stanovanje",
    details: "12 m² · 3 sostanovalci",
    image: "☀️",
  },
  {
    id: "l4",
    title: "Soba blizu Rožne doline",
    district: "Vič, Ljubljana",
    price: 350,
    available: "15. sep",
    roomType: "soba",
    details: "14 m² · 1 sostanovalec · opremljeno",
    image: "🪴",
  },
];

export const recommended = [
  { name: "Iva K.", faculty: "FDV", score: 92, color: "coral" },
  { name: "Marko P.", faculty: "FE", score: 84, color: "blue" },
  { name: "Sara D.", faculty: "FF", score: 77, color: "purple" },
];
