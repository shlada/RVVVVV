const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const axios = require('axios');

const username = process.env.username;
const password = process.env.password;
const shared_secret = process.env.shared;

const client = new SteamUser();

// 🔁 Review text variations
const reviewTexts = [
  "Really enjoyed this one!",
  "Fantastic game, loved it.",
  "Well done devs, great experience.",
  "Top tier game. Highly recommend.",
  "Had a blast playing this!",
  "This one surprised me, solid.",
  "Definitely worth it.",
  "Good value, fun gameplay.",
  "Would play it again!",
  "Nothing bad to say. Awesome.",
  "Solid title, great time.",
  "Fun from start to finish.",
  "Amazing! 10/10.",
  "Classic must-play.",
  "Quality experience.",
  "Well-crafted and engaging.",
  "Great content, smooth performance.",
  "Good vibes only.",
  "Perfect to relax and enjoy.",
  "Respect to the devs, this rocks."
];

client.logOn({
  accountName: username,
  password: password,
  twoFactorCode: SteamTotp.generateAuthCode(shared_secret)
});

client.on('loggedOn', () => {
  console.log(`[+] Logged in as ${client.steamID}`);
  client.setPersona(SteamUser.EPersonaState.Online);
});

client.on('webSession', async (sessionID, cookies) => {
  console.log("[*] Web session started. Getting owned games...");

  const steamLoginSecure = cookies.find(c => c.startsWith('steamLoginSecure')).split(';')[0];

  try {
    const games = await fetchOwnedGames(client.steamID.getSteamID64(), steamLoginSecure);
    console.log(`[+] Found ${games.length} games.`);

    // Shuffle order
    games.sort(() => Math.random() - 0.5);

    for (const game of games) {
      const reviewText = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
      const delay = randomDelay(1, 15); // 1 to 15 min

      try {
        await postReview(game.appid, sessionID, steamLoginSecure, reviewText);
        console.log(`[✓] Reviewed: ${game.name || 'AppID ' + game.appid} (${game.appid})`);
      } catch (err) {
        console.warn(`[!] Failed review on AppID ${game.appid}: ${err.message}`);
      }

      console.log(`⏳ Waiting ${Math.floor(delay / 60000)} min...`);
      await sleep(delay);
    }

    console.log("✅ All reviews done.");
  } catch (err) {
    console.error("❌ Failed to get owned games:", err.message);
  }
});

// --- Helpers ---

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMinutes, maxMinutes) {
  const min = minMinutes * 60000;
  const max = maxMinutes * 60000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchOwnedGames(steamID64, steamLoginSecure) {
  const url = `https://store.steampowered.com/dynamicstore/userdata/`;

  const res = await axios.get(url, {
    headers: {
      'Cookie': `steamLoginSecure=${steamLoginSecure}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!res.data || !res.data.rgOwnedApps) throw new Error("Could not parse owned games.");

  const appIDs = res.data.rgOwnedApps;
  return appIDs.map(id => ({ appid: id }));
}

async function postReview(appid, sessionID, steamLoginSecure, text) {
  const url = 'https://store.steampowered.com/friends/recommendgame/';
  const form = new URLSearchParams({
    appid,
    review_text: text,
    voted_up: 'true',
    is_public: 'true',
    received_compensation: 'false',
    language: 'english',
    sessionid: sessionID
  });

  await axios.post(url, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `sessionid=${sessionID}; ${steamLoginSecure}`
    }
  });
}
