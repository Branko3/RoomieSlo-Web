"use client";

import Link from "next/link";
import { MyCohabitationsSection } from "../../components/my-cohabitations-section";
import { MyRatingsSection } from "../../components/my-ratings-section";
import { OwnProfileSection } from "../../components/own-profile-section";
import {
  AvailabilityCard,
  QuestionnaireProgressCard,
} from "../../components/profile-status-cards";
import { getSupabaseConfig } from "../../lib/config";
import { LogoutButton } from "../../components/logout-button";

export default function ProfilePage() {
  const configured = getSupabaseConfig().configured;
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">TVOJ PROSTOR</p>
          <h1>Profil</h1>
        </div>
      </header>
      <OwnProfileSection configured={configured} />
      {configured && (
        <>
          <AvailabilityCard />
          <QuestionnaireProgressCard />
          <MyCohabitationsSection />
          <MyRatingsSection />
        </>
      )}
      <LogoutButton />
      <Link
        className="text-link danger-link delete-account-link"
        href="/profile/delete-account"
      >
        Izbriši račun
      </Link>
    </div>
  );
}
