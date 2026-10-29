import test from "node:test";
import assert from "node:assert/strict";
import {
  schemas,
  inquirySchema,
  publicBirthDate,
} from "../apps/api/src/domain";
const sponsor = {
  name: "Club partner",
  description: { kk: "Серіктес" },
  logo: "/media/sponsors/bank-rbk.webp",
  status: "PUBLISHED",
  sortOrder: 0,
  logoApproved: true,
  youthSafe: false,
  verificationSource: "https://example.org/announcement",
  verifiedAt: new Date().toISOString(),
};
test("sponsors require independent partnership verification and approved logo before publication", () => {
  assert.ok(schemas.sponsors.safeParse(sponsor).success);
  for (const patch of [
    { logoApproved: false },
    { verifiedAt: null },
    { verificationSource: null },
    { logo: null },
    { websiteUrl: "javascript:alert(1)" },
    { validFrom: "2026-12-01T00:00:00Z", validUntil: "2026-01-01T00:00:00Z" },
  ])
    assert.equal(
      schemas.sponsors.safeParse({ ...sponsor, ...patch }).success,
      false,
    );
  assert.ok(
    schemas.sponsors.safeParse({
      ...sponsor,
      status: "DRAFT",
      logo: null,
      logoApproved: false,
      verificationSource: null,
      verifiedAt: null,
    }).success,
  );
});
test("sporting honours have an explicit competition/year and cannot publish unverified claims", () => {
  const a = {
    title: { kk: "Қазақстан чемпионы" },
    description: { kk: "" },
    year: 2026,
    source: "club",
    verification: "VERIFIED",
    status: "PUBLISHED",
    achievementType: "LEAGUE",
    competitionKey: "kazakhstan-premier-league",
  };
  assert.ok(schemas.achievements.safeParse(a).success);
  for (const patch of [
    { competitionKey: null },
    { year: null },
    { verification: "LEGACY_UNVERIFIED" },
  ])
    assert.equal(
      schemas.achievements.safeParse({ ...a, ...patch }).success,
      false,
    );
  assert.ok(
    schemas.achievements.safeParse({
      ...a,
      achievementType: "MILESTONE",
      competitionKey: null,
      year: null,
    }).success,
  );
});
test("academy inquiry setup requires published privacy content and approved contact details", () => {
  const page = {
    id: "main",
    content: { privacyNotice: { kk: "Құпиялық" } },
    status: "PUBLISHED",
    admissionState: "CLOSED",
    inquiriesEnabled: true,
    contactEmail: "academy@example.org",
    source: "club",
  };
  assert.ok(schemas.academy.safeParse(page).success);
  for (const patch of [
    { content: {} },
    { contactEmail: null },
    { status: "DRAFT" },
  ])
    assert.equal(
      schemas.academy.safeParse({ ...page, ...patch }).success,
      false,
    );
});
test("parent inquiries require consent and contact and reject spam and excess minor data", () => {
  const inquiry = {
    guardianName: "Parent",
    contact: "parent@example.org",
    message: "Please send admission information.",
    locale: "kk",
    consent: true,
    website: "",
  };
  assert.ok(inquirySchema.safeParse(inquiry).success);
  for (const patch of [
    { consent: false },
    { contact: "not-a-contact" },
    { website: "spam" },
    { childAddress: "private" },
    { message: "x" },
  ])
    assert.equal(
      inquirySchema.safeParse({ ...inquiry, ...patch }).success,
      false,
    );
  assert.ok(
    inquirySchema.safeParse({ ...inquiry, contact: "+7 (777) 111-22-33" })
      .success,
  );
});

test("exact minor birth dates stay private through the birthday boundary and leap years", () => {
  const ordinary = new Date("2008-10-30T00:00:00Z"),
    leap = new Date("2008-02-29T00:00:00Z");
  assert.equal(
    publicBirthDate(ordinary, new Date("2026-10-29T23:59:59Z")),
    null,
  );
  assert.equal(
    publicBirthDate(ordinary, new Date("2026-10-30T00:00:00Z")),
    ordinary,
  );
  assert.equal(publicBirthDate(leap, new Date("2026-02-28T23:59:59Z")), null);
  assert.equal(publicBirthDate(leap, new Date("2026-03-01T00:00:00Z")), leap);
  assert.equal(publicBirthDate(null), null);
});
