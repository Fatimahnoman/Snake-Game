// Game Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;
const INITIAL_FRUIT_COUNT = 4;
const AI_STARTS = [
    { x: 4, y: 4, dir: { x: 1, y: 0 }, color: '#f97316', name: 'AI-1' },
    { x: TILE_COUNT - 5, y: TILE_COUNT - 5, dir: { x: -1, y: 0 }, color: '#38bdf8', name: 'AI-2' }
];

// Game State
let score = 0;
let highScore = Number(localStorage.getItem('snakeHighScore') || 0);
let gameRunning = false;
let gamePaused = false;
let gameSpeed = 120;
let snakes = [];
let fruits = [];

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

initializeGame();

function initializeGame() {
    score = 0;
    gameSpeed = 120;
    gameRunning = false;
    gamePaused = false;
    snakes = [];
    fruits = [];

    snakes.push(createSnake(
        Math.floor(TILE_COUNT / 2),
        Math.floor(TILE_COUNT / 2),
        { x: 1, y: 0 },
        snakeColor,
        'Player',
        true
    ));

    AI_STARTS.forEach((start) => {
        snakes.push(createSnake(start.x, start.y, start.dir, start.color, start.name, false));
    });

    for (let i = 0; i < INITIAL_FRUIT_COUNT; i += 1) {
        fruits.push(generateFruit());
    }

    scoreDisplay.textContent = score;
    highScoreDisplay.textContent = highScore;
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
