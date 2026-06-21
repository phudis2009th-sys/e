// ErgoAI Main Application Controller

// App State
let activeTab = 'tab-dashboard';
let isConnected = false;
let connectionType = 'mode-ble'; // mode-ble, mode-serial, mode-wifi, mode-sim
let sessionSeconds = 0;
let isSessionActive = false;
let sessionTimerInterval = null;

// Telemetry state
let spineAngle = 0;
let neckFlex = 10;
let pressureValue = 0;
let sidewaysAngle = 0;

// Device connection objects
let bleDevice = null;
let bleCharacteristic = null;
let serialPort = null;
let serialReader = null;
let webSocket = null;

// Sound Warning context
let audioContext = null;
let warningConsecutiveCount = 0;
const WARNING_THRESHOLD_SECONDS = 5; // Alert if slouching for 5 seconds

// Localization State
let currentLanguage = 'en'; // default language

// DOM elements cache
let elConnectionBadge, elConnectionStatusText, elSessionTime, elPostureStateTag, elAvatarStatusDesc;
let elSpineVal, elSpineFill, elNeckVal, elNeckFill, elPressureVal, elPressureFill;
let elAvatarAlert, elAvatarAlertMsg, elSimToggle, elSimDock;
let elTorsoContour, elArmContour;

document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupTabNavigation();
    setupConnectionSubTabs();
    setupHardwareSimulator();
    setupChatSystem();
    setupFirmwareCopy();
    setupDirectConnectButtons();
    setupLanguageSwitcher();
    
    // Start main system tick loop (1Hz)
    setInterval(systemTick, 1000);
});

// Cache DOM references
function initDOMElements() {
    elConnectionBadge = document.getElementById('connection-badge');
    elConnectionStatusText = document.getElementById('connection-status-text');
    elSessionTime = document.getElementById('session-time');
    elPostureStateTag = document.getElementById('posture-state-tag');
    elAvatarStatusDesc = document.getElementById('avatar-status-desc');
    
    elSpineVal = document.getElementById('gauge-spine-val');
    elSpineFill = document.getElementById('gauge-spine-fill');
    elNeckVal = document.getElementById('gauge-neck-val');
    elNeckFill = document.getElementById('gauge-neck-fill');
    elPressureVal = document.getElementById('gauge-pressure-val');
    elPressureFill = document.getElementById('gauge-pressure-fill');
    
    elAvatarAlert = document.getElementById('avatar-alert');
    elAvatarAlertMsg = document.getElementById('avatar-alert-msg');
    elSimToggle = document.getElementById('sim-toggle');
    elSimDock = document.getElementById('simulator-dock');
    
    elTorsoContour = document.getElementById('torso-contour');
    elArmContour = document.getElementById('arm-contour');
}

// 1. Sidebar tab switching
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Remove active states
            navItems.forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            
            // Set active states
            item.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            activeTab = targetTab;
            updateHeaderTitles();
        });
    });
}

// Update active Tab titles based on current language
function updateHeaderTitles() {
    const headerTitle = document.getElementById('page-title-text');
    const headerSubtitle = document.getElementById('page-subtitle-text');
    
    if (activeTab === 'tab-dashboard') {
        headerTitle.textContent = TRANSLATIONS[currentLanguage]['nav-dashboard'];
        headerSubtitle.textContent = currentLanguage === 'en' 
            ? 'Monitor your back alignment and neck flex values from ESP32 sensors.'
            : 'ตรวจวัดระดับกระดูกสันหลังและการก้มของต้นคอผ่านทางเซนเซอร์ฮาร์ดแวร์ ESP32';
    } else if (activeTab === 'tab-ai-coach') {
        headerTitle.textContent = TRANSLATIONS[currentLanguage]['nav-coach'];
        headerSubtitle.textContent = currentLanguage === 'en'
            ? 'Get real-time ergonomics diagnostics and customized stretch instructions.'
            : 'รับการวิเคราะห์สรีระร่างกายแบบเรียลไทม์พร้อมคำแนะนำกายภาพเฉพาะบุคคล';
    } else if (activeTab === 'tab-analytics') {
        headerTitle.textContent = TRANSLATIONS[currentLanguage]['nav-analytics'];
        headerSubtitle.textContent = currentLanguage === 'en'
            ? 'Analyze sitting posture habits, warning frequencies, and health scores over time.'
            : 'วิเคราะห์พฤติกรรมการนั่ง ความถี่ของสัญญาณเตือน และรายงานคะแนนสุขภาพย้อนหลัง';
    } else if (activeTab === 'tab-firmware') {
        headerTitle.textContent = TRANSLATIONS[currentLanguage]['nav-firmware'];
        headerSubtitle.textContent = currentLanguage === 'en'
            ? 'Schematics, PIN routing configurations, and copyable ESP32 code.'
            : 'แผนภาพการต่อวงจร การกำหนดรหัสพินบนบอร์ด และซอร์สโค้ดพร้อมใช้งาน';
    }
}

// 2. Language Switcher Setup
function setupLanguageSwitcher() {
    const btnEn = document.getElementById('lang-btn-en');
    const btnTh = document.getElementById('lang-btn-th');

    btnEn.addEventListener('click', () => {
        btnEn.classList.add('active');
        btnTh.classList.remove('active');
        setLanguage('en');
    });

    btnTh.addEventListener('click', () => {
        btnTh.classList.add('active');
        btnEn.classList.remove('active');
        setLanguage('th');
    });

    // Apply default English translation
    setLanguage(currentLanguage);
}

// Apply translation keys across the DOM
function setLanguage(lang) {
    currentLanguage = lang;
    
    // Scan all data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        
        // Handle input placeholders, e.g. [placeholder]chat-input-placeholder
        if (key.startsWith('[placeholder]')) {
            const realKey = key.replace('[placeholder]', '');
            if (TRANSLATIONS[lang] && TRANSLATIONS[lang][realKey]) {
                el.setAttribute('placeholder', TRANSLATIONS[lang][realKey]);
            }
            return;
        }
        
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        }
    });

    // Update dynamic header
    updateHeaderTitles();
    
    // Update active connection badge state
    updateConnectionStateLabel();

    // Update chatbot introductory texts
    updateChatbotLabels();

    // Force refresh avatar state text
    const state = classifyPosture(spineAngle, neckFlex, pressureValue, sidewaysAngle);
    animateAvatar(state, spineAngle, neckFlex, sidewaysAngle);

    // Refresh telemetry labels & risks labels
    renderTelemetryUI();
    renderRiskUI();
    updateAnalyticsMetrics();
}

function updateConnectionStateLabel() {
    if (isConnected) {
        if (connectionType === 'mode-sim') {
            updateConnectionUI('online', TRANSLATIONS[currentLanguage]['conn-sim']);
        } else {
            updateConnectionUI('online', TRANSLATIONS[currentLanguage]['conn-online']);
        }
    } else {
        updateConnectionUI('offline', TRANSLATIONS[currentLanguage]['conn-offline']);
    }
}

function updateChatbotLabels() {
    const chatWelcome = document.getElementById('welcome-chat-box');
    if (chatWelcome) {
        chatWelcome.innerHTML = `
            <p>${TRANSLATIONS[currentLanguage]['chat-welcome-bot']}</p>
            <ul>
                <li>"${TRANSLATIONS[currentLanguage]['chat-welcome-opt-1']}"</li>
                <li>"${TRANSLATIONS[currentLanguage]['chat-welcome-opt-2']}"</li>
                <li>"${TRANSLATIONS[currentLanguage]['chat-welcome-opt-3']}"</li>
            </ul>
        `;
    }
}

// Translate posture state strings
function getTranslatedState(state) {
    if (state === POSTURE_EMPTY) return TRANSLATIONS[currentLanguage]['state-empty'];
    if (state === POSTURE_GOOD) return TRANSLATIONS[currentLanguage]['state-good'];
    if (state === POSTURE_SLOUCHED) return TRANSLATIONS[currentLanguage]['state-slouched'];
    if (state === POSTURE_NECK_FORWARD) return TRANSLATIONS[currentLanguage]['state-neck'];
    if (state === POSTURE_LEANING_SIDE) return TRANSLATIONS[currentLanguage]['state-side'];
    return state;
}

// 3. Connection panel sub-tabs switching
function setupConnectionSubTabs() {
    const subTabs = document.querySelectorAll('.sub-tab');
    subTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            subTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.conn-panel').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            connectionType = tab.getAttribute('data-conn');
            
            // Activate panel
            if (connectionType === 'mode-ble') document.getElementById('pane-ble').classList.add('active');
            if (connectionType === 'mode-serial') document.getElementById('pane-serial').classList.add('active');
            if (connectionType === 'mode-wifi') document.getElementById('pane-wifi').classList.add('active');
            if (connectionType === 'mode-sim') document.getElementById('pane-sim').classList.add('active');
        });
    });
}

// 4. Connect buttons routing
function setupDirectConnectButtons() {
    document.getElementById('btn-connect-ble').addEventListener('click', connectBluetoothBLE);
    document.getElementById('btn-connect-serial').addEventListener('click', connectSerialPort);
    
    document.getElementById('btn-connect-wifi').addEventListener('click', () => {
        const ip = document.getElementById('wifi-ip').value.trim();
        connectWebSocket(ip);
    });

    document.getElementById('btn-close-sim-dock').addEventListener('click', () => {
        elSimToggle.checked = false;
        elSimDock.classList.add('hidden');
        isConnected = false;
        updateConnectionStateLabel();
        stopSession();
    });
}

// 5. Connect Web Bluetooth (BLE)
async function connectBluetoothBLE() {
    updateConnectionUI('connecting', TRANSLATIONS[currentLanguage]['conn-connecting']);
    try {
        if (!navigator.bluetooth) {
            throw new Error(currentLanguage === 'en' 
                ? "Web Bluetooth is not supported in this browser. Please use Chrome/Edge or Serial Mode."
                : "เบราว์เซอร์นี้ไม่รองรับระบบ Web Bluetooth กรุณาใช้งานผ่าน Chrome/Edge หรือโหมดสาย USB");
        }
        
        const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
        const charUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
        
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'ErgoAI-ESP32' }],
            optionalServices: [serviceUuid]
        });
        
        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);
        bleCharacteristic = await service.getCharacteristic(charUuid);
        
        await bleCharacteristic.startNotifications();
        bleCharacteristic.addEventListener('characteristicvaluechanged', handleBLENotification);
        
        isConnected = true;
        updateConnectionStateLabel();
        startSession();
        
        bleDevice.addEventListener('gattserverdisconnected', () => {
            isConnected = false;
            updateConnectionStateLabel();
            stopSession();
        });
    } catch (err) {
        console.error(err);
        alert(err.message || "Failed to pair with BLE device");
        updateConnectionStateLabel();
    }
}

function handleBLENotification(event) {
    const value = new TextDecoder().decode(event.target.value);
    parseTelemetryJSON(value);
}

// 6. Connect USB Web Serial
async function connectSerialPort() {
    updateConnectionUI('connecting', TRANSLATIONS[currentLanguage]['conn-connecting']);
    try {
        if (!navigator.serial) {
            throw new Error(currentLanguage === 'en'
                ? "Web Serial is not supported in this browser. Please use Chrome or Edge."
                : "เบราว์เซอร์นี้ไม่รองรับระบบ Web Serial กรุณาใช้งานผ่าน Chrome หรือ Edge");
        }
        
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });
        
        isConnected = true;
        updateConnectionStateLabel();
        startSession();
        
        readSerialStream();
    } catch (err) {
        console.error(err);
        alert(err.message || "Failed to connect to Serial Port");
        updateConnectionStateLabel();
    }
}

async function readSerialStream() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();
    
    let buffer = '';
    try {
        while (isConnected) {
            const { value, done } = await serialReader.read();
            if (done) break;
            
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim().startsWith('{')) {
                    parseTelemetryJSON(line);
                }
            }
        }
    } catch (err) {
        console.error("Serial read error:", err);
    } finally {
        serialReader.releaseLock();
    }
}

// 7. Connect Wi-Fi WebSocket
function connectWebSocket(ip) {
    if (!ip || ip === '192.168.1.') {
        alert(currentLanguage === 'en' ? "Please enter a valid ESP32 IP address." : "กรุณาระบุหมายเลข IP ของ ESP32 ให้ถูกต้อง");
        return;
    }
    
    updateConnectionUI('connecting', TRANSLATIONS[currentLanguage]['conn-connecting']);
    
    try {
        if (webSocket) webSocket.close();
        
        webSocket = new WebSocket(`ws://${ip}/ws`);
        
        webSocket.onopen = () => {
            isConnected = true;
            updateConnectionStateLabel();
            startSession();
        };
        
        webSocket.onmessage = (event) => {
            parseTelemetryJSON(event.data);
        };
        
        webSocket.onclose = () => {
            isConnected = false;
            updateConnectionStateLabel();
            stopSession();
        };
        
        webSocket.onerror = (err) => {
            console.error("WebSocket Error:", err);
            alert("Unable to establish WebSocket connection with " + ip);
            updateConnectionStateLabel();
        };
    } catch (err) {
        alert(err.message);
        updateConnectionStateLabel();
    }
}

// 8. Parse telemetry JSON payload
function parseTelemetryJSON(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        
        if (data.spine !== undefined) spineAngle = Number(data.spine);
        if (data.neck !== undefined) neckFlex = Number(data.neck);
        if (data.pressure !== undefined) pressureValue = Number(data.pressure);
        if (data.side !== undefined) sidewaysAngle = Number(data.side);
        
        renderTelemetryUI();
    } catch (err) {
        console.warn("Failed to parse JSON string:", jsonStr);
    }
}

// Render Telemetry values onto gauges
function renderTelemetryUI() {
    elSpineVal.textContent = `${spineAngle.toFixed(1)}°`;
    const spinePct = Math.min(100, Math.max(0, ((spineAngle + 30) / 75) * 100));
    elSpineFill.style.width = `${spinePct}%`;
    
    elNeckVal.textContent = `${neckFlex.toFixed(1)}%`;
    elNeckFill.style.width = `${Math.min(100, Math.max(0, neckFlex))}%`;
    
    elPressureVal.textContent = `${pressureValue.toFixed(0)}%`;
    elPressureFill.style.width = `${Math.min(100, Math.max(0, pressureValue))}%`;

    const state = classifyPosture(spineAngle, neckFlex, pressureValue, sidewaysAngle);
    if (state === POSTURE_GOOD) {
        elSpineFill.style.background = 'var(--success)';
        elNeckFill.style.background = 'var(--success)';
    } else {
        elSpineFill.style.background = Math.abs(spineAngle) > THRESHOLDS.SLOUCH_ANGLE_MIN ? 'var(--danger)' : 'var(--success)';
        elNeckFill.style.background = neckFlex > THRESHOLDS.NECK_FLEXION_MIN ? 'var(--warning)' : 'var(--success)';
    }
}

function updateConnectionUI(status, label) {
    elConnectionBadge.className = `conn-status-badge ${status}`;
    elConnectionStatusText.textContent = label;
}

// Session Timer Management
function startSession() {
    if (isSessionActive) return;
    isSessionActive = true;
    sessionSeconds = 0;
    sessionTimerInterval = setInterval(() => {
        sessionSeconds++;
        const hrs = String(Math.floor(sessionSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((sessionSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(sessionSeconds % 60).padStart(2, '0');
        elSessionTime.textContent = `${hrs}:${mins}:${secs}`;
        
        const totalMinutes = Math.floor(sessionSeconds / 60);
        document.getElementById('time-monitored-text').textContent = currentLanguage === 'en' 
            ? `Aggregated: ${totalMinutes} mins`
            : `สะสมแล้ว: ${totalMinutes} นาที`;
    }, 1000);
}

function stopSession() {
    isSessionActive = false;
    if (sessionTimerInterval) {
        clearInterval(sessionTimerInterval);
    }
}

// 9. Hardware Simulator Module
function setupHardwareSimulator() {
    elSimToggle.addEventListener('change', () => {
        if (elSimToggle.checked) {
            isConnected = true;
            updateConnectionStateLabel();
            elSimDock.classList.remove('hidden');
            startSession();
        } else {
            isConnected = false;
            updateConnectionStateLabel();
            elSimDock.classList.add('hidden');
            stopSession();
        }
    });

    const simSpine = document.getElementById('sim-spine');
    const simNeck = document.getElementById('sim-neck');
    const simPressure = document.getElementById('sim-pressure');
    const simSideways = document.getElementById('sim-sideways');

    const updateSimValues = () => {
        if (!elSimToggle.checked) return;
        
        spineAngle = Number(simSpine.value);
        neckFlex = Number(simNeck.value);
        pressureValue = Number(simPressure.value);
        sidewaysAngle = Number(simSideways.value);

        document.getElementById('sim-spine-lbl').textContent = `${spineAngle}°`;
        document.getElementById('sim-neck-lbl').textContent = neckFlex;
        document.getElementById('sim-pressure-lbl').textContent = pressureValue;
        document.getElementById('sim-sideways-lbl').textContent = `${sidewaysAngle}°`;

        renderTelemetryUI();
    };

    simSpine.addEventListener('input', updateSimValues);
    simNeck.addEventListener('input', updateSimValues);
    simPressure.addEventListener('input', updateSimValues);
    simSideways.addEventListener('input', updateSimValues);

    const resetPresetsStyle = () => {
        document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
    };

    document.getElementById('preset-empty').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 0;
        simNeck.value = 10;
        simPressure.value = 0;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-good').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 4;
        simNeck.value = 12;
        simPressure.value = 100;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-slouch').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 28;
        simNeck.value = 15;
        simPressure.value = 100;
        simSideways.value = 2;
        updateSimValues();
    });

    document.getElementById('preset-forward').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 6;
        simNeck.value = 52;
        simPressure.value = 100;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-lean').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 3;
        simNeck.value = 14;
        simPressure.value = 85;
        simSideways.value = 18;
        updateSimValues();
    });
}

// 10. Core System Timer Loop running at 1Hz
let chartIntervalCount = 0;

function systemTick() {
    if (!isConnected) return;

    // A. Posture Classification
    const state = classifyPosture(spineAngle, neckFlex, pressureValue, sidewaysAngle);
    
    // B. Increment State durations
    postureDurations[state]++;
    
    // C. Update avatar visual representation
    animateAvatar(state, spineAngle, neckFlex, sidewaysAngle);

    // D. Update long-term syndrome risks accumulation
    updateLongTermRisks(state);
    
    // E. Warning Sound / Visual alert checks
    handleWarningAlerts(state);

    // F. Update analytics scorecards
    updateAnalyticsMetrics();

    // G. Add Chart values at 10-second intervals
    chartIntervalCount++;
    if (chartIntervalCount >= 10) {
        chartIntervalCount = 0;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        // Append data to timeline and donut
        addTimelineData(timeStr, spineAngle, neckFlex);
        updateDonutData(
            postureDurations[POSTURE_GOOD],
            postureDurations[POSTURE_SLOUCHED],
            postureDurations[POSTURE_NECK_FORWARD],
            postureDurations[POSTURE_LEANING_SIDE],
            postureDurations[POSTURE_EMPTY]
        );
    }
}

// Animate/Tilt the SVG Spine path and Head
function animateAvatar(state, spine, neck, side) {
    elPostureStateTag.textContent = getTranslatedState(state);
    
    // Set color based on posture state
    let stateColor = 'var(--text-muted)';
    if (state === POSTURE_GOOD) stateColor = 'var(--success)';
    if (state === POSTURE_SLOUCHED) stateColor = 'var(--danger)';
    if (state === POSTURE_NECK_FORWARD) stateColor = 'var(--warning)';
    if (state === POSTURE_LEANING_SIDE) stateColor = 'var(--info)';

    elPostureStateTag.style.backgroundColor = `${stateColor}15`;
    elPostureStateTag.style.color = stateColor;

    const spinePath = document.getElementById('spine-path');
    const spinePathCore = document.getElementById('spine-path-core');
    const headGroup = document.getElementById('head-group');
    const armPath = document.getElementById('arm-path');
    const eyeDot = document.getElementById('eye-dot');
    
    if (state === POSTURE_EMPTY) {
        spinePath.setAttribute('d', 'M 0,0 Q 0,-40 0,-85 T 0,-130');
        spinePathCore.setAttribute('d', 'M 0,0 Q 0,-40 0,-85 T 0,-130');
        spinePathCore.setAttribute('stroke', '#E2E8F0');
        if (elTorsoContour) elTorsoContour.setAttribute('d', 'M 0,0 Q 0,-40 0,-85 T 0,-130');
        if (elArmContour) elArmContour.setAttribute('d', 'M 0,-100 L 30,-50 L 50,-50');
        headGroup.setAttribute('transform', 'translate(0, -145)');
        elAvatarStatusDesc.textContent = TRANSLATIONS[currentLanguage]['avatar-status-empty'];
        return;
    }

    elAvatarStatusDesc.textContent = TRANSLATIONS[currentLanguage]['avatar-status-sitting'] + getTranslatedState(state);
    spinePathCore.setAttribute('stroke', stateColor);

    const bendX = spine * 1.2;
    const dPath = `M 0,0 Q ${bendX},-45 ${bendX / 2},-90 T ${bendX},-130`;
    spinePath.setAttribute('d', dPath);
    spinePathCore.setAttribute('d', dPath);
    if (elTorsoContour) elTorsoContour.setAttribute('d', dPath);

    const neckBend = (neck > 30) ? (neck - 30) * 0.6 : 0;
    headGroup.setAttribute('transform', `translate(${bendX}, -145) rotate(${neckBend + side})`);
    
    eyeDot.setAttribute('cx', `${10 + neckBend * 0.2}`);
    
    const armDPath = `M 0,-100 L ${30 + bendX * 0.3},-50 L ${50 + bendX * 0.2},-50`;
    armPath.setAttribute('d', armDPath);
    if (elArmContour) elArmContour.setAttribute('d', armDPath);
}

// Visual warning overlay
function handleWarningAlerts(state) {
    if (state !== POSTURE_GOOD && state !== POSTURE_EMPTY) {
        warningConsecutiveCount++;
        
        if (warningConsecutiveCount >= WARNING_THRESHOLD_SECONDS) {
            elAvatarAlert.classList.remove('hidden');
            
            if (state === POSTURE_SLOUCHED) elAvatarAlertMsg.textContent = TRANSLATIONS[currentLanguage]['alert-msg-slouched'];
            if (state === POSTURE_NECK_FORWARD) elAvatarAlertMsg.textContent = TRANSLATIONS[currentLanguage]['alert-msg-neck'];
            if (state === POSTURE_LEANING_SIDE) elAvatarAlertMsg.textContent = TRANSLATIONS[currentLanguage]['alert-msg-side'];
            
            playAlertBeep();
            
            if (warningConsecutiveCount === WARNING_THRESHOLD_SECONDS) {
                totalWarningsCount++;
            }
        }
    } else {
        if (warningConsecutiveCount >= WARNING_THRESHOLD_SECONDS && state === POSTURE_GOOD) {
            activeBreaksCount++;
        }
        warningConsecutiveCount = 0;
        elAvatarAlert.classList.add('hidden');
    }
}

function playAlertBeep() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (sessionSeconds % 5 !== 0) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioContext.currentTime);
        
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        
        osc.start();
        osc.stop(audioContext.currentTime + 0.35);
    } catch (err) {
        console.warn("Audio Context beep blocker:", err);
    }
}

// Compute cumulative statistics
function updateAnalyticsMetrics() {
    const straightSecs = postureDurations[POSTURE_GOOD];
    const badSecs = postureDurations[POSTURE_SLOUCHED] + postureDurations[POSTURE_NECK_FORWARD] + postureDurations[POSTURE_LEANING_SIDE];
    const totalOccupiedSecs = straightSecs + badSecs;
    
    let postureScore = 100;
    if (totalOccupiedSecs > 0) {
        postureScore = Math.round((straightSecs / totalOccupiedSecs) * 100);
    }
    
    document.getElementById('analytic-score').textContent = postureScore;
    
    let qualityText = TRANSLATIONS[currentLanguage]['analytic-sub-pct-excellent'];
    let qualityClass = 'text-success';
    let qualityColor = 'var(--success)';
    
    if (postureScore < 45) {
        qualityText = TRANSLATIONS[currentLanguage]['analytic-sub-pct-critical'];
        qualityClass = 'text-danger';
        qualityColor = 'var(--danger)';
    } else if (postureScore < 75) {
        qualityText = TRANSLATIONS[currentLanguage]['analytic-sub-pct-warning'];
        qualityClass = 'text-warning';
        qualityColor = 'var(--warning)';
    }
    
    const elScorePct = document.getElementById('analytic-score-pct');
    elScorePct.textContent = qualityText;
    elScorePct.className = `metric-sub ${qualityClass}`;
    
    const elScoreBar = document.getElementById('analytic-score-bar');
    elScoreBar.style.width = `${postureScore}%`;
    elScoreBar.style.backgroundColor = qualityColor;

    const straightMinutes = Math.floor(straightSecs / 60);
    const straightSecRemainder = straightSecs % 60;
    document.getElementById('analytic-straight-time').textContent = `${straightMinutes}m ${straightSecRemainder}s`;
    
    const occupiedPct = totalOccupiedSecs > 0 ? Math.round((straightSecs / totalOccupiedSecs) * 100) : 0;
    document.getElementById('analytic-straight-pct').textContent = `${occupiedPct}% ` + TRANSLATIONS[currentLanguage]['analytic-sub-pct-total'];
    document.getElementById('analytic-straight-bar').style.width = `${occupiedPct}%`;

    document.getElementById('analytic-warnings').textContent = totalWarningsCount;
    const warningsRate = totalOccupiedSecs > 0 ? ((totalWarningsCount / (totalOccupiedSecs / 3600))).toFixed(1) : '0.0';
    document.getElementById('analytic-warnings-rate').textContent = `${warningsRate}` + TRANSLATIONS[currentLanguage]['analytic-sub-avg-hour'];
    
    const badPct = totalOccupiedSecs > 0 ? Math.round((badSecs / totalOccupiedSecs) * 100) : 0;
    document.getElementById('analytic-warnings-bar').style.width = `${badPct}%`;

    document.getElementById('analytic-breaks').textContent = activeBreaksCount;
    document.getElementById('analytic-breaks-bar').style.width = `${Math.min(100, activeBreaksCount * 15)}%`;

    updateTodayWeeklyScore(postureScore);
}

// 11. AI Ergonomic Chat System Setup
function setupChatSystem() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send-chat');
    const chatContainer = document.getElementById('chat-messages');

    const handleSendMessage = () => {
        const text = chatInput.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        chatInput.value = '';

        setTimeout(() => {
            const reply = generateAIResponse(text);
            appendChatMessage('bot', reply);
        }, 600);
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    function appendChatMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        const avatar = sender === 'user' ? '👤' : '🤖';
        
        let formattedText = text;
        if (sender === 'bot') {
            formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>')
                .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>');
            
            if (formattedText.includes('<li>')) {
                formattedText = formattedText.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
                formattedText = formattedText.replace(/<\/ul>\s*<ul>/g, '');
            }
        } else {
            formattedText = `<p>${text}</p>`;
        }

        msgDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                ${formattedText}
            </div>
        `;
        
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// 12. Copy firmware snippet
function setupFirmwareCopy() {
    const btn = document.getElementById('btn-copy-code');
    const codeBlock = document.getElementById('firmware-code-block');
    
    btn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeBlock.textContent)
            .then(() => {
                btn.textContent = currentLanguage === 'en' ? "Copied!" : "คัดลอกแล้ว!";
                btn.style.backgroundColor = "var(--success)";
                btn.style.color = "white";
                
                setTimeout(() => {
                    btn.textContent = TRANSLATIONS[currentLanguage]['firmware-code-btn'];
                    btn.style.backgroundColor = "";
                    btn.style.color = "";
                }, 2000);
            })
            .catch(err => {
                console.error("Copy failed:", err);
                alert("Failed to copy firmware text automatically.");
            });
    });
}
