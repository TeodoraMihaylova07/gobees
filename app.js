const express = require("express");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const { Redis } = require("@upstash/redis");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
        ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false }
      }
);

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  : null;
const memoryRooms = new Map();
const ROOM_TTL_SECONDS = 60 * 60 * 24;

function roomKey(code) {
  return `room:${String(code || "").toUpperCase()}`;
}

async function getRoom(code) {
  const normalized = String(code || "").toUpperCase();
  if (!normalized) return null;
  if (redis) return await redis.get(roomKey(normalized));
  return memoryRooms.get(normalized) || null;
}

async function setRoom(room) {
  const normalized = String(room?.code || "").toUpperCase();
  if (!normalized) return;
  room.code = normalized;
  if (redis) {
    await redis.set(roomKey(normalized), room, { ex: ROOM_TTL_SECONDS });
    return;
  }
  memoryRooms.set(normalized, room);
}

async function deleteRoom(code) {
  const normalized = String(code || "").toUpperCase();
  if (!normalized) return;
  if (redis) {
    await redis.del(roomKey(normalized));
    return;
  }
  memoryRooms.delete(normalized);
}

async function roomExists(code) {
  return Boolean(await getRoom(code));
}

const BULGARIAN_WORDS = [
  "море", "гора", "река", "маса", "стол", "книга", "път", "мечка", "врата", "прозорец",
  "училище", "учител", "ученик", "време", "ден", "нощ", "слънце", "луна", "звезда", "сняг",
  "дъжд", "буря", "огън", "вода", "земя", "вятър", "поле", "град", "село", "двор",
  "приятел", "семейство", "майка", "баща", "дете", "брат", "сестра", "любов", "радост", "усмивка",
  "песен", "музика", "танц", "театър", "картина", "история", "наука", "работа", "проект", "система",
  "програма", "код", "игра", "победа", "загуба", "трофей", "клас", "мисъл", "език", "буква",
  "дума", "израз", "въпрос", "отговор", "памет", "идея", "план", "среща", "пазар", "магазин",
  "цвете", "градина", "ябълка", "круша", "череша", "слива", "хляб", "мляко", "сирене", "масло",
  "домат", "краставица", "салата", "супа", "пиле", "риба", "месо", "сол", "захар", "мед",
  "кафе", "чай", "чаша", "чиния", "лъжица", "вилица", "нож", "кухня", "баня", "стая",
  "лампа", "легло", "възглавница", "одеяло", "дреха", "риза", "панталон", "обувка", "чанта", "часовник"
];

const EXTRA_BULGARIAN_WORDS = [
  "пътя", "пътник", "пътека", "пълен", "пъзел", "трън", "тръба", "тръст", "мъгла", "къща",
  "кътче", "въже", "въглища", "лъжа", "лъскав", "ръка", "ръкав", "ръст", "дъга", "дъска",
  "дъно", "зъб", "зъболекар", "тъкан", "тънък", "кърпа", "кърпа", "кърма", "мъх", "гъба",
  "гъст", "гъска", "прасе", "прасец", "прах", "прахосмукачка", "влак", "влакно", "гара", "перон",
  "станция", "билет", "пътуване", "багаж", "куфар", "автобус", "спирка", "шофьор", "пътна", "карта",
  "кола", "кормило", "гума", "двигател", "скорост", "спирачка", "фар", "огледало", "капак", "врата",
  "пръст", "пръстен", "глас", "гласен", "тих", "шум", "шумен", "звук", "мелодия", "ритъм",
  "нота", "пиано", "цигулка", "флейта", "тромпет", "барабан", "сцена", "публика", "аплодисменти", "роля",
  "актьор", "режисьор", "филм", "серия", "екран", "камера", "снимка", "обектив", "кадър", "галерия",
  "рамка", "четка", "боя", "палитра", "платно", "майстор", "занаят", "работилница", "инструмент", "чук",
  "пирон", "трион", "бормашина", "лопата", "гребло", "кофа", "метла", "чистота", "ред", "подредба",
  "учебник", "тетрадка", "молив", "химикал", "гума", "чертожна", "дъска", "класна", "стая", "звънец",
  "междучасие", "домашно", "упражнение", "задача", "контролно", "изпит", "оценка", "успех", "стипендия", "диплома",
  "университет", "факултет", "катедра", "лекция", "семинар", "лаборатория", "експеримент", "формула", "уравнение", "графика",
  "таблица", "данни", "анализ", "модел", "алгоритъм", "променлива", "функция", "масив", "цикъл", "условие",
  "сървър", "клиент", "мрежа", "сайт", "браузър", "страница", "бутон", "екран", "прозорец", "меню",
  "профил", "парола", "вход", "изход", "регистрация", "потребител", "приятели", "покана", "съобщение", "чат",
  "канал", "група", "отбор", "съперник", "финал", "полуфинал", "турнир", "класация", "точки", "рекорд",
  "победител", "шампион", "медал", "купа", "стадион", "трибуна", "писта", "топка", "мрежа", "врата",
  "съдия", "свирка", "фал", "гол", "пас", "удар", "защита", "атака", "тактика", "тренировка",
  "отдих", "ваканция", "море", "плаж", "чадър", "кърпа", "вълна", "бряг", "скала", "остров",
  "гора", "пътека", "връх", "долина", "езеро", "река", "водопад", "пещера", "поляна", "сезон",
  "пролет", "лято", "есен", "зима", "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември", "понеделник", "вторник", "сряда", "четвъртък",
  "петък", "събота", "неделя", "сутрин", "обед", "вечер", "минута", "секунда", "календар", "час",
  "закуска", "обяд", "вечеря", "десерт", "торта", "бонбон", "шоколад", "бисквита", "палачинка", "кисело",
  "сладко", "люто", "солено", "горчиво", "топло", "студено", "прясно", "вкусно", "аромат", "рецепта",
  "готвач", "фурна", "котлон", "тенджера", "тиган", "чиния", "чаша", "бутилка", "кана", "лъжица",
  "вилица", "ножица", "покривка", "маса", "стол", "салфетка", "подарък", "празник", "рожден", "имен",
  "коледа", "великден", "фойерверк", "свещ", "торбичка", "лента", "картичка", "усмивка", "прегръдка", "пожелание",
  "здраве", "щастие", "късмет", "надежда", "мечта", "смелост", "сила", "воля", "търпение", "вяра",
  "чест", "доброта", "уважение", "подкрепа", "доверие", "отговорност", "свобода", "справедливост", "истина", "мъдрост",
  "знание", "умение", "памет", "внимание", "фокус", "логика", "творчество", "вдъхновение", "процес", "резултат",
  "задача", "решение", "пример", "идея", "проект", "план", "цел", "стъпка", "напредък", "развитие",
  "начало", "среда", "край", "проблем", "помощ", "съвет", "избор", "шанс", "опит", "урок"
];

function normalizeWord(w) {
  return String(w || "").trim().toUpperCase();
}

function isBulgarianWordFormat(word) {
  return /^[А-ЯЍ]+$/i.test(word);
}

function isWordAllowedByLetters(word, letters) {
  for (const ch of word) {
    if (!letters.includes(ch)) return false;
  }
  return true;
}

function pointsForLength(len) {
  if (len <= 4) return 1;
  if (len === 5) return 3;
  if (len === 6) return 4;
  if (len === 7) return 6;
  if (len === 8) return 7;
  if (len === 9) return 8;
  if (len === 10) return 10;
  if (len === 11) return 11;
  if (len === 12) return 13;
  return 15;
}

function generateLetters(difficulty = "easy") {
  const vowels = ["А", "Е", "И", "О", "У", "Ъ"];
  const pools = {
    easy: ["А", "Е", "И", "О", "У", "П", "Р", "С", "Т", "Л", "М", "Н"],
    medium: ["А", "Е", "И", "О", "У", "К", "М", "Н", "П", "Р", "С", "Т", "Л", "Д"],
    hard: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪ".split("")
  };
  const pool = [...new Set(pools[difficulty] || pools.easy)];
  const letters = [vowels[Math.floor(Math.random() * vowels.length)]];

  while (letters.length < 7) {
    const l = pool[Math.floor(Math.random() * pool.length)];
    if (!letters.includes(l)) letters.push(l);
  }
  return letters;
}

function pickBotWords(letters, count, exclude = []) {
  const excluded = new Set(exclude.map((w) => normalizeWord(w)));
  const sourceWords = [...BULGARIAN_WORDS, ...EXTRA_BULGARIAN_WORDS];
  const candidates = sourceWords.map((w) => normalizeWord(w))
    .filter((w) => w.length >= 4)
    .filter((w) => !excluded.has(w))
    .filter((w) => isWordAllowedByLetters(w, letters))
    .sort((a, b) => b.length - a.length);
  return [...new Set(candidates)].slice(0, count);
}

async function createUniqueRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let attempts = 0;
  while (attempts < 2000) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!(await roomExists(code))) return code;
    attempts += 1;
  }
  throw new Error("Could not generate unique room code.");
}

app.post("/register", async (req, res) => {
  const { username, nickname, email, password } = req.body;

  try {
    const exists = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (exists.rows.length > 0) return res.json({ error: "Username taken" });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (username, nickname, email, password, trophies, friends) VALUES ($1,$2,$3,$4,0,'')",
      [username, nickname, email, hash]
    );
    res.json({ success: true });
  } catch {
    res.json({ error: "DB error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const r = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (r.rows.length === 0) return res.json({ error: "No user" });
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Wrong password" });
    res.json(user);
  } catch {
    res.json({ error: "DB error" });
  }
});

app.post("/addFriend", async (req, res) => {
  const { userId, friendUsername } = req.body;
  try {
    const r = await pool.query("SELECT id FROM users WHERE username=$1", [friendUsername]);
    if (r.rows.length === 0) return res.json({ error: "No such user" });

    const friendId = r.rows[0].id;
    const user = await pool.query("SELECT friends FROM users WHERE id=$1", [userId]);
    const friend = await pool.query("SELECT friends FROM users WHERE id=$1", [friendId]);

    const userFriends = user.rows[0].friends.split(",").filter((x) => x);
    const friendFriends = friend.rows[0].friends.split(",").filter((x) => x);

    if (!friendFriends.includes(String(userId))) {
      friendFriends.push(String(userId));
      await pool.query("UPDATE users SET friends=$1 WHERE id=$2", [friendFriends.join(","), friendId]);
    }
    if (!userFriends.includes(String(friendId))) {
      userFriends.push(String(friendId));
      await pool.query("UPDATE users SET friends=$1 WHERE id=$2", [userFriends.join(","), userId]);
    }

    res.json({ success: true });
  } catch {
    res.json({ error: "friend error" });
  }
});

app.get("/friends/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.json([]);

    const r = await pool.query("SELECT friends FROM users WHERE id=$1", [id]);
    if (r.rows.length === 0) return res.json([]);

    const ids = String(r.rows[0].friends || "")
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return res.json([]);

    const friends = await pool.query("SELECT nickname FROM users WHERE id = ANY($1::int[])", [ids]);
    res.json(friends.rows);
  } catch {
    res.json([]);
  }
});

app.post("/checkWord", async (req, res) => {
  try {
    const word = String(req.body.word || "").trim().toLowerCase();
    if (!/^[а-яѝ]+$/i.test(word)) return res.json({ valid: false });

    const r = await fetch(`https://rechnik.chitanka.info/w/${encodeURIComponent(word)}`);
    const text = await r.text();
    const hasEntrySections =
      text.includes('class="meaning box"') ||
      text.includes('class="derivative-forms box"') ||
      text.includes('class="synonyms box"');
    res.json({ valid: hasEntrySections });
  } catch {
    res.json({ valid: false });
  }
});

app.post("/botWords", (req, res) => {
  const letters = (req.body.letters || []).map((l) => normalizeWord(l));
  const count = Math.max(0, Math.min(50, Number(req.body.count) || 0));
  const exclude = Array.isArray(req.body.exclude) ? req.body.exclude : [];
  if (!Array.isArray(letters) || letters.length === 0) return res.json({ words: [] });
  res.json({ words: pickBotWords(letters, count, exclude) });
});

app.post("/simulateRandomLobby", (req, res) => {
  const letters = (req.body.letters || []).map((l) => normalizeWord(l));
  const bots = Math.max(1, Math.min(9, Number(req.body.bots) || 1));
  const maxWordsEach = Math.max(3, Math.min(20, Number(req.body.maxWordsEach) || 6));
  const players = [];

  for (let i = 0; i < bots; i += 1) {
    const take = Math.max(3, Math.min(maxWordsEach, 3 + Math.floor(Math.random() * maxWordsEach)));
    const words = pickBotWords(letters, take, []);
    players.push({
      nickname: `Player${i + 2}`,
      score: words.reduce((sum, w) => sum + pointsForLength(w.length), 0),
      words
    });
  }
  res.json({ players });
});

app.post("/updateTrophies", async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const trophies = Math.max(0, Number(req.body.trophies) || 0);
    if (!userId) return res.json({ error: "Missing userId" });
    await pool.query("UPDATE users SET trophies=$1 WHERE id=$2", [trophies, userId]);
    res.json({ success: true, trophies });
  } catch {
    res.json({ error: "DB error" });
  }
});

app.post("/rooms/create", async (req, res) => {
  try {
    const nickname = String(req.body.nickname || "Guest").trim() || "Guest";
    const code = await createUniqueRoomCode();
    await setRoom({
      code,
      status: "waiting",
      durationSeconds: 60,
      letters: [],
      players: [{ nickname, score: 0, words: [], finished: false }]
    });
    res.json({ code });
  } catch {
    res.json({ error: "Could not create room." });
  }
});

app.post("/rooms/join", async (req, res) => {
  const code = String(req.body.code || "").toUpperCase();
  const nickname = String(req.body.nickname || "Guest").trim() || "Guest";
  const room = await getRoom(code);
  if (!room) return res.json({ success: false, error: "Room not found." });
  if (room.status !== "waiting") return res.json({ success: false, error: "Game already started." });

  if (!room.players.some((p) => p.nickname === nickname)) {
    room.players.push({ nickname, score: 0, words: [], finished: false });
  }
  await setRoom(room);
  res.json({ success: true });
});

app.get("/rooms/:code", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  res.json({ room: room || null });
});

app.post("/rooms/:code/start", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  if (!room) return res.json({ error: "Room not found." });
  if (room.status !== "waiting") return res.json({ error: "Already started." });

  room.status = "playing";
  room.durationSeconds = Math.max(60, Math.min(1200, Number(req.body.durationSeconds) || 60));
  room.letters = generateLetters("hard");
  room.players.forEach((p) => {
    p.score = 0;
    p.words = [];
    p.finished = false;
  });

  await setRoom(room);
  res.json({ success: true, room });
});

app.post("/rooms/:code/submit-word", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  if (!room || room.status !== "playing") return res.json({ error: "Room is not in game." });

  const nickname = String(req.body.nickname || "").trim();
  const word = normalizeWord(req.body.word);
  const points = Number(req.body.points) || pointsForLength(word.length);

  if (!nickname || word.length < 4 || !isBulgarianWordFormat(word) || !isWordAllowedByLetters(word, room.letters)) {
    return res.json({ error: "Invalid word." });
  }

  const player = room.players.find((p) => p.nickname === nickname);
  if (!player) return res.json({ error: "Player missing." });
  if (player.words.includes(word)) return res.json({ error: "Already used by this player." });

  player.words.push(word);
  player.score += points;
  await setRoom(room);
  res.json({ success: true });
});

app.post("/rooms/:code/finish", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  if (!room) return res.json({ error: "Room not found." });

  const nickname = String(req.body.nickname || "").trim();
  const player = room.players.find((p) => p.nickname === nickname);
  if (player) player.finished = true;
  if (room.players.length > 0 && room.players.every((p) => p.finished)) {
    room.status = "finished";
  }
  await setRoom(room);
  res.json({ success: true });
});

app.get("/rooms/:code/result", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  if (!room) return res.json({ players: [] });
  res.json({ players: room.players });
});

app.post("/rooms/:code/leave", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const room = await getRoom(code);
  if (!room) return res.json({ success: true });

  const nickname = String(req.body.nickname || "").trim();
  room.players = room.players.filter((p) => p.nickname !== nickname);
  if (room.players.length === 0) {
    await deleteRoom(code);
  } else {
    await setRoom(room);
  }

  res.json({ success: true });
});

module.exports = app;
