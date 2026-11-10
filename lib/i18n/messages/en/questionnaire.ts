import type { Messages } from "../../types";

export const questionnaire: Messages["questionnaire"] = {
  title: "Lifestyle questionnaire",
  progress: "{answered} of {total} statements answered",
  skip: "Skip",
  loading: "Loading the questionnaire …",
  signedOutTitle: "You're not signed in",
  loadFailedTitle: "Couldn't load the questionnaire",
  unavailable: "The questionnaire isn't available right now.",
  signIn: "Sign in",
  retry: "Try again",
  intro:
    "Mark how much you agree with each statement. You can skip the questionnaire at any time; unanswered statements don't affect matching.",
  saving: "Saving …",
  save: "Save and continue",
  errors: {
    "signed-out": "Sign in to fill in the questionnaire.",
    permission:
      "You don't have permission to save these answers. Sign in again.",
    offline: "No connection. Check your internet and try again.",
    unknown: "Saving failed. Try again.",
  },
  statements: {
    q_cleanliness: "Shared spaces should always be tidy.",
    q_costs: "I pay my share of the costs by the agreed date.",
    q_smoking: "Smoking in the flat doesn't bother me.",
    q_parties: "Occasional parties in the flat don't bother me.",
    q_noise: "I like peace and quiet in the evening.",
    q_chores: "Household chores should follow an agreed rota.",
    q_guests: "I'm happy to have visitors in the flat often.",
    q_pets: "I'd like to have a pet in the flat.",
    q_study: "I often study at home and need quiet when I do.",
    q_overnight:
      "I don't mind guests or partners staying overnight in the flat.",
    q_wake: "I get up early in the morning and go to bed early.",
  },
  likert: {
    strongly_disagree: "Strongly disagree",
    disagree: "Disagree",
    neutral: "Neither agree nor disagree",
    agree: "Agree",
    strongly_agree: "Strongly agree",
    no_answer: "Prefer not to say",
  },
  card: {
    progressFailed: "Couldn't load your progress.",
    loading: "Loading …",
    progressLabel: "Questionnaire completion",
    edit: "Edit",
    continue: "Continue",
    start: "Start",
  },
  readiness: {
    noAnswersTitle: "Fill in the questionnaire first",
    noAnswersBody:
      "We rank recommendations by how compatible your answers are. Answer at least {statements} about your lifestyle.",
    insufficientTitle: "We need more answers for recommendations",
    insufficientBody:
      "You've answered {answered}. Answer another {missing} so the compatibility scores are reliable.",
    statements: {
      one: "{count} statement",
      other: "{count} statements",
    },
  },
};
