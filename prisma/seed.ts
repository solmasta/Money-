// Seeds two verified, profiled users who are a strong match, for demoing
// the flow quickly via the UI or curl without re-running the full
// interview/verification steps by hand.

import { prisma } from "../src/db.js";
import { hashEmbed } from "../src/adapters/mock.js";

async function main() {
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.escrowLedgerEntry.deleteMany(),
    prisma.closureEvent.deleteMany(),
    prisma.dateProposal.deleteMany(),
    prisma.match.deleteMany(),
    prisma.vouch.deleteMany(),
    prisma.preferenceProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const aliceText =
    "i value honesty and family above all. i am looking for a long-term relationship, something serious. i am pretty secure and independent. smoking is a dealbreaker for me.";
  const bobText =
    "honesty and family matter a lot to me too. i want a long-term relationship, something serious and stable. i feel pretty secure in relationships.";

  const alice = await prisma.user.create({
    data: {
      email: "alice@example.com",
      displayName: "Alice",
      verificationStatus: "VERIFIED",
      intent: "LONG_TERM",
      intentLockedAt: new Date(),
      preferenceProfile: {
        create: {
          values: JSON.stringify(["honesty", "family"]),
          dealbreakers: JSON.stringify(["smoking"]),
          attachmentStyle: "secure",
          relationshipHistorySummary: aliceText,
          vector: JSON.stringify(hashEmbed(aliceText)),
          rawTranscript: aliceText,
        },
      },
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@example.com",
      displayName: "Bob",
      verificationStatus: "VERIFIED",
      intent: "LONG_TERM",
      intentLockedAt: new Date(),
      preferenceProfile: {
        create: {
          values: JSON.stringify(["honesty", "family"]),
          dealbreakers: JSON.stringify([]),
          attachmentStyle: "secure",
          relationshipHistorySummary: bobText,
          vector: JSON.stringify(hashEmbed(bobText)),
          rawTranscript: bobText,
        },
      },
    },
  });

  console.log("Seeded:", { alice: alice.id, bob: bob.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
