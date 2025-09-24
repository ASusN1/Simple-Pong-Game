// --- Audio setup ---
const beepSound = new Audio("https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa3c1e.mp3"); // Paddle hit
const scoreSound = new Audio("https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa3c1e.mp3"); // Scoring
const wallSound = new Audio("https://cdn.pixabay.com/audio/2022/07/26/audio_11e3b2c6d7.mp3"); // Wall bounce
// Unlock audio context on user gesture
function unlockAudio() {
    beepSound.play().catch(()=>{});
    scoreSound.play().catch(()=>{});
    wallSound.play().catch(()=>{});
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// --- DOM Elements ---
const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const rulesBtn = document.getElementById('rulesBtn');
const highScoreBtn = document.getElementById('highScoreBtn');
const rulesBox = document.getElementById('rulesBox');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const highScoreBox = document.getElementById('highScoreBox');
const closeHighScoreBtn = document.getElementById('closeHighScoreBtn');
const highScoreValue = document.getElementById('highScoreValue');
const gameOverBox = document.getElementById('gameOverBox');
const finalScoreBox = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');

// --- Game constants ---
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 16;
const PLAYER_X = 20;
const AI_X = canvas.width - PADDLE_WIDTH - 20;
let animationId = null;

// --- Game state ---
let playerY, aiY, ballX, ballY, ballSpeedX, ballSpeedY, playerScore, aiScore, highScore;
let gameRunning = false, gameOver = false;

// --- Utility functions ---
function resetPositions() {
    playerY = (canvas.height - PADDLE_HEIGHT) / 2;
    aiY = (canvas.height - PADDLE_HEIGHT) / 2;
    ballX = (canvas.width - BALL_SIZE) / 2;
    ballY = (canvas.height - BALL_SIZE) / 2;
    // Randomize initial ball direction
    ballSpeedX = Math.random() > 0.5 ? 5 : -5;
    ballSpeedY = (Math.random() - 0.5) * 6;
}

function resetGame() {
    playerScore = 0;
    aiScore = 0;
    gameOver = false;
    resetPositions();
}

function drawNet() {
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawNet();
    // Draw player paddle
    ctx.fillStyle = "#fff";
    ctx.fillRect(PLAYER_X, playerY, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Draw AI paddle
    ctx.fillRect(AI_X, aiY, PADDLE_WIDTH, PADDLE_HEIGHT);
    // Draw ball
    ctx.beginPath();
    ctx.arc(ballX + BALL_SIZE / 2, ballY + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    // Draw score
    ctx.font = "32px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(playerScore, canvas.width / 2 - 60, 50);
    ctx.fillText(aiScore, canvas.width / 2 + 30, 50);
    // Draw high score at top
    ctx.font = "18px Arial";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("High Score: " + getHighScore(), canvas.width / 2 - 70, 28);
}

// --- Collision Detection ---
function isColliding(paddleX, paddleY) {
    // Ball vs Paddle (rect-circle collision)
    return (
        ballX < paddleX + PADDLE_WIDTH &&
        ballX + BALL_SIZE > paddleX &&
        ballY < paddleY + PADDLE_HEIGHT &&
        ballY + BALL_SIZE > paddleY
    );
}

function update() {
    // Ball movement
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Wall bounce (top/bottom)
    if (ballY <= 0 || ballY + BALL_SIZE >= canvas.height) {
        ballSpeedY = -ballSpeedY;
        wallSound.currentTime = 0; wallSound.play();
    }

    // Paddle collision
    if (isColliding(PLAYER_X, playerY)) {
        // Calculate hit position
        let collidePoint = (ballY + BALL_SIZE / 2) - (playerY + PADDLE_HEIGHT / 2);
        collidePoint = collidePoint / (PADDLE_HEIGHT / 2);
        let angle = collidePoint * (Math.PI / 4); // Max 45deg deflection
        ballSpeedX = Math.abs(ballSpeedX);
        ballSpeedY = 6 * Math.sin(angle);
        beepSound.currentTime = 0; beepSound.play();
    } else if (isColliding(AI_X, aiY)) {
        let collidePoint = (ballY + BALL_SIZE / 2) - (aiY + PADDLE_HEIGHT / 2);
        collidePoint = collidePoint / (PADDLE_HEIGHT / 2);
        let angle = collidePoint * (Math.PI / 4);
        ballSpeedX = -Math.abs(ballSpeedX);
        ballSpeedY = 6 * Math.sin(angle);
        beepSound.currentTime = 0; beepSound.play();
    }

    // Score update
    if (ballX + BALL_SIZE < 0) {
        // AI scores
        aiScore += 1;
        scoreSound.currentTime = 0; scoreSound.play();
        if (aiScore >= 5) {
            endGame();
            return;
        }
        resetPositions();
    } else if (ballX > canvas.width) {
        // Player scores
        playerScore += 1;
        scoreSound.currentTime = 0; scoreSound.play();
        if (playerScore > getHighScore()) {
            setHighScore(playerScore);
        }
        resetPositions();
    }

    // --- Imperfect AI ---
    // Only track ball if it's moving toward AI and within paddle zone
    // Introduce chance for the AI to "miss" (10% chance per frame)
    // Or, AI sometimes lags behind instead of following ball perfectly
    let aiMissChance = 0.08; // 8% chance per frame to not move
    let aiLag = 16; // AI leaves a "dead zone" of this many pixels

    if (Math.random() > aiMissChance) {
        // If ball is moving toward AI, try to follow it; else don't move
        if (ballSpeedX > 0 && ballX > canvas.width / 2) {
            let target = ballY + BALL_SIZE / 2 - PADDLE_HEIGHT / 2 + (Math.random() - 0.5) * aiLag;
            // Move AI paddle toward the "target" position with limited speed
            if (aiY < target) {
                aiY += 5;
            } else if (aiY > target) {
                aiY -= 5;
            }
        } else {
            // Ball moving away: center paddle slowly
            let center = (canvas.height - PADDLE_HEIGHT) / 2;
            if (aiY < center) aiY += 2;
            if (aiY > center) aiY -= 2;
        }
    }
    // Clamp AI paddle
    aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
}

function gameLoop() {
    if (!gameRunning) return;
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
}

// --- Paddle Control ---
canvas.addEventListener('mousemove', function(evt) {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    playerY = evt.clientY - rect.top - PADDLE_HEIGHT / 2;
    playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
});

// --- High Score System ---
function getHighScore() {
    return parseInt(localStorage.getItem('pongHighScore') || "0", 10);
}
function setHighScore(score) {
    localStorage.setItem('pongHighScore', score);
}

// --- Menu & UI Logic ---
function showMenu() {
    menu.classList.remove('hidden');
    canvas.classList.add('hidden');
    rulesBox.classList.add('hidden');
    highScoreBox.classList.add('hidden');
    gameOverBox.classList.add('hidden');
}
function showGame() {
    menu.classList.add('hidden');
    canvas.classList.remove('hidden');
    rulesBox.classList.add('hidden');
    highScoreBox.classList.add('hidden');
    gameOverBox.classList.add('hidden');
}
function showRules() {
    rulesBox.classList.remove('hidden');
    menu.classList.add('hidden');
    highScoreBox.classList.add('hidden');
    gameOverBox.classList.add('hidden');
    canvas.classList.add('hidden');
}
function showHighScore() {
    highScoreValue.textContent = getHighScore();
    highScoreBox.classList.remove('hidden');
    menu.classList.add('hidden');
    rulesBox.classList.add('hidden');
    gameOverBox.classList.add('hidden');
    canvas.classList.add('hidden');
}
function showGameOver() {
    finalScoreBox.innerHTML = `Your score: <b>${playerScore}</b> <br> Highest: <b>${getHighScore()}</b>`;
    gameOverBox.classList.remove('hidden');
    menu.classList.add('hidden');
    rulesBox.classList.add('hidden');
    highScoreBox.classList.add('hidden');
    canvas.classList.add('hidden');
}

function endGame() {
    gameOver = true;
    gameRunning = false;
    cancelAnimationFrame(animationId);
    showGameOver();
}

// --- Button Events ---
startBtn.onclick = function() {
    unlockAudio(); // Ensure audio context is unlocked on Play
    resetGame();
    showGame();
    gameRunning = true;
    animationId = requestAnimationFrame(gameLoop);
};
rulesBtn.onclick = showRules;
highScoreBtn.onclick = showHighScore;
closeRulesBtn.onclick = showMenu;
closeHighScoreBtn.onclick = showMenu;
restartBtn.onclick = function() {
    resetGame();
    showGame();
    gameRunning = true;
    animationId = requestAnimationFrame(gameLoop);
};
menuBtn.onclick = function() {
    showMenu();
};

// --- Initial UI State ---
showMenu();