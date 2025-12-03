/**
 * Neon Rocket Escape - Core Game Logic
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.state = 'START'; // START, PLAYING, GAMEOVER
        this.lastTime = 0;
        this.timeSurvived = 0;
        this.score = 0;
        this.difficultyMultiplier = 1;

        // Entities
        this.player = new Player(this);
        this.obstacleManager = new ObstacleManager(this);
        this.powerupManager = new PowerupManager(this);
        this.particleSystem = new ParticleSystem(this);
        this.audioManager = new AudioManager();

        this.shieldActive = false;

        // UI Elements
        this.ui = {
            start: document.getElementById('start-screen'),
            gameOver: document.getElementById('game-over-screen'),
            hud: document.getElementById('hud'),
            time: document.getElementById('timeDisplay'),
            score: document.getElementById('scoreDisplay'),
            best: document.getElementById('bestDisplay'),
            finalTime: document.getElementById('finalTime'),
            finalScore: document.getElementById('finalScore'),
            startBtn: document.getElementById('startBtn'),
            restartBtn: document.getElementById('restartBtn')
        };

        this.bindEvents();
        this.loadBestScore();

        // Start loop
        requestAnimationFrame(t => this.loop(t));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    bindEvents() {
        this.ui.startBtn.addEventListener('click', () => this.start());
        this.ui.restartBtn.addEventListener('click', () => this.start());

        window.addEventListener('keydown', e => this.player.handleInput(e, true));
        window.addEventListener('keyup', e => this.player.handleInput(e, false));
    }

    loadBestScore() {
        const best = localStorage.getItem('neonRocketBestTime') || 0;
        this.ui.best.textContent = parseFloat(best).toFixed(2);
    }

    start() {
        this.state = 'PLAYING';
        this.timeSurvived = 0;
        this.score = 0;
        this.difficultyMultiplier = 1;

        this.player.reset();
        this.obstacleManager.reset();
        this.powerupManager.reset();
        this.particleSystem.reset();
        this.shieldActive = false;

        this.ui.start.classList.add('hidden');
        this.ui.gameOver.classList.add('hidden');
        this.ui.hud.classList.remove('hidden');

        this.audioManager.playMusic();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        this.audioManager.stopMusic();
        this.audioManager.playSound('explosion');

        const best = localStorage.getItem('neonRocketBestTime') || 0;
        if (this.timeSurvived > best) {
            localStorage.setItem('neonRocketBestTime', this.timeSurvived);
            this.ui.best.textContent = this.timeSurvived.toFixed(2);
        }

        this.ui.finalTime.textContent = this.timeSurvived.toFixed(2);
        this.ui.finalScore.textContent = Math.floor(this.score);
        this.ui.gameOver.classList.remove('hidden');
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.state === 'PLAYING') {
            this.update(dt);
        }
        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes

        this.timeSurvived += dt;
        this.difficultyMultiplier = 1 + (this.timeSurvived / 20); // Increases every 20s

        // Update entities
        this.player.update(dt);
        this.obstacleManager.update(dt);
        this.powerupManager.update(dt);
        this.particleSystem.update(dt);

        // Update UI
        this.ui.time.textContent = this.timeSurvived.toFixed(2);
        this.ui.score.textContent = Math.floor(this.score);
    }

    draw() {
        // Clear with trail effect
        this.ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid background
        this.drawGrid();

        this.particleSystem.draw(this.ctx);
        this.powerupManager.draw(this.ctx);
        this.obstacleManager.draw(this.ctx);
        this.player.draw(this.ctx);
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        const offset = (Date.now() / 50) % gridSize;

        this.ctx.beginPath();
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        // Horizontal lines (moving down)
        for (let y = offset; y <= this.canvas.height; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.reset();

        this.keys = {
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
            w: false, s: false, a: false, d: false
        };
    }

    reset() {
        this.x = this.game.canvas.width / 2;
        this.y = this.game.canvas.height / 2;
        this.radius = 15;
        this.speed = 400;
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.92;
        this.color = '#00ff9d';
    }

    handleInput(e, isDown) {
        if (this.keys.hasOwnProperty(e.key)) {
            this.keys[e.key] = isDown;
        }
    }

    update(dt) {
        // Input force
        let dx = 0;
        let dy = 0;

        if (this.keys.ArrowUp || this.keys.w) dy = -1;
        if (this.keys.ArrowDown || this.keys.s) dy = 1;
        if (this.keys.ArrowLeft || this.keys.a) dx = -1;
        if (this.keys.ArrowRight || this.keys.d) dx = 1;

        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        // Apply acceleration
        this.vx += dx * this.speed * dt * 10;
        this.vy += dy * this.speed * dt * 10;

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Boundaries
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
        if (this.x > this.game.canvas.width - this.radius) { this.x = this.game.canvas.width - this.radius; this.vx *= -0.5; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.5; }
        if (this.y > this.game.canvas.height - this.radius) { this.y = this.game.canvas.height - this.radius; this.vy *= -0.5; }

        // Emit particles
        if (Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) {
            this.game.particleSystem.emit(this.x, this.y, -this.vx * 0.5, -this.vy * 0.5, '#00ff9d');
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Rotate towards velocity
        const angle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        ctx.rotate(angle);

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        // Draw Rocket Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, 5);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();

        // Engine flame
        if (Math.random() > 0.5) {
            ctx.fillStyle = '#ff003c';
            ctx.beginPath();
            ctx.moveTo(-5, 10);
            ctx.lineTo(0, 25 + Math.random() * 10);
            ctx.lineTo(5, 10);
            ctx.fill();
        }

        // Draw Shield if active
        if (this.game.shieldActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.2})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
        }

        ctx.restore();
    }
}

class PowerupManager {
    constructor(game) {
        this.game = game;
        this.powerups = [];
        this.spawnTimer = 0;
    }

    reset() {
        this.powerups = [];
        this.spawnTimer = 5; // First powerup after 5s
    }

    update(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawn();
            this.spawnTimer = 10 + Math.random() * 10; // Random 10-20s
        }

        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.update(dt);

            // Collision
            const dist = Math.hypot(p.x - this.game.player.x, p.y - this.game.player.y);
            if (dist < p.radius + this.game.player.radius) {
                this.activatePowerup(p.type);
                this.powerups.splice(i, 1);
            }

            if (p.life <= 0) {
                this.powerups.splice(i, 1);
            }
        }
    }

    spawn() {
        const x = Math.random() * (this.game.canvas.width - 100) + 50;
        const y = Math.random() * (this.game.canvas.height - 100) + 50;
        this.powerups.push(new Powerup(this.game, x, y, 'SHIELD'));
    }

    activatePowerup(type) {
        if (type === 'SHIELD') {
            this.game.shieldActive = true;
            this.game.audioManager.playSound('powerup');
            // Shield lasts 10s or until hit
            setTimeout(() => { this.game.shieldActive = false; }, 10000);
        }
    }

    draw(ctx) {
        this.powerups.forEach(p => p.draw(ctx));
    }
}

class Powerup {
    constructor(game, x, y, type) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 15;
        this.life = 10; // Disappear after 10s if not picked up
        this.pulse = 0;
    }

    update(dt) {
        this.life -= dt;
        this.pulse += dt * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const scale = 1 + Math.sin(this.pulse) * 0.2;
        ctx.scale(scale, scale);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 0);

        ctx.restore();
    }
}

class ObstacleManager {
    constructor(game) {
        this.game = game;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.baseSpawnRate = 1.5; // Seconds
    }

    reset() {
        this.obstacles = [];
        this.spawnTimer = 0;
    }

    update(dt) {
        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawn();
            // Decrease spawn time as difficulty increases, cap at 0.2s
            this.spawnTimer = Math.max(0.2, this.baseSpawnRate / this.game.difficultyMultiplier);
        }

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.update(dt);

            // Check collision
            const dist = Math.hypot(obs.x - this.game.player.x, obs.y - this.game.player.y);
            if (dist < obs.radius + this.game.player.radius) {
                if (this.game.shieldActive) {
                    this.game.shieldActive = false;
                    this.game.particleSystem.emitExplosion(obs.x, obs.y, '#00ffff');
                    this.game.audioManager.playSound('shield_break');
                    this.obstacles.splice(i, 1);
                } else {
                    this.game.gameOver();
                }
            }

            // Remove if off screen
            if (obs.isOffScreen()) {
                this.obstacles.splice(i, 1);
                this.game.score += 10 * Math.floor(this.game.difficultyMultiplier);
            }
        }
    }

    spawn() {
        const type = Math.random();
        let obs;

        // Spawn from edges
        const side = Math.floor(Math.random() * 4); // 0:top, 1:right, 2:bottom, 3:left
        let x, y, vx, vy;
        const speed = 200 * this.game.difficultyMultiplier;
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        switch (side) {
            case 0: x = Math.random() * w; y = -50; vx = (Math.random() - 0.5) * 100; vy = speed; break;
            case 1: x = w + 50; y = Math.random() * h; vx = -speed; vy = (Math.random() - 0.5) * 100; break;
            case 2: x = Math.random() * w; y = h + 50; vx = (Math.random() - 0.5) * 100; vy = -speed; break;
            case 3: x = -50; y = Math.random() * h; vx = speed; vy = (Math.random() - 0.5) * 100; break;
        }

        // Aim slightly towards player for extra challenge
        const angle = Math.atan2(this.game.player.y - y, this.game.player.x - x);
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;

        this.obstacles.push(new Obstacle(this.game, x, y, vx, vy));
    }

    draw(ctx) {
        this.obstacles.forEach(obs => obs.draw(ctx));
    }
}

class Obstacle {
    constructor(game, x, y, vx, vy) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 20 + Math.random() * 20;
        this.color = Math.random() > 0.5 ? '#ff00ff' : '#00f3ff';
        this.rotation = 0;
        this.rotSpeed = (Math.random() - 0.5) * 5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotSpeed * dt;
    }

    isOffScreen() {
        return (this.x < -100 || this.x > this.game.canvas.width + 100 ||
            this.y < -100 || this.y > this.game.canvas.height + 100);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;

        // Draw geometric shape
        ctx.beginPath();
        const sides = 4;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }
}

class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.particles = [];
    }

    reset() {
        this.particles = [];
    }

    emit(x, y, vx, vy, color) {
        this.particles.push({
            x, y, vx: vx + (Math.random() - 0.5) * 50, vy: vy + (Math.random() - 0.5) * 50,
            life: 1.0, color
        });
    }

    emitExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200;
            this.emit(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 2; // Fade out speed

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
}

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.isPlaying = false;
        this.nextNoteTime = 0;
        this.tempo = 130;
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.1;
        this.notes = [110, 110, 110, 110, 130.81, 130.81, 98, 98]; // Bassline
        this.noteIndex = 0;
    }

    playMusic() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    stopMusic() {
        this.isPlaying = false;
    }

    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNote();
        }
        setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat / 2; // 8th notes
        this.noteIndex = (this.noteIndex + 1) % this.notes.length;
    }

    scheduleNote(time) {
        // Bass synth
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = this.notes[this.noteIndex];

        // Lowpass filter for "techno" feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.1);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        // Kick drum (every 4th note)
        if (this.noteIndex % 2 === 0) {
            this.playKick(time);
        }
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSound(type) {
        if (type === 'explosion') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.5);
        }
    }
}

// Start game instance
window.onload = () => {
    const game = new Game();
};
