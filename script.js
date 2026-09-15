const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const grid = 20;
let count = 0;
let score = 0;
let best = localStorage.getItem("snakeBest") || 0;
let lives = 3;
let timer = 0;
let timeInterval = null;
let gameInterval = null;
let running = false;
let paused = false;

// UI Elements
const menu = document.getElementById("menu");
const gameUI = document.getElementById("gameUI");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const timerEl = document.getElementById("timer");
const countdownEl = document.getElementById("countdown");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreEl = document.getElementById("finalScore");
const pauseMenu = document.getElementById("pauseMenu");
const statsScreen = document.getElementById("statsScreen");
const achievementScreen = document.getElementById("achievementScreen");
const statsText = document.getElementById("statsText");
const achievementText = document.getElementById("achievementText");
const mobileControls = document.getElementById("mobileControls");

bestEl.innerText = best;

// Game Objects
let snake = [];
let dx = grid;
let dy = 0;
let nextDx = grid;
let nextDy = 0;

let apple = { x: 0, y: 0, type: 'normal' };
let obstacles = []; // За Maze, Growing Walls и Hard пречки
let portals = [];   // За Portal Mode
let currentMode = "normal";
let currentSkin = "classic";
let currentTheme = "dark";

// Statistics & Achievements Tracking
let stats = JSON.parse(localStorage.getItem("snakeStats")) || {
    gamesPlayed: 0,
    totalScore: 0,
    applesEaten: 0,
    highScore: 0
};

let achievements = JSON.parse(localStorage.getItem("snakeAch")) || {
    neonUnlocked: false,
    fireUnlocked: false,
    goldUnlocked: false,
    ghostUnlocked: false
};

// Start Game Button
document.getElementById("start").addEventListener("click", () => {
    currentMode = document.getElementById("level").value;
    currentSkin = document.getElementById("skin").value;
    currentTheme = document.getElementById("theme").value;

    document.body.className = currentTheme;
    menu.style.display = "none";
    gameUI.style.display = "block";

    startCountdown();
});

function startCountdown() {
    let countNum = 3;
    countdownEl.innerText = countNum;
    let timerId = setInterval(() => {
        countNum--;
        if (countNum > 0) {
            countdownEl.innerText = countNum;
        } else if (countNum === 0) {
            countdownEl.innerText = "GO!";
        } else {
            clearInterval(timerId);
            countdownEl.innerText = "";
            initGame();
        }
    }, 1000);
}

function initGame() {
    snake = [
        { x: 160, y: 160 },
        { x: 140, y: 160 },
        { x: 120, y: 160 }
    ];
    dx = grid;
    dy = 0;
    nextDx = grid;
    nextDy = 0;
    score = 0;
    lives = 3;
    timer = 0;
    scoreEl.innerText = score;
    livesEl.innerText = lives;
    timerEl.innerText = timer;

    obstacles = [];
    portals = [];

    // Подесување според левелот
    if (currentMode === "maze") {
        generateMazeWalls();
    } else if (currentMode === "portal") {
        generatePortals();
    }

    spawnApple();
    running = true;
    paused = false;

    // Прикажи ги мобилните контроли САМО за време на активна игра и само на телефон
    if (window.innerWidth <= 768) {
        mobileControls.style.display = "block";
    }

    if (timeInterval) clearInterval(timeInterval);
    if (gameInterval) clearInterval(gameInterval);

    // Тајмер за секунди
    timeInterval = setInterval(() => {
        if (running && !paused) {
            timer++;
            timerEl.innerText = timer;
            if (currentMode === "time" && timer >= 60) {
                gameOver();
            }
        }
    }, 1000);

    // Главна брзина на играта
    let speed = 100;
    if (currentMode === "easy") speed = 140;
    if (currentMode === "hard") speed = 80;
    if (currentMode === "ice") speed = 110;

    gameInterval = setInterval(gameLoop, speed);

    draw();
}

// Контроли со тастатура и паметно спречување на скролувањето
window.addEventListener('keydown', e => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        // Спречува скролување со стрелките САМО кога играта е активна и не е паузирана
        if (running && !paused) {
            e.preventDefault();
        }
    }

    if (!running) return;

    if (e.key === "p" || e.key === "P") {
        togglePause();
        return;
    }

    if (paused) return;

    if (e.key === "ArrowUp" && dy === 0) { nextDx = 0; nextDy = -grid; }
    else if (e.key === "ArrowDown" && dy === 0) { nextDx = 0; nextDy = grid; }
    else if (e.key === "ArrowLeft" && dx === 0) { nextDx = -grid; nextDy = 0; }
    else if (e.key === "ArrowRight" && dx === 0) { nextDx = grid; nextDy = 0; }
});

function gameLoop() {
    if (!running || paused) return;

    dx = nextDx;
    dy = nextDy;

    let head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Portal Mode Teleportation
    if (currentMode === "portal" && portals.length === 2) {
        if (head.x === portals[0].x && head.y === portals[0].y) {
            head.x = portals[1].x;
            head.y = portals[1].y;
        } else if (head.x === portals[1].x && head.y === portals[1].y) {
            head.x = portals[0].x;
            head.y = portals[0].y;
        }
    }

    // Проверка за граници (Walls collision)
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        handleDeath();
        return;
    }

    // Проверка за судир со сопственото тело или пречки
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            handleDeath();
            return;
        }
    }

    for (let obs of obstacles) {
        if (head.x === obs.x && head.y === obs.y) {
            handleDeath();
            return;
        }
    }

    snake.unshift(head);

    if (head.x === apple.x && head.y === apple.y) {
        score += (apple.type === 'poison' ? 3 : 1);
        scoreEl.innerText = score;
        stats.applesEaten++;

        if (currentMode === "growingWalls") {
            obstacles.push({ x: Math.floor(Math.random() * (canvas.width / grid)) * grid, y: Math.floor(Math.random() * (canvas.height / grid)) * grid });
        }

        spawnApple();
    } else {
        snake.pop();
    }

    draw();
}

function spawnApple() {
    apple.x = Math.floor(Math.random() * (canvas.width / grid)) * grid;
    apple.y = Math.floor(Math.random() * (canvas.height / grid)) * grid;

    if (currentMode === "poison") {
        let rand = Math.random();
        apple.type = rand > 0.7 ? 'poison' : 'normal';
    } else {
        apple.type = 'normal';
    }
}

function generateMazeWalls() {
    for (let i = 4; i < 16; i++) {
        obstacles.push({ x: i * grid, y: 100 });
        obstacles.push({ x: 100, y: i * grid });
    }
}

function generatePortals() {
    portals = [
        { x: 60, y: 60 },
        { x: 320, y: 320 }
    ];
}

function handleDeath() {
    lives--;
    livesEl.innerText = lives;
    if (lives <= 0) {
        gameOver();
    } else {
        snake = [
            { x: 160, y: 160 },
            { x: 140, y: 160 },
            { x: 120, y: 160 }
        ];
        dx = grid;
        dy = 0;
        nextDx = grid;
        nextDy = 0;
    }
}

function gameOver() {
    running = false;
    clearAllTimers();
    gameUI.style.display = "none";
    gameOverScreen.style.display = "block";
    finalScoreEl.innerText = score;

    // СКРИЈ ГИ МОБИЛНИТЕ КОПЧИЊА КОГА ИГРАТА ЌЕ ЗАВРШИ
    mobileControls.style.display = "none";

    stats.gamesPlayed = Number(stats.gamesPlayed) || 0;
    stats.totalScore = Number(stats.totalScore) || 0;
    stats.applesEaten = Number(stats.applesEaten) || 0;
    stats.highScore = Number(stats.highScore) || 0;

    stats.gamesPlayed += 1;
    stats.totalScore += Number(score) || 0;
    stats.applesEaten += Number(snake.length - 3) || 0;

    if (score > stats.highScore) {
        stats.highScore = Number(score);
        best = Number(score);
        bestEl.innerText = best;
        localStorage.setItem("snakeBest", best);
    }

    localStorage.setItem("snakeStats", JSON.stringify(stats));
}

function clearAllTimers() {
    if (timeInterval) clearInterval(timeInterval);
    if (gameInterval) clearInterval(gameInterval);
}

function draw() {
    if (currentTheme === "retro") {
        ctx.fillStyle = "#8bac0f";
    } else if (currentTheme === "neon") {
        ctx.fillStyle = "#05000d";
    } else {
        ctx.fillStyle = "#111118";
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff5555";
    obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, grid - 2, grid - 2);
    });

    if (currentMode === "portal") {
        ctx.fillStyle = "#9370DB";
        portals.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x + grid/2, p.y + grid/2, grid/2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.fillStyle = apple.type === 'poison' ? '#ff00ff' : '#ff3333';
    ctx.fillRect(apple.x, apple.y, grid - 2, grid - 2);

    snake.forEach((part, index) => {
        if (currentSkin === "neon") {
            ctx.fillStyle = index === 0 ? "#00ffff" : "#008b8b";
        } else if (currentSkin === "fire") {
            ctx.fillStyle = index === 0 ? "#ff4500" : "#ff8c00";
        } else if (currentSkin === "gold") {
            ctx.fillStyle = index === 0 ? "#ffd700" : "#daa520";
        } else if (currentSkin === "ghost") {
            ctx.fillStyle = index === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
        } else {
            ctx.fillStyle = index === 0 ? "#00f2fe" : "#4facfe";
        }
        ctx.fillRect(part.x, part.y, grid - 2, grid - 2);
    });
}

// Pause Menu Logic
function togglePause() {
    paused = !paused;
    if (paused) {
        pauseMenu.style.display = "block";
    } else {
        pauseMenu.style.display = "none";
    }
}

document.getElementById("pauseBtn").onclick = togglePause;
document.getElementById("resumeBtn").onclick = () => {
    paused = false;
    pauseMenu.style.display = "none";
};

document.getElementById("exitPauseBtn").onclick = () => {
    paused = false;
    running = false;
    clearAllTimers();
    pauseMenu.style.display = "none";
    gameUI.style.display = "none";
    menu.style.display = "block";

    // Скриј ги мобилните копчиња при излез во мени
    mobileControls.style.display = "none";
};

// Restart / Menu from Game Over
document.getElementById("restartGameBtn").onclick = () => {
    gameOverScreen.style.display = "none";
    gameUI.style.display = "block";
    startCountdown();
};

document.getElementById("menuBtn").onclick = () => {
    gameOverScreen.style.display = "none";
    menu.style.display = "block";
    mobileControls.style.display = "none";
};

document.getElementById("restart").onclick = () => {
    clearAllTimers();
    startCountdown();
};

// Statistics & Achievements Modals
document.getElementById("statsBtn").onclick = () => {
    let gPlayed = stats.gamesPlayed !== undefined ? stats.gamesPlayed : 0;
    let hScore = stats.highScore !== undefined ? stats.highScore : 0;
    let aEaten = stats.applesEaten !== undefined ? stats.applesEaten : 0;
    let tScore = stats.totalScore !== undefined ? stats.totalScore : 0;

    statsText.innerHTML = `
        <div><b>Вкупно игри:</b> ${gPlayed}</div>
        <div><b>Најдобар резултат:</b> ${hScore}</div>
        <div><b>Вкупно изедени јаболка:</b> ${aEaten}</div>
        <div><b>Вкупно поени освоени:</b> ${tScore}</div>
    `;
    statsScreen.style.display = "block";
};

document.getElementById("closeStats").onclick = () => {
    statsScreen.style.display = "none";
};

document.getElementById("achBtn").onclick = () => {
    achievementText.innerHTML = `
        <div><b>Neon Skin:</b> ${achievements.neonUnlocked ? '✅ Отклучено' : '❌ Заклучено (Рекорд 100)'}</div>
        <div><b>Fire Skin:</b> ${achievements.fireUnlocked ? '✅ Отклучено' : '❌ Заклучено (Ииграј Hard)'}</div>
        <div><b>Golden Skin:</b> ${achievements.goldUnlocked ? '✅ Отклучено' : '❌ Заклучено (Рекорд 500)'}</div>
        <div><b>Ghost Skin:</b> ${achievements.ghostUnlocked ? '✅ Отклучено' : '❌ Заклучено (Ииграј Survival)'}</div>
    `;
    achievementScreen.style.display = "block";
};

document.getElementById("closeAch").onclick = () => {
    achievementScreen.style.display = "none";
};

// Мобилни контроли на допир (Touch / Click)
const handleDirection = (newDx, newDy) => {
    if (running && !paused) {
        if ((newDx !== 0 && dx === 0) || (newDy !== 0 && dy === 0)) {
            nextDx = newDx;
            nextDy = newDy;
        }
    }
};

document.getElementById("up").addEventListener("touchstart", (e) => { e.preventDefault(); handleDirection(0, -grid); });
document.getElementById("down").addEventListener("touchstart", (e) => { e.preventDefault(); handleDirection(0, grid); });
document.getElementById("left").addEventListener("touchstart", (e) => { e.preventDefault(); handleDirection(-grid, 0); });
document.getElementById("right").addEventListener("touchstart", (e) => { e.preventDefault(); handleDirection(grid, 0); });

document.getElementById("up").onclick = () => handleDirection(0, -grid);
document.getElementById("down").onclick = () => handleDirection(0, grid);
document.getElementById("left").onclick = () => handleDirection(-grid, 0);
document.getElementById("right").onclick = () => handleDirection(grid, 0);