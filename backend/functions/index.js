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
    const CYCLE_MS = 3 * 24 * 60 * 60 * 1000;
    const cycleId = `cycle_${now.getTime()}`;

    try {
      // 1. Fetch Rank #1 Player (Strictly Google verified users)
      const topPlayerSnapshot = await db
        .collection("leaderboard")
        .where("isGoogleUser", "==", true)
        .orderBy("score", "desc")
        .limit(1)
        .get();

      let champion = null;

      if (!topPlayerSnapshot.empty) {
        const winnerDoc = topPlayerSnapshot.docs[0];
        const winnerData = winnerDoc.data();
        const winnerId = winnerData.uid || winnerDoc.id;
        const winningScore = winnerData.score || 0;

        if (winningScore > 0) {
          champion = {
            uid: winnerId,
            name: winnerData.name || "Champion",
            photoURL: winnerData.photoURL || "",
            score: winningScore,
            cycleWon: cycleId
          };

          console.log(`🏆 Rank #1 Winner Found: ${champion.name} (${winnerId}) with ${winningScore} pts`);

          // 2. Credit +100 Coins & set celebration notification flag in winner's profile
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

          console.log(`✅ +100 Coins credited to ${champion.name}'s wallet.`);
        }
      }

      // 3. Freeze Reigning Champion & Start new 3-day cycle in /tournaments/current_cycle
      await db.collection("tournaments").doc("current_cycle").set({
        cycleId: cycleId,
        startTime: admin.firestore.Timestamp.fromDate(now),
        endTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + CYCLE_MS)),
        reigningChampion: champion
      });

      // 4. Reset all tournament scores to 0 for the next 3-day cycle
      const allPlayersSnapshot = await db.collection("leaderboard").get();
      const resetBatch = db.batch();

      allPlayersSnapshot.docs.forEach((doc) => {
        resetBatch.update(doc.ref, {
          score: 0,
          matchesPlayed: 0,
          matchesWon: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
