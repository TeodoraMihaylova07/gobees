let currentUser = null;
let score = 0;
let usedWords = [];
let timeLeft = 60;
let timer = null;
let letters = [];
let gameMode = "pc";
let pcDifficulty = "easy";
let pcWords = [];
let pcScore = 0;
let randomLobbySize = 2;
let activeRoomCode = null;
let roomDurationSeconds = 60;
let roomPollTimer = null;
let currentRoomState = null;
let achievements = [];

function byId(id) {
  return document.getElementById(id);
}

function show(screen) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  byId(screen + "-screen").classList.remove("hidden");
}

function playerName() {
  return currentUser?.nickname || "Guest";
}

function refreshProfileBadge() {
  byId("nickname").innerText = playerName();
  byId("rank").innerText = getRank(currentUser?.trophies || 0);
  byId("trophies").innerText = `Trophies: ${currentUser?.trophies || 0}`;
}

async function login() {
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: byId("username").value.trim(),
      password: byId("password").value
    })
  });

  const data = await res.json();
  if (!data.id) {
    alert(data.error || "Login failed");
    return;
  }

  currentUser = data;
  refreshProfileBadge();
  show("menu");
}

async function register() {
  const username = byId("regUsername").value.trim();
  const nickname = byId("regNickname").value.trim();
  const email = byId("regEmail").value.trim();
  const password = byId("regPassword").value;

  if (!username || !nickname || !email || !password) {
    alert("All fields are required.");
    return;
  }

  // Add email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  // Add password validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    alert("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.");
    return;
  }

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, nickname, email, password })
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  byId("regPassword").value = "";
  byId("username").value = username;
  alert("Registered successfully. You can log in now.");
  show("login");
}

function guest() {
  currentUser = { nickname: "Guest", trophies: 0 };
  refreshProfileBadge();
  show("menu");
}

function logout() {
  clearAllTimers();
  currentUser = null;
  show("login");
}

function getRank(trophies) {
  if (trophies >= 2000) return "Diamond";
  if (trophies >= 1000) return "Emerald";
  if (trophies >= 500) return "Gold";
  if (trophies >= 200) return "Silver";
  if (trophies >= 50) return "Platinum";
  return "Bronze";
}

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

function showDifficulty() {
  show("difficulty");
}

function selectFriendDuration(seconds) {
  roomDurationSeconds = seconds;
  byId("friendDurationLabel").innerText = `Selected: ${seconds / 60} min`;
}

function clearAllTimers() {
  clearInterval(timer);
  clearInterval(roomPollTimer);
  timer = null;
  roomPollTimer = null;
}

function generateLetters(mode = "easy") {
  const vowels = ["А", "Е", "И", "О", "У", "Ъ"];
  const pools = {
    easy: ["А", "Е", "И", "О", "У", "П", "Р", "С", "Т", "Л", "М", "Н"],
    medium: ["А", "Е", "И", "О", "У", "К", "М", "Н", "П", "Р", "С", "Т", "Л", "Д"],
    hard: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪ".split("")
  };

  const pool = [...new Set(pools[mode] || pools.easy)];
  letters = [vowels[Math.floor(Math.random() * vowels.length)]];

  while (letters.length < 7) {
    const l = pool[Math.floor(Math.random() * pool.length)];
    if (!letters.includes(l)) letters.push(l);
  }
  renderLetters();
}

function renderLetters() {
  const lettersEl = byId("letters");
  lettersEl.innerHTML = "";
  letters.forEach((l) => {
    const d = document.createElement("div");
    d.className = "letter";
    d.innerText = l;
    d.onclick = () => {
      byId("wordInput").value += l;
    };
    lettersEl.appendChild(d);
  });
}

function isValidLetters(word) {
  for (const l of word) {
    if (!letters.includes(l)) return false;
  }
  return true;
}

function setInfoMessage(msg) {
  byId("message").innerText = msg;
}

function deleteLastLetter() {
  const input = byId("wordInput");
  input.value = input.value.slice(0, -1);
}

function resetRoundState() {
  score = 0;
  usedWords = [];
  pcWords = [];
  pcScore = 0;
  updateScore();
  byId("wordInput").value = "";
  setInfoMessage("");
}

function updateScore() {
  byId("score").innerText = score;
}

function startTimer(onEnd) {
  clearInterval(timer);
  byId("timer").innerText = timeLeft;

  timer = setInterval(() => {
    timeLeft -= 1;
    byId("timer").innerText = Math.max(0, timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timer);
      timer = null;
      onEnd();
    }
  }, 1000);
}

function startPcGame(level) {
  gameMode = "pc";
  pcDifficulty = level;
  timeLeft = 60;
  resetRoundState();
  generateLetters(level);
  byId("gameModeTitle").innerText = `Vs PC (${level})`;
  byId("gameOpponentScore").innerText = "PC score: 0";
  byId("gameOpponentWords").innerText = "";
  show("game");
  startTimer(endGame);
}

async function startRandomMatch() {
  gameMode = "random";
  timeLeft = 60;
  resetRoundState();
  generateLetters("hard");
  byId("gameModeTitle").innerText = `Random ${randomLobbySize} players`;
  byId("gameOpponentScore").innerText = "Random lobby";
  byId("gameOpponentWords").innerText = "";
  show("game");
  startTimer(endGame);
}

async function submitWord() {
  const input = byId("wordInput");
  const word = input.value.trim().toUpperCase();
  input.value = "";

  if (word.length < 4) {
    setInfoMessage("Word must be at least 4 letters.");
    return;
  }
  if (usedWords.includes(word)) {
    setInfoMessage("Word already used.");
    return;
  }
  if (!isValidLetters(word)) {
    setInfoMessage("Invalid letters. Cleared automatically.");
    return;
  }

  const res = await fetch("/checkWord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word })
  });
  const data = await res.json();

  if (!data.valid) {
    setInfoMessage("Not a valid Bulgarian word. Cleared automatically.");
    return;
  }

  usedWords.push(word);
  const points = calculatePoints(word.length);
  score += points;
  updateScore();
  setInfoMessage(`+${points} points for ${word}`);

  if (gameMode === "friends" && activeRoomCode) {
    await fetch(`/rooms/${activeRoomCode}/submit-word`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: playerName(), word, points })
    });
  }
}

async function endGame() {
  clearInterval(timer);
  timer = null;
  try {
    if (gameMode === "pc") {
      await finishPcGame();
      return;
    }

    if (gameMode === "friends") {
      await finishFriendGame();
      return;
    }

    if (gameMode === "random") {
      await finishRandomGame();
      return;
    }

    show("menu");
  } catch (err) {
    console.error(err);
    showResults({
      title: "Game Finished",
      subtitle: "There was a temporary error while loading results.",
      lines: [
        `Your score: ${score}`,
        `Your words: ${usedWords.join(", ") || "-"}`,
        "Please return to menu and try again."
      ]
    });
  }
}

async function finishPcGame() {
  const targetByDifficulty = { easy: 5, medium: 10, hard: 20 };
  const neededWords = targetByDifficulty[pcDifficulty] || 5;
  const res = await fetch("/botWords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      letters,
      count: neededWords,
      exclude: usedWords
    })
  });
  const data = await res.json();
  pcWords = data.words || [];
  pcScore = pcWords.reduce((sum, w) => sum + calculatePoints(w.length), 0);

  let result = "Draw";
  let isWin = false;
  if (score > pcScore) {
    result = "You win vs PC";
    isWin = true;
  }
  if (score < pcScore) result = "You lose vs PC";

  // Check achievements and wait for it to complete
  await checkAchievements(isWin);

  showResults({
    title: "Vs PC Result",
    subtitle: result,
    lines: [
      `${playerName()}: ${score} pts`,
      `PC (${pcDifficulty}): ${pcScore} pts`,
      `Your words: ${usedWords.join(", ") || "-"}`,
      `PC words: ${pcWords.join(", ") || "-"}`
    ]
  });
}

function randomDeltaByPlacement(size, place) {
  if (size === 2) return place === 1 ? 5 : -5;
  if (size === 5) {
    return [10, 5, 0, -5, -10][place - 1] ?? 0;
  }
  if (size === 10) {
    return [10, 8, 6, 4, 2, -2, -4, -6, -8, -10][place - 1] ?? 0;
  }
  return 0;
}

async function updateUserTrophies(delta) {
  if (!currentUser) return;
  const current = currentUser.trophies || 0;
  const next = Math.max(0, current + delta);
  currentUser.trophies = next;
  refreshProfileBadge();

  if (currentUser.id) {
    await fetch("/updateTrophies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, trophies: next })
    });
  }
}

async function finishRandomGame() {
  const botsNeeded = Math.max(1, randomLobbySize - 1);
  const botTarget = Math.max(4, Math.floor(score / 4));

  const botRes = await fetch("/simulateRandomLobby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      letters,
      bots: botsNeeded,
      maxWordsEach: botTarget
    })
  });
  const data = await botRes.json();
  if (!botRes.ok) {
    throw new Error(data?.error || "Could not finish random match.");
  }
  const lobby = [{ nickname: playerName(), score, words: [...usedWords] }, ...(data.players || [])];
  lobby.sort((a, b) => b.score - a.score);

  const myPlace = Math.max(1, lobby.findIndex((p) => p.nickname === playerName()) + 1);
  const delta = randomDeltaByPlacement(randomLobbySize, myPlace);
  await updateUserTrophies(delta);

  // Check achievements and wait for it to complete
  const isWin = myPlace === 1;
  await checkAchievements(isWin);

  const lines = lobby.map((p, idx) => `${idx + 1}. ${p.nickname} - ${p.score} pts - ${p.words.join(", ") || "-"}`);
  lines.unshift(`You finished #${myPlace} (${delta >= 0 ? "+" : ""}${delta} trophies)`);
  lines.unshift(`New rank: ${getRank(currentUser?.trophies || 0)}`);

  showResults({
    title: "Random Match Result",
    subtitle: `Players: ${randomLobbySize}`,
    lines
  });
}

function showRooms() {
  show("rooms");
}

async function createRoom() {
  const res = await fetch("/rooms/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: playerName() })
  });
  const data = await res.json();
  if (!data.code) {
    alert(data.error || "Could not create room.");
    return;
  }

  activeRoomCode = data.code;
  byId("roomStatus").innerText = `Room created: ${data.code}`;
  await pollRoomState();
}

async function joinRoom() {
  const code = byId("roomCode").value.trim().toUpperCase();
  if (!code) return;

  const res = await fetch("/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, nickname: playerName() })
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "Join failed.");
    return;
  }

  activeRoomCode = code;
  byId("roomStatus").innerText = `Joined room: ${code}`;
  await pollRoomState();
}

async function leaveRoom() {
  if (!activeRoomCode) return;
  await fetch(`/rooms/${activeRoomCode}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: playerName() })
  });
  activeRoomCode = null;
  currentRoomState = null;
  clearInterval(roomPollTimer);
  roomPollTimer = null;
  byId("roomStatus").innerText = "Left room.";
}

async function startFriendRoomGame() {
  if (!activeRoomCode) return;
  await fetch(`/rooms/${activeRoomCode}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds: roomDurationSeconds })
  });
  await pollRoomState();
}

async function pollRoomState() {
  if (!activeRoomCode) return;
  clearInterval(roomPollTimer);

  const doPoll = async () => {
    const res = await fetch(`/rooms/${activeRoomCode}`);
    const data = await res.json();
    if (!data.room) {
      activeRoomCode = null;
      byId("roomStatus").innerText = "Room no longer exists.";
      clearInterval(roomPollTimer);
      roomPollTimer = null;
      return;
    }

    currentRoomState = data.room;
    byId("roomPlayers").innerText = `Players: ${data.room.players.map((p) => p.nickname).join(", ")}`;
    byId("roomStatus").innerText = `Room ${activeRoomCode} (${data.room.status})`;

    if (data.room.status === "playing" && gameMode !== "friends") {
      beginFriendGameFromRoom(data.room);
    }
  };

  await doPoll();
  roomPollTimer = setInterval(doPoll, 2000);
}

function beginFriendGameFromRoom(room) {
  gameMode = "friends";
  score = 0;
  usedWords = [];
  timeLeft = room.durationSeconds;
  letters = room.letters;
  renderLetters();
  updateScore();
  byId("wordInput").value = "";
  byId("gameModeTitle").innerText = `Friends Room ${activeRoomCode}`;
  byId("gameOpponentScore").innerText = "Live room game";
  byId("gameOpponentWords").innerText = "";
  show("game");
  startTimer(endGame);
}

async function finishFriendGame() {
  if (!activeRoomCode) {
    show("menu");
    return;
  }

  await fetch(`/rooms/${activeRoomCode}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: playerName() })
  });

  const finalRes = await fetch(`/rooms/${activeRoomCode}/result`);
  const data = await finalRes.json();
  const rows = (data.players || []).sort((a, b) => b.score - a.score);
  const winner = rows[0]?.nickname || "No winner";
  const isWin = winner === playerName();

  // Check achievements and wait for it to complete
  await checkAchievements(isWin);

  const lines = rows.map((p, idx) => `${idx + 1}. ${p.nickname} - ${p.score} pts - ${p.words.join(", ") || "-"}`);

  showResults({
    title: "Friends Match Result",
    subtitle: `Winner: ${winner}`,
    lines
  });

  await fetch(`/rooms/${activeRoomCode}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: playerName() })
  });
  activeRoomCode = null;
  currentRoomState = null;
  clearInterval(roomPollTimer);
  roomPollTimer = null;
}

function showProfile() {
  byId("profileName").innerText = playerName();
  byId("profileRank").innerText = `${getRank(currentUser?.trophies || 0)} (${currentUser?.trophies || 0} trophies)`;
  
  // Display achievements
  const achievementsList = byId("achievements");
  if (achievements.length > 0) {
    achievementsList.innerHTML = achievements.map(a => `<li>🏆 ${a.name}</li>`).join("");
  } else {
    achievementsList.innerHTML = "<li>No achievements yet. Play games to unlock!</li>";
  }
  
  show("profile");
}

async function checkAchievements(isWin) {
  if (!currentUser?.id) {
    // Guest user - skip achievements but continue
    return;
  }

  try {
    const res = await fetch("/achievements/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        isWin
      })
    });
    const data = await res.json();

    if (data.newAchievements && data.newAchievements.length > 0) {
      const achievementNames = data.newAchievements.map(a => a.name).join(", ");
      showAchievementNotification(`🏆 Achievement Unlocked: ${achievementNames}`);
      achievements = data.allAchievements || [];
    }
  } catch (err) {
    console.error("Error checking achievements:", err);
  }
}

function showAchievementNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f4b400, #ffcf2f);
    color: #1d1d22;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
    font-weight: bold;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  notification.innerText = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animations to HTML head
if (!document.querySelector("style[data-achievements]")) {
  const style = document.createElement("style");
  style.setAttribute("data-achievements", "true");
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

function showResults(obj) {
  const lines = obj.lines || [];
  byId("resultBody").innerHTML = lines.map(line => `<p>${line}</p>`).join("");
  
  const resultScreen = byId("result-screen");
  if (resultScreen) {
    const titleEl = resultScreen.querySelector("h2") || document.createElement("h2");
    titleEl.innerText = obj.title || "Result";
    if (!resultScreen.querySelector("h2")) resultScreen.prepend(titleEl);
    
    const subtitleEl = resultScreen.querySelector("h3") || document.createElement("h3");
    subtitleEl.innerText = obj.subtitle || "";
    if (!resultScreen.querySelector("h3")) resultScreen.insertBefore(subtitleEl, byId("resultBody"));
  }
  
  show("result");
}