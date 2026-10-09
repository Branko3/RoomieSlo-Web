export const metadata = {
  title: "Napaka prijave",
  robots: { index: false, follow: false },
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const message =
    searchParams.reason === "configuration"
      ? "Supabase ni konfiguriran. Nastavi NEXT_PUBLIC_SUPABASE_URL in NEXT_PUBLIC_SUPABASE_ANON_KEY."
      : "Seje ni mogoče preveriti. Poskusi znova.";
  return (
    <div className="page-state" role="alert">
      <h1>Prijava ni na voljo</h1>
      <p>{message}</p>
    </div>
  );
}
