// ErgoAI Real-time Posture Classifier & AI Health Coach Engine

// Posture categories
const POSTURE_EMPTY = 'Empty Chair';
const POSTURE_GOOD = 'Straight Sitting';
const POSTURE_SLOUCHED = 'Slouched';
const POSTURE_NECK_FORWARD = 'Neck Forward';
const POSTURE_LEANING_SIDE = 'Leaning Side';

// Risk State variables (Percentages 0-100)
let riskCervical = 12; // starts at baseline low
let riskLumbar = 8;
let riskPelvic = 5;
let riskDvt = 15;

// Cumulative time in seconds for each posture in the current session
let postureDurations = {
    [POSTURE_GOOD]: 0,
    [POSTURE_SLOUCHED]: 0,
    [POSTURE_NECK_FORWARD]: 0,
    [POSTURE_LEANING_SIDE]: 0,
    [POSTURE_EMPTY]: 0
};

// Consecutive sitting duration (for DVT warning)
let consecutiveSittingSeconds = 0;
let totalWarningsCount = 0;
let activeBreaksCount = 0;

// Threshold values for classification
const THRESHOLDS = {
    PRESSURE_OCCUPIED: 15,     // Pressure above 15% means chair is occupied
    SLOUCH_ANGLE_MIN: 15,      // Spine roll angle > 15 deg is slouched
    LEAN_BACK_ANGLE_MIN: -20,  // Spine roll angle < -20 deg is leaning too far back
    NECK_FLEXION_MIN: 30,      // Neck flexion > 30% is forward neck
    SIDE_TILT_MIN: 12          // Sideways tilt > 12 deg is leaning side
};

/**
 * Classifies raw sensor inputs into one of the posture states.
 * @param {number} spine - Spine Tilt Angle in degrees
 * @param {number} neck - Neck flexion in percentage
 * @param {number} pressure - Seat contact pressure in percentage
 * @param {number} side - Sideways tilt angle in degrees
 * @returns {string} Posture State
 */
function classifyPosture(spine, neck, pressure, side) {
    if (pressure < THRESHOLDS.PRESSURE_OCCUPIED) {
        return POSTURE_EMPTY;
    }

    // Check sideways tilt first
    if (Math.abs(side) > THRESHOLDS.SIDE_TILT_MIN) {
        return POSTURE_LEANING_SIDE;
    }

    // Check neck bend next
    if (neck > THRESHOLDS.NECK_FLEXION_MIN) {
        return POSTURE_NECK_FORWARD;
    }

    // Check spine roll (forward slouch)
    if (spine > THRESHOLDS.SLOUCH_ANGLE_MIN) {
        return POSTURE_SLOUCHED;
    }

    // Check excessive leaning back
    if (spine < THRESHOLDS.LEAN_BACK_ANGLE_MIN) {
        return POSTURE_SLOUCHED;
    }

    return POSTURE_GOOD;
}

/**
 * Updates long-term health risks based on current sitting state
 * Called once per second
 */
function updateLongTermRisks(currentPosture) {
    if (currentPosture === POSTURE_EMPTY) {
        // Slowly recover/decay risk if standing up
        consecutiveSittingSeconds = 0;
        riskCervical = Math.max(5, riskCervical - 0.1);
        riskLumbar = Math.max(5, riskLumbar - 0.1);
        riskPelvic = Math.max(5, riskPelvic - 0.1);
        riskDvt = Math.max(5, riskDvt - 0.2);
    } else {
        consecutiveSittingSeconds++;
        
        // Accumulate risk based on posture type
        if (currentPosture === POSTURE_GOOD) {
            riskCervical = Math.max(5, riskCervical - 0.05);
            riskLumbar = Math.max(5, riskLumbar - 0.05);
            riskPelvic = Math.max(5, riskPelvic - 0.05);
            
            // DVT risk is strictly time-dependent (sitting too long)
            riskDvt = Math.min(100, riskDvt + 0.05);
        } else if (currentPosture === POSTURE_SLOUCHED) {
            riskLumbar = Math.min(100, riskLumbar + 0.3);
            riskCervical = Math.min(100, riskCervical + 0.05); // slight secondary neck strain
            riskDvt = Math.min(100, riskDvt + 0.08); // bad circulation
        } else if (currentPosture === POSTURE_NECK_FORWARD) {
            riskCervical = Math.min(100, riskCervical + 0.35);
            riskLumbar = Math.min(100, riskLumbar + 0.05);
            riskDvt = Math.min(100, riskDvt + 0.08);
        } else if (currentPosture === POSTURE_LEANING_SIDE) {
            riskPelvic = Math.min(100, riskPelvic + 0.3);
            riskDvt = Math.min(100, riskDvt + 0.08);
        }
    }

    // Refresh UI elements
    renderRiskUI();
    updateAIRecommendation(currentPosture);
}

// Map risk percent to visual colors and labels (Bilingual)
function getRiskLevel(pct) {
    const isTh = (typeof currentLanguage !== 'undefined' && currentLanguage === 'th');
    if (pct < 30) {
        return { 
            label: isTh ? 'ความเสี่ยงต่ำ' : 'Low Risk', 
            class: 'badge-green', 
            colorClass: 'bg-success' 
        };
    }
    if (pct < 65) {
        return { 
            label: isTh ? 'ความเสี่ยงปานกลาง' : 'Moderate Risk', 
            class: 'badge-yellow', 
            colorClass: 'bg-warning' 
        };
    }
    return { 
        label: isTh ? 'ความเสี่ยงสูง' : 'High Risk', 
        class: 'badge-red', 
        colorClass: 'bg-danger' 
    };
}

// Render Risk metrics to the UI DOM
function renderRiskUI() {
    const cervicalObj = getRiskLevel(riskCervical);
    const lumbarObj = getRiskLevel(riskLumbar);
    const pelvicObj = getRiskLevel(riskPelvic);
    const dvtObj = getRiskLevel(riskDvt);

    // Update cervical UI
    document.getElementById('risk-cervical-lbl').className = `risk-badge ${cervicalObj.class}`;
    document.getElementById('risk-cervical-lbl').textContent = cervicalObj.label;
    document.getElementById('risk-cervical-bar').className = `risk-fill ${cervicalObj.colorClass}`;
    document.getElementById('risk-cervical-bar').style.width = `${riskCervical}%`;

    // Update lumbar UI
    document.getElementById('risk-lumbar-lbl').className = `risk-badge ${lumbarObj.class}`;
    document.getElementById('risk-lumbar-lbl').textContent = lumbarObj.label;
    document.getElementById('risk-lumbar-bar').className = `risk-fill ${lumbarObj.colorClass}`;
    document.getElementById('risk-lumbar-bar').style.width = `${riskLumbar}%`;

    // Update pelvic UI
    document.getElementById('risk-pelvic-lbl').className = `risk-badge ${pelvicObj.class}`;
    document.getElementById('risk-pelvic-lbl').textContent = pelvicObj.label;
    document.getElementById('risk-pelvic-bar').className = `risk-fill ${pelvicObj.colorClass}`;
    document.getElementById('risk-pelvic-bar').style.width = `${riskPelvic}%`;

    // Update DVT UI
    document.getElementById('risk-dvt-lbl').className = `risk-badge ${dvtObj.class}`;
    document.getElementById('risk-dvt-lbl').textContent = dvtObj.label;
    document.getElementById('risk-dvt-bar').className = `risk-fill ${dvtObj.colorClass}`;
    document.getElementById('risk-dvt-bar').style.width = `${riskDvt}%`;

    // Update global badge in sidebar
    const maxRisk = Math.max(riskCervical, riskLumbar, riskPelvic, riskDvt);
    const globalObj = getRiskLevel(maxRisk);
    const globalBadge = document.getElementById('risk-badge');
    
    // Shorten tag for display
    const labelText = globalObj.label;
    globalBadge.textContent = (typeof currentLanguage !== 'undefined' && currentLanguage === 'th') 
        ? labelText.replace('ความเสี่ยง', '') 
        : labelText.split(' ')[0];
        
    globalBadge.className = `badge ${maxRisk < 30 ? '' : (maxRisk < 65 ? 'warning' : 'danger')}`;
}

// Generate context-aware recommendations based on current posture status
function updateAIRecommendation(currentPosture) {
    const recDesc = document.getElementById('ai-rec-desc');
    const recBox = document.getElementById('ai-rec-box');
    const lang = (typeof currentLanguage !== 'undefined') ? currentLanguage : 'en';

    if (currentPosture === POSTURE_EMPTY) {
        recDesc.textContent = TRANSLATIONS[lang]['ai-rec-empty'];
        recBox.style.borderColor = "var(--text-muted)";
        return;
    }

    if (currentPosture === POSTURE_GOOD) {
        if (consecutiveSittingSeconds > 1800) { // 30 minutes
            recDesc.textContent = TRANSLATIONS[lang]['ai-rec-sitting-long'];
            recBox.style.borderColor = "var(--info)";
        } else {
            recDesc.textContent = TRANSLATIONS[lang]['ai-rec-stable'];
            recBox.style.borderColor = "var(--success)";
        }
    } else if (currentPosture === POSTURE_SLOUCHED) {
        recDesc.textContent = TRANSLATIONS[lang]['ai-rec-warn-slouch'];
        recBox.style.borderColor = "var(--danger)";
    } else if (currentPosture === POSTURE_NECK_FORWARD) {
        recDesc.textContent = TRANSLATIONS[lang]['ai-rec-warn-neck'];
        recBox.style.borderColor = "var(--warning)";
    } else if (currentPosture === POSTURE_LEANING_SIDE) {
        recDesc.textContent = TRANSLATIONS[lang]['ai-rec-warn-side'];
        recBox.style.borderColor = "var(--info)";
    }
}

/**
 * AI Ergonomics Coach chatbot response generator (Bilingual)
 * @param {string} userText - User text message
 * @returns {string} Response text
 */
function generateAIResponse(userText) {
    const txt = userText.toLowerCase();
    const isTh = (typeof currentLanguage !== 'undefined' && currentLanguage === 'th');

    if (isTh) {
        // Thai Conversational logic
        // 1. Neck stretch
        if (txt.includes('neck') || txt.includes('stretch') || txt.includes('shoulder') || 
            txt.includes('คอ') || txt.includes('บ่า') || txt.includes('ไหล่') || txt.includes('เมื่อย') || txt.includes('ยืด')) {
            return `นี่คือขั้นตอนการยืดคอและบ่าใน **2 นาที** เพื่อคลายความเมื่อยล้าครับ:
1. **ท่าเก็บคาง (Chin Tucks - 10 ครั้ง):** นั่งตัวตรง มองตรงไปข้างหน้า จากนั้นเกร็งคอดึงคางกลับมาด้านหลังตรงๆ (ให้เหมือนมีคางสองชั้น) ค้างไว้ 2 วินาทีแล้วปล่อย ท่านี้ช่วยลดภาวะยื่นคอ
2. **ท่ายืดกล้ามเนื้อคอด้านข้าง (ข้างละ 30 วินาที):** นั่งทับมือขวา ใช้มือซ้ายอ้อมเอียงศีรษะดึงหูซ้ายลงไปใกล้ไหล่ซ้ายจนรู้สึกตึงกล้ามเนื้อบ่าด้านขวา
3. **ท่าหนีบสะบัก (Shoulder Blade Squeezes - 10 ครั้ง):** ดึงหัวไหล่ไปทางด้านหลังและกดลงล่าง พยายามเกร็งหนีบสะบักเข้าหากันค้างไว้ 3 วินาที เหมือนมีดินสอคั่นอยู่`;
        }

        // 2. Chair adjustment
        if (txt.includes('chair') || txt.includes('adjust') || txt.includes('seat') || 
            txt.includes('เก้าอี้') || txt.includes('ปรับ') || txt.includes('โต๊ะ')) {
            return `ขั้นตอนการปรับเก้าอี้เพื่อสุขภาพท่านั่งที่ดี **ตามหลักสรีรศาสตร์ 4 ขั้นตอน**:
1. **ความสูงของเบาะนั่ง:** ปรับให้ฝ่าเท้าวางราบกับพื้นได้เต็มเท้า และเข่าทำมุม 90 องศา สะโพกสูงกว่าหรือเสมอกับเข่าเล็กน้อย
2. **มุมพนักพิง:** ปรับเอนพนักพิงให้อยู่ระหว่าง 100-110 องศา (ไม่ตั้งตรงเป๊ะ) ท่านี้ช่วยลดแรงกดทับที่หมอนรองกระดูกหลัง
3. **ที่หนุนหลังส่วนล่าง (Lumbar Support):** ปรับเบาะดันหลังให้พอดีกับส่วนโค้งของหลังส่วนล่าง (ประมาณระดับเข็มขัด) เพื่อกันไม่ให้หลังค่อม
4. **ที่เท้าแขน (Armrests):** ปรับสูงพอที่จะให้บ่าผ่อนคลาย ข้อศอกงอ 90 องศาขณะพิมพ์งาน และข้อมือระนาบตรง`;
        }

        // 3. Back / Lumbar pain
        if (txt.includes('back') || txt.includes('pain') || txt.includes('lumbar') || txt.includes('spine') || 
            txt.includes('หลัง') || txt.includes('ปวด') || txt.includes('หมอนรอง')) {
            return `**อาการปวดหลังส่วนล่างและท่านั่ง:**
เมื่อคุณนั่งหลังค่อม แนวกระดูกสันหลังจะเปลี่ยนจากทรงตัว S เป็นทรงตัว C ทำให้แรงกดทับทั้งหมดไปตกลงที่กระดูกสันหลังและหมอนรองกระดูกส่วนล่าง การนั่งในท่านี้ต่อเนื่องจะทำให้หมอนรองกระดูกเสื่อมหรือกล้ามเนื้อหลังเกร็งตึงจนเกิดอาการปวดเรื้อรัง

**คำแนะนำแก้ปวดทันที:**
1. ลุกขึ้นยืน เอามือค้ำบริเวณบั้นท้าย แล้วค่อยๆ แอ่นตัวไปด้านหลังช้าๆ เพื่อยืดข้อต่อ
2. ตรวจสอบให้แน่ใจว่าเก้าอี้มีเบาะดันหลังที่พอดี
3. ทุกๆ 45 นาที ให้ยืนขึ้นขยับร่างกายหรือเดิน 1-2 นาที กระดูกสันหลังต้องการการเคลื่อนไหวเพื่อฟื้นฟูตัวเองครับ!`;
        }

        // 4. ESP32 Sensor Setup
        if (txt.includes('esp32') || txt.includes('sensor') || txt.includes('connect') || 
            txt.includes('เชื่อมต่อ') || txt.includes('บอร์ด')) {
            return `วิธีการเชื่อมต่อระบบ **เก้าอี้อัจฉริยะ ESP32**:
1. เปิดแถบ **เฟิร์มแวร์ ESP32** ด้านซ้ายเพื่อดูแผนผังการต่อเซนเซอร์และคัดลอกโค้ด
2. เชื่อมต่อเซนเซอร์วัดมุม MPU6050 และเซนเซอร์วัดแรงกดเบาะนั่ง FSR เข้ากับบอร์ด
3. อัปโหลดโค้ดลงบอร์ดผ่านโปรแกรม Arduino IDE
4. ไปที่หน้าแรกและเลือกโหมดการเชื่อมต่อที่สะดวก (บลูทูธ, สาย USB, หรือ Wi-Fi) แล้วกดเชื่อมต่อ
5. หากยังไม่มีอุปกรณ์ สามารถเปิดสวิตช์ **โหมดจำลองฮาร์ดแวร์** ในตัวเลือก Simulator เพื่อทดลองใช้งานหน้าเว็บได้ทันที`;
        }

        // Default Fallback
        return `ผมคือโค้ชกายภาพส่วนตัว ErgoAI ยินดีที่ได้ให้บริการครับ

จากสถิติเซสชันการนั่งปัจจุบันของคุณ:
- คะแนนท่านั่งของคุณตอนนี้อยู่ที่ **${document.getElementById('analytic-score').textContent}/100**
- ระบบตรวจพบการนั่งผิดท่าสะสมไปแล้ว **${totalWarningsCount} ครั้ง**

พิมพ์ข้อความสั้นๆ เพื่อให้ผมช่วยเหลือ:
- พิมพ์ **"ยืดคอ"** หรือ **"เมื่อย"** เพื่อดูท่ายืดเหยียดคอและบ่า
- พิมพ์ **"เก้าอี้"** หรือ **"ปรับ"** เพื่อดูวิธีจัดท่านั่งและโต๊ะทำงาน
- พิมพ์ **"ปวดหลัง"** เพื่อหาวิธีบรรเทาอาการปวดหลังส่วนล่าง`;

    } else {
        // English Conversational logic
        // 1. Neck stretch queries
        if (txt.includes('neck') || txt.includes('stretch') || txt.includes('shoulder')) {
            return `Here is a quick **2-Minute Neck & Shoulder Relief Routine**:
1. **Chin Tucks (10 times):** Sit tall, look straight, and pull your chin straight back (like making a double chin). Hold for 2 seconds. This counteracts forward head posture.
2. **Upper Trapezius Stretch (30s each side):** Sit on your right hand, place your left hand on top of your head, and gently pull your left ear toward your left shoulder. Feel the stretch on the right side.
3. **Shoulder Blade Squeezes (10 times):** Pull your shoulders back and down, squeeze your shoulder blades together like you are holding a pencil between them. Hold for 3 seconds.`;
        }

        // 2. Chair adjustment queries
        if (txt.includes('chair') || txt.includes('adjust') || txt.includes('seat')) {
            return `To adjust your chair for **maximum ergonomic support**, follow these 4 steps:
1. **Seat Height:** Adjust so your feet rest flat on the floor, and your knees are at a 90-degree angle, slightly lower than or level with your hips.
2. **Backrest Angle:** Tilt the backrest to 100-110 degrees rather than perfectly upright. This decreases pressure on your spinal discs.
3. **Lumbar Support:** Place the lumbar cushion directly in the curve of your lower back (about belt level) to prevent slouching.
4. **Armrests:** Height should allow your shoulders to relax, with elbows bent at 90 degrees while typing. Your wrists should be flat, not angled.`;
        }

        // 3. Lumbar / Back pain queries
        if (txt.includes('back') || txt.includes('pain') || txt.includes('lumbar') || txt.includes('spine')) {
            return `**Lumbar Pain & Sitting Posture:**
When you slouch, the natural S-curve of your spine turns into a C-curve. This puts intense pressure on the front of your lumbar intervertebral discs. Over time, this causes disc bulging or lower back muscle spasms.

**Immediate Relief Action:**
1. Stand up, place your hands on your lower back/hips, and gently bend backward.
2. Ensure your chair has proper lumbar support.
3. Every 45 minutes, stand up and walk around for 1-2 minutes. Motion is lotion for the spine!`;
        }

        // 4. ESP32 queries
        if (txt.includes('esp32') || txt.includes('sensor') || txt.includes('connect')) {
            return `To connect your **ESP32 Smart Posture system**:
1. Go to the **ESP32 Firmware** tab to view the schematic wiring diagram and copy the code.
2. Connect an MPU6050 Accelerometer (for spine angle) and a Flex Sensor or Seat FSR resistor.
3. Upload the firmware from Arduino IDE.
4. On the **Real-time Dashboard** tab, select your preferred connection mode (Bluetooth BLE, USB Serial, or Wi-Fi) and click Connect. 
5. If you do not have hardware, simply toggle **Simulator Mode** in the Connection panel to test the dashboard.`;
        }

        // Default fallback
        return `I am your personal AI Ergonomics Coach. I process your sitting data to protect your spine. 

Based on your current session data:
- Your cumulative posture score is **${document.getElementById('analytic-score').textContent}/100**.
- You have accumulated **${totalWarningsCount} posture warnings**.

Let me know if you would like:
- **"stretches"** to relieve neck/shoulder tension.
- **"chair adjustments"** to customize your workstation.
- **"back pain tips"** to understand lower back strain.`;
    }
}
