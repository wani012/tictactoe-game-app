/**
 * ==============================================================================
 * FURU Tic-Tac-Toe - 3-Day Tournament Automation Cloud Function (Firebase v2)
 * ==============================================================================
 * 
 * Rules Handled:
 * 1. ONLY Logged-in / Authenticated users are eligible (where('isGuest', '==', false)).
 * 2. Finds Rank #1 Player by highest trophies.
 * 3. Automatically credits +100 Coins to winner's wallet document (coins += 100).
 * 4. Flags the winner profile with unclaimedTournamentReward so they get the celebration popup upon login.
 * 5. Saves tournament season history in 'tournaments' collection.
 * 6. Resets tournament scores to 0 for the next 3-day season.
 * 
 * Schedule: Every 72 hours (3 days) at midnight UTC.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.distributeTournamentRewards = onSchedule(
  {
    schedule: "0 0 */3 * *", // Runs every 3rd day at 00:00 UTC
    timeZone: "UTC",
    retryCount: 3,
    memory: "256MiB"
  },
  async (event) => {
    console.log("🚀 Starting 3-Day Tournament Reward & Reset Cycle...");

    const now = new Date();
    const seasonId = `season_${now.toISOString().slice(0, 10).replace(/-/g, "_")}`;

    try {
      // 1. Fetch Rank #1 Player (Excluding any guest accounts)
      const topPlayerSnapshot = await db
        .collection("tournament_leaderboard")
        .where("isGuest", "==", false)
        .orderBy("trophies", "desc")
        .limit(1)
        .get();

      if (topPlayerSnapshot.empty) {
        console.log("ℹ️ No active registered players found for this tournament season.");
        return;
      }

      const winnerDoc = topPlayerSnapshot.docs[0];
      const winnerData = winnerDoc.data();
      const winnerId = winnerData.userId || winnerDoc.id;
      const winningTrophies = winnerData.trophies || 0;

      // Only reward if winner has at least 1 trophy
      if (winningTrophies <= 0) {
        console.log("ℹ️ Rank #1 player has 0 trophies. No reward distribution needed.");
        return;
      }

      console.log(`🏆 Rank #1 Winner Found: ${winnerData.displayName} (${winnerId}) with ${winningTrophies} 🏆`);

      const batch = db.batch();

      // 2. Credit +100 Coins & set celebration notification flag in winner's profile
      const userRef = db.collection("users").doc(winnerId);
      batch.set(
        userRef,
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

      // 3. Record Tournament Season History
      const tournamentRef = db.collection("tournaments").doc(seasonId);
      batch.set(tournamentRef, {
        seasonId: seasonId,
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        winner: {
          userId: winnerId,
          displayName: winnerData.displayName,
          winningTrophies: winningTrophies,
          rewardCoins: 100
        },
        status: "completed"
      });

      // Commit winner credit & season record
      await batch.commit();
      console.log(`✅ +100 Coins credited to ${winnerData.displayName}'s wallet.`);

      // 4. Reset all tournament scores to 0 for the next 3-day cycle
      const allPlayersSnapshot = await db.collection("tournament_leaderboard").get();
      const resetBatch = db.batch();

      allPlayersSnapshot.docs.forEach((doc) => {
        resetBatch.update(doc.ref, {
          trophies: 0,
          lastResetAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await resetBatch.commit();
      console.log(`🔄 Tournament scores reset to 0 for ${allPlayersSnapshot.size} players. Next 3-day season started!`);
    } catch (error) {
      console.error("❌ Error in 3-day tournament reward automation:", error);
      throw error;
    }
  }
);
