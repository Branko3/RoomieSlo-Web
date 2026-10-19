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
import { MyListingsSettingsRow } from "../../components/my-listings-links";

export default function ProfilePage() {
  const configured = getSupabaseConfig().configured;
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>Profil</h1>
        </div>
      </header>
      <OwnProfileSection configured={configured} />
      {configured && (
        <>
          <div className="settings-list">
            <AvailabilityCard />
            <QuestionnaireProgressCard />
            <MyListingsSettingsRow />
          </div>
          <MyCohabitationsSection />
          <MyRatingsSection />
        </>
      )}
      <footer className="profile-footer">
        <LogoutButton />
        <Link
          className="text-link danger-link delete-account-link"
          href="/profile/delete-account"
        >
          Izbriši račun
        </Link>
      </footer>
    </div>
  );
}
