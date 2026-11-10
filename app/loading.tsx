import { getI18n } from "../lib/i18n/server";

export default async function Loading() {
  const { m } = await getI18n();
  return (
    <div className="page-state">
      <span className="spinner" /> {m.common.loading.app}
    </div>
  );
}
