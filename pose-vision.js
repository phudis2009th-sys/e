// ============================================================
// pose-vision.js — In-Browser Real-Time Posture Detection
// ============================================================
// Ports the core logic of the original Python posture monitor
// (MediaPipe Pose + OpenCV) to run 100% client-side in the browser
// using @mediapipe/tasks-vision, so the "Browser AI Camera" mode
// needs no local Python server.
//
// It reuses the SAME dashboard pipeline as the rest of ErgoAI
// (spineAngle / neckFlex / pressureValue / sidewaysAngle globals,
// classifyPosture(), updateStateFromPython(), the charts, and the
// long-term risk engine) — those are declared in app.js / ai-engine.js
// and are visible here because classic <script> tags share one
// global scope.
// ============================================================

(function () {
    const TASKS_VISION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
    const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
    const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

    let poseLandmarker = null;
    let modelLoading = false;
    let modelReady = false;
    let detectionActive = false;
    let rafId = null;
    let lastVideoTime = -1;
    let lastTickTs = 0;
    let chartTickCount = 0;

    // DOM refs, cached lazily so this file works regardless of script load order
    let videoEl, landmarksCanvas, statusEl, pythonHudCanvas;
    // true when videoEl is the ESP32-CAM <img> MJPEG stream instead of the webcam <video> element —
    // <img> has no readyState/currentTime, so the frame-change guard used for <video> can't apply to it.
    let sourceIsImage = false;

    function t(en, th) {
        return (typeof currentLanguage !== 'undefined' && currentLanguage === 'th') ? th : en;
    }

    function setStatus(text) {
        if (!statusEl) statusEl = document.getElementById('pose-vision-status');
        if (statusEl) statusEl.textContent = text;
    }

    // ---- Smoothing: median despike (window 5) -> EMA, ported from Python MedianDespike / ExponentialSmoother ----
    function createDespike(windowSize) {
        const hist = [];
        return function (value) {
            if (value === null || value === undefined) return null;
            hist.push(value);
            if (hist.length > windowSize) hist.shift();
            const sorted = [...hist].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length / 2)];
        };
    }
    function createEMA(alpha) {
        let val = null;
        return function (value) {
            if (value === null || value === undefined) return val;
            val = (val === null) ? value : (alpha * value + (1 - alpha) * val);
            return val;
        };
    }
    const smoothRatio = (() => { const d = createDespike(5); const e = createEMA(0.2); return v => e(d(v)); })();
    const smoothTilt = (() => { const d = createDespike(5); const e = createEMA(0.3); return v => e(d(v)); })();

    // ---- Calibration, ported from Python Calibrator ----
    function makeCalibrator(samplesNeeded) {
        return {
            samples: [],
            baseline: null,
            active: false,
            samplesNeeded,
            finishedAt: null, // timestamp (ms) of when calibration completed, used for the confirmation banner
            start() { this.samples = []; this.active = true; this.baseline = null; this.finishedAt = null; },
            feed(value) {
                if (!this.active || value === null || value === undefined) return;
                this.samples.push(value);
                if (this.samples.length >= this.samplesNeeded) {
                    this.baseline = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
                    this.active = false;
                    this.finishedAt = performance.now();
                }
            },
            justFinished() {
                return this.finishedAt !== null && (performance.now() - this.finishedAt) < 2500;
            }
        };
    }
    const straightCal = makeCalibrator(30);
    const hunchedCal = makeCalibrator(30);

    // Tracks the last classification so we can apply hysteresis (a Schmitt trigger) around
    // the threshold below. Without this, a ratio that sits right near `threshold` flickers
    // Good/Slouched every single tick from ordinary landmark jitter. Each flicker back to
    // "Good" resets updateStateFromPython()'s debounce timer AND handleWarningAlerts()'s
    // warningConsecutiveCount to 0, so the posture tag can get stuck and the warning popup
    // can go 5 seconds without ever accumulating enough consecutive "bad" ticks to fire.
    let lastMappedState = null;

    // Midpoint between the user's own straight/hunched baselines (or a relative fallback), ported from Python compute_threshold_value
    function computeThreshold() {
        if (straightCal.baseline === null) return null;
        if (hunchedCal.baseline !== null && hunchedCal.baseline < straightCal.baseline) {
            return straightCal.baseline - (straightCal.baseline - hunchedCal.baseline) * 0.5;
        }
        return straightCal.baseline - 0.06;
    }

    // Called from app.js when the Calibrate Straight / Calibrate Hunch buttons are clicked in Browser AI mode
    window.poseVisionCalibrate = function (type) {
        if (!detectionActive) {
            setStatus(t('Start the Browser AI camera first.', 'กรุณาเปิดกล้อง Browser AI ก่อน'));
            return;
        }
        if (type === 'straight') {
            straightCal.start();
            setStatus(t('Calibrating straight posture... sit tall and hold still (~2s)', 'กำลังคาลิเบรตท่านั่งตรง... นั่งหลังตรงค้างไว้สักครู่'));
        } else {
            hunchedCal.start();
            setStatus(t('Calibrating hunched posture... slouch as you normally would and hold still (~2s)', 'กำลังคาลิเบรตท่าค้อม... นั่งค้อมแบบที่ทำบ่อยๆ ค้างไว้สักครู่'));
        }
    };

    // ---- Model loading (dynamic ESM import works fine from a classic script) ----
    async function ensureModelLoaded() {
        if (modelReady) return true;
        if (modelLoading) {
            while (modelLoading) await new Promise(r => setTimeout(r, 150));
            return modelReady;
        }
        modelLoading = true;
        setStatus(t('Loading AI model (first run may take a moment)...', 'กำลังโหลดโมเดล AI (ครั้งแรกอาจใช้เวลาสักครู่)...'));
        try {
            const vision = await import(TASKS_VISION_CDN);
            const { PoseLandmarker, FilesetResolver } = vision;
            const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE);

            try {
                poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
                    runningMode: "VIDEO",
                    numPoses: 1
                });
            } catch (gpuErr) {
                console.warn("[PoseVision] GPU delegate failed, falling back to CPU:", gpuErr);
                poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
                    runningMode: "VIDEO",
                    numPoses: 1
                });
            }

            modelReady = true;
            setStatus(t('Ready! Sit up straight and click "Calibrate Straight" to begin.', 'พร้อมใช้งาน! นั่งหลังตรงแล้วกด "คาลิเบรตหลังตรง" เพื่อเริ่มต้น'));
            return true;
        } catch (err) {
            console.error("[PoseVision] Failed to load AI model:", err);
            const detail = (err && err.message) ? err.message : String(err);
            setStatus(t(
                `Failed to load the AI model: ${detail}`,
                `โหลดโมเดล AI ไม่สำเร็จ: ${detail}`
            ));
            modelReady = false;
            return false;
        } finally {
            modelLoading = false;
        }
    }

    // ---- Metric computation, ported from Python compute_posture_metrics ----
    // MediaPipe landmark indices: 0 = nose, 11 = left shoulder, 12 = right shoulder
    function computeMetrics(landmarks) {
        const nose = landmarks[0];
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        if (!nose || !leftShoulder || !rightShoulder) return null;
        if ((nose.visibility ?? 1) < 0.5 || (leftShoulder.visibility ?? 1) < 0.5 || (rightShoulder.visibility ?? 1) < 0.5) {
            return null;
        }

        const shoulderWidth = Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y);
        if (shoulderWidth < 1e-6) return null;

        const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        // Smaller ratio => nose has sunk toward the shoulder line => more hunched / forward head
        const noseToShoulderRatio = (midShoulderY - nose.y) / shoulderWidth;

        // Real geometric side-tilt: angle of the shoulder line from horizontal (degrees)
        const shoulderTiltDeg = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180 / Math.PI;

        return { noseToShoulderRatio, shoulderTiltDeg };
    }

    // ---- Draw the detected skeleton on its own overlay canvas (mirrored to match the video via CSS) ----
    const POSE_CONNECTIONS = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
        [24, 26], [26, 28], [0, 11], [0, 12]
    ];

    function drawLandmarks(landmarks) {
        if (!landmarksCanvas) return;
        const ctx = landmarksCanvas.getContext('2d');
        const w = landmarksCanvas.clientWidth, h = landmarksCanvas.clientHeight;
        landmarksCanvas.width = w;
        landmarksCanvas.height = h;
        ctx.clearRect(0, 0, w, h);
        if (!landmarks) return;

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)';
        ctx.lineWidth = 2;
        POSE_CONNECTIONS.forEach(([a, b]) => {
            const p1 = landmarks[a], p2 = landmarks[b];
            if (!p1 || !p2) return;
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
        });

        ctx.fillStyle = 'rgba(6, 182, 212, 0.95)';
        landmarks.forEach((p, i) => {
            if (i > 32) return; // skip fine-grained hand/face points, not used
            if ((p.visibility ?? 1) < 0.4) return;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // ---- Python-style status overlay, drawn directly on the video (mirrors the on-screen HUD from the original OpenCV script) ----
    const STATUS_STYLES = {
        noBody: { color: '#F59E0B', en: 'No person detected', th: 'ไม่พบร่างกายในกล้อง' },
        notCalibrated: { color: '#F59E0B', en: 'Waiting for calibration (sit up straight, click Calibrate Straight)', th: 'รอคาลิเบรต (นั่งหลังตรงแล้วกด "คาลิเบรตหลังตรง")' },
        slouched: { color: '#EF4444', en: 'Slouching', th: 'หลังค้อม' },
        leaning: { color: '#06B6D4', en: 'Leaning sideways', th: 'เอียงตัว' },
        good: { color: '#10B981', en: 'Good posture', th: 'ท่าทางปกติ' }
    };

    function drawPythonHud(statusKey, ratio, threshold) {
        if (!pythonHudCanvas) return;
        const w = pythonHudCanvas.clientWidth, h = pythonHudCanvas.clientHeight;
        if (w === 0 || h === 0) return;
        pythonHudCanvas.width = w;
        pythonHudCanvas.height = h;
        const ctx = pythonHudCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        // Small helper: legible text with a soft dark shadow, same trick the Python HUD needed for
        // readability over a busy camera background.
        function shadowText(text, x, y, size, color, align) {
            ctx.font = `700 ${size}px 'Plus Jakarta Sans', sans-serif`;
            ctx.textAlign = align || 'left';
            ctx.shadowColor = 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        }

        const pad = 12;
        const baseSize = Math.max(11, Math.min(18, w / 28));

        // 1. Top status line
        const style = STATUS_STYLES[statusKey] || STATUS_STYLES.noBody;
        shadowText(t(style.en, style.th), pad, pad + baseSize, baseSize, style.color, 'left');

        // 2. Live value line: current ratio | straight baseline | hunched baseline
        const straightTxt = straightCal.baseline !== null ? straightCal.baseline.toFixed(3) : t('not calibrated', 'ยังไม่คาลิเบรต');
        const hunchedTxt = hunchedCal.baseline !== null ? hunchedCal.baseline.toFixed(3) : t('not calibrated', 'ยังไม่คาลิเบรต');
        const ratioTxt = (ratio === null || ratio === undefined) ? '—' : ratio.toFixed(3);
        const valuesSize = Math.max(9, baseSize * 0.62);
        shadowText(
            t(`Current: ${ratioTxt}  |  Straight: ${straightTxt}  |  Hunched: ${hunchedTxt}`,
              `ค่าปัจจุบัน: ${ratioTxt}  |  ตรง: ${straightTxt}  |  ค้อม: ${hunchedTxt}`),
            pad, pad + baseSize + valuesSize + 8, valuesSize, '#FFFFFF', 'left'
        );

        let nextY = pad + baseSize + valuesSize + 8 + valuesSize + 10;

        // 3. Active calibration: progress text + bar (mirrors the Python cv2.rectangle progress bar)
        const activeCal = straightCal.active ? straightCal : (hunchedCal.active ? hunchedCal : null);
        const activeLabel = straightCal.active ? t('straight posture', 'ท่าหลังตรง') : t('hunched posture', 'ท่าค้อม');
        const finishedCal = straightCal.justFinished() ? straightCal : (hunchedCal.justFinished() ? hunchedCal : null);
        const finishedLabel = straightCal.justFinished() ? t('Straight posture', 'ท่าหลังตรง') : t('Hunched posture', 'ท่าค้อม');

        if (activeCal) {
            const progressRatio = Math.min(1, activeCal.samples.length / activeCal.samplesNeeded);
            shadowText(
                t(`Calibrating ${activeLabel}... (${activeCal.samples.length}/${activeCal.samplesNeeded}) hold still`,
                  `กำลังคาลิเบรต${activeLabel}... (${activeCal.samples.length}/${activeCal.samplesNeeded}) ค้างท่าไว้ ห้ามขยับ`),
                pad, nextY + valuesSize, valuesSize, '#FDE047', 'left'
            );
            nextY += valuesSize + 10;
            const barW = Math.min(260, w - pad * 2), barH = 14;
            ctx.fillStyle = 'rgba(80,80,80,0.75)';
            ctx.fillRect(pad, nextY, barW, barH);
            ctx.fillStyle = '#FDE047';
            ctx.fillRect(pad, nextY, barW * progressRatio, barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(pad, nextY, barW, barH);
            nextY += barH + 12;
        } else if (finishedCal) {
            // Green confirmation banner across the top, like the Python version's "saved!" banner
            const bannerH = 34;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
            ctx.fillRect(0, nextY - 4, w, bannerH);
            shadowText(
                t(`${finishedLabel} saved! (baseline = ${finishedCal.baseline.toFixed(3)})`,
                  `บันทึก${finishedLabel}สำเร็จแล้ว! (baseline = ${finishedCal.baseline.toFixed(3)})`),
                pad, nextY - 4 + bannerH - 10, valuesSize, '#FFFFFF', 'left'
            );
            nextY += bannerH + 10;
        }

        // 4. Bottom hint line
        const hintSize = Math.max(9, valuesSize * 0.92);
        shadowText(
            t('Use the "Calibrate Straight" / "Calibrate Hunch" buttons below (or press C / H)',
              'ใช้ปุ่ม "คาลิเบรตหลังตรง" / "คาลิเบรตค้อม" ด้านล่าง (หรือกด C / H)'),
            pad, h - pad, hintSize, 'rgba(255,255,255,0.85)', 'left'
        );
    }


    function pushDashboardTick(mappedState, pythonStyleStatusText) {
        if (typeof updateStateFromPython === 'function') {
            updateStateFromPython(mappedState, pythonStyleStatusText);
        }
        if (typeof updateAnalyticsMetrics === 'function') updateAnalyticsMetrics();
        if (typeof handleWarningAlerts === 'function' && typeof confirmedPostureState !== 'undefined') {
            handleWarningAlerts(confirmedPostureState);
        }

        chartTickCount++;
        if (chartTickCount >= 10) {
            chartTickCount = 0;
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            if (typeof addTimelineData === 'function') addTimelineData(timeStr, spineAngle, neckFlex);
            if (typeof updateDonutData === 'function' && typeof postureDurations !== 'undefined') {
                updateDonutData(
                    postureDurations[POSTURE_GOOD],
                    postureDurations[POSTURE_SLOUCHED],
                    postureDurations[POSTURE_NECK_FORWARD],
                    postureDurations[POSTURE_LEANING_SIDE],
                    postureDurations[POSTURE_EMPTY]
                );
            }
        }
    }

    // ---- Per-frame detection loop ----
    function detectFrame() {
        if (!detectionActive || !poseLandmarker || !videoEl) return;
        rafId = requestAnimationFrame(detectFrame);

        if (sourceIsImage) {
            // ESP32-CAM MJPEG <img>: no readyState/currentTime to check for a "new frame" like <video>
            // has, and the browser keeps repainting the same element as multipart bytes arrive. Just
            // make sure the stream has actually loaded something before running detection on it.
            if (!videoEl.complete || !videoEl.naturalWidth) return;
        } else {
            if (videoEl.readyState < 2 || videoEl.currentTime === lastVideoTime) return;
            lastVideoTime = videoEl.currentTime;
        }

        let result;
        try {
            result = poseLandmarker.detectForVideo(videoEl, performance.now());
        } catch (err) {
            return;
        }

        const landmarks = (result && result.landmarks && result.landmarks[0]) ? result.landmarks[0] : null;
        drawLandmarks(landmarks);

        let mappedState = (typeof POSTURE_EMPTY !== 'undefined') ? POSTURE_EMPTY : 'Empty Chair';
        let statusTextForTick = 'ไม่พบร่างกาย';
        let hudStatusKey = 'noBody';
        let hudRatio = null;
        let hudThreshold = null;

        if (landmarks) {
            const metrics = computeMetrics(landmarks);
            if (metrics) {
                const ratio = smoothRatio(metrics.noseToShoulderRatio);
                const tilt = smoothTilt(metrics.shoulderTiltDeg);

                straightCal.feed(ratio);
                hunchedCal.feed(ratio);

                pressureValue = 92; // a person is detected -> chair is occupied
                sidewaysAngle = tilt || 0;

                const threshold = computeThreshold();
                hudRatio = ratio;
                hudThreshold = threshold;
                if (threshold === null) {
                    // Not calibrated yet: stay neutral and prompt the user
                    mappedState = POSTURE_GOOD;
                    spineAngle = 0;
                    neckFlex = 10;
                    statusTextForTick = 'รอคาลิเบรต';
                    hudStatusKey = 'notCalibrated';
                    if (!straightCal.active) {
                        setStatus(t('Not calibrated yet — sit up straight and click "Calibrate Straight".', 'ยังไม่ได้คาลิเบรต — นั่งหลังตรงแล้วกด "คาลิเบรตหลังตรง"'));
                    }
                } else {
                    // Map the deviation from the user's own straight baseline onto the same
                    // degree/percentage scales the rest of the dashboard already understands.
                    const deviation = Math.max(0, (straightCal.baseline - ratio) / straightCal.baseline);
                    spineAngle = deviation * 90;                 // feeds Slouch detection (threshold ~15°)
                    neckFlex = Math.min(100, deviation * 180);   // feeds Neck-Forward detection (threshold ~30%)

                    // Hysteresis gap: scales with how far apart the user's own straight/hunched
                    // calibration points are, with a small floor so it still helps even when
                    // hunchedCal hasn't been calibrated (computeThreshold's -0.06 fallback).
                    const calSpan = (hunchedCal.baseline !== null)
                        ? (straightCal.baseline - hunchedCal.baseline)
                        : 0.06;
                    const gap = Math.max(0.006, calSpan * 0.15);

                    // Schmitt trigger: once slouched, require the ratio to climb back ABOVE
                    // threshold+gap to be considered good again (and vice versa). This is what
                    // keeps a boundary-hugging ratio from flip-flopping state every tick.
                    const isSlouched = (lastMappedState === POSTURE_SLOUCHED)
                        ? (ratio < threshold + gap)
                        : (ratio < threshold - gap);

                    if (isSlouched) {
                        mappedState = POSTURE_SLOUCHED;
                        statusTextForTick = 'หลังค้อม';
                        hudStatusKey = 'slouched';
                    } else {
                        mappedState = POSTURE_GOOD;
                        statusTextForTick = 'ท่าทางปกติ';
                        hudStatusKey = 'good';
                    }
                    lastMappedState = mappedState;

                    if (!straightCal.active && !hunchedCal.active) {
                        setStatus(t(
                            `Live: ${ratio.toFixed(3)}  |  threshold: ${threshold.toFixed(3)}  |  straight baseline: ${straightCal.baseline.toFixed(3)}`,
                            `ค่าปัจจุบัน: ${ratio.toFixed(3)}  |  เกณฑ์: ${threshold.toFixed(3)}  |  baseline หลังตรง: ${straightCal.baseline.toFixed(3)}`
                        ));
                    }
                }
            }
        } else {
            pressureValue = 0;
            spineAngle = 0;
            neckFlex = 0;
            sidewaysAngle = 0;
        }

        drawPythonHud(hudStatusKey, hudRatio, hudThreshold);

        if (typeof renderTelemetryUI === 'function') renderTelemetryUI();

        // Drive the dashboard's per-second state machine independently from the render/detection frame rate
        const now = performance.now();
        if (now - lastTickTs >= 1000) {
            lastTickTs = now;
            pushDashboardTick(mappedState, statusTextForTick);
        }
    }

    // Keyboard shortcuts (C = calibrate straight, H = calibrate hunched), mirroring the original Python hotkeys.
    // Ignored while the user is typing into a text field/select elsewhere on the dashboard.
    function handleKeydown(e) {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
        if (!detectionActive) return;
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            window.poseVisionCalibrate('straight');
        } else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            window.poseVisionCalibrate('hunched');
        }
    }

    // ---- Public start/stop, called from app.js's camera controls ----
    window.startPoseVisionDetection = async function (sourceElementId) {
        const elId = sourceElementId || 'webcam-feed';
        videoEl = document.getElementById(elId);
        sourceIsImage = !!videoEl && videoEl.tagName === 'IMG';
        landmarksCanvas = document.getElementById('pose-landmarks-canvas');
        pythonHudCanvas = document.getElementById('python-hud-canvas');
        statusEl = document.getElementById('pose-vision-status');
        if (!videoEl) return;

        const ok = await ensureModelLoaded();
        if (!ok) return;

        straightCal.baseline = null;
        hunchedCal.baseline = null;
        straightCal.active = false;
        hunchedCal.active = false;
        lastVideoTime = -1;
        lastTickTs = performance.now();
        chartTickCount = 0;
        detectionActive = true;
        document.addEventListener('keydown', handleKeydown);
        rafId = requestAnimationFrame(detectFrame);
    };

    window.stopPoseVisionDetection = function () {
        detectionActive = false;
        sourceIsImage = false;
        document.removeEventListener('keydown', handleKeydown);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (landmarksCanvas) {
            const ctx = landmarksCanvas.getContext('2d');
            ctx.clearRect(0, 0, landmarksCanvas.width, landmarksCanvas.height);
        }
        if (pythonHudCanvas) {
            const ctx = pythonHudCanvas.getContext('2d');
            ctx.clearRect(0, 0, pythonHudCanvas.width, pythonHudCanvas.height);
        }
        setStatus('');
    };
})();
