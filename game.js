// Game Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const GRID_SIZE = 20;
let TILE_COUNT = 20; // will be recalculated on resize
const INITIAL_FRUIT_COUNT = 4;
const LEVELS = [
    { id: 1, speed: 160, threshold: 0 },
    { id: 2, speed: 130, threshold: 50 },
    { id: 3, speed: 100, threshold: 120 },
    { id: 4, speed: 80, threshold: 220 },
    { id: 5, speed: 60, threshold: 350 }
];

// Game State
let score = 0;
let highScore = Number(localStorage.getItem('snakeHighScore') || 0);
let level = 1;
let gameRunning = false;
let gamePaused = false;
let gameSpeed = LEVELS[0].speed;
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let fruits = [];

// DOM Elements
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const levelDisplay = document.getElementById('level');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const snakeColorInput = document.getElementById('snakeColor');

let snakeColor = snakeColorInput.value;
let snakeHeadColor = lightenColor(snakeColor, 24);

scoreDisplay.textContent = score;
highScoreDisplay.textContent = highScore;
levelDisplay.textContent = level;

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);
snakeColorInput.addEventListener('input', () => {
    snakeColor = snakeColorInput.value;
    snakeHeadColor = lightenColor(snakeColor, 24);
});
document.addEventListener('keydown', handleKeyPress);

// Responsive canvas setup
function resizeCanvas() {
    const parentWidth = canvas.parentElement.clientWidth;
    const size = Math.min(parentWidth - 40, 600);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = size;
    canvas.height = size;
    TILE_COUNT = Math.max(8, Math.floor(size / GRID_SIZE));
}

window.addEventListener('resize', () => {
    const prev = TILE_COUNT;
    resizeCanvas();
    if (TILE_COUNT !== prev) initializeGame(true);
});

resizeCanvas();
initializeGame();

function initializeGame(reinit = false) {
    score = 0;
    level = 1;
    gameSpeed = LEVELS[0].speed;
    gameRunning = false;
    gamePaused = false;
    snake = [];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    fruits = [];

    const startX = Math.floor(TILE_COUNT / 2);
    const startY = Math.floor(TILE_COUNT / 2);
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];

    for (let i = 0; i < INITIAL_FRUIT_COUNT; i += 1) {
        fruits.push(generateFruit());
    }

    scoreDisplay.textContent = score;
    highScoreDisplay.textContent = highScore;
    levelDisplay.textContent = level;
    draw();
}

function startGame() {
    if (!gameRunning) {
        gameRunning = true;
        gamePaused = false;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = 'Pause';
        gameLoop();
    }
}

function togglePause() {
    if (gameRunning) {
        gamePaused = !gamePaused;
        pauseBtn.textContent = gamePaused ? 'Resume' : 'Pause';
        if (!gamePaused) {
            gameLoop();
        }
    }
}

function resetGame() {
    initializeGame();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
}

function handleKeyPress(e) {
    const key = e.key.toLowerCase();

    if (!gameRunning && key !== 'r') return;
    if (key === 'r') {
        resetGame();
        return;
    }

    const arrows = {
        arrowup: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 }
    };

    if (arrows[key]) {
        e.preventDefault();
        const desired = arrows[key];
        if (!(direction.x === -desired.x && direction.y === -desired.y)) {
            nextDirection = desired;
        }
    }
}

let touchStartX = null;
let touchStartY = null;

canvas.addEventListener('touchstart', (e) => {
    if (!(e.touches && e.touches.length === 1)) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) {
        dir = { x: dx > 0 ? 1 : -1, y: 0 };
    } else {
        dir = { x: 0, y: dy > 0 ? 1 : -1 };
    }
    if (!(direction.x === -dir.x && direction.y === -dir.y)) {
        nextDirection = dir;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30;
    if (Math.max(absX, absY) > threshold) {
        let dir;
        if (absX > absY) dir = { x: dx > 0 ? 1 : -1, y: 0 };
        else dir = { x: 0, y: dy > 0 ? 1 : -1 };
        if (!(direction.x === -dir.x && direction.y === -dir.y)) {
            nextDirection = dir;
        }
    }
    touchStartX = null;
    touchStartY = null;
}, false);

function gameLoop() {
    if (!gameRunning || gamePaused) return;

    direction = { ...nextDirection };
    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        endGame('You hit the wall!');
        return;
    }

    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        endGame('You hit yourself!');
        return;
    }

    snake.unshift(head);
    const fruitIndex = fruits.findIndex((fruit) => fruit.x === head.x && fruit.y === head.y);
    const ateFruit = fruitIndex > -1;

    if (ateFruit) {
        fruits.splice(fruitIndex, 1);
        score += 10;
        scoreDisplay.textContent = score;
        spawnFruit();
    } else {
        snake.pop();
    }

    updateLevelByScore();
    draw();
    setTimeout(gameLoop, gameSpeed);
}

function updateLevelByScore() {
    const next = [...LEVELS].reverse().find(l => score >= l.threshold) || LEVELS[0];
    if (next.id !== level) {
        level = next.id;
        gameSpeed = next.speed;
        levelDisplay.textContent = level;
    }
}

function generateFruit() {
    let newFruit;
    const occupied = new Set(snake.map(segment => `${segment.x},${segment.y}`));
    const existingFruit = new Set(fruits.map((fruit) => `${fruit.x},${fruit.y}`));

    do {
        newFruit = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
    } while (occupied.has(`${newFruit.x},${newFruit.y}`) || existingFruit.has(`${newFruit.x},${newFruit.y}`));

    return newFruit;
}

function spawnFruit() {
    fruits.push(generateFruit());
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= TILE_COUNT; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    fruits.forEach((fruit) => {
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(
            fruit.x * GRID_SIZE + GRID_SIZE / 2,
            fruit.y * GRID_SIZE + GRID_SIZE / 2,
            GRID_SIZE / 2 - 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.shadowColor = 'transparent';
    });

    snake.forEach((segment, index) => {
        if (index === 0) {
            ctx.fillStyle = snakeHeadColor;
            ctx.shadowColor = snakeHeadColor;
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = snakeColor;
            ctx.shadowColor = 'transparent';
        }

        ctx.fillRect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );
    });

    if (gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }
}

function endGame(reason) {
    gameRunning = false;
    gamePaused = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreDisplay.textContent = highScore;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '20px Arial';
    ctx.fillText(reason, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 50);
}

function lightenColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(2.55 * percent));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(2.55 * percent));
    const b = Math.min(255, (num & 0xff) + Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
