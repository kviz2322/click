document.addEventListener('DOMContentLoaded', () => {
    // Состояние приложения
    const state = {
        coins: 0,
        totalCoins: 0,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        energy: 100,
        maxEnergy: 100,
        energyRegenRate: 2, // в секунду
        tapPower: 1,
        autoIncome: 0, // монет в секунду
        totalTaps: 0,
        upgradesPurchased: 0,
        lastSavedTime: Date.now(),
        hapticEnabled: true,
        buffEndTime: 0, // таймер x2 тапа
        lastDailyClaimDate: '',
        dailyStreak: 0,
        upgrades: {
            tapPower: { level: 0, cost: 15 },
            maxEnergy: { level: 0, cost: 25 },
            energyRegen: { level: 0, cost: 50 },
            autoClicker: { level: 0, cost: 100 }
        },
        quests: {
            taps100: { progress: 0, target: 100, claimed: false },
            coins1000: { progress: 0, target: 1000, claimed: false },
            upgrades5: { progress: 0, target: 5, claimed: false }
        }
    };

    // Конфигурация улучшений
    const upgradeConfig = {
        tapPower: {
            name: 'Мощность тапа',
            desc: '+1 к силе нажатия',
            baseCost: 15,
            costMult: 1.5,
            getEffect: (lvl) => `Сила: +${lvl + 1} за тап`,
            apply: (s) => { s.tapPower = 1 + s.upgrades.tapPower.level; }
        },
        maxEnergy: {
            name: 'Ёмкость аккумулятора',
            desc: '+25 к макс. энергии',
            baseCost: 25,
            costMult: 1.4,
            getEffect: (lvl) => `Максимум: ${100 + lvl * 25}`,
            apply: (s) => {
                const oldMax = s.maxEnergy;
                s.maxEnergy = 100 + s.upgrades.maxEnergy.level * 25;
                s.energy += (s.maxEnergy - oldMax);
            }
        },
        energyRegen: {
            name: 'Регенерация энергии',
            desc: '+0.5 энергии в секунду',
            baseCost: 50,
            costMult: 1.6,
            getEffect: (lvl) => `Восстановление: ${(2 + lvl * 0.5).toFixed(1)}/сек`,
            apply: (s) => { s.energyRegenRate = 2 + s.upgrades.energyRegen.level * 0.5; }
        },
        autoClicker: {
            name: 'ИИ-Автотапер',
            desc: '+1 монета в секунду пассивно',
            baseCost: 100,
            costMult: 1.7,
            getEffect: (lvl) => `Доход: +${lvl}/сек`,
            apply: (s) => { s.autoIncome = s.upgrades.autoClicker.level; }
        }
    };

    // Конфигурация заданий
    const questConfig = {
        taps100: {
            name: 'Первые шаги',
            desc: 'Сделайте 100 тапов по ядру',
            reward: 500
        },
        coins1000: {
            name: 'Финансовый поток',
            desc: 'Заработайте суммарно 1000 монет',
            reward: 1000
        },
        upgrades5: {
            name: 'Модернизация',
            desc: 'Приобретите 5 любых улучшений',
            reward: 750
        }
    };

    // Ежедневные награды (7 дней)
    const dailyRewardsConfig = [
        { day: 1, reward: 200, label: 'День 1: 200 монет' },
        { day: 2, reward: 500, label: 'День 2: 500 монет' },
        { day: 3, reward: 1000, label: 'День 3: 1,000 монет' },
        { day: 4, reward: 2000, label: 'День 4: 2,000 монет' },
        { day: 5, reward: 5000, label: 'День 5: 5,000 монет' },
        { day: 6, reward: 10000, label: 'День 6: 10,000 монет' },
        { day: 7, reward: 25000, label: 'День 7: 25,000 монет' }
    ];

    // DOM Элементы
    const balanceEl = document.getElementById('balance-amount');
    const levelBadgeEl = document.getElementById('level-badge');
    const xpFillEl = document.getElementById('xp-fill');
    const xpCurrentEl = document.getElementById('xp-current');
    const xpMaxEl = document.getElementById('xp-max');
    const incomeAmountEl = document.getElementById('income-amount');
    
    const tapCoreEl = document.getElementById('tap-core');
    const effectsContainerEl = document.getElementById('effects-container');
    const dropArenaContainer = document.getElementById('drop-arena-container');
    const energyCurrentEl = document.getElementById('energy-current');
    const energyMaxEl = document.getElementById('energy-max');
    const energyFillEl = document.getElementById('energy-fill');
    const regenRateEl = document.getElementById('regen-rate');

    const upgradesListEl = document.getElementById('upgrades-list');
    const questsListEl = document.getElementById('quests-list');
    const dailyListEl = document.getElementById('daily-list');

    const hapticToggleBtn = document.getElementById('haptic-toggle');
    const dailyModalToggleBtn = document.getElementById('daily-modal-toggle');
    const statsModalToggleBtn = document.getElementById('stats-modal-toggle');

    const offlineModalEl = document.getElementById('offline-modal');
    const offlineTimeEl = document.getElementById('offline-time');
    const offlineEarnedEl = document.getElementById('offline-earned');
    const offlineCloseBtn = document.getElementById('offline-close');

    const dailyModalEl = document.getElementById('daily-modal');
    const dailyCloseBtn = document.getElementById('daily-close');

    const statsModalEl = document.getElementById('stats-modal');
    const statsCloseBtn = document.getElementById('stats-close');
    const statTapsEl = document.getElementById('stat-taps');
    const statCoinsEl = document.getElementById('stat-coins');
    const statUpgradesEl = document.getElementById('stat-upgrades');
    const statLevelEl = document.getElementById('stat-level');

    const buffBadgeEl = document.getElementById('buff-badge');
    const buffTimerEl = document.getElementById('buff-timer');

    // Telegram WebApp инициализация
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) {
            tg.setHeaderColor('#080B14');
        }
    }

    // Тактильный отклик
    function triggerHaptic(type = 'light') {
        if (!state.hapticEnabled) return;
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred(type);
        } else if ('vibrate' in navigator) {
            navigator.vibrate(type === 'heavy' ? 40 : 20);
        }
    }

    // Загрузка сохраненных данных
    function loadGame() {
        const saved = localStorage.getItem('forai_tap_save');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                Object.assign(state, data);
                Object.keys(state.upgrades).forEach(key => {
                    if (upgradeConfig[key] && upgradeConfig[key].apply) {
                        upgradeConfig[key].apply(state);
                    }
                });
            } catch (e) {
                console.error('Ошибка загрузки сохранения:', e);
            }
        }
    }

    // Сохранение данных
    function saveGame() {
        state.lastSavedTime = Date.now();
        localStorage.setItem('forai_tap_save', JSON.stringify(state));
    }

    // Проверка офлайн-дохода
    function checkOfflineEarnings() {
        const now = Date.now();
        const elapsedSec = Math.floor((now - state.lastSavedTime) / 1000);
        const maxOfflineSec = 8 * 3600;
        const activeSec = Math.min(elapsedSec, maxOfflineSec);

        if (activeSec > 30 && state.autoIncome > 0) {
            const earned = Math.floor(activeSec * state.autoIncome);
            if (earned > 0) {
                state.coins += earned;
                state.totalCoins += earned;
                
                const hours = (activeSec / 3600).toFixed(1);
                offlineTimeEl.textContent = `${hours} ч.`;
                offlineEarnedEl.textContent = `+${earned.toLocaleString('ru-RU')}`;
                offlineModalEl.classList.add('active');
            }
        }
    }

    // Проверка повышения уровня
    function addXp(amount) {
        state.xp += amount;
        while (state.xp >= state.xpToNextLevel) {
            state.xp -= state.xpToNextLevel;
            state.level += 1;
            state.xpToNextLevel = Math.floor(state.xpToNextLevel * 1.3);
            triggerHaptic('heavy');
        }
    }

    // Обработка тапа по ядро
    function handleTap(e) {
        if (state.energy < 1) {
            triggerHaptic('heavy');
            return;
        }

        state.energy -= 1;
        const isBuffActive = Date.now() < state.buffEndTime;
        const multiplier = isBuffActive ? 2 : 1;
        const earnedCoins = state.tapPower * multiplier;

        state.coins += earnedCoins;
        state.totalCoins += earnedCoins;
        state.totalTaps += 1;

        addXp(earnedCoins);
        checkQuestsProgress();
        triggerHaptic(isBuffActive ? 'medium' : 'light');

        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || window.innerWidth / 2;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || window.innerHeight / 2;
        showFloatingNumber(clientX, clientY, `+${earnedCoins}`, isBuffActive);

        updateUI();
    }

    // Всплывающие цифры
    function showFloatingNumber(x, y, text, isBuff = false) {
        const el = document.createElement('div');
        el.className = `floating-number ${isBuff ? 'buffed' : ''}`;
        el.textContent = text;
        
        const rect = tapCoreEl.getBoundingClientRect();
        const offsetX = x - rect.left - 30;
        const offsetY = y - rect.top - 20;

        el.style.left = `${Math.max(20, Math.min(rect.width - 40, offsetX))}px`;
        el.style.top = `${Math.max(20, Math.min(rect.height - 40, offsetY))}px`;
        
        effectsContainerEl.appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    // Спавн случайных кибер-дропов
    function spawnCyberDrop() {
        if (document.querySelector('.cyber-drop')) return; // Только один дроп одновременно

        const drop = document.createElement('div');
        drop.className = 'cyber-drop';
        drop.innerHTML = `
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        // Случайные координаты на арене игры
        const arenaRect = dropArenaContainer.getBoundingClientRect();
        const posX = Math.random() * (window.innerWidth - 80) + 20;
        const posY = Math.random() * 200 + 100;

        drop.style.left = `${posX}px`;
        drop.style.top = `${posY}px`;

        drop.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            triggerHaptic('heavy');

            // Награда: либо x2 тап на 10 сек, либо мгновенные монеты
            const isBuffReward = Math.random() > 0.4;
            if (isBuffReward) {
                state.buffEndTime = Date.now() + 10000;
                showFloatingNumber(e.clientX, e.clientY, '⚡ x2 ТАП!', true);
            } else {
                const bonusCoins = Math.max(50, state.tapPower * 50);
                state.coins += bonusCoins;
                state.totalCoins += bonusCoins;
                showFloatingNumber(e.clientX, e.clientY, `+${bonusCoins} 🪙`, true);
            }

            drop.remove();
            updateUI();
        });

        dropArenaContainer.appendChild(drop);

        // Автоисчезновение через 7 секунд
        setTimeout(() => {
            if (drop.parentElement) drop.remove();
        }, 7000);
    }

    // Проверка прогресса заданий
    function checkQuestsProgress() {
        state.quests.taps100.progress = Math.min(state.quests.taps100.target, state.totalTaps);
        state.quests.coins1000.progress = Math.min(state.quests.coins1000.target, state.totalCoins);
        state.quests.upgrades5.progress = Math.min(state.quests.upgrades5.target, state.upgradesPurchased);
    }

    // Покупка улучшений
    window.buyUpgrade = function(key) {
        const upgrade = upgradeConfig[key];
        const currentData = state.upgrades[key];
        const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMult, currentData.level));

        if (state.coins >= cost) {
            state.coins -= cost;
            currentData.level += 1;
            state.upgradesPurchased += 1;
            upgrade.apply(state);
            checkQuestsProgress();
            triggerHaptic('medium');
            updateUI();
            renderUpgrades();
            saveGame();
        }
    };

    // Получение награды за задание
    window.claimQuest = function(key) {
        const quest = state.quests[key];
        const config = questConfig[key];

        if (quest.progress >= quest.target && !quest.claimed) {
            quest.claimed = true;
            state.coins += config.reward;
            state.totalCoins += config.reward;
            triggerHaptic('heavy');
            updateUI();
            renderQuests();
            saveGame();
        }
    };

    // Получение ежедневной награды
    window.claimDaily = function(dayIndex) {
        const todayStr = new Date().toDateString();
        if (state.lastDailyClaimDate === todayStr) return;

        if (dayIndex === state.dailyStreak) {
            const rewardObj = dailyRewardsConfig[dayIndex];
            state.coins += rewardObj.reward;
            state.totalCoins += rewardObj.reward;
            state.dailyStreak = (state.dailyStreak + 1) % dailyRewardsConfig.length;
            state.lastDailyClaimDate = todayStr;

            triggerHaptic('heavy');
            updateUI();
            renderDailyRewards();
            saveGame();
            dailyModalEl.classList.remove('active');
        }
    };

    // Отрисовка улучшений
    function renderUpgrades() {
        upgradesListEl.innerHTML = '';
        Object.keys(upgradeConfig).forEach(key => {
            const config = upgradeConfig[key];
            const data = state.upgrades[key];
            const cost = Math.floor(config.baseCost * Math.pow(config.costMult, data.level));
            const canBuy = state.coins >= cost;

            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="upgrade-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="upgrade-info">
                    <div class="upgrade-title-row">
                        <span class="upgrade-name">${config.name}</span>
                        <span class="upgrade-level">Ур. ${data.level}</span>
                    </div>
                    <span class="upgrade-desc">${config.desc}</span>
                    <span class="upgrade-effect">${config.getEffect(data.level)}</span>
                </div>
                <button class="btn-buy" ${!canBuy ? 'disabled' : ''} onclick="buyUpgrade('${key}')">
                    <span>Купить</span>
                    <span>🪙 ${cost.toLocaleString('ru-RU')}</span>
                </button>
            `;
            upgradesListEl.appendChild(card);
        });
    }

    // Отрисовка заданий
    function renderQuests() {
        questsListEl.innerHTML = '';
        Object.keys(questConfig).forEach(key => {
            const config = questConfig[key];
            const quest = state.quests[key];
            const isCompleted = quest.progress >= quest.target;
            const percent = Math.min(100, Math.floor((quest.progress / quest.target) * 100));

            let btnHtml = '';
            if (quest.claimed) {
                btnHtml = `<button class="btn-claim" disabled>Выполнено</button>`;
            } else if (isCompleted) {
                btnHtml = `<button class="btn-claim" onclick="claimQuest('${key}')">Забрать</button>`;
            } else {
                btnHtml = `<button class="btn-claim" disabled>${quest.progress} / ${quest.target}</button>`;
            }

            const card = document.createElement('div');
            card.className = 'quest-card';
            card.innerHTML = `
                <div class="quest-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                        <path d="M9 11l3 3L22 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="quest-info">
                    <div class="quest-title-row">
                        <span class="quest-name">${config.name}</span>
                        <span class="upgrade-level">+🪙 ${config.reward}</span>
                    </div>
                    <span class="quest-desc">${config.desc}</span>
                    <div class="quest-progress-box">
                        <div class="quest-progress-text">${quest.progress} / ${quest.target}</div>
                        <div class="quest-progress-bar-bg">
                            <div class="quest-progress-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                </div>
                ${btnHtml}
            `;
            questsListEl.appendChild(card);
        });
    }

    // Отрисовка ежедневных бонусов
    function renderDailyRewards() {
        dailyListEl.innerHTML = '';
        const todayStr = new Date().toDateString();
        const alreadyClaimedToday = state.lastDailyClaimDate === todayStr;

        dailyRewardsConfig.forEach((item, index) => {
            const isCurrent = index === state.dailyStreak && !alreadyClaimedToday;
            const isPast = index < state.dailyStreak || (alreadyClaimedToday && index <= state.dailyStreak);

            let btnHtml = '';
            if (isPast && !(isCurrent)) {
                btnHtml = `<button class="btn-daily" disabled>Получено</button>`;
            } else if (isCurrent) {
                btnHtml = `<button class="btn-daily" onclick="claimDaily(${index})">Забрать</button>`;
            } else {
                btnHtml = `<button class="btn-daily" disabled>Скоро</button>`;
            }

            const card = document.createElement('div');
            card.className = `daily-card ${isPast && !isCurrent ? 'claimed' : ''}`;
            card.innerHTML = `
                <div class="daily-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="daily-info">
                    <span class="daily-name">День ${item.day}</span>
                    <span class="daily-desc">+${item.reward.toLocaleString('ru-RU')} монет</span>
                </div>
                ${btnHtml}
            `;
            dailyListEl.appendChild(card);
        });
    }

    // Обновление HUD и элементов интерфейса
    function updateUI() {
        balanceEl.textContent = Math.floor(state.coins).toLocaleString('ru-RU');
        levelBadgeEl.textContent = `Ур. ${state.level}`;
        xpCurrentEl.textContent = state.xp;
        xpMaxEl.textContent = state.xpToNextLevel;
        const xpPercent = Math.min(100, (state.xp / state.xpToNextLevel) * 100);
        xpFillEl.style.width = `${xpPercent}%`;

        incomeAmountEl.textContent = `+${state.autoIncome.toFixed(1)} / сек`;

        energyCurrentEl.textContent = Math.floor(state.energy);
        energyMaxEl.textContent = state.maxEnergy;
        const energyPercent = Math.min(100, (state.energy / state.maxEnergy) * 100);
        energyFillEl.style.width = `${energyPercent}%`;
        regenRateEl.textContent = state.energyRegenRate;

        // Бафф x2
        const timeLeft = Math.ceil((state.buffEndTime - Date.now()) / 1000);
        if (timeLeft > 0) {
            buffBadgeEl.classList.add('visible');
            buffTimerEl.textContent = `${timeLeft}с`;
        } else {
            buffBadgeEl.classList.remove('visible');
        }

        // Статистика
        statTapsEl.textContent = state.totalTaps.toLocaleString('ru-RU');
        statCoinsEl.textContent = Math.floor(state.totalCoins).toLocaleString('ru-RU');
        statUpgradesEl.textContent = state.upgradesPurchased;
        statLevelEl.textContent = state.level;
    }

    // Игровой цикл
    let lastTick = Date.now();
    let dropTimer = 0;

    function gameLoop() {
        const now = Date.now();
        const delta = (now - lastTick) / 1000;
        lastTick = now;

        // Регенерация энергии
        if (state.energy < state.maxEnergy) {
            state.energy = Math.min(state.maxEnergy, state.energy + state.energyRegenRate * delta);
        }

        // Пассивный доход
        if (state.autoIncome > 0) {
            const added = state.autoIncome * delta;
            state.coins += added;
            state.totalCoins += added;
            addXp(added * 0.2);
            checkQuestsProgress();
        }

        // Спавн дропа каждые 45 секунд в среднем
        dropTimer += delta;
        if (dropTimer > 40 && Math.random() < 0.05) {
            dropTimer = 0;
            spawnCyberDrop();
        }

        updateUI();

        if (Math.random() < 0.05) {
            saveGame();
        }
    }

    // Переключение вкладок
    const tabButtons = document.querySelectorAll('.bottom-nav .nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-target');

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.getAttribute('data-tab') === targetTab) {
                    pane.classList.add('active');
                }
            });

            triggerHaptic('light');

            if (targetTab === 'upgrades') renderUpgrades();
            if (targetTab === 'quests') renderQuests();
        });
    });

    // Модальные окна
    hapticToggleBtn.addEventListener('click', () => {
        state.hapticEnabled = !state.hapticEnabled;
        hapticToggleBtn.classList.toggle('active', state.hapticEnabled);
        triggerHaptic('medium');
    });

    dailyModalToggleBtn.addEventListener('click', () => {
        renderDailyRewards();
        dailyModalEl.classList.add('active');
        triggerHaptic('light');
    });

    dailyCloseBtn.addEventListener('click', () => {
        dailyModalEl.classList.remove('active');
    });

    statsModalToggleBtn.addEventListener('click', () => {
        updateUI();
        statsModalEl.classList.add('active');
        triggerHaptic('light');
    });

    statsCloseBtn.addEventListener('click', () => {
        statsModalEl.classList.remove('active');
    });

    offlineCloseBtn.addEventListener('click', () => {
        offlineModalEl.classList.remove('active');
        saveGame();
    });

    // Тап по ядру
    tapCoreEl.addEventListener('pointerdown', (e) => {
        handleTap(e);
    });

    // Инициализация при старте
    loadGame();
    checkOfflineEarnings();
    updateUI();
    renderUpgrades();
    renderQuests();

    // Автоматическое открытие ежедневных наград при первом входе за день
    const todayStr = new Date().toDateString();
    if (state.lastDailyClaimDate !== todayStr) {
        setTimeout(() => {
            renderDailyRewards();
            dailyModalEl.classList.add('active');
        }, 1000);
    }

    // Запуск цикла
    setInterval(gameLoop, 100);

    window.addEventListener('beforeunload', saveGame);
});
