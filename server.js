const express = require("express");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({
  user: "neondb_owner",
  host: "ep-crimson-rice-an108lyd-pooler.c-6.us-east-1.aws.neon.tech",
  database: "neondb",
  password: "npg_3Qy7toGnCxeO",
  ssl: { rejectUnauthorized: false }
});

// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
  const { username, nickname, email, password } = req.body;

  try {
    const exists = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [username]
    );

    if (exists.rows.length > 0) {
      return res.json({ error: "Username taken" });
    }

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

// ---------------- LOGIN ----------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const r = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    if (r.rows.length === 0) {
      return res.json({ error: "No user" });
    }

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.json({ error: "Wrong password" });

    res.json(user);

  } catch {
    res.json({ error: "DB error" });
  }
});

// ---------------- ADD FRIEND ----------------
app.post("/addFriend", async (req, res) => {
  const { userId, friendUsername } = req.body;

  try {
    const r = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [friendUsername]
    );

    if (r.rows.length === 0) return res.json({ error: "No such user" });

    const friendId = r.rows[0].id;

    const user = await pool.query(
      "SELECT friends FROM users WHERE id=$1",
      [userId]
    );

    const friend = await pool.query(
      "SELECT friends FROM users WHERE id=$1",
      [friendId]
    );

    const userFriends = user.rows[0].friends.split(",").filter(x => x);
    const friendFriends = friend.rows[0].friends.split(",").filter(x => x);

    // mutual add only if both add each other
    if (!friendFriends.includes(String(userId))) {
      friendFriends.push(String(userId));
      await pool.query(
        "UPDATE users SET friends=$1 WHERE id=$2",
        [friendFriends.join(","), friendId]
      );
    }

    if (!userFriends.includes(String(friendId))) {
      userFriends.push(String(friendId));
      await pool.query(
        "UPDATE users SET friends=$1 WHERE id=$2",
        [userFriends.join(","), userId]
      );
    }

    res.json({ success: true });

  } catch {
    res.json({ error: "friend error" });
  }
});

// ---------------- GET FRIENDS ----------------
app.get("/friends/:id", async (req, res) => {
  const id = req.params.id;

  const r = await pool.query(
    "SELECT friends FROM users WHERE id=$1",
    [id]
  );

  const ids = r.rows[0].friends.split(",").filter(x => x);

  if (ids.length === 0) return res.json([]);

  const friends = await pool.query(
    `SELECT nickname FROM users WHERE id = ANY($1::int[])`,
    [ids]
  );

  res.json(friends.rows);
});

// ---------------- WORD CHECK ----------------
app.post("/checkWord", async (req, res) => {
  try {
    const word = String(req.body.word || "").trim().toLowerCase();

    // Allow only Bulgarian Cyrillic letters for dictionary checks.
    if (!/^[а-яѝ]+$/i.test(word)) {
      return res.json({ valid: false });
    }

    const r = await fetch(`https://rechnik.chitanka.info/w/${encodeURIComponent(word)}`);
    const text = await r.text();

    // A real entry has at least one dictionary data section.
    const hasEntrySections =
      text.includes('class="meaning box"') ||
      text.includes('class="derivative-forms box"') ||
      text.includes('class="synonyms box"');

    res.json({
      valid: hasEntrySections
    });

  } catch {
    res.json({ valid: false });
  }
});

app.listen(3000, () => {
  console.log("http://localhost:3000 🐝");
});