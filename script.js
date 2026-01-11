const DEFAULT_KEY_BINDINGS = {
    joint1: { decrease: 'Q', increase: 'W' },
    joint2: { decrease: 'A', increase: 'S' },
    joint3: { decrease: 'Z', increase: 'X' },
    joint4: { decrease: 'O', increase: 'P' },
    joint5: { decrease: 'K', increase: 'L' },
    joint6: { decrease: 'N', increase: 'M' }
};

const JOINT_LABELS = {
    joint1: 'Joint 1', joint2: 'Joint 2', joint3: 'Joint 3',
    joint4: 'Joint 4', joint5: 'Joint 5', joint6: 'Joint 6'
};

let keyBindings = loadFromStorage('robotKeyBindings', DEFAULT_KEY_BINDINGS);
let jointValues = { joint1: 0, joint2: 0, joint3: 0, joint4: 0, joint5: 0, joint6: 0 };
let activeKeys = new Set();
let currentBindingTarget = null;
let connectionMode = 'emitter';
let websocket = null;
let isConnected = false;


function loadFromStorage(key, defaultValue) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : { ...defaultValue };
    } catch {
        return { ...defaultValue };
    }
}

function saveToStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}


const elements = {
    jointsGrid: document.getElementById('joints-grid'),
    transmissionLog: document.getElementById('transmission-log'),
    settingsModal: document.getElementById('settings-modal'),
    targetBindingSpan: document.getElementById('target-binding'),
    currentKeyDisplay: document.getElementById('current-key'),
    modeEmitterBtn: document.getElementById('mode-emitter'),
    modeReceptorBtn: document.getElementById('mode-receptor'),
    serverUrlInput: document.getElementById('server-url'),
    channelIdInput: document.getElementById('channel-id'),
    connectBtn: document.getElementById('connect-btn'),
    connectionDot: document.getElementById('connection-dot'),
    connectionStatus: document.getElementById('connection-status')
};


function renderJointCards() {
    elements.jointsGrid.innerHTML = '';

    Object.keys(keyBindings).forEach((jointId, index) => {
        const binding = keyBindings[jointId];
        const value = jointValues[jointId];
        const progressPercent = ((value + 100) / 200) * 100;

        const card = document.createElement('div');
        card.className = 'joint-card';
        card.id = `card-${jointId}`;
        card.innerHTML = `
            <div class="joint-header">
                <div class="joint-name">
                    <span class="joint-number">${index + 1}</span>
                    ${JOINT_LABELS[jointId]}
                </div>
                <div class="joint-value" id="value-${jointId}">${value}</div>
            </div>
            <div class="joint-controls">
                <div class="control-group">
                    <span class="control-label">Decrease</span>
                    <button class="key-btn decrease" id="key-${jointId}-decrease"
                            data-joint="${jointId}" data-action="decrease">
                        <span>${binding.decrease}</span>
                    </button>
                </div>
                <div class="control-group">
                    <span class="control-label">Increase</span>
                    <button class="key-btn increase" id="key-${jointId}-increase"
                            data-joint="${jointId}" data-action="increase">
                        <span>${binding.increase}</span>
                    </button>
                </div>
            </div>
            <div class="joint-progress">
                <div class="progress-fill" id="progress-${jointId}" style="width: ${progressPercent}%"></div>
            </div>
        `;
        elements.jointsGrid.appendChild(card);
    });

    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', openKeyBindingModal);
    });
}

function updateJointDisplay(jointId) {
    const valueElement = document.getElementById(`value-${jointId}`);
    const progressElement = document.getElementById(`progress-${jointId}`);

    if (valueElement) valueElement.textContent = jointValues[jointId];
    if (progressElement) {
        progressElement.style.width = `${((jointValues[jointId] + 100) / 200) * 100}%`;
    }
}


function openKeyBindingModal(event) {
    const { joint, action } = event.currentTarget.dataset;
    currentBindingTarget = { joint, action };

    elements.targetBindingSpan.textContent = `${JOINT_LABELS[joint]} ${action}`;
    elements.currentKeyDisplay.textContent = keyBindings[joint][action];
    elements.settingsModal.classList.add('active');
}

function closeKeyBindingModal() {
    elements.settingsModal.classList.remove('active');
    currentBindingTarget = null;
}

function assignNewKeyBinding(event) {
    if (!currentBindingTarget) return;

    event.preventDefault();
    const newKey = event.key.toUpperCase();

    if (newKey.length !== 1 || !/[A-Z0-9]/.test(newKey)) return;

    const oldKey = keyBindings[currentBindingTarget.joint][currentBindingTarget.action];

    Object.keys(keyBindings).forEach(jointId => {
        if (keyBindings[jointId].decrease === newKey) keyBindings[jointId].decrease = oldKey;
        if (keyBindings[jointId].increase === newKey) keyBindings[jointId].increase = oldKey;
    });

    keyBindings[currentBindingTarget.joint][currentBindingTarget.action] = newKey;
    saveToStorage('robotKeyBindings', keyBindings);
    renderJointCards();
    addLogEntry(`Key updated: ${JOINT_LABELS[currentBindingTarget.joint]} ${currentBindingTarget.action} → ${newKey}`, 'system');
    closeKeyBindingModal();
}

function resetKeyBindings() {
    keyBindings = JSON.parse(JSON.stringify(DEFAULT_KEY_BINDINGS));
    saveToStorage('robotKeyBindings', keyBindings);
    renderJointCards();
    addLogEntry('Key bindings reset to defaults', 'system');
}


function setConnectionMode(mode) {
    connectionMode = mode;
    elements.modeEmitterBtn.classList.toggle('active', mode === 'emitter');
    elements.modeReceptorBtn.classList.toggle('active', mode === 'receptor');
    saveConnectionSettings();
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    elements.connectionDot.className = 'status-dot' + (connected ? ' connected' : '');
    elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
    elements.connectBtn.classList.toggle('connected', connected);
    elements.connectBtn.innerHTML = connected
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg> Disconnect`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Connect`;
}

function saveConnectionSettings() {
    saveToStorage('robotConnectionSettings', {
        serverUrl: elements.serverUrlInput.value,
        channelId: elements.channelIdInput.value,
        mode: connectionMode
    });
}

function loadConnectionSettings() {
    const settings = loadFromStorage('robotConnectionSettings', { serverUrl: '', channelId: 'robot-1', mode: 'emitter' });
    elements.serverUrlInput.value = settings.serverUrl;
    elements.channelIdInput.value = settings.channelId;
    setConnectionMode(settings.mode);
}

function connectToServer() {
    const serverUrl = elements.serverUrlInput.value.trim();
    const channelId = elements.channelIdInput.value.trim() || 'default';

    if (!serverUrl) {
        addLogEntry('Error: Server URL required', 'system');
        return;
    }

    saveConnectionSettings();

    const separator = serverUrl.includes('?') ? '&' : '?';
    const fullUrl = `${serverUrl}${separator}channel=${channelId}&mode=${connectionMode}`;

    websocket = new WebSocket(fullUrl);
    websocket.onopen = () => {
        updateConnectionStatus(true);
        addLogEntry(`Connected as ${connectionMode.toUpperCase()}`, 'network');
    };
    websocket.onclose = () => {
        updateConnectionStatus(false);
        addLogEntry('Disconnected', 'network');
    };
    websocket.onerror = () => addLogEntry('Connection error', 'system');
    websocket.onmessage = (event) => handleIncomingJointUpdate(event.data);
}

function disconnectFromServer() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    updateConnectionStatus(false);
}

function toggleConnection() {
    isConnected ? disconnectFromServer() : connectToServer();
}

function sendJointUpdate(joint, value, action) {
    if (!isConnected || !websocket || connectionMode !== 'emitter') return;

    websocket.send(JSON.stringify({
        type: 'joint_update',
        joint, value, action,
        timestamp: Date.now()
    }));
}

function handleIncomingJointUpdate(data) {
    console.log('Received:', data);

    try {
        const message = JSON.parse(data);
        console.log('Parsed:', message);

        if (message.type !== 'joint_update') return;
        if (connectionMode !== 'receptor') return;

        const { joint, value, action } = message;
        if (!jointValues.hasOwnProperty(joint)) return;

        jointValues[joint] = value;
        updateJointDisplay(joint);
        flashJointCard(joint, action);
        addLogEntry(`<span class="joint-label">${JOINT_LABELS[joint]}</span> ${action} → <span class="value">${value}</span>`, action);
    } catch (e) {
        console.error('Parse error:', e);
    }
}

function flashJointCard(joint, action) {
    const keyBtn = document.getElementById(`key-${joint}-${action}`);
    const card = document.getElementById(`card-${joint}`);

    [keyBtn, card].forEach(el => {
        if (el) {
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 100);
        }
    });
}


function buildKeyMapping() {
    const mapping = {};
    Object.keys(keyBindings).forEach(jointId => {
        mapping[keyBindings[jointId].decrease] = { joint: jointId, action: 'decrease' };
        mapping[keyBindings[jointId].increase] = { joint: jointId, action: 'increase' };
    });
    return mapping;
}

function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT') return;

    if (elements.settingsModal.classList.contains('active')) {
        assignNewKeyBinding(event);
        return;
    }

    if (connectionMode === 'receptor') return;

    const key = event.key.toUpperCase();
    const mapping = buildKeyMapping();

    if (!mapping[key]) return;

    event.preventDefault();
    const { joint, action } = mapping[key];

    if (!activeKeys.has(key)) {
        activeKeys.add(key);
        document.getElementById(`key-${joint}-${action}`)?.classList.add('active');
        document.getElementById(`card-${joint}`)?.classList.add('active');
    }

    const delta = action === 'increase' ? 1 : -1;
    jointValues[joint] = Math.max(-100, Math.min(100, jointValues[joint] + delta));
    updateJointDisplay(joint);
    sendJointUpdate(joint, jointValues[joint], action);

    if (!event.repeat) {
        addLogEntry(`<span class="joint-label">${JOINT_LABELS[joint]}</span> ${action} → <span class="value">${jointValues[joint]}</span>`, action);
    }
}

function handleKeyUp(event) {
    const key = event.key.toUpperCase();
    activeKeys.delete(key);

    const mapping = buildKeyMapping();
    if (!mapping[key]) return;

    const { joint, action } = mapping[key];
    document.getElementById(`key-${joint}-${action}`)?.classList.remove('active');
    document.getElementById(`card-${joint}`)?.classList.remove('active');
}


function addLogEntry(message, type = 'system') {
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

    elements.transmissionLog.appendChild(entry);
    elements.transmissionLog.scrollTop = elements.transmissionLog.scrollHeight;

    while (elements.transmissionLog.children.length > 100) {
        elements.transmissionLog.removeChild(elements.transmissionLog.firstChild);
    }
}

function clearLog() {
    elements.transmissionLog.innerHTML = '';
    addLogEntry('Log cleared', 'system');
}


function initialize() {
    loadConnectionSettings();
    renderJointCards();
    addLogEntry('System ready', 'system');
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.getElementById('close-modal').addEventListener('click', closeKeyBindingModal);
document.getElementById('cancel-binding').addEventListener('click', closeKeyBindingModal);
document.getElementById('reset-bindings').addEventListener('click', resetKeyBindings);
document.getElementById('clear-log').addEventListener('click', clearLog);
elements.modeEmitterBtn.addEventListener('click', () => setConnectionMode('emitter'));
elements.modeReceptorBtn.addEventListener('click', () => setConnectionMode('receptor'));
elements.connectBtn.addEventListener('click', toggleConnection);
elements.settingsModal.addEventListener('click', (e) => { if (e.target === elements.settingsModal) closeKeyBindingModal(); });

initialize();
