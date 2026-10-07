import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">R</span>
        <b>
          Roomie<span>Slo</span>
        </b>
      </div>
      <div className="auth-card">
        <p className="eyebrow">ZAČNI NA NOVO</p>
        <h1>Ustvari svoj račun</h1>
        <p className="muted">Poveži se s ljudmi, ki iščejo podoben dom.</p>
        <label>
          Ime in priimek
          <input placeholder="Amar H." />
        </label>
        <label>
          E-naslov
          <input type="email" placeholder="ime@student.uni-lj.si" />
        </label>
        <label>
          Geslo
          <input type="password" placeholder="Najmanj 8 znakov" />
        </label>
        <button className="button full-button">Nadaljuj</button>
        <p className="auth-footer">
          Že imaš račun? <Link href="/login">Prijava</Link>
        </p>
      </div>
    </div>
  );
}
