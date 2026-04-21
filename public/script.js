let currentUser = null;
let difficulty = "easy";
let score = 0;
let usedWords = [];
let timeLeft = 60;
let timer;
let letters = [];

// ---------------- UI ----------------
function show(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(screen + "-screen").classList.remove("hidden");
}

// ---------------- AUTH ----------------
async function login() {
  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    })
  });

  const data = await res.json();

  if (data.id) {
    currentUser = data;
    document.getElementById("nickname").innerText = data.nickname;
    document.getElementById("rank").innerText = getRank(data.trophies);
    show("menu");
  } else {
    alert(data.error);
  }
}

async function register() {
  const username = prompt("Username:");
  const nickname = prompt("Nickname:");
  const email = prompt("Email:");
  const password = prompt("Password:");

  const res = await fetch("/register", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ username, nickname, email, password })
  });

  const data = await res.json();
  alert(data.error || "Registered");
}

function guest() {
  currentUser = { nickname: "Guest", trophies: 0 };
  document.getElementById("nickname").innerText = "Guest";
  document.getElementById("rank").innerText = "No Rank";
  show("menu");
}

function logout() {
  currentUser = null;
  show("login");
}

// ---------------- RANK ----------------
function getRank(t) {
  if (t >= 2000) return "Diamond";
  if (t >= 1000) return "Emerald";
  if (t >= 500) return "Gold";
  if (t >= 200) return "Silver";
  if (t >= 50) return "Platinum";
  return "Bronze";
}

// ---------------- GAME ----------------
function showDifficulty() {
  show("difficulty");
}

function startGame(level) {
  difficulty = level;
  show("game");

  score = 0;
  usedWords = [];
  timeLeft = 60;

  generateLetters();
  updateScore();
  startTimer();
}

// ---------------- LETTERS ----------------
function generateLetters() {
  const vowels = ["А","Е","И","О","У","Ъ"];

  const pools = {
    easy: ["А","Е","И","О","У","П","Р","С","Т","Л"],
    medium: ["А","Е","И","О","У","К","М","Н","П","Р","С","Т"],
    hard: "БВГДЖЗЙКЛМНПРСТФХЦЧШЩЪ".split("")
  };

  const pool = [...new Set(pools[difficulty])];

  letters = [];

  letters.push(vowels[Math.floor(Math.random()*vowels.length)]);

  while (letters.length < 7) {
    const l = pool[Math.floor(Math.random()*pool.length)];
    if (!letters.includes(l)) {
      letters.push(l);
    }
  }

  renderLetters();
}

function renderLetters() {
  const lettersEl = document.getElementById("letters");
  lettersEl.innerHTML = "";

  letters.forEach(l => {
    const d = document.createElement("div");
    d.className = "letter";
    d.innerText = l;
    d.onclick = () => document.getElementById("wordInput").value += l;
    lettersEl.appendChild(d);
  });
}

// ---------------- WORD ----------------
function isValidLetters(word) {
  for (let l of word) {
    if (!letters.includes(l)) return false;
  }

  return true;
}

async function submitWord() {
  const input = document.getElementById("wordInput");
  const word = input.value.toUpperCase();

  if (word.length < 4 || usedWords.includes(word)) return;

  if (!isValidLetters(word)) {
    alert("Invalid letters");
    return;
  }

  const res = await fetch("/checkWord", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ word })
  });

  const data = await res.json();

  if (!data.valid) {
    alert("Not a word");
    return;
  }

  usedWords.push(word);
  score += calculatePoints(word.length);
  updateScore();
  input.value = "";
}

// ---------------- SCORE ----------------
function calculatePoints(len) {
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

function updateScore() {
  document.getElementById("score").innerText = score;
}

// ---------------- TIMER ----------------
function startTimer() {
  clearInterval(timer);

  const timerEl = document.getElementById("timer");

  timer = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;

    if (timeLeft <= 0) endGame();
  }, 1000);
}

// ---------------- END ----------------
async function endGame() {
  clearInterval(timer);

  if (currentUser?.id) {
    await fetch("/saveScore", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        userId: currentUser.id,
        score
      })
    });
  }

  alert("Score: " + score);
  show("menu");
}

// ---------------- FRIENDS ----------------
async function addFriend() {
  const username = prompt("Enter friend's username:");

  await fetch("/addFriend", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      userId: currentUser.id,
      friendUsername: username
    })
  });

  loadFriends();
}

async function loadFriends() {
  const res = await fetch("/friends/" + currentUser.id);
  const data = await res.json();

  const list = document.getElementById("achievements");
  list.innerHTML = "";

  data.forEach(f => {
    const li = document.createElement("li");
    li.innerText = f.nickname;
    list.appendChild(li);
  });
}

// ---------------- PROFILE ----------------
function showProfile() {
  document.getElementById("profileName").innerText = currentUser.nickname;
  document.getElementById("profileRank").innerText = getRank(currentUser.trophies);

  loadFriends();
  show("profile");
}

// ENTER KEY
document.addEventListener("keypress", e => {
  if (e.key === "Enter") submitWord();
});