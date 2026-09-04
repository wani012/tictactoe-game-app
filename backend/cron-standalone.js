/**
 * ==============================================================================
 * FURU Tic-Tac-Toe - Standalone Node.js Cron Script (node-cron / MongoDB / Firestore)
 * ==============================================================================
 * 
 * Can be run on any Node.js server (Render, Railway, Heroku, AWS EC2, VPS).
 * 
 * Run command:
 *   node backend/cron-standalone.js
 * 
 * Requirements:
 *   npm install node-cron firebase-admin (or mongoose)
 */

const cron = require("node-cron");
const admin = require("firebase-admin");

// Initialize Firebase Admin (serviceAccountKey.json required)
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  // Fallback to default application credentials if running on GCP / Cloud Run
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function runTournamentAutomation() {
  console.log(`[${new Date().toISOString()}] 🚀 Running 3-Day Tournament Automation...`);

  const now = new Date();
  const CYCLE_MS = 3 * 24 * 60 * 60 * 1000;
  const cycleId = `cycle_${now.getTime()}`;

  try {
    // 1. Find Rank #1 Google Verified Player from /leaderboard
    const snapshot = await db
      .collection("leaderboard")
      .where("isGoogleUser", "==", true)
      .orderBy("score", "desc")
      .limit(1)
      .get();

    let champion = null;

    if (!snapshot.empty) {
      const winnerDoc = snapshot.docs[0];
      const winnerData = winnerDoc.data();
      const winnerId = winnerData.uid || winnerDoc.id;
      const score = winnerData.score || 0;

      if (score > 0) {
        champion = {
          uid: winnerId,
          name: winnerData.name || "Champion",
          photoURL: winnerData.photoURL || "",
          score: score,
          cycleWon: cycleId
        };

        console.log(`🏆 Reigning Champion: ${champion.name} with ${score} pts`);

        // 2. Increment 100 coins & set winner notification in user profile
        const userRef = db.collection("users").doc(winnerId);
        await userRef.set(
          {
            coins: admin.firestore.FieldValue.increment(100),
            unclaimedTournamentReward: {
              amount: 100,
              cycleWon: cycleId,
              claimed: false,
              awardedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            lastActive: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        console.log(`✅ 100 Coins credited to ${champion.name}. Notification flag set.`);
      }
    }

    // 3. Update /tournaments/current_cycle with next 3-day window & freeze Reigning Champion
    await db.collection("tournaments").doc("current_cycle").set({
      cycleId: cycleId,
      startTime: admin.firestore.Timestamp.fromDate(now),
      endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + CYCLE_MS)),
      reigningChampion: champion
    });

    // 4. Reset scores for next 3-day cycle
    const allDocs = await db.collection("leaderboard").get();
    const batch = db.batch();
    allDocs.forEach((doc) => {
      batch.update(doc.ref, {
        score: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`🔄 Leaderboard reset to 0. Next 3-day tournament started!`);
  } catch (err) {
    console.error("❌ Cron execution error:", err);
  }
}

// Scheduled to run every 3 days at 00:00 UTC
// Cron syntax: minute hour day-of-month month day-of-week
cron.schedule("0 0 */3 * *", () => {
  runTournamentAutomation();
});

console.log("⚡ Standalone 3-Day Tournament Cron Service started.");

// Run immediately once on startup for debugging / verification if flag passed:
if (process.argv.includes("--run-now")) {
  runTournamentAutomation();
}
