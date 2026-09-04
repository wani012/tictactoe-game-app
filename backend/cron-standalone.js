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
  const seasonId = `season_${now.toISOString().slice(0, 10).replace(/-/g, "_")}`;

  try {
    // 1. Find Rank #1 Player (Excluding any guest accounts)
    const snapshot = await db
      .collection("tournament_leaderboard")
      .where("isGuest", "==", false)
      .orderBy("trophies", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("ℹ️ No active registered players found.");
      return;
    }

    const winnerDoc = snapshot.docs[0];
    const winnerData = winnerDoc.data();
    const winnerId = winnerData.userId || winnerDoc.id;
    const trophies = winnerData.trophies || 0;

    if (trophies <= 0) {
      console.log("ℹ️ Rank #1 player has 0 trophies. Skipping reward.");
      return;
    }

    console.log(`🏆 Winner: ${winnerData.displayName} with ${trophies} 🏆`);

    // 2. Increment 100 coins & set pop-up flag
    const userRef = db.collection("users").doc(winnerId);
    await userRef.set(
      {
        coins: admin.firestore.FieldValue.increment(100),
        unclaimedTournamentReward: {
          amount: 100,
          seasonId: seasonId,
          rank: 1,
          claimed: false,
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    // 3. Save completed tournament record
    await db.collection("tournaments").doc(seasonId).set({
      seasonId: seasonId,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      winner: {
        userId: winnerId,
        displayName: winnerData.displayName,
        trophies: trophies,
        coinsAwarded: 100
      },
      status: "completed"
    });

    console.log(`✅ 100 Coins credited to ${winnerData.displayName}. Notification flag set.`);

    // 4. Reset scores for next 3-day cycle
    const allDocs = await db.collection("tournament_leaderboard").get();
    const batch = db.batch();
    allDocs.forEach((doc) => {
      batch.update(doc.ref, {
        trophies: 0,
        lastResetAt: admin.firestore.FieldValue.serverTimestamp()
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
