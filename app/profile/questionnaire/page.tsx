import { Suspense } from "react";
import { LifestyleQuestionnaire } from "../../../components/lifestyle-questionnaire";

export default function QuestionnairePage() {
  return (
    <Suspense
      fallback={
        <div className="content-wrap narrow-content" aria-busy="true" />
      }
    >
      <LifestyleQuestionnaire />
    </Suspense>
  );
}
