import { getI18n } from "../lib/i18n/server";

export default async function NotFound() {
  const { m } = await getI18n();
  return (
    <div className="page-state">
      <h1>{m.errors.notFound.title}</h1>
      <p>{m.errors.notFound.body}</p>
      <a className="button" href="/listings">
        {m.common.actions.toListings}
      </a>
    </div>
  );
}
