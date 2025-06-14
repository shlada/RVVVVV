const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const axios = require('axios');

const username = process.env.username;
const password = process.env.password;
const shared_secret = process.env.shared;
const steamApiKey = process.env.STEAM_API_KEY;

const client = new SteamUser();

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

  try {
    const games = await fetchOwnedGames(client.steamID.getSteamID64());
    console.log(`[+] Found ${games.length} games.`);

    // Shuffle order randomly
    games.sort(() => Math.random() - 0.5);

    for (const game of games) {
      const reviewText = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
      const delay = randomDelay(1, 15); // 1 to 15 min delay

      try {
        await postReview(game.appid, sessionID, cookies, reviewText);
        console.log(`[✓] Reviewed: ${game.name || 'AppID ' + game.appid} (${game.appid})`);
      } catch (err) {
        console.warn(`[!] Failed review on AppID ${game.appid}: ${err.message}`);
      }

      console.log(`⏳ Waiting ${Math.floor(delay / 60000)} minutes before next review...`);
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

async function fetchOwnedGames(steamID64) {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamApiKey}&steamid=${steamID64}&include_appinfo=true&include_played_free_games=true`;

  const res = await axios.get(url);
  if (!res.data.response || !res.data.response.games) throw new Error("Could not retrieve games.");

  return res.data.response.games.map(game => ({
    appid: game.appid,
    name: game.name
  }));
}

async function postReview(appid, sessionID, cookies, text) {
  // Extract sessionid cookie value from cookies array
  const sessionidCookie = cookies.find(c => c.startsWith('sessionid='));
  const sessionid = sessionidCookie ? sessionidCookie.split('=')[1].split(';')[0] : sessionID;

  const cookieString = cookies.join('; ');

  const url = 'https://store.steampowered.com/friends/recommendgame/';
  const form = new URLSearchParams({
    appid,
    review_text: text,
    voted_up: 'true',
    is_public: 'true',
    received_compensation: 'false',
    language: 'english',
    sessionid
  });

  await axios.post(url, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0'
    }
  });
}
