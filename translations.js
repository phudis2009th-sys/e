// ErgoAI Bilingual Translation Dictionary (EN / TH)

const TRANSLATIONS = {
    en: {
        // Sidebar Navigation
        "brand-name": "ErgoAI",
        "brand-sub": "Ergonomic intelligence",
        "nav-dashboard": "Real-time Dashboard",
        "nav-coach": "AI Coach & Risks",
        "nav-analytics": "Posture Analytics",
        "nav-firmware": "ESP32 Firmware",
        "user-name": "Office Worker",
        "user-role": "Smart Seat Active",

        // Header Widgets
        "conn-offline": "ESP32 Offline",
        "conn-online": "ESP32 Online",
        "conn-connecting": "Connecting...",
        "conn-sim": "Simulator Active",
        
        // Tab 1: Dashboard
        "card-avatar-title": "Live Posture Avatar",
        "tag-idle": "Idle",
        "avatar-status-calibrate": "Sit in chair to begin calibration",
        "avatar-status-empty": "Chair unoccupied. Stand up & stretch.",
        "avatar-status-sitting": "Sitting: ",
        "alert-bad-posture": "Bad Posture Detected",
        "alert-msg-slouched": "Lower back slouch detected! Straighten your lumbar spine.",
        "alert-msg-neck": "Forward head lean! Slide your ears back over shoulders.",
        "alert-msg-side": "Sideways lean! Evenly balance your sitting weight.",
        "alert-msg-default": "Please sit straight up",
        
        "card-connect-title": "Connect ESP32 Sensor",
        "conn-tab-ble": "Bluetooth (BLE)",
        "conn-tab-serial": "USB Serial",
        "conn-tab-wifi": "Wi-Fi (WS)",
        "conn-tab-sim": "Simulator",
        
        "conn-desc-ble": "Pairs wirelessly via Web Bluetooth. Ideal for mobile or laptop devices without cables.",
        "conn-btn-ble": "Scan & Connect BLE",
        "conn-desc-serial": "Connects via USB cable. Highly stable connection directly reading Serial raw feeds.",
        "conn-btn-serial": "🔌 Connect via Serial Port",
        "conn-desc-wifi": "Enter the IP address shown in your ESP32 Serial Monitor to connect over WebSocket.",
        "conn-btn-wifi": "Connect",
        "conn-desc-sim": "No ESP32 hardware? Turn on simulator mode to control sensor values manually below.",
        "conn-label-sim": "Hardware Simulator Mode",

        "card-telemetry-title": "Sensor Telemetry",
        "tag-live": "Live Data",
        "gauge-spine": "Spine Angle",
        "gauge-spine-lbl-back": "Leaning Back",
        "gauge-spine-lbl-mid": "Straight",
        "gauge-spine-lbl-front": "Slouched",
        
        "gauge-neck": "Neck Flexion",
        "gauge-neck-lbl-flat": "Flat",
        "gauge-neck-lbl-mid": "Normal Flex",
        "gauge-neck-lbl-max": "Forward Neck",
        
        "gauge-pressure": "Seat Contact Pressure",
        "gauge-pressure-lbl-empty": "Empty",
        "gauge-pressure-lbl-mid": "Leaning Off",
        "gauge-pressure-lbl-max": "Fully Seated",

        // Tab 2: AI Coach
        "card-risk-title": "Long-Term Office Syndrome Risk Assessment",
        "risk-intro": "Our local AI processor evaluates cumulative biomechanical strain based on your live sitting history. Bad posture accumulates micro-damage that triggers chronic pain.",
        
        "risk-card-neck-title": "Neck & Shoulder Strain",
        "risk-card-neck-desc": "Triggers **Forward Head Posture** (Neck flexion > 30°), causing chronic tension headaches and neck vertebrae degeneration.",
        
        "risk-card-lumbar-title": "Lumbar Spine Compression",
        "risk-card-lumbar-desc": "Triggers **Herniated Disc Risk** (Slouch angle > 15°). Increases compression loads on spinal discs by up to 180% compared to standing.",
        
        "risk-card-pelvic-title": "Lateral Pelvic Tilt",
        "risk-card-pelvic-desc": "Triggers **Unbalanced Hip Pressure** (Sideways lean > 10°). Causes lateral spinal curvatures and muscle imbalance over weeks.",
        
        "risk-card-dvt-title": "Circulatory Stagnation (DVT)",
        "risk-card-dvt-desc": "Triggers **Leg Numbness & Varicose Veins**. Associated with sitting uninterrupted for > 60 minutes, regardless of posture quality.",
        
        "ai-rec-title": "AI Recommendation",
        "ai-rec-stable": "Your posture is currently stable. Maintain your back at a 90-110° angle and stand up for 2 minutes every hour.",
        "ai-rec-empty": "Chair unoccupied. Excellent opportunity to do a standing chest stretch or take a short walk to keep blood flowing.",
        "ai-rec-sitting-long": "You've been sitting straight for over 30 minutes! Your spine is aligned, but it is highly recommended to stand up for 1 minute to release hip pressure.",
        "ai-rec-warn-slouch": "AI Warning: Spine slouching detected. This pushes your lower vertebrae into flexion. Please slide your hips all the way back into the chair and lift your chest.",
        "ai-rec-warn-neck": "AI Warning: Neck forward strain detected. For every inch your head tilts forward, you double the load on your cervical vertebrae. Retract your chin backwards (double-chin stretch).",
        "ai-rec-warn-side": "AI Warning: Asymmetrical loading. You are leaning to one side, which compresses one side of your pelvic joints. Center your weight evenly on both sit-bones.",

        "card-chat-title": "AI Ergonomics Coach",
        "chat-sub": "Ask for stretches, chair adjustments, or pain relief",
        "chat-input-placeholder": "Type your ergonomic question...",
        "chat-btn-send": "Send",
        "chat-welcome-bot": "Hello! I am your AI Ergonomic Assistant. I monitor your sitting patterns in real-time. Feel free to ask me questions like:",
        "chat-welcome-opt-1": "How can I adjust my chair?",
        "chat-welcome-opt-2": "Give me a 2-minute neck stretch.",
        "chat-welcome-opt-3": "What are the symptoms of lumbar compression?",

        // Tab 3: Analytics
        "analytic-label-score": "Posture Score",
        "analytic-label-straight": "Straight Sitting Time",
        "analytic-label-warnings": "Bad Posture Warnings",
        "analytic-label-breaks": "Stand-up Alerts Cleared",
        
        "analytic-sub-pct-excellent": "Excellent",
        "analytic-sub-pct-warning": "Needs Work",
        "analytic-sub-pct-critical": "Critical",
        "analytic-sub-pct-total": "of total seated time",
        "analytic-sub-avg-hour": " / hour average",
        "analytic-sub-breaks-active": "Active stretch",
        
        "card-timeline-title": "Daily Posture Timeline",
        "card-timeline-sub": "Real-time status logged at 10-second intervals for the current session",
        "card-donut-title": "Posture Distribution",
        "card-donut-sub": "Comparison of sitting states",
        "card-weekly-title": "Weekly Ergo Score Trend",
        "card-weekly-sub": "Comparison of overall posture quality index over the past 7 days",

        // Tab 4: Firmware
        "card-firmware-title": "ESP32 Hardware Schematic & Code",
        "firmware-guide-head-1": "1. Required Components",
        "firmware-guide-comp-1": "ESP32 Dev Module (any version with Bluetooth BLE or Wi-Fi)",
        "firmware-guide-comp-2": "MPU6050 Accelerometer/Gyroscope (for measuring spine/back posture tilt angle)",
        "firmware-guide-comp-3": "Flex Sensor (or Force Sensitive Resistor - FSR) (mounted near the collar/neck area or on the seat to check alignment/occupancy)",
        "firmware-guide-comp-4": "Jumper wires & USB-C Cable",
        "firmware-guide-head-2": "2. Connection Pinout Diagram",
        "firmware-guide-head-3": "3. Ready-To-Flash Firmware Code",
        "firmware-guide-intro": "Copy the code below into your Arduino IDE, configure your Wi-Fi or compile directly for Bluetooth BLE / Web Serial connection mode.",
        "firmware-code-btn": "Copy Arduino Code",

        // Posture states translations
        "state-empty": "Empty Chair",
        "state-good": "Straight Sitting",
        "state-slouched": "Slouched",
        "state-neck": "Neck Forward",
        "state-side": "Leaning Side",

        // Simulator labels
        "sim-title": "🤖 ESP32 Hardware Simulator",
        "sim-preset-label": "Presets:",
        "sim-preset-empty": "Empty Chair",
        "sim-preset-good": "Good Sitting",
        "sim-preset-slouch": "Slouched",
        "sim-preset-forward": "Neck Forward",
        "sim-preset-lean": "Leaning Side",
        "sim-label-spine": "Spine Tilt Angle (-30° to 45°): ",
        "sim-label-neck": "Neck Flex Sensor (0 to 100): ",
        "sim-label-pressure": "Pressure Sensor / FSR (0 to 100): ",
        "sim-label-sideways": "Sideways Tilt Angle (-30° to 30°): ",
        
        // ESP32-CAM and Sidebar Connection additions
        "sidebar-connect-title": "ESP32 CONNECTION",
        "cam-card-title": "ESP32-CAM Live View",
        "cam-label-stream-url": "Stream IP / URL",
        "cam-btn-connect": "Connect Video",
        "cam-btn-disconnect": "Stop Video",
        "cam-mode-label": "Video Source:",
        "cam-mode-esp32cam": "ESP32-CAM IP Stream",
        "cam-mode-webcam": "Web Camera (Simulator)",
        "cam-status-offline": "Camera Offline",
        "cam-status-online": "Camera Live",
        "cam-overlay-toggle": "Show Diagnostic HUD",
        "sidebar-cam-toggle": "ESP32-CAM stream:",

        // Landing Page Additions
        "landing-title": "ErgoAI",
        "landing-subtitle": "Smart Ergonomic Posture Tracker",
        "landing-hero-head": "Master Your Sitting Posture",
        "landing-hero-desc": "ErgoAI combines advanced ESP32 sensor telemetry and real-time ESP32-CAM video streaming to protect you from Office Syndrome. Stabilized posture analysis updates in just 4 seconds to prevent joint strain and cervical fatigue.",
        "landing-btn-enter": "Start Monitoring",
        "landing-feat-title": "Core Features",
        "landing-feat-1-title": "Real-Time Telemetry",
        "landing-feat-1-desc": "Tracks spine curvature, sideways tilt, and neck flex angle using high-precision MPU6050 sensors.",
        "landing-feat-2-title": "Camera Posture HUD",
        "landing-feat-2-desc": "Integrates ESP32-CAM stream with a futuristic cybernetic overlay to map your skeletal joints.",
        "landing-feat-3-title": "AI Ergonomics Coach",
        "landing-feat-3-desc": "Predicts long-term office syndrome risks and answers posture queries in real-time.",
        "landing-footer": "Created for smart workplaces. Connect your ESP32 to get started."
    },
    th: {
        // Sidebar Navigation
        "brand-name": "ErgoAI",
        "brand-sub": "ระบบวิเคราะห์ท่านั่งอัจฉริยะ",
        "nav-dashboard": "แดชบอร์ดเรียลไทม์",
        "nav-coach": "AI โค้ช & ความเสี่ยง",
        "nav-analytics": "สถิติวิเคราะห์ท่านั่ง",
        "nav-firmware": "เฟิร์มแวร์ ESP32",
        "user-name": "พนักงานออฟฟิศ",
        "user-role": "เบาะนั่งอัจฉริยะทำงานอยู่",

        // Header Widgets
        "conn-offline": "ESP32 ออฟไลน์",
        "conn-online": "ESP32 ออนไลน์",
        "conn-connecting": "กำลังเชื่อมต่อ...",
        "conn-sim": "ใช้งานเครื่องจำลอง",
        
        // Tab 1: Dashboard
        "card-avatar-title": "โมเดลโครงร่างท่านั่งจริง",
        "tag-idle": "ว่าง",
        "avatar-status-calibrate": "กรุณานั่งลงบนเก้าอี้เพื่อเริ่มตั้งค่าเซนเซอร์",
        "avatar-status-empty": "ไม่มีผู้นั่งบนเก้าอี้ กรุณาลุกขึ้นยืนยืดเส้นยืดสาย",
        "avatar-status-sitting": "การนั่ง: ",
        "alert-bad-posture": "ตรวจพบท่านั่งที่ไม่เหมาะสม",
        "alert-msg-slouched": "ตรวจพบการนั่งหลังค่อม! กรุณายืดหลังตรง",
        "alert-msg-neck": "ศีรษะยื่นไปข้างหน้ามากเกินไป! กรุณาดึงคอกลับมาให้อยู่ในแนวไหล่",
        "alert-msg-side": "ตัวเอียงไปข้างใดข้างหนึ่ง! กรุณากระจายน้ำหนักลงบนสะโพกให้เท่ากัน",
        "alert-msg-default": "กรุณานั่งตัวตรงหลังตรง",
        
        "card-connect-title": "เชื่อมต่อเซนเซอร์ ESP32",
        "conn-tab-ble": "บลูทูธ (BLE)",
        "conn-tab-serial": "สาย USB Serial",
        "conn-tab-wifi": "Wi-Fi (WS)",
        "conn-tab-sim": "จำลองเซนเซอร์",
        
        "conn-desc-ble": "จับคู่แบบไร้สายผ่าน Web Bluetooth เหมาะสำหรับคอมพิวเตอร์พกพาและมือถือที่ไม่มีช่องต่อสาย",
        "conn-btn-ble": "สแกน & เชื่อมต่อบลูทูธ",
        "conn-desc-serial": "เชื่อมต่อโดยตรงผ่านสาย USB มีความเสถียรสูงสุดโดยอ่านค่าจาก Serial Feed ทันที",
        "conn-btn-serial": "🔌 เชื่อมต่อผ่านพอร์ต Serial",
        "conn-desc-wifi": "ระบุหมายเลข IP ที่แสดงในโปรแกรม Arduino IDE Serial Monitor เพื่อเชื่อมต่อผ่าน WebSocket",
        "conn-btn-wifi": "เชื่อมต่อ",
        "conn-desc-sim": "ไม่มีอุปกรณ์ ESP32? คุณสามารถเปิดโหมดเครื่องจำลองเพื่อปรับระดับเซนเซอร์ด้วยตัวเองได้ที่ด้านล่าง",
        "conn-label-sim": "โหมดจำลองฮาร์ดแวร์",

        "card-telemetry-title": "ข้อมูลจากเซนเซอร์ (Telemetry)",
        "tag-live": "ข้อมูลสด",
        "gauge-spine": "มุมกระดูกสันหลัง",
        "gauge-spine-lbl-back": "เอนหลัง",
        "gauge-spine-lbl-mid": "ตัวตรง",
        "gauge-spine-lbl-front": "หลังค่อม",
        
        "gauge-neck": "การเกร็ง/ก้มคอ",
        "gauge-neck-lbl-flat": "ปกติ",
        "gauge-neck-lbl-mid": "ก้มปานกลาง",
        "gauge-neck-lbl-max": "ยื่นคอมาก",
        
        "gauge-pressure": "แรงกดบนเบาะนั่ง",
        "gauge-pressure-lbl-empty": "ว่าง",
        "gauge-pressure-lbl-mid": "ทิ้งน้ำหนักเอียง",
        "gauge-pressure-lbl-max": "นั่งเต็มเบาะ",

        // Tab 2: AI Coach
        "card-risk-title": "การประเมินความเสี่ยงต่อโรคออฟฟิศซินโดรมระยะยาว",
        "risk-intro": "ระบบ AI ท้องถิ่นจะวิเคราะห์แรงกดทับและความเครียดของกล้ามเนื้อสะสมจากประวัติการนั่งจริง การนั่งผิดท่าเป็นเวลานานจะสะสมความเสียหายของโครงสร้างกระดูกและข้อ",
        
        "risk-card-neck-title": "ภาวะเกร็งและเมื่อยล้าคอ/บ่า",
        "risk-card-neck-desc": "กระตุ้นภาวะ **คอยื่นไปข้างหน้า** (ก้มคอ > 30 องศา) ส่งผลให้ปวดหัวเรื้อรัง (Tension Headache) และกระดูกคอเสื่อมก่อนวัย",
        
        "risk-card-lumbar-title": "แรงกดทับกระดูกสันหลังส่วนล่าง",
        "risk-card-lumbar-desc": "เสี่ยงต่อ **หมอนรองกระดูกทับเส้นประสาท** (มุมหลังค่อม > 15 องศา) เพิ่มแรงกดดันต่อหมอนรองกระดูกสันหลังขึ้นถึง 180% เมื่อเทียบกับการยืน",
        
        "risk-card-pelvic-title": "สะโพกและกระดูกเชิงกรานบิดเอียง",
        "risk-card-pelvic-desc": "กระตุ้นภาวะ **ข้อต่อสะโพกรับแรงไม่เท่ากัน** (ตัวเอียง > 10 องศา) ทำให้แนวกระดูกสันหลังคดงอและกล้ามเนื้อหลังฝั่งใดฝั่งหนึ่งตึงเรื้อรัง",
        
        "risk-card-dvt-title": "การไหลเวียนเลือดชะงัก (DVT)",
        "risk-card-dvt-desc": "เสี่ยงต่อภาวะ **เหน็บชา ลิ่มเลือดอุดตัน และเส้นเลือดขอด** สัมพันธ์กับการนั่งนิ่งๆ บนเก้าอี้ติดต่อกันเกิน 60 นาที โดยไม่ลุกขึ้นยืนเดิน",
        
        "ai-rec-title": "ข้อแนะนำจาก AI",
        "ai-rec-stable": "ท่านั่งของคุณปกติและมีความปลอดภัยสูงในขณะนี้ พยายามพิงหลังให้ราบกับเบาะที่ทำมุม 90-110 องศา และกรุณาลุกขึ้นยืดเส้นยืดสาย 2 นาทีทุกๆ 1 ชั่วโมง",
        "ai-rec-empty": "เก้าอี้ว่างอยู่ เป็นโอกาสดีที่จะยืดเหยียดหน้าอกในท่ายืน หรือเดินสั้นๆ เพื่อให้โลหิตไหลเวียนได้ดียิ่งขึ้น",
        "ai-rec-sitting-long": "คุณนั่งตัวตรงติดต่อกันเกิน 30 นาทีแล้ว! แม้หลังจะตรงดี แต่แนะนำให้ลุกขึ้นยืน 1 นาที เพื่อลดแรงกดทับสะโพกและกระดูกก้นกบ",
        "ai-rec-warn-slouch": "เตือนจาก AI: ตรวจพบการนั่งหลังค่อม ซึ่งจะดัดให้กระดูกสันหลังโค้งงอผิดรูป กรุณาเลื่อนก้นให้ชิดพนักพิงเก้าอี้และยืดอกขึ้น",
        "ai-rec-warn-neck": "เตือนจาก AI: ตรวจพบการยื่นคอไปข้างหน้า ทุกๆ 1 นิ้วที่คอยื่นไปข้างหน้าจะเพิ่มน้ำหนักกดทับกระดูกคอขึ้นอีกเท่าตัว กรุณาดึงคอและคางกลับไปด้านหลัง (ท่าเก็บคาง)",
        "ai-rec-warn-side": "เตือนจาก AI: น้ำหนักตัวกดทับไม่สมดุล คุณกำลังนั่งเอียงตัวส่งผลให้สะโพกฝั่งหนึ่งรับแรงกดทับสูง กรุณาปรับแนวกระดูกสันหลังให้ตรงและลงน้ำหนักที่ก้นทั้งสองข้างให้เท่ากัน",

        "card-chat-title": "AI โค้ชกายภาพส่วนตัว",
        "chat-sub": "ปรึกษาท่าทางยืดเหยียด วิธีปรับแต่งโต๊ะทำงาน หรือวิธีแก้อาการปวดเมื่อย",
        "chat-input-placeholder": "พิมพ์ถามคำถามกายภาพกับบอทที่นี่...",
        "chat-btn-send": "ส่งคำถาม",
        "chat-welcome-bot": "สวัสดีครับ! ผมคือบอทโค้ชกายภาพ ErgoAI ที่คอยเฝ้าระวังท่านั่งของคุณในแบบเรียลไทม์ คุณสามารถสอบถามคำถามสุขภาพได้ เช่น:",
        "chat-welcome-opt-1": "ปรับเก้าอี้ทำงานอย่างไรดี?",
        "chat-welcome-opt-2": "ขอท่ายืดคอ 2 นาทีหน่อย",
        "chat-welcome-opt-3": "กระดูกส่วนล่างถูกกดทับจะมีอาการอย่างไร?",

        // Tab 3: Analytics
        "analytic-label-score": "คะแนนท่านั่ง (Posture Score)",
        "analytic-label-straight": "เวลานั่งตัวตรงหลังตรง",
        "analytic-label-warnings": "จำนวนการเตือนนั่งผิดท่า",
        "analytic-label-breaks": "การปรับท่านั่งตามสัญญาณเตือน",
        
        "analytic-sub-pct-excellent": "ยอดเยี่ยม",
        "analytic-sub-pct-warning": "ควรปรับปรุง",
        "analytic-sub-pct-critical": "อันตราย",
        "analytic-sub-pct-total": "ของเวลาที่นั่งทั้งหมด",
        "analytic-sub-avg-hour": " ครั้งต่อชั่วโมง (เฉลี่ย)",
        "analytic-sub-breaks-active": "ปรับท่านั่งกลับมาตรง",
        
        "card-timeline-title": "กราฟบันทึกท่านั่งรายนาที",
        "card-timeline-sub": "ข้อมูลสดบันทึกจากเซนเซอร์ทุกๆ 10 วินาทีในรอบการทำงานปัจจุบัน",
        "card-donut-title": "สัดส่วนท่าทางขณะนั่งทำงาน",
        "card-donut-sub": "การเปรียบเทียบสัดส่วนของท่านั่งแต่ละประเภท",
        "card-weekly-title": "คะแนนท่านั่งสะสมรายสัปดาห์",
        "card-weekly-sub": "ดัชนีชี้วัดคุณภาพท่านั่งเปรียบเทียบในรอบ 7 วันที่ผ่านมา",

        // Tab 4: Firmware
        "card-firmware-title": "แผนผังการต่อวงจรและโค้ด ESP32",
        "firmware-guide-head-1": "1. อุปกรณ์ที่จำเป็นต้องใช้",
        "firmware-guide-comp-1": "บอร์ด ESP32 Dev Module (รุ่นใดก็ได้ที่มี Bluetooth BLE หรือ Wi-Fi)",
        "firmware-guide-comp-2": "เซนเซอร์วัดความเร่ง MPU6050 (ใช้ติดที่แผ่นหลังเพื่อวัดมุมเอียงกระดูกสันหลัง)",
        "firmware-guide-comp-3": "เซนเซอร์วัดการโค้งงอ Flex Sensor หรือ เซนเซอร์วัดแรงกดเบาะนั่ง FSR (ใช้ติดแถวปกคอเสื้อเพื่อวัดแนวกระดูกคอ หรือไว้ใต้เบาะนั่ง)",
        "firmware-guide-comp-4": "สายไฟเชื่อมต่อเบรดบอร์ด และ สาย USB-C สำหรับแฟลชบอร์ด",
        "firmware-guide-head-2": "2. แผนผังพินการเชื่อมต่อวงจร",
        "firmware-guide-head-3": "3. โค้ดต้นแบบสำหรับแฟลชลงบอร์ด",
        "firmware-guide-intro": "คัดลอกโค้ดด้านล่างนี้ลงในโปรแกรม Arduino IDE กำหนดค่า Wi-Fi หรือคอมไพล์สำหรับเชื่อมต่อผ่าน Bluetooth BLE / สาย USB Serial ได้โดยตรง",
        "firmware-code-btn": "คัดลอกโค้ด Arduino",

        // Posture states translations
        "state-empty": "เก้าอี้ว่าง",
        "state-good": "นั่งตัวตรง",
        "state-slouched": "นั่งหลังค่อม",
        "state-neck": "ศีรษะยื่นไปข้างหน้า",
        "state-side": "นั่งตัวเอียงข้าง",

        // Simulator labels
        "sim-title": "🤖 เครื่องจำลองบอร์ดเซนเซอร์ ESP32",
        "sim-preset-label": "ปุ่มเซ็ตค่าสำเร็จรูป:",
        "sim-preset-empty": "เก้าอี้ว่าง",
        "sim-preset-good": "ท่านั่งที่ดี",
        "sim-preset-slouch": "นั่งหลังค่อม",
        "sim-preset-forward": "คอยื่นหน้า",
        "sim-preset-lean": "นั่งเอียงตัว",
        "sim-label-spine": "มุมเอียงกระดูกสันหลัง (-30° ถึง 45°): ",
        "sim-label-neck": "เซนเซอร์ก้มคอ (0 ถึง 100): ",
        "sim-label-pressure": "เซนเซอร์วัดแรงกดเบาะ (0 ถึง 100): ",
        "sim-label-sideways": "มุมเอียงตัวออกด้านข้าง (-30° ถึง 30°): ",
        
        // ESP32-CAM and Sidebar Connection additions
        "sidebar-connect-title": "การเชื่อมต่อ ESP32",
        "cam-card-title": "กล้องไลฟ์ฟีด ESP32-CAM",
        "cam-label-stream-url": "ลิงก์สตรีม (IP/URL)",
        "cam-btn-connect": "เชื่อมต่อกล้อง",
        "cam-btn-disconnect": "ปิดกล้อง",
        "cam-mode-label": "แหล่งสัญญาณภาพ:",
        "cam-mode-esp32cam": "ลิงก์สตรีม ESP32-CAM",
        "cam-mode-webcam": "กล้องเว็บแคม (ตัวจำลอง)",
        "cam-status-offline": "กล้องออฟไลน์",
        "cam-status-online": "กล้องกำลังทำงาน",
        "cam-overlay-toggle": "แสดงเส้นโครงกระดูกอัจฉริยะ",
        "sidebar-cam-toggle": "เปิดระบบกล้องติดตามตัว:",

        // Landing Page Additions
        "landing-title": "ErgoAI",
        "landing-subtitle": "ระบบติดตามท่านั่งทำงานอัจฉริยะ",
        "landing-hero-head": "ปรับปรุงท่านั่งทำงานของคุณด้วย AI",
        "landing-hero-desc": "ErgoAI ผสานพลังข้อมูลเซนเซอร์จากบอร์ด ESP32 และกล้องไลฟ์ฟีด ESP32-CAM เพื่อป้องกันออฟฟิศซินโดรมอย่างมีประสิทธิภาพ ระบบจะประมวลผลและวิเคราะห์ความเสถียรของร่างกายใน 4 วินาทีเพื่อป้องกันความเมื่อยล้าสะสม",
        "landing-btn-enter": "เริ่มตรวจวัดท่านั่ง",
        "landing-feat-title": "ฟังก์ชันการทำงานหลัก",
        "landing-feat-1-title": "ข้อมูลเซนเซอร์เรียลไทม์",
        "landing-feat-1-desc": "ตรวจวัดมุมกระดูกสันหลัง การก้มคอ และการเอียงตัวซ้ายขวาอย่างละเอียดด้วยเซนเซอร์ MPU6050",
        "landing-feat-2-title": "กล้องอัจฉริยะตรวจจับสรีระ",
        "landing-feat-2-desc": "เชื่อมโยงสัญญาณกล้อง ESP32-CAM พร้อมเทคโนโลยี HUD โครงกระดูกเพื่อช่วยเช็คไหล่และจุดตึงตัว",
        "landing-feat-3-title": "โค้ช AI ประเมินสุขภาพ",
        "landing-feat-3-desc": "วิเคราะห์ความเสี่ยงโรคออฟฟิศซินโดรมสะสมรายวัน พร้อมตอบข้อสงสัยการยืดเหยียดร่างกาย",
        "landing-footer": "ออกแบบมาเพื่อสุขภาพของคนทำงานยุคใหม่ เชื่อมต่อเซนเซอร์ ESP32 ของคุณเพื่อเริ่มต้นใช้งาน"
    }
};
