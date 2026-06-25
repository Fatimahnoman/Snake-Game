// Game Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const GRID_SIZE = 20;
let TILE_COUNT = 20; // will be recalculated on resize
const INITIAL_FRUIT_COUNT = 4;
let AI_STARTS = [];

// Game State
let score = 0;
let highScore = Number(localStorage.getItem('snakeHighScore') || 0);
let gameRunning = false;
let gamePaused = false;
let gameSpeed = 120;
let snakes = [];
let fruits = [];
let level = 1;
const LEVELS = [
    { id: 1, speed: 160, threshold: 0 },
    { id: 2, speed: 130, threshold: 50 },
    { id: 3, speed: 100, threshold: 120 },
    { id: 4, speed: 80, threshold: 220 },
    { id: 5, speed: 60, threshold: 350 }
];

// DOM Elements
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const enemyCountDisplay = document.getElementById('enemyCount');
const enemyList = document.getElementById('enemyList');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const snakeColorInput = document.getElementById('snakeColor');

let snakeColor = snakeColorInput.value;
let snakeHeadColor = lightenColor(snakeColor, 24);

const levelDisplay = document.getElementById('level');

highScoreDisplay.textContent = highScore;
scoreDisplay.textContent = score;

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);
snakeColorInput.addEventListener('input', () => {
    snakeColor = snakeColorInput.value;
    snakeHeadColor = lightenColor(snakeColor, 24);
    const playerSnake = getPlayerSnake();
    if (playerSnake) {
        playerSnake.color = snakeColor;
        playerSnake.headColor = snakeHeadColor;
    }
});
document.addEventListener('keydown', handleKeyPress);

// Responsive canvas setup
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const parentWidth = canvas.parentElement.clientWidth;
    // Keep canvas square and fit within parent with some padding
    const size = Math.min(parentWidth - 40, 600);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    // Reset transform so we draw in logical pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TILE_COUNT = Math.max(8, Math.floor(size / GRID_SIZE));
}

window.addEventListener('resize', () => {
    const prev = TILE_COUNT;
    resizeCanvas();
    // If grid size changed, reinitialize positions so AIs spawn correctly
    if (TILE_COUNT !== prev) initializeGame(true);
});

resizeCanvas();

initializeGame();

function initializeGame(reinit = false) {
    score = 0;
    gameSpeed = 120;
    level = 1;
    gameRunning = false;
    gamePaused = false;
    snakes = [];
    fruits = [];

    // Ensure AI start positions are based on current TILE_COUNT
    AI_STARTS = [
        { x: 4, y: 4, dir: { x: 1, y: 0 }, color: '#f97316', name: 'AI-1' },
        { x: Math.max(6, TILE_COUNT - 5), y: Math.max(6, TILE_COUNT - 5), dir: { x: -1, y: 0 }, color: '#38bdf8', name: 'AI-2' }
    ];

    snakes.push(createSnake(Math.floor(TILE_COUNT / 2), Math.floor(TILE_COUNT / 2), { x: 1, y: 0 }, snakeColor, 'Player', true));

    AI_STARTS.forEach((start) => {
        snakes.push(createSnake(start.x, start.y, start.dir, start.color, start.name, false));
    });

    for (let i = 0; i < INITIAL_FRUIT_COUNT; i += 1) {
        fruits.push(generateFruit());
    }

    scoreDisplay.textContent = score;
    highScoreDisplay.textContent = highScore;
    levelDisplay.textContent = level;
    updateEnemyInfo();
    draw();
}

function createSnake(x, y, direction, color, name, isPlayer) {
    const body = [{ x, y }];
    for (let i = 1; i < 3; i += 1) {
        body.push({ x: x - direction.x * i, y: y - direction.y * i });
    }

    return {
        id: name,
        body,
        direction: { ...direction },
        nextDirection: { ...direction },
        color,
        headColor: lightenColor(color, 24),
        alive: true,
        isPlayer,
        name
    };
}

function getPlayerSnake() {
    return snakes.find((snake) => snake.isPlayer);
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

    const playerSnake = getPlayerSnake();
    if (!playerSnake || !playerSnake.alive) return;

    if (arrows[key]) {
        e.preventDefault();
        const desired = arrows[key];
        if (!(playerSnake.direction.x === -desired.x && playerSnake.direction.y === -desired.y)) {
            playerSnake.nextDirection = desired;
        }
    }
}

// Touch / swipe support
const touchControls = document.getElementById('touchControls');
const touchButtons = document.querySelectorAll('.touch-btn');
let touchStartX = null;
let touchStartY = null;

touchButtons.forEach((btn) => {
    const parts = btn.dataset.dir.split(',');
    const dir = { x: Number(parts[0]), y: Number(parts[1]) };
    const applyDir = () => {
        const player = getPlayerSnake();
        if (!player || !player.alive) return;
        if (!(player.direction.x === -dir.x && player.direction.y === -dir.y)) {
            player.nextDirection = dir;
        }
    };
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); applyDir(); }, { passive: false });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); applyDir(); });
});

canvas.addEventListener('touchstart', (e) => {
    if (!(e.touches && e.touches.length === 1)) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Immediate tap-to-direction based on canvas center
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
    const player = getPlayerSnake();
    if (player && player.alive) {
        if (!(player.direction.x === -dir.x && player.direction.y === -dir.y)) {
            player.nextDirection = dir;
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30; // px
    if (Math.max(absX, absY) > threshold) {
        let dir;
        if (absX > absY) dir = { x: dx > 0 ? 1 : -1, y: 0 };
        else dir = { x: 0, y: dy > 0 ? 1 : -1 };
        const player = getPlayerSnake();
        if (player && player.alive) {
            if (!(player.direction.x === -dir.x && player.direction.y === -dir.y)) player.nextDirection = dir;
        }
    }
    touchStartX = null; touchStartY = null;
}, false);

function gameLoop() {
    if (!gameRunning || gamePaused) return;

    moveSnakes();
    processFruits();
    resolveCollisions();
    updateEnemyInfo();
    draw();

    if (gameRunning) {
        setTimeout(gameLoop, gameSpeed);
    }
}

function moveSnakes() {
    snakes.forEach((snake) => {
        if (!snake.alive) return;

        if (!snake.isPlayer) {
            const nextDir = chooseAiDirection(snake);
            if (nextDir) {
                snake.nextDirection = nextDir;
            }
        }

        snake.direction = { ...snake.nextDirection };
        const nextHead = {
            x: snake.body[0].x + snake.direction.x,
            y: snake.body[0].y + snake.direction.y
        };
        snake.body.unshift(nextHead);
        snake.grew = false;
    });
}

function processFruits() {
    snakes.forEach((snake) => {
        if (!snake.alive) return;

        const head = snake.body[0];
        const fruitIndex = fruits.findIndex((fruit) => fruit.x === head.x && fruit.y === head.y);

        if (fruitIndex > -1) {
            fruits.splice(fruitIndex, 1);
            snake.grew = true;
            if (snake.isPlayer) {
                score += 10;
                scoreDisplay.textContent = score;
            }
            spawnFruit();
        }

        if (!snake.grew) {
            snake.body.pop();
        }
    });

    gameSpeed = Math.max(60, 120 - Math.floor(score / 5));
    updateLevelByScore();
}

function updateLevelByScore() {
    const next = [...LEVELS].reverse().find(l => score >= l.threshold) || LEVELS[0];
    if (next.id !== level) {
        level = next.id;
        gameSpeed = next.speed;
        levelDisplay.textContent = level;
    }
}

function resolveCollisions() {
    const positionCounts = new Map();
    const headCounts = new Map();

    snakes.forEach((snake) => {
        if (!snake.alive) return;
        snake.body.forEach((segment) => {
            const key = `${segment.x},${segment.y}`;
            positionCounts.set(key, (positionCounts.get(key) || 0) + 1);
        });
        const headKey = `${snake.body[0].x},${snake.body[0].y}`;
        headCounts.set(headKey, (headCounts.get(headKey) || 0) + 1);
    });

    const toDie = [];

    snakes.forEach((snake) => {
        if (!snake.alive) return;
        const head = snake.body[0];
        const headKey = `${head.x},${head.y}`;

        if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
            toDie.push(snake);
            return;
        }

        if (positionCounts.get(headKey) > 1 || headCounts.get(headKey) > 1) {
            toDie.push(snake);
        }
    });

    toDie.forEach((snake) => killSnake(snake));
}

function killSnake(snake) {
    if (!snake.alive) return;
    snake.alive = false;
    convertSnakeBodyToFruit(snake.body);

    if (snake.isPlayer) {
        endGame('You were defeated in battle.');
    }
}

function convertSnakeBodyToFruit(body) {
    const occupied = getOccupiedSet();

    body.forEach((segment) => {
        const key = `${segment.x},${segment.y}`;
        if (occupied.has(key) || fruits.some((fruit) => fruit.x === segment.x && fruit.y === segment.y)) {
            return;
        }
        fruits.push({ x: segment.x, y: segment.y });
    });
}

function getOccupiedSet() {
    const occupied = new Set();
    snakes.forEach((snake) => {
        if (!snake.alive) return;
        snake.body.forEach((segment) => {
            occupied.add(`${segment.x},${segment.y}`);
        });
    });
    return occupied;
}

function chooseAiDirection(snake) {
    const options = [
        snake.direction,
        ...getTurnOptions(snake.direction)
    ];

    const safeOptions = options.filter((direction) => !wouldCollide(snake, direction));
    if (safeOptions.length === 0) {
        return null;
    }

    const target = findClosestFruit(snake.body[0]);
    if (target) {
        const chasing = safeOptions.filter((direction) => {
            const next = {
                x: snake.body[0].x + direction.x,
                y: snake.body[0].y + direction.y
            };
            return distance(next, target) < distance(snake.body[0], target);
        });

        if (chasing.length) {
            return randomChoice(chasing);
        }
    }

    return randomChoice(safeOptions);
}

function getTurnOptions(direction) {
    if (direction.x !== 0) {
        return [
            { x: 0, y: -1 },
            { x: 0, y: 1 }
        ];
    }

    return [
        { x: -1, y: 0 },
        { x: 1, y: 0 }
    ];
}

function wouldCollide(snake, direction) {
    const nextX = snake.body[0].x + direction.x;
    const nextY = snake.body[0].y + direction.y;

    if (nextX < 0 || nextX >= TILE_COUNT || nextY < 0 || nextY >= TILE_COUNT) {
        return true;
    }

    const occupied = getOccupiedSet();
    const tail = snake.body[snake.body.length - 1];
    const tailKey = `${tail.x},${tail.y}`;
    const nextKey = `${nextX},${nextY}`;

    if (!snake.grew) {
        occupied.delete(tailKey);
    }

    return occupied.has(nextKey);
}

function findClosestFruit(position) {
    if (fruits.length === 0) return null;
    return fruits.reduce((closest, fruit) => {
        return distance(position, fruit) < distance(position, closest) ? fruit : closest;
    }, fruits[0]);
}

function distance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function spawnFruit() {
    fruits.push(generateFruit());
}

function generateFruit() {
    let newFruit;
    const occupied = getOccupiedSet();
    const existingFruit = new Set(fruits.map((fruit) => `${fruit.x},${fruit.y}`));

    do {
        newFruit = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
    } while (occupied.has(`${newFruit.x},${newFruit.y}`) || existingFruit.has(`${newFruit.x},${newFruit.y}`));

    return newFruit;
}

function updateEnemyInfo() {
    const enemies = snakes.filter((snake) => !snake.isPlayer);
    const alive = enemies.filter((snake) => snake.alive).length;

    enemyCountDisplay.textContent = alive;
    enemyList.innerHTML = enemies
        .map(
            (snake) =>
                `<div class="enemy-item"><span class="enemy-color" style="background:${snake.color}"></span>${snake.name}: ${snake.alive ? 'Alive' : 'Dead'}</div>`
        )
        .join('');
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

    snakes.forEach((snake) => {
        if (!snake.alive) return;

        snake.body.forEach((segment, index) => {
            if (index === 0) {
                ctx.fillStyle = snake.headColor;
                ctx.shadowColor = snake.headColor;
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = snake.color;
                ctx.shadowColor = 'transparent';
            }

            ctx.fillRect(
                segment.x * GRID_SIZE + 1,
                segment.y * GRID_SIZE + 1,
                GRID_SIZE - 2,
                GRID_SIZE - 2
            );
        });
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
