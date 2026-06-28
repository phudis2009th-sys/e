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

// ESP32-CAM and Camera stream state
let isCamStreamActive = false;
let cameraMode = 'mode-esp32cam'; // mode-esp32cam, mode-webcam
let isCamConnected = false;
let webcamStream = null;
let hudAnimationId = null;

// Posture state debouncing (4-second processing window)
let confirmedPostureState = 'Empty Chair'; // maps to POSTURE_EMPTY
let pendingPostureState = 'Empty Chair';
let postureChangeTimer = 0; // ticks (seconds) remaining to confirm change
const STABILIZATION_TIME_SECONDS = 4;

// DOM elements cache
let elConnectionBadge, elConnectionStatusText, elSessionTime, elPostureStateTag, elAvatarStatusDesc;
let elSpineVal, elSpineFill, elNeckVal, elNeckFill, elPressureVal, elPressureFill;
let elAvatarAlert, elAvatarAlertMsg, elSimToggle, elSimDock;
let elTorsoContour, elArmContour;

// Camera DOM elements cache
let elCamToggle, elCameraCard, elCamSourceSelect, elCamUrlContainer, elCamStreamUrl;
let elBtnConnectCam, elWebcamFeed, elEsp32camFeed, elCameraPlaceholder, elHudCanvas, elHudToggle, elCameraStatusTag;
let elConnModeSelect;

// Landing page and mobile responsive elements cache
let elLandingPage, elAppLayout, elBtnEnterDashboard, elMobileMenuBtn, elSidebarOverlay, elSidebar;
let elLandingLangEn, elLandingLangTh;

document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupTabNavigation();
    setupConnectionSelect();
    setupHardwareSimulator();
    setupCameraSystem();
    setupChatSystem();
    setupFirmwareCopy();
    setupDirectConnectButtons();
    setupLanguageSwitcher();
    setupLandingAndMobile();
    
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
    
    const landBtnEn = document.getElementById('landing-lang-btn-en');
    const landBtnTh = document.getElementById('landing-lang-btn-th');

    const updateLanguageUI = (lang) => {
        if (lang === 'en') {
            if (btnEn) btnEn.classList.add('active');
            if (btnTh) btnTh.classList.remove('active');
            if (landBtnEn) landBtnEn.classList.add('active');
            if (landBtnTh) landBtnTh.classList.remove('active');
        } else {
            if (btnTh) btnTh.classList.add('active');
            if (btnEn) btnEn.classList.remove('active');
            if (landBtnTh) landBtnTh.classList.add('active');
            if (landBtnEn) landBtnEn.classList.remove('active');
        }
        setLanguage(lang);
    };

    if (btnEn) btnEn.addEventListener('click', () => updateLanguageUI('en'));
    if (btnTh) btnTh.addEventListener('click', () => updateLanguageUI('th'));
    if (landBtnEn) landBtnEn.addEventListener('click', () => updateLanguageUI('en'));
    if (landBtnTh) landBtnTh.addEventListener('click', () => updateLanguageUI('th'));

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

    // A. Posture Classification (Raw sensor reading)
    const rawState = classifyPosture(spineAngle, neckFlex, pressureValue, sidewaysAngle);
    
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
    
    const activeStateToShow = confirmedPostureState;
    
    // C. Increment State durations (Only for stabilized/confirmed posture)
    postureDurations[activeStateToShow]++;
    
    // D. Update avatar visual representation (Animate using confirmed posture)
    animateAvatar(activeStateToShow, spineAngle, neckFlex, sidewaysAngle);
    
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

    // F. Update long-term syndrome risks accumulation (Only for confirmed posture)
    updateLongTermRisks(activeStateToShow);
    
    // G. Warning Sound / Visual alert checks (Only for confirmed posture)
    handleWarningAlerts(activeStateToShow);

    // H. Update analytics scorecards
    updateAnalyticsMetrics();

    // I. Add Chart values at 10-second intervals
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
                
            })
            .catch(err => {
                console.error("Copy failed:", err);
                alert("Failed to copy firmware text automatically.");
            });
    });
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
            
            if (cameraMode === 'mode-esp32cam') {
                elCamUrlContainer.classList.remove('hidden');
            } else {
                elCamUrlContainer.classList.add('hidden');
            }
        });
    }

    // Connect Camera button click
    if (elBtnConnectCam) {
        elBtnConnectCam.addEventListener('click', () => {
            if (isCamConnected) {
                stopAllStreams();
            } else {
                if (cameraMode === 'mode-esp32cam') {
                    const url = elCamStreamUrl.value.trim();
                    startESP32Cam(url);
                } else {
                    startWebcam();
                }
            }
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
    };
    
    elEsp32camFeed.onerror = () => {
        console.warn("Failed to load ESP32-CAM MJPEG stream");
        alert(currentLanguage === 'en'
            ? "Failed to load camera stream. Make sure the ESP32-CAM is connected to the same Wi-Fi network and the IP is correct."
            : "ไม่สามารถเชื่อมต่อกล้องได้ กรุณาตรวจสอบให้มั่นใจว่า ESP32-CAM อยู่บนเครือข่าย Wi-Fi เดียวกันและหมายเลข IP ถูกต้อง");
        stopAllStreams();
    };
}

// Stop all running camera feeds
function stopAllStreams() {
    isCamConnected = false;
    updateCameraStatus(false);
    stopHUDAnimation();
    
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
        const state = classifyPosture(spineAngle, neckFlex, pressureValue, sidewaysAngle);
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
        if (pressureValue > 10) {
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
    // Enter Dashboard transition
    if (elBtnEnterDashboard && elLandingPage && elAppLayout) {
        elBtnEnterDashboard.addEventListener('click', () => {
            elLandingPage.classList.add('hidden');
            elAppLayout.classList.remove('hidden');
            
            // Force redraw chart to adapt to container size
            window.dispatchEvent(new Event('resize'));
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
