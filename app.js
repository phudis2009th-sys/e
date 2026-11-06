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

// ESP32-CAM and Camera stream state
let isCamStreamActive = false;
let cameraMode = 'mode-browser-ai'; // mode-esp32cam, mode-webcam, mode-browser-ai, mode-python-ai
let isCamConnected = false;
let cameraDrivesConnection = false; // true when Browser AI Camera itself is what flipped `isConnected` on
let webcamStream = null;
let hudAnimationId = null;

// Posture state debouncing (2-second processing window)
// Lowered from 4s -> 2s: 4s was making the dashboard feel slow to notice slouching.
// Still long enough to avoid flicker from a single noisy frame.
let confirmedPostureState = 'Empty Chair'; // maps to POSTURE_EMPTY
let pendingPostureState = 'Empty Chair';
let postureChangeTimer = 0; // ticks (seconds) remaining to confirm change
const STABILIZATION_TIME_SECONDS = 2;

// DOM elements cache
let elConnectionBadge, elConnectionStatusText, elSessionTime, elPostureStateTag, elAvatarStatusDesc;
let elSpineVal, elSpineFill, elNeckVal, elNeckFill, elSlouchCountVal;
let elAvatarAlert, elAvatarAlertMsg, elSimToggle, elSimDock;
let elTorsoContour, elArmContour;

// Camera DOM elements cache
let elCamToggle, elCameraCard, elCamSourceSelect, elCamUrlContainer, elCamStreamUrl;
let elBtnConnectCam, elWebcamFeed, elEsp32camFeed, elCameraPlaceholder, elHudCanvas, elHudToggle, elCameraStatusTag;
let elConnModeSelect;

// Landing page and mobile responsive elements cache
let elLandingPage, elAppLayout, elBtnEnterDashboard, elMobileMenuBtn, elSidebarOverlay, elSidebar;
let elQuizPage, elQuizFormView, elQuizResultView, elBtnQuizSubmit, elBtnQuizRetake, elBtnQuizContinue;
let elLandingLangEn, elLandingLangTh;

document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupTabNavigation();
    setupConnectionSelect();
    setupHardwareSimulator();
    setupCameraSystem();
    setupChatSystem();
    setupDirectConnectButtons();
    setupLanguageSwitcher();
    setupLandingAndMobile();
    setupOfficeSyndromeQuiz();
    
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
    elSlouchCountVal = document.getElementById('gauge-slouch-val');
    
    elAvatarAlert = document.getElementById('avatar-alert');
    elAvatarAlertMsg = document.getElementById('avatar-alert-msg');
    elSimToggle = document.getElementById('sim-toggle');
    elSimDock = document.getElementById('simulator-dock');
    
    elTorsoContour = document.getElementById('torso-contour');
    elArmContour = document.getElementById('arm-contour');
    
    // New Camera & connection caches
    elCamToggle = document.getElementById('cam-toggle');
    elCameraCard = document.getElementById('camera-card');
    elCamSourceSelect = document.getElementById('cam-source-select');
    elCamUrlContainer = document.getElementById('cam-url-container');
    elCamStreamUrl = document.getElementById('cam-stream-url');
    elBtnConnectCam = document.getElementById('btn-connect-cam');
    elWebcamFeed = document.getElementById('webcam-feed');
    elEsp32camFeed = document.getElementById('esp32cam-feed');
    elCameraPlaceholder = document.getElementById('camera-placeholder');
    elHudCanvas = document.getElementById('hud-canvas');
    elHudToggle = document.getElementById('hud-toggle');
    elCameraStatusTag = document.getElementById('camera-status-tag');
    elConnModeSelect = document.getElementById('conn-mode-select');

    // New Landing Page & Mobile responsive caches
    elLandingPage = document.getElementById('landing-page');
    elAppLayout = document.getElementById('app-layout');
    elBtnEnterDashboard = document.getElementById('btn-enter-dashboard');
    elMobileMenuBtn = document.getElementById('mobile-menu-btn');
    elSidebarOverlay = document.getElementById('sidebar-overlay');
    elSidebar = document.querySelector('.sidebar');
    elLandingLangEn = document.getElementById('landing-lang-btn-en');
    elLandingLangTh = document.getElementById('landing-lang-btn-th');

    // Office Syndrome quiz caches
    elQuizPage = document.getElementById('quiz-page');
    elQuizFormView = document.getElementById('quiz-form-view');
    elQuizResultView = document.getElementById('quiz-result-view');
    elBtnQuizSubmit = document.getElementById('btn-quiz-submit');
    elBtnQuizRetake = document.getElementById('btn-quiz-retake');
    elBtnQuizContinue = document.getElementById('btn-quiz-continue');
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

            // Collapse mobile sidebar drawer when a tab is clicked
            if (elSidebar && elSidebarOverlay) {
                elSidebar.classList.remove('open');
                elSidebarOverlay.classList.remove('open');
            }
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
    }
}

// 2. Language Switcher Setup
function setupLanguageSwitcher() {
    const btnEn = document.getElementById('lang-btn-en');
    const btnTh = document.getElementById('lang-btn-th');
    
    const landBtnEn = document.getElementById('landing-lang-btn-en');
    const landBtnTh = document.getElementById('landing-lang-btn-th');

    const quizBtnEn = document.getElementById('quiz-lang-btn-en');
    const quizBtnTh = document.getElementById('quiz-lang-btn-th');

    const updateLanguageUI = (lang) => {
        if (lang === 'en') {
            if (btnEn) btnEn.classList.add('active');
            if (btnTh) btnTh.classList.remove('active');
            if (landBtnEn) landBtnEn.classList.add('active');
            if (landBtnTh) landBtnTh.classList.remove('active');
            if (quizBtnEn) quizBtnEn.classList.add('active');
            if (quizBtnTh) quizBtnTh.classList.remove('active');
        } else {
            if (btnTh) btnTh.classList.add('active');
            if (btnEn) btnEn.classList.remove('active');
            if (landBtnTh) landBtnTh.classList.add('active');
            if (landBtnEn) landBtnEn.classList.remove('active');
            if (quizBtnTh) quizBtnTh.classList.add('active');
            if (quizBtnEn) quizBtnEn.classList.remove('active');
        }
        setLanguage(lang);
        if (typeof applyQuizLanguage === 'function') applyQuizLanguage(lang);
    };

    if (btnEn) btnEn.addEventListener('click', () => updateLanguageUI('en'));
    if (btnTh) btnTh.addEventListener('click', () => updateLanguageUI('th'));
    if (landBtnEn) landBtnEn.addEventListener('click', () => updateLanguageUI('en'));
    if (landBtnTh) landBtnTh.addEventListener('click', () => updateLanguageUI('th'));
    if (quizBtnEn) quizBtnEn.addEventListener('click', () => updateLanguageUI('en'));
    if (quizBtnTh) quizBtnTh.addEventListener('click', () => updateLanguageUI('th'));

    // Apply default English translation
    updateLanguageUI(currentLanguage);
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
            el.innerHTML = TRANSLATIONS[lang][key];
        }
    });

    // Update dynamic header
    updateHeaderTitles();
    
    // Update active connection badge state
    updateConnectionStateLabel();

    // Update chatbot introductory texts
    updateChatbotLabels();

    // Force refresh avatar state text
    const state = classifyPosture(spineAngle, neckFlex, sidewaysAngle, confirmedPostureState);
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

// 3. Connection selection dropdown
function setupConnectionSelect() {
    if (!elConnModeSelect) return;
    elConnModeSelect.addEventListener('change', (e) => {
        connectionType = e.target.value;
        
        // Hide all connection sub-panels
        document.querySelectorAll('.sidebar-conn-panel').forEach(p => p.classList.remove('active'));
        
        // Show selected panel
        if (connectionType === 'mode-ble') document.getElementById('sidebar-pane-ble').classList.add('active');
        if (connectionType === 'mode-serial') document.getElementById('sidebar-pane-serial').classList.add('active');
        if (connectionType === 'mode-wifi') document.getElementById('sidebar-pane-wifi').classList.add('active');
        if (connectionType === 'mode-sim') document.getElementById('sidebar-pane-sim').classList.add('active');
        
        // If switching away from simulator, turn off simulator mode
        if (connectionType !== 'mode-sim') {
            if (elSimToggle && elSimToggle.checked) {
                elSimToggle.checked = false;
                elSimToggle.dispatchEvent(new Event('change'));
            }
        } else {
            // Automatically turn simulator on when simulator mode selected
            if (elSimToggle && !elSimToggle.checked) {
                elSimToggle.checked = true;
                elSimToggle.dispatchEvent(new Event('change'));
            }
        }
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
    
    if (elSlouchCountVal) elSlouchCountVal.textContent = `${slouchCount}`;

    const state = classifyPosture(spineAngle, neckFlex, sidewaysAngle, confirmedPostureState);
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
    const simSideways = document.getElementById('sim-sideways');

    const updateSimValues = () => {
        if (!elSimToggle.checked) return;
        
        spineAngle = Number(simSpine.value);
        neckFlex = Number(simNeck.value);
        sidewaysAngle = Number(simSideways.value);

        document.getElementById('sim-spine-lbl').textContent = `${spineAngle}°`;
        document.getElementById('sim-neck-lbl').textContent = neckFlex;
        document.getElementById('sim-sideways-lbl').textContent = `${sidewaysAngle}°`;

        renderTelemetryUI();
    };

    simSpine.addEventListener('input', updateSimValues);
    simNeck.addEventListener('input', updateSimValues);
    simSideways.addEventListener('input', updateSimValues);

    const resetPresetsStyle = () => {
        document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
    };

    document.getElementById('preset-empty').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 0;
        simNeck.value = 0;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-good').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 4;
        simNeck.value = 12;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-slouch').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 28;
        simNeck.value = 15;
        simSideways.value = 2;
        updateSimValues();
    });

    document.getElementById('preset-forward').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 6;
        simNeck.value = 52;
        simSideways.value = 0;
        updateSimValues();
    });

    document.getElementById('preset-lean').addEventListener('click', (e) => {
        resetPresetsStyle();
        e.target.classList.add('active');
        simSpine.value = 3;
        simNeck.value = 14;
        simSideways.value = 18;
        updateSimValues();
    });
}

// 10. Core System Timer Loop running at 1Hz
let chartIntervalCount = 0;
let riskIntervalCount = 0;

// --- ESP32 hardware alert (buzzer/vibration/LED), fired from whatever camera/sensor mode is
// currently driving the dashboard. Mirrors the Python script's Esp32Notifier: hold N seconds of
// confirmed slouching before firing, then a cooldown before firing again; clear as soon as posture
// returns to normal. Targets the same IP entered in the sidebar "Wi-Fi (WS)" field.
// Hold time lowered from 2s -> 1s (combined with the 2s stabilization above, the buzzer/motor now
// fires ~3s after you actually start slouching instead of ~6s).
const ESP32_ALERT_HOLD_SECONDS = 1;
const ESP32_ALERT_COOLDOWN_SECONDS = 8;
let esp32AlertBadSeconds = 0;
let esp32AlertLastFiredTick = -9999;
let esp32AlertActive = false;
let esp32AlertTickCounter = 0;

function sendEsp32Command(command) {
    const ipInput = document.getElementById('esp32-alert-ip');
    const ip = ipInput ? ipInput.value.trim() : '';
    if (!ip) return; // no ESP32 alert IP configured yet, skip silently
    let url = ip;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'http://' + url;
    fetch(`${url}/${command}`).catch(() => {
        // Fire-and-forget, same as the Python notifier: ESP32 may be offline/unreachable.
    });
}

// Desktop popup bridge (ergoai_popup_server.py) — a local HTTP server that pops an
// always-on-top window covering every app on the PC, not just the browser tab.
// Runs on the same machine as the browser, so the URL is fixed to localhost.
const LOCAL_POPUP_SERVER_URL = 'http://127.0.0.1:5005';

function sendLocalPopupCommand(command) {
    fetch(`${LOCAL_POPUP_SERVER_URL}/${command}`, { mode: 'no-cors' }).catch(() => {
        // Fire-and-forget: popup server may not be running, that's fine.
    });
}

function handleEsp32PostureAlert(state) {
    esp32AlertTickCounter++;
    const isBadPosture = (state === POSTURE_SLOUCHED || state === POSTURE_NECK_FORWARD || state === POSTURE_LEANING_SIDE);
    if (isBadPosture) {
        esp32AlertBadSeconds++;
        const ticksSinceLastAlert = esp32AlertTickCounter - esp32AlertLastFiredTick;
        if (esp32AlertBadSeconds >= ESP32_ALERT_HOLD_SECONDS && ticksSinceLastAlert >= ESP32_ALERT_COOLDOWN_SECONDS) {
            sendEsp32Command('alert');
            sendLocalPopupCommand('alert');
            esp32AlertLastFiredTick = esp32AlertTickCounter;
            esp32AlertActive = true;
        }
    } else {
        esp32AlertBadSeconds = 0;
        if (esp32AlertActive) {
            sendEsp32Command('clear');
            sendLocalPopupCommand('clear');
            esp32AlertActive = false;
        }
    }
}

function systemTick() {
    if (!isConnected) return;

    // When the Browser AI Camera is driving the connection, pose-vision.js's
    // pushDashboardTick() -> updateStateFromPython() already owns: raw classification,
    // debounce/stabilization, confirmedPostureState/pendingPostureState writes,
    // duration increments, avatar animation, HUD text, analytics, and chart data.
    // Running that same pipeline again here would race with it over the same shared
    // state variables, which is what caused the posture tag to flicker. So this
    // whole block only runs for the non-camera (manual/simulated sensor) path.
    if (!cameraDrivesConnection) {
        // A. Posture Classification (Raw sensor reading)
        const rawState = classifyPosture(spineAngle, neckFlex, sidewaysAngle, confirmedPostureState);

        // B. Debouncing / Stabilization check
        // Empty chair transitions (standing up or sitting down) happen instantly.
        // Transitions between different sitting postures (Straight, Slouched, Neck, Side) wait 4 seconds.
        if (rawState === POSTURE_EMPTY || confirmedPostureState === POSTURE_EMPTY) {
            confirmedPostureState = rawState;
            pendingPostureState = rawState;
            postureChangeTimer = 0;
        } else if (rawState !== pendingPostureState) {
            pendingPostureState = rawState;
            postureChangeTimer = STABILIZATION_TIME_SECONDS;
        }

        let isProcessing = false;
        if (postureChangeTimer > 0) {
            postureChangeTimer--;
            isProcessing = true;

            if (postureChangeTimer === 0) {
                confirmedPostureState = pendingPostureState;
                isProcessing = false;
            }
        }

        const tickStateToShow = confirmedPostureState;
        trackSlouchCount(tickStateToShow);

        // C. Increment State durations (Only for stabilized/confirmed posture)
        postureDurations[tickStateToShow]++;

        // D. Update avatar visual representation (Animate using confirmed posture)
        animateAvatar(tickStateToShow, spineAngle, neckFlex, sidewaysAngle);

        // E. Display processing countdown HUD text if debouncing
        if (isProcessing && confirmedPostureState !== pendingPostureState) {
            const translatedPendingState = getTranslatedState(pendingPostureState);
            const processingLabelEn = `AI Processing... (Transitioning to: ${translatedPendingState} in ${postureChangeTimer + 1}s)`;
            const processingLabelTh = `AI กำลังประมวลผล... (กำลังเปลี่ยนเป็น: ${translatedPendingState} ใน ${postureChangeTimer + 1} วิ)`;

            elPostureStateTag.textContent = currentLanguage === 'en' ? `Analyzing... (${postureChangeTimer + 1}s)` : `กำลังวิเคราะห์... (${postureChangeTimer + 1}วิ)`;
            elPostureStateTag.style.backgroundColor = 'rgba(245, 158, 11, 0.15)'; // warning orange
            elPostureStateTag.style.color = 'var(--warning)';

            elAvatarStatusDesc.textContent = currentLanguage === 'en' ? processingLabelEn : processingLabelTh;
        }

        // H. Update analytics scorecards
        updateAnalyticsMetrics();

        // I. Add Chart / posture-analysis-stats values at 5-second intervals
        chartIntervalCount++;
        if (chartIntervalCount >= 5) {
            chartIntervalCount = 0;
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            // Append data to timeline and donut (donut is Good vs Bad posture only)
            addTimelineData(timeStr, spineAngle, neckFlex);
            const goodSecs = postureDurations[POSTURE_GOOD];
            const badSecs = postureDurations[POSTURE_SLOUCHED] + postureDurations[POSTURE_NECK_FORWARD] + postureDurations[POSTURE_LEANING_SIDE];
            updateDonutData(goodSecs, badSecs);
        }
    }

    // The following run regardless of who drives the connection, since pose-vision.js's
    // updateStateFromPython() does NOT do these on its own — it only sets confirmedPostureState.
    const activeStateToShow = confirmedPostureState;

    // F. Update long-term syndrome risks accumulation, at 10-second intervals
    // (Only for confirmed posture)
    riskIntervalCount++;
    if (riskIntervalCount >= 10) {
        riskIntervalCount = 0;
        updateLongTermRisks(activeStateToShow);
    }

    // F.5 Fire/clear the ESP32 hardware alert (buzzer/vibration/LED) based on confirmed posture
    handleEsp32PostureAlert(activeStateToShow);

    // G. Warning Sound / Visual alert checks (Only for confirmed posture)
    handleWarningAlerts(activeStateToShow);
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
            
            // Map text dynamically based on language
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
        
        // Repeat every 5 seconds of *continuous bad posture* (warningConsecutiveCount),
        // not 5 seconds of session clock time — the old sessionSeconds check meant the
        // beep only played when the absolute session clock happened to line up.
        if (warningConsecutiveCount % 5 !== 0) return;

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

// 13. Camera & ESP32-CAM stream controls
function setupCameraSystem() {
    if (!elCamToggle || !elCameraCard) return;

    // Sidebar Camera Toggle
    elCamToggle.addEventListener('change', () => {
        isCamStreamActive = elCamToggle.checked;
        if (isCamStreamActive) {
            elCameraCard.classList.remove('hidden');
        } else {
            elCameraCard.classList.add('hidden');
            stopAllStreams();
        }
    });

    // Camera source selector dropdown
    if (elCamSourceSelect) {
        elCamSourceSelect.addEventListener('change', (e) => {
            cameraMode = e.target.value;
            stopAllStreams();
            
            const pythonCalContainer = document.getElementById('cam-python-cal-container');
            
            if (cameraMode === 'mode-esp32cam') {
                elCamUrlContainer.classList.remove('hidden');
                elCamStreamUrl.value = 'http://192.168.1.';
                if (pythonCalContainer) pythonCalContainer.classList.add('hidden');
            } else if (cameraMode === 'mode-python-ai') {
                elCamUrlContainer.classList.remove('hidden');
                elCamStreamUrl.value = 'http://localhost:5000/video_feed';
                if (pythonCalContainer) pythonCalContainer.classList.remove('hidden');
            } else if (cameraMode === 'mode-browser-ai') {
                // Runs entirely in the browser (MediaPipe Pose) - no stream URL needed
                elCamUrlContainer.classList.add('hidden');
                if (pythonCalContainer) pythonCalContainer.classList.remove('hidden');
            } else {
                elCamUrlContainer.classList.add('hidden');
                if (pythonCalContainer) pythonCalContainer.classList.add('hidden');
            }
        });
    }

    // Connect Camera button click
    if (elBtnConnectCam) {
        elBtnConnectCam.addEventListener('click', () => {
            if (isCamConnected) {
                stopAllStreams();
            } else {
                if (cameraMode === 'mode-esp32cam' || cameraMode === 'mode-python-ai') {
                    const url = elCamStreamUrl.value.trim();
                    startESP32Cam(url);
                } else if (cameraMode === 'mode-browser-ai') {
                    startWebcam().then(() => {
                        if (isCamConnected && typeof startPoseVisionDetection === 'function') {
                            startPoseVisionDetection();
                            // Let the camera itself drive the dashboard's posture state machine
                            // (avatar animation, risk accumulation, charts, ESP32 alerts) even if
                            // no physical ESP32 sensor is connected.
                            isConnected = true;
                            cameraDrivesConnection = true;
                            updateConnectionUI('online', currentLanguage === 'en' ? 'AI Camera Active' : 'กล้อง AI ทำงานอยู่');
                        }
                    });
                } else {
                    startWebcam();
                }
            }
        });
    }

    // Remote Python calibration buttons triggers
    const btnCalStraight = document.getElementById('btn-python-cal-straight');
    const btnCalHunched = document.getElementById('btn-python-cal-hunched');

    if (btnCalStraight) {
        btnCalStraight.addEventListener('click', () => {
            if (cameraMode === 'mode-browser-ai') {
                if (typeof poseVisionCalibrate === 'function') poseVisionCalibrate('straight');
                return;
            }
            const streamUrl = elCamStreamUrl.value.trim();
            let baseUrl = "http://localhost:5000";
            try {
                const u = new URL(streamUrl);
                baseUrl = `${u.protocol}//${u.host}`;
            } catch(e) {}
            
            fetch(`${baseUrl}/calibrate?type=straight`)
                .then(res => res.json())
                .then(data => {
                    console.log("Remote straight calibration request:", data);
                })
                .catch(err => {
                    console.error("Remote calibration failed:", err);
                    alert("Could not connect to Python AI server. Please make sure main_v5.py is running on localhost.");
                });
        });
    }

    if (btnCalHunched) {
        btnCalHunched.addEventListener('click', () => {
            if (cameraMode === 'mode-browser-ai') {
                if (typeof poseVisionCalibrate === 'function') poseVisionCalibrate('hunched');
                return;
            }
            const streamUrl = elCamStreamUrl.value.trim();
            let baseUrl = "http://localhost:5000";
            try {
                const u = new URL(streamUrl);
                baseUrl = `${u.protocol}//${u.host}`;
            } catch(e) {}
            
            fetch(`${baseUrl}/calibrate?type=hunched`)
                .then(res => res.json())
                .then(data => {
                    console.log("Remote hunched calibration request:", data);
                })
                .catch(err => {
                    console.error("Remote calibration failed:", err);
                    alert("Could not connect to Python AI server. Please make sure main_v5.py is running on localhost.");
                });
        });
    }
}

// Start local Web Camera feed
async function startWebcam() {
    try {
        stopAllStreams();
        const constraints = { 
            video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
            audio: false 
        };
        webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
        elWebcamFeed.srcObject = webcamStream;
        elWebcamFeed.classList.remove('hidden');
        elEsp32camFeed.classList.add('hidden');
        elCameraPlaceholder.classList.add('hidden');
        
        isCamConnected = true;
        updateCameraStatus(true);
        startHUDAnimation();
    } catch (err) {
        console.error("Web Camera access error:", err);
        alert(currentLanguage === 'en' 
            ? "Could not access local Web Camera. Please verify camera permissions in your browser."
            : "ไม่สามารถเข้าถึงกล้องเว็บแคมได้ กรุณาตรวจสอบการอนุญาตใช้งานกล้องในเบราว์เซอร์");
        updateCameraStatus(false);
    }
}

// Start ESP32-CAM MJPEG stream loading
function startESP32Cam(url) {
    stopAllStreams();
    if (!url || url === 'http://192.168.1.') {
        alert(currentLanguage === 'en' 
            ? "Please enter a valid ESP32-CAM stream IP URL." 
            : "กรุณาระบุหมายเลข URL สำหรับสตรีมกล้อง ESP32-CAM ให้ถูกต้อง");
        return;
    }
    
    // Automatically add http:// if missing
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'http://' + url;
    }
    
    updateCameraStatus(true, true); // show connecting state
    
    elEsp32camFeed.src = fullUrl;
    elEsp32camFeed.classList.remove('hidden');
    elWebcamFeed.classList.add('hidden');
    elCameraPlaceholder.classList.add('hidden');
    
    elEsp32camFeed.onload = () => {
        isCamConnected = true;
        updateCameraStatus(true);
        startHUDAnimation();
        
        if (cameraMode === 'mode-python-ai') {
            startPythonPoll();
        }
    };
    
    elEsp32camFeed.onerror = () => {
        console.warn("Failed to load stream");
        alert(currentLanguage === 'en'
            ? "Failed to load camera stream. Make sure the stream URL is correct and running."
            : "ไม่สามารถเชื่อมต่อกล้องได้ กรุณาตรวจสอบให้มั่นใจว่า URL สตรีมกล้องถูกต้องและกำลังทำงานอยู่");
        stopAllStreams();
    };
}

// Stop all running camera feeds
function stopAllStreams() {
    isCamConnected = false;
    updateCameraStatus(false);
    stopHUDAnimation();
    stopPythonPoll();
    if (typeof stopPoseVisionDetection === 'function') stopPoseVisionDetection();

    if (cameraDrivesConnection) {
        isConnected = false;
        cameraDrivesConnection = false;
        updateConnectionUI('offline', TRANSLATIONS[currentLanguage]['conn-offline']);
    }
    
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (elWebcamFeed) {
        elWebcamFeed.srcObject = null;
        elWebcamFeed.classList.add('hidden');
    }
    
    if (elEsp32camFeed) {
        elEsp32camFeed.removeAttribute('src'); // Stop browser load requests
        elEsp32camFeed.classList.add('hidden');
    }
    
    if (elCameraPlaceholder) {
        elCameraPlaceholder.classList.remove('hidden');
    }
}

// Update camera tag and button labels based on connection state
function updateCameraStatus(active, connecting = false) {
    if (!elCameraStatusTag || !elBtnConnectCam) return;
    
    if (active) {
        if (connecting) {
            elCameraStatusTag.className = 'tag secondary';
            elCameraStatusTag.setAttribute('data-i18n', 'conn-connecting');
            elCameraStatusTag.textContent = currentLanguage === 'en' ? "Connecting..." : "กำลังเชื่อมต่อ...";
        } else {
            elCameraStatusTag.className = 'tag';
            elCameraStatusTag.style.backgroundColor = 'var(--success-light)';
            elCameraStatusTag.style.color = 'var(--success)';
            elCameraStatusTag.setAttribute('data-i18n', 'cam-status-online');
            elCameraStatusTag.textContent = TRANSLATIONS[currentLanguage]['cam-status-online'];
            
            elBtnConnectCam.setAttribute('data-i18n', 'cam-btn-disconnect');
            elBtnConnectCam.textContent = TRANSLATIONS[currentLanguage]['cam-btn-disconnect'];
            elBtnConnectCam.className = 'btn btn-secondary btn-sm';
        }
    } else {
        elCameraStatusTag.className = 'tag secondary';
        elCameraStatusTag.style.backgroundColor = '';
        elCameraStatusTag.style.color = '';
        elCameraStatusTag.setAttribute('data-i18n', 'cam-status-offline');
        elCameraStatusTag.textContent = TRANSLATIONS[currentLanguage]['cam-status-offline'];
        
        elBtnConnectCam.setAttribute('data-i18n', 'cam-btn-connect');
        elBtnConnectCam.textContent = TRANSLATIONS[currentLanguage]['cam-btn-connect'];
        elBtnConnectCam.className = 'btn btn-primary btn-sm';
    }
}

// Animating Cybernetic HUD Canvas overlay
function startHUDAnimation() {
    stopHUDAnimation();
    renderHUD();
}

function stopHUDAnimation() {
    if (hudAnimationId) {
        cancelAnimationFrame(hudAnimationId);
        hudAnimationId = null;
    }
    // Clear canvas
    if (elHudCanvas) {
        const ctx = elHudCanvas.getContext('2d');
        ctx.clearRect(0, 0, elHudCanvas.width, elHudCanvas.height);
    }
}

function renderHUD() {
    if (!isCamConnected || !elHudCanvas) return;

    // Browser AI mode draws its own Python-style status overlay (see pose-vision.js);
    // skip the generic sci-fi HUD here so the two don't draw on top of each other.
    if (cameraMode === 'mode-browser-ai') {
        const ctx0 = elHudCanvas.getContext('2d');
        ctx0.clearRect(0, 0, elHudCanvas.width, elHudCanvas.height);
        return;
    }
    
    const ctx = elHudCanvas.getContext('2d');
    const width = elHudCanvas.clientWidth;
    const height = elHudCanvas.clientHeight;
    
    // Set actual resolution equal to display resolution
    elHudCanvas.width = width;
    elHudCanvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const isHudVisible = elHudToggle ? elHudToggle.checked : true;
    
    if (isHudVisible) {
        // Draw cybernetic scanning lines/boxes
        const state = classifyPosture(spineAngle, neckFlex, sidewaysAngle, confirmedPostureState);
        let neonColor = 'rgba(148, 163, 184, 0.7)'; // Muted gray (default empty)
        let borderNeon = 'rgba(148, 163, 184, 0.3)';
        let postureLabel = currentLanguage === 'en' ? "CHAIR EMPTY" : "ไม่มีผู้นั่ง";
        
        if (state === POSTURE_GOOD) {
            neonColor = 'rgba(16, 185, 129, 0.85)'; // Green
            borderNeon = 'rgba(16, 185, 129, 0.4)';
            postureLabel = currentLanguage === 'en' ? "ALIGNMENT: EXCELLENT" : "แนวกระดูก: ยอดเยี่ยม";
        } else if (state === POSTURE_SLOUCHED) {
            neonColor = 'rgba(239, 68, 68, 0.85)'; // Red
            borderNeon = 'rgba(239, 68, 68, 0.4)';
            postureLabel = currentLanguage === 'en' ? "ALIGNMENT: POOR (SLOUCHED)" : "แนวกระดูก: ผิดปกติ (นั่งหลังค่อม)";
        } else if (state === POSTURE_NECK_FORWARD) {
            neonColor = 'rgba(245, 158, 11, 0.85)'; // Orange/Amber
            borderNeon = 'rgba(245, 158, 11, 0.4)';
            postureLabel = currentLanguage === 'en' ? "ALIGNMENT: NECK STRAIN" : "แนวกระดูก: โน้มไปข้างหน้ามาก";
        } else if (state === POSTURE_LEANING_SIDE) {
            neonColor = 'rgba(6, 182, 212, 0.85)'; // Cyan/Blue
            borderNeon = 'rgba(6, 182, 212, 0.4)';
            postureLabel = currentLanguage === 'en' ? "ALIGNMENT: ASYMMETRIC TILT" : "แนวกระดูก: เอียงตัวด้านข้าง";
        }
        
        // 1. Draw glowing HUD corners
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 2.5;
        const cornerLen = 15;
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(10 + cornerLen, 10); ctx.lineTo(10, 10); ctx.lineTo(10, 10 + cornerLen);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(width - 10 - cornerLen, 10); ctx.lineTo(width - 10, 10); ctx.lineTo(width - 10, 10 + cornerLen);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(10 + cornerLen, height - 10); ctx.lineTo(10, height - 10); ctx.lineTo(10, height - 10 - cornerLen);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(width - 10 - cornerLen, height - 10); ctx.lineTo(width - 10, height - 10); ctx.lineTo(width - 10, height - 10 - cornerLen);
        ctx.stroke();

        // If posture is bad, flash screen borders subtly
        if (state !== POSTURE_GOOD && state !== POSTURE_EMPTY) {
            if (Math.floor(Date.now() / 400) % 2 === 0) {
                ctx.strokeStyle = neonColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(10, 10, width - 20, height - 20);
                
                ctx.fillStyle = neonColor.replace('0.85', '0.05');
                ctx.fillRect(10, 10, width - 20, height - 20);
            }
        }
        
        // 2. Draw Digital Diagnostics Text
        ctx.font = "bold 9px 'Outfit', sans-serif";
        ctx.fillStyle = neonColor;
        ctx.textAlign = "left";
        ctx.fillText("ERGOAI VISION v1.2.0", 20, 28);
        ctx.fillText(`STATUS: ${postureLabel}`, 20, 40);
        
        ctx.textAlign = "right";
        ctx.fillText(`SPINE ANGLE: ${spineAngle.toFixed(1)}°`, width - 20, 28);
        ctx.fillText(`NECK FLEX: ${neckFlex.toFixed(1)}%`, width - 20, 40);
        ctx.fillText(`SIDE TILT: ${sidewaysAngle.toFixed(1)}°`, width - 20, 52);

        // 3. Draw cybernetic skeleton if weight is on chair
        if (confirmedPostureState !== POSTURE_EMPTY) {
            // Anchor coordinates (Pelvis in chair)
            const pelvisX = width * 0.5; // Center horizontally
            const pelvisY = height * 0.85;
            
            // Calculate spine vertebrae bend
            const spineLength = height * 0.35;
            const spineRad = (spineAngle * Math.PI) / 180;
            
            // Mirror coordinates visually because webcam is mirrored scaleX(-1)
            const drawMirrorMultiplier = (cameraMode === 'mode-webcam') ? 1 : -1;
            
            const neckX = pelvisX + drawMirrorMultiplier * spineLength * Math.sin(spineRad);
            const neckY = pelvisY - spineLength * Math.cos(spineRad);
            
            // Draw Pelvis Joint
            ctx.fillStyle = 'white';
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(pelvisX, pelvisY, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw Spine Path Bezier
            ctx.beginPath();
            ctx.moveTo(pelvisX, pelvisY);
            // Control points for curved bending look
            const cp1X = pelvisX + drawMirrorMultiplier * (spineLength * 0.5) * Math.sin(spineRad * 0.5);
            const cp1Y = pelvisY - (spineLength * 0.5) * Math.cos(spineRad * 0.5);
            ctx.quadraticCurveTo(cp1X, cp1Y, neckX, neckY);
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Draw Vertebrae dotted beads along the spine
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([2, 8]);
            ctx.beginPath();
            ctx.moveTo(pelvisX, pelvisY);
            ctx.quadraticCurveTo(cp1X, cp1Y, neckX, neckY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dashed lines

            // Draw Neck Joint
            ctx.fillStyle = 'white';
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(neckX, neckY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw Neck Extension
            const neckLength = height * 0.12;
            const neckRad = ((spineAngle + neckFlex * 0.5) * Math.PI) / 180;
            const headX = neckX + drawMirrorMultiplier * neckLength * Math.sin(neckRad);
            const headY = neckY - neckLength * Math.cos(neckRad);
            
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(neckX, neckY);
            ctx.lineTo(headX, headY);
            ctx.stroke();
            
            // Draw Head Circle (Face/Head Target)
            const headR = height * 0.08;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(headX, headY, headR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw crosshair box around the head
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(headX - headR - 4, headY - headR - 4, (headR + 4) * 2, (headR + 4) * 2);
            
            // Draw "HEAD LOCK" text above head
            ctx.fillStyle = neonColor;
            ctx.font = "700 8px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("HEAD LOCK", headX, headY - headR - 8);

            // Draw Shoulder/collar line tilting with sideways tilt
            const shoulderHalfWidth = width * 0.15;
            // Mirror sideways tilt visually
            const sideRad = drawMirrorMultiplier * (sidewaysAngle * Math.PI) / 180;
            const shLeftX = neckX - shoulderHalfWidth * Math.cos(sideRad);
            const shLeftY = neckY - shoulderHalfWidth * Math.sin(sideRad);
            const shRightX = neckX + shoulderHalfWidth * Math.cos(sideRad);
            const shRightY = neckY + shoulderHalfWidth * Math.sin(sideRad);

            ctx.strokeStyle = borderNeon;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(shLeftX, shLeftY);
            ctx.lineTo(shRightX, shRightY);
            ctx.stroke();

            // Draw Shoulder joints
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.strokeStyle = borderNeon;
            ctx.lineWidth = 2;
            
            ctx.beginPath(); ctx.arc(shLeftX, shLeftY, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(shRightX, shRightY, 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
        } else {
            // Sweeping laser scanning overlay when chair is empty (Super premium sci-fi touch)
            const scanTime = Date.now() / 1500;
            const laserY = 40 + (height - 80) * (0.5 + 0.5 * Math.sin(scanTime * Math.PI));
            
            // Laser beam
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
            ctx.beginPath();
            ctx.moveTo(15, laserY);
            ctx.lineTo(width - 15, laserY);
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
            
            // Scanner text
            ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.font = "bold 8px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("SCANNING FOR TARGET...", width / 2, laserY - 6);
        }
    }
    
    hudAnimationId = requestAnimationFrame(renderHUD);
}

// 14. Landing page and mobile responsive menu setup
function setupLandingAndMobile() {
    // "Start Monitoring" now leads into the Office Syndrome self-assessment quiz first
    if (elBtnEnterDashboard && elLandingPage && elQuizPage) {
        elBtnEnterDashboard.addEventListener('click', () => {
            elLandingPage.classList.add('hidden');
            elQuizPage.classList.remove('hidden');
        });
    }

    // Mobile Hamburger Menu toggle
    if (elMobileMenuBtn && elSidebar && elSidebarOverlay) {
        elMobileMenuBtn.addEventListener('click', () => {
            elSidebar.classList.add('open');
            elSidebarOverlay.classList.add('open');
        });
        
        // Clicking overlay collapses sidebar drawer
        elSidebarOverlay.addEventListener('click', () => {
            elSidebar.classList.remove('open');
            elSidebarOverlay.classList.remove('open');
        });
    }
}

// 14b. Office Syndrome Self-Assessment Quiz (shown after landing, before dashboard access)
const QUIZ_I18N = {
    en: {
        pageTitle: 'Office Syndrome Self-Assessment',
        pageSubtitle: 'Answer a few quick questions before you start monitoring',
        progress: (n) => `${n} / 5 answered`,
        warning: 'Please answer all questions to see your risk result.',
        submitBtn: 'See My Result',
        resultTitle: 'Your Office Syndrome Risk',
        retakeBtn: 'Retake Quiz',
        continueBtn: 'Start Monitoring',
        questions: [
            {
                text: '1. What age range are you in?',
                options: ['Under 20', '20–30', '31–40', 'Over 40'],
                scored: false
            },
            {
                text: '2. How many hours do you sit continuously without a break?',
                options: ['Less than 1 hour', '1–2 hours', '2–4 hours', 'More than 4 hours']
            },
            {
                text: '3. Do you feel neck or shoulder pain during work?',
                options: ['Never', 'Sometimes', 'Often', 'Almost always']
            },
            {
                text: '4. When you have back pain, which area hurts the most?',
                options: ['Upper back (between shoulder blades)', 'Middle back', 'Lower back', 'All over / multiple areas'],
                scored: false
            },
            {
                text: '5. How many hours per day do you use a computer?',
                options: ['Less than 4 hours', '4–6 hours', '6–8 hours', 'More than 8 hours']
            }
        ],
        risk: {
            low: { badge: 'Low Risk', icon: '🟢', desc: 'Your habits look relatively healthy. Keep monitoring your posture with ErgoAI to stay that way.' },
            medium: { badge: 'Medium Risk', icon: '🟡', desc: 'You show some early warning signs of Office Syndrome. ErgoAI will help you catch bad posture before it becomes a habit.' },
            high: { badge: 'High Risk', icon: '🔴', desc: 'Your answers suggest a high risk of Office Syndrome. Real-time monitoring and AI coaching are strongly recommended — let’s get started.' }
        }
    },
    th: {
        pageTitle: 'แบบประเมินความเสี่ยงออฟฟิศซินโดรม',
        pageSubtitle: 'ตอบคำถามสั้นๆ ก่อนเริ่มใช้งานระบบตรวจวัด',
        progress: (n) => `ตอบแล้ว ${n} / 5 ข้อ`,
        warning: 'กรุณาตอบคำถามให้ครบทุกข้อเพื่อดูผลการประเมินความเสี่ยง',
        submitBtn: 'ดูผลการประเมิน',
        resultTitle: 'ผลประเมินความเสี่ยงออฟฟิศซินโดรมของคุณ',
        retakeBtn: 'ทำแบบทดสอบใหม่',
        continueBtn: 'เริ่มใช้งานระบบ',
        questions: [
            {
                text: '1. คุณอยู่ในช่วงอายุใด?',
                options: ['ต่ำกว่า 20 ปี', '20–30 ปี', '31–40 ปี', 'มากกว่า 40 ปี'],
                scored: false
            },
            {
                text: '2. คุณนั่งต่อเนื่องโดยไม่ลุกพักกี่ชั่วโมง?',
                options: ['น้อยกว่า 1 ชั่วโมง', '1–2 ชั่วโมง', '2–4 ชั่วโมง', 'มากกว่า 4 ชั่วโมง']
            },
            {
                text: '3. คุณรู้สึกปวดคอหรือบ่าขณะทำงานหรือไม่?',
                options: ['ไม่เคย', 'บางครั้ง', 'บ่อยครั้ง', 'แทบทุกครั้ง']
            },
            {
                text: '4. เวลาคุณปวดหลัง คุณจะปวดส่วนไหนมากที่สุด?',
                options: ['หลังส่วนบน (ระหว่างสะบัก)', 'หลังส่วนกลาง', 'หลังส่วนล่าง', 'ปวดทั่วทั้งหลัง/หลายจุด'],
                scored: false
            },
            {
                text: '5. คุณใช้คอมพิวเตอร์วันละกี่ชั่วโมง?',
                options: ['น้อยกว่า 4 ชั่วโมง', '4–6 ชั่วโมง', '6–8 ชั่วโมง', 'มากกว่า 8 ชั่วโมง']
            }
        ],
        risk: {
            low: { badge: 'ความเสี่ยงต่ำ', icon: '🟢', desc: 'พฤติกรรมของคุณค่อนข้างดีต่อสุขภาพ ใช้ ErgoAI ต่อไปเพื่อคงระดับความเสี่ยงต่ำนี้ไว้' },
            medium: { badge: 'ความเสี่ยงปานกลาง', icon: '🟡', desc: 'คุณเริ่มมีสัญญาณเตือนของออฟฟิศซินโดรม ErgoAI จะช่วยแจ้งเตือนท่านั่งที่ไม่ถูกต้องก่อนกลายเป็นนิสัย' },
            high: { badge: 'ความเสี่ยงสูง', icon: '🔴', desc: 'คำตอบของคุณบ่งชี้ความเสี่ยงออฟฟิศซินโดรมในระดับสูง แนะนำให้ใช้ระบบตรวจวัดเรียลไทม์และคำแนะนำจาก AI อย่างจริงจัง เริ่มกันเลย' }
        }
    }
};

let quizAnswers = {}; // { 1: scoreValue, 2: scoreValue, ... }

function renderQuizQuestions(lang) {
    const data = QUIZ_I18N[lang];
    data.questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const textEl = document.getElementById(`quiz-q${qNum}-text`);
        const optsEl = document.getElementById(`quiz-q${qNum}-options`);
        if (textEl) textEl.textContent = q.text;
        if (!optsEl) return;

        optsEl.innerHTML = '';
        q.options.forEach((optLabel, optIdx) => {
            const id = `quiz-q${qNum}-opt${optIdx}`;
            const wrapper = document.createElement('label');
            wrapper.className = 'quiz-option';
            wrapper.setAttribute('for', id);
            if (quizAnswers[qNum] === optIdx) wrapper.classList.add('selected');

            wrapper.innerHTML = `
                <input type="radio" name="quiz-q${qNum}" id="${id}" value="${optIdx}" ${quizAnswers[qNum] === optIdx ? 'checked' : ''}>
                <span class="quiz-option-dot"></span>
                <span class="quiz-option-label">${optLabel}</span>
            `;

            wrapper.querySelector('input').addEventListener('change', () => {
                quizAnswers[qNum] = optIdx;
                optsEl.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                wrapper.classList.add('selected');
                updateQuizProgress();
            });

            optsEl.appendChild(wrapper);
        });
    });
}

function updateQuizProgress() {
    const answeredCount = Object.keys(quizAnswers).length;
    const progressText = document.getElementById('quiz-progress-text');
    const progressFill = document.getElementById('quiz-progress-fill');
    const warningText = document.getElementById('quiz-warning-text');

    if (progressText) progressText.textContent = QUIZ_I18N[currentLanguage].progress(answeredCount);
    if (progressFill) progressFill.style.width = `${(answeredCount / 5) * 100}%`;
    if (warningText) warningText.style.display = answeredCount >= 5 ? 'none' : 'block';
}

function applyQuizLanguage(lang) {
    if (!QUIZ_I18N[lang]) return;
    const data = QUIZ_I18N[lang];

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    setText('quiz-title', data.pageTitle);
    setText('quiz-subtitle', data.pageSubtitle);
    setText('quiz-submit-btn-text', data.submitBtn);
    setText('quiz-result-title', data.resultTitle);
    setText('quiz-retake-btn-text', data.retakeBtn);
    setText('quiz-continue-btn-text', data.continueBtn);
    setText('quiz-warning-text', data.warning);

    renderQuizQuestions(lang);
    updateQuizProgress();
}

function calculateQuizRisk() {
    const questions = QUIZ_I18N[currentLanguage].questions;
    let total = 0;
    let maxScore = 0;
    questions.forEach((q, idx) => {
        if (q.scored === false) return; // informational questions (age, pain location) don't affect risk score
        maxScore += 3;
        const qNum = idx + 1;
        if (typeof quizAnswers[qNum] === 'number') total += quizAnswers[qNum];
    });
    let level = 'low';
    if (total >= maxScore * (2 / 3)) level = 'high';
    else if (total >= maxScore * (1 / 3)) level = 'medium';
    return { total, maxScore, level };
}

function showQuizResult() {
    const { total, maxScore, level } = calculateQuizRisk();
    const data = QUIZ_I18N[currentLanguage];
    const riskInfo = data.risk[level];

    const badgeEl = document.getElementById('quiz-result-badge');
    const iconEl = document.getElementById('quiz-result-icon');
    const descEl = document.getElementById('quiz-result-desc');
    const fillEl = document.getElementById('quiz-result-fill');

    if (badgeEl) {
        badgeEl.textContent = riskInfo.badge;
        badgeEl.classList.remove('badge-green', 'badge-yellow', 'badge-red');
        badgeEl.classList.add(level === 'low' ? 'badge-green' : level === 'medium' ? 'badge-yellow' : 'badge-red');
    }
    if (iconEl) iconEl.textContent = riskInfo.icon;
    if (descEl) descEl.textContent = riskInfo.desc;
    if (fillEl) {
        const pct = Math.round((total / maxScore) * 100);
        fillEl.style.width = `${pct}%`;
        fillEl.style.backgroundColor = level === 'low' ? 'var(--success)' : level === 'medium' ? 'var(--warning)' : 'var(--danger)';
    }

    if (elQuizFormView) elQuizFormView.classList.add('hidden');
    if (elQuizResultView) elQuizResultView.classList.remove('hidden');
}

function resetQuiz() {
    quizAnswers = {};
    renderQuizQuestions(currentLanguage);
    updateQuizProgress();
    if (elQuizResultView) elQuizResultView.classList.add('hidden');
    if (elQuizFormView) elQuizFormView.classList.remove('hidden');
}

function setupOfficeSyndromeQuiz() {
    // Initial render in current language
    applyQuizLanguage(currentLanguage);

    if (elBtnQuizSubmit) {
        elBtnQuizSubmit.addEventListener('click', () => {
            if (Object.keys(quizAnswers).length < 5) {
                updateQuizProgress();
                const warningText = document.getElementById('quiz-warning-text');
                if (warningText) warningText.style.display = 'block';
                return;
            }
            showQuizResult();
        });
    }

    if (elBtnQuizRetake) {
        elBtnQuizRetake.addEventListener('click', () => {
            resetQuiz();
        });
    }

    if (elBtnQuizContinue) {
        elBtnQuizContinue.addEventListener('click', () => {
            if (elQuizPage) elQuizPage.classList.add('hidden');
            if (elAppLayout) elAppLayout.classList.remove('hidden');

            // Force redraw chart to adapt to container size
            window.dispatchEvent(new Event('resize'));
        });
    }
}

// 15. Python AI Telemetry & Polling logic
let pythonPollInterval = null;

function startPythonPoll() {
    stopPythonPoll();
    
    const streamUrl = elCamStreamUrl.value.trim();
    let baseUrl = "http://localhost:5000";
    try {
        const u = new URL(streamUrl);
        baseUrl = `${u.protocol}//${u.host}`;
    } catch(e) {}

    pythonPollInterval = setInterval(() => {
        if (cameraMode !== 'mode-python-ai' || !isCamConnected) {
            stopPythonPoll();
            return;
        }

        fetch(`${baseUrl}/state`)
            .then(res => res.json())
            .then(data => {
                let mappedState = POSTURE_EMPTY;
                let rawSpineAngle = 0;
                let rawNeckFlex = 0;

                if (data.status && data.status.indexOf("หลังค้อม") !== -1) {
                    mappedState = POSTURE_SLOUCHED;
                    rawSpineAngle = 28;
                    rawNeckFlex = 60;
                } else if (data.status && data.status.indexOf("ท่าทางปกติ") !== -1) {
                    mappedState = POSTURE_GOOD;
                    rawSpineAngle = 4;
                    rawNeckFlex = 10;
                } else if (data.status && data.status.indexOf("รอคาลิเบรต") !== -1) {
                    mappedState = POSTURE_GOOD; 
                    rawSpineAngle = 0;
                    rawNeckFlex = 0;
                } else if (data.status && data.status.indexOf("ไม่พบร่างกาย") !== -1) {
                    mappedState = POSTURE_EMPTY;
                }

                // Update system variables for widgets & charts
                spineAngle = rawSpineAngle;
                neckFlex = rawNeckFlex;

                renderTelemetryUI();

                // If no ESP32 hardware is connected, Python drives dashboard ticks!
                if (!isConnected) {
                    updateStateFromPython(mappedState, data.status);
                }
            })
            .catch(err => {
                console.warn("Python AI state polling fail:", err);
            });
    }, 1000);
}

function stopPythonPoll() {
    if (pythonPollInterval) {
        clearInterval(pythonPollInterval);
        pythonPollInterval = null;
    }
}

function updateStateFromPython(mappedState, pythonStatusText) {
    const rawState = mappedState;
    
    if (rawState === POSTURE_EMPTY || confirmedPostureState === POSTURE_EMPTY) {
        confirmedPostureState = rawState;
        pendingPostureState = rawState;
        postureChangeTimer = 0;
    } else if (rawState !== pendingPostureState) {
        pendingPostureState = rawState;
        postureChangeTimer = STABILIZATION_TIME_SECONDS;
    }
    
    let isProcessing = false;
    if (postureChangeTimer > 0) {
        postureChangeTimer--;
        isProcessing = true;
        
        if (postureChangeTimer === 0) {
            confirmedPostureState = pendingPostureState;
            isProcessing = false;
        }
    }
    
    const activeStateToShow = confirmedPostureState;
    postureDurations[activeStateToShow]++;
    trackSlouchCount(activeStateToShow);
    
    animateAvatar(activeStateToShow, spineAngle, neckFlex, sidewaysAngle);
    
    if (isProcessing && confirmedPostureState !== pendingPostureState) {
        const translatedPendingState = getTranslatedState(pendingPostureState);
        const processingLabelEn = `AI Processing... (Transitioning to: ${translatedPendingState} in ${postureChangeTimer + 1}s)`;
        const processingLabelTh = `AI กำลังประมวลผล... (กำลังเปลี่ยนเป็น: ${translatedPendingState} ใน ${postureChangeTimer + 1} วิ)`;
        
        elAvatarStatusDesc.textContent = currentLanguage === 'en' ? processingLabelEn : processingLabelTh;
        elPostureStateTag.textContent = currentLanguage === 'en' ? "Analyzing..." : "กำลังวิเคราะห์...";
        elPostureStateTag.className = "tag secondary";
    } else {
        if (pythonStatusText === "รอคาลิเบรต") {
            elAvatarStatusDesc.textContent = currentLanguage === 'en' 
                ? "Waiting for Python AI calibration. Sit straight and press 'c' or click Calibrate on the website."
                : "กำลังรอการคาลิเบรตของ Python AI กรุณานั่งหลังตรงแล้วกด Calibrate";
            elPostureStateTag.textContent = currentLanguage === 'en' ? "Wait Calibrate" : "รอคาลิเบรต";
            elPostureStateTag.className = "tag secondary";
        } else {
            const translatedState = getTranslatedState(activeStateToShow);
            elPostureStateTag.textContent = translatedState;
            
            if (activeStateToShow === POSTURE_GOOD) {
                elPostureStateTag.className = "tag success";
                elAvatarStatusDesc.textContent = currentLanguage === 'en'
                    ? "Your posture looks great! Maintain this straight neck and spine alignment."
                    : "ท่านั่งของคุณปกติและมีความปลอดภัยสูง พยายามรักษาระดับกระดูกสันหลังและคอตรงนี้ไว้";
            } else if (activeStateToShow === POSTURE_EMPTY) {
                elPostureStateTag.className = "tag secondary";
                elAvatarStatusDesc.textContent = currentLanguage === 'en'
                    ? "Chair is currently empty. Monitor will resume when body is detected."
                    : "ไม่มีคนนั่งอยู่บนเก้าอี้ ระบบจะติดตามความสมดุลอีกครั้งเมื่อพบร่างกาย";
            } else {
                elPostureStateTag.className = "tag danger";
                elAvatarStatusDesc.textContent = currentLanguage === 'en'
                    ? `Warning: Bad posture detected (${translatedState}). Please adjust your seating position.`
                    : `คำเตือน: ตรวจพบการนั่งผิดท่า (${translatedState}) กรุณาปรับเปลี่ยนท่านั่งของคุณ`;
            }
        }
    }
    
    // Accumulate sitting risks
    if (typeof updateSittingRisks === 'function') {
        updateSittingRisks(activeStateToShow);
    }
    
    // Increment timer
    if (activeStateToShow !== POSTURE_EMPTY) {
        sessionSeconds++;
        const mins = Math.floor(sessionSeconds / 60);
        const secs = sessionSeconds % 60;
        elSessionTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
