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
import { LanguageSwitcher } from "../../components/language-switcher";
import { useI18n } from "../../lib/i18n/provider";

export default function ProfilePage() {
  const configured = getSupabaseConfig().configured;
  const { m } = useI18n();
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>{m.profile.title}</h1>
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
      {/* The sidebar's switcher is hidden on phones; this one is always here. */}
      <div className="settings-list">
        <div className="profile-card">
          <LanguageSwitcher />
        </div>
      </div>
      <footer className="profile-footer">
        <LogoutButton />
        <Link
          className="text-link danger-link delete-account-link"
          href="/profile/delete-account"
        >
          {m.profile.deleteAccount}
        </Link>
      </footer>
    </div>
  );
}
