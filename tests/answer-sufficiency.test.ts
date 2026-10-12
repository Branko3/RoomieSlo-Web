import { describe, expect, it } from "vitest";
import type { CompatibilityAnswer } from "../lib/compatibility/compatibility";
import {
  expressedAnswerCount,
  MIN_EXPRESSED_ANSWERS,
  QUESTIONNAIRE_ROUTE,
  readinessMessage,
  recommendationReadiness,
  sharedStatementCount,
  statementsLabel,
} from "../lib/matching/answer-sufficiency";

const answer = (
  question_id: string,
  weight = 0.1,
  value = 1,
): CompatibilityAnswer => ({
  question_id,
  value,
  weight,
});

describe("expressedAnswerCount", () => {
  it("counts only answers with a positive weight, once per statement", () => {
    expect(expressedAnswerCount(null)).toBe(0);
    expect(expressedAnswerCount([])).toBe(0);
    expect(
      expressedAnswerCount([
        answer("q1"),
        answer("q2", 0),
        answer("q1"),
        answer("q3"),
      ]),
    ).toBe(2);
  });
});

describe("recommendationReadiness", () => {
  it("asks for the questionnaire when nothing is answered", () => {
    expect(recommendationReadiness(null)).toEqual({ status: "no-answers" });
    expect(recommendationReadiness([answer("q1", 0), answer("q2", 0)])).toEqual(
      {
        status: "no-answers",
      },
    );
  });

  it("reports how many answers are still missing below the threshold", () => {
    expect(recommendationReadiness([answer("q1"), answer("q2")])).toEqual({
      status: "insufficient",
      answered: 2,
      required: MIN_EXPRESSED_ANSWERS,
    });
  });

  it("is ready at exactly the threshold", () => {
    expect(MIN_EXPRESSED_ANSWERS).toBe(3);
    expect(
      recommendationReadiness([answer("q1"), answer("q2"), answer("q3")]),
    ).toEqual({
      status: "ready",
    });
  });

  it("accepts a custom threshold", () => {
    expect(recommendationReadiness([answer("q1")], 1)).toEqual({
      status: "ready",
    });
  });
});

describe("sharedStatementCount", () => {
  it("counts statements both users answered with a positive weight", () => {
    const mine = [answer("q1"), answer("q2"), answer("q3", 0)];
    const theirs = [answer("q2"), answer("q3"), answer("q4"), answer("q1", 0)];
    expect(sharedStatementCount(mine, theirs)).toBe(1);
  });

  it("is 0 without the user's answers or without overlap", () => {
    expect(sharedStatementCount(null, [answer("q1")])).toBe(0);
    expect(sharedStatementCount([answer("q1")], [answer("q2")])).toBe(0);
    expect(sharedStatementCount([answer("q1")], [])).toBe(0);
  });
});

describe("statementsLabel", () => {
  it.each([
    [1, "1 trditev"],
    [2, "2 trditvi"],
    [3, "3 trditve"],
    [4, "4 trditve"],
    [5, "5 trditev"],
    [11, "11 trditev"],
    [101, "101 trditev"],
    [102, "102 trditvi"],
  ])("formats %i as %s", (count, label) => {
    expect(statementsLabel(count)).toBe(label);
  });
});

describe("readinessMessage", () => {
  it("returns nothing when recommendations can be shown", () => {
    expect(readinessMessage({ status: "ready" })).toBeNull();
  });

  it("explains the questionnaire requirement for users without answers", () => {
    expect(readinessMessage({ status: "no-answers" })).toEqual({
      title: "Najprej izpolni vprašalnik",
      body: "Priporočila razvrstimo po združljivosti tvojih odgovorov. Odgovori na vsaj 3 trditve o življenjskem slogu.",
    });
  });

  it("says how many more answers are needed", () => {
    expect(
      readinessMessage({ status: "insufficient", answered: 1, required: 3 }),
    ).toEqual({
      title: "Za priporočila potrebujemo več odgovorov",
      body: "Odgovoril(a) si na 1 trditev. Odgovori še na 2 trditvi, da bodo ocene združljivosti zanesljive.",
    });
  });

  it("points to the questionnaire route", () => {
    expect(QUESTIONNAIRE_ROUTE).toBe("/profile/questionnaire");
  });
});
