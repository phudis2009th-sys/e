from __future__ import annotations

import argparse
import http.client
import math
import os
import queue
import threading
import time
import traceback
import urllib.error
import urllib.request
from collections import deque

import cv2
import keyboard
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ---------- รองรับ MediaPipe ทุกเวอร์ชัน ----------
import mediapipe as mp

try:
    mp_drawing = mp.solutions.drawing_utils
    mp_pose = mp.solutions.pose
except AttributeError:
    import mediapipe.python.solutions.drawing_utils as mp_drawing
    import mediapipe.python.solutions.pose as mp_pose

# ---------- Flask (ทางเลือก) สำหรับสตรีมวิดีโอไปที่ ErgoAI Web Dashboard ----------
# ถ้าไม่ได้ติดตั้ง flask ไว้ โปรแกรมจะยังรันหน้าต่าง OpenCV ได้ตามปกติ
# เพียงแต่จะไม่มีการสตรีมวิดีโอไปที่เว็บ (ติดตั้งด้วย: pip install flask)
try:
    from flask import Flask, Response, jsonify, request

    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False


# ============================================================
# ส่วนที่ 1: วาดข้อความภาษาไทย (cv2.putText วาดภาษาไทยไม่ได้)
# ============================================================
CANDIDATE_THAI_FONTS = [
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\tahomabd.ttf",
    r"C:\Windows\Fonts\leelawad.ttf",
    r"C:\Windows\Fonts\leelawui.ttf",
    r"C:\Windows\Fonts\angsana.ttc",
    "/usr/share/fonts/truetype/thai/Garuda.ttf",
    "/usr/share/fonts/truetype/tlwg/Garuda.ttf",
]


def load_thai_font(size: int) -> ImageFont.FreeTypeFont:
    for path in CANDIDATE_THAI_FONTS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    print("[คำเตือน] ไม่พบฟอนต์ภาษาไทยในเครื่อง ข้อความอาจแสดงผลไม่ถูกต้อง")
    return ImageFont.load_default()


class ThaiTextRenderer:
    """วาดข้อความภาษาไทยลงบนเฟรมของ OpenCV โดยใช้ Pillow"""

    def __init__(self) -> None:
        self._font_cache: dict[int, ImageFont.FreeTypeFont] = {}

    def _get_font(self, size: int) -> ImageFont.FreeTypeFont:
        if size not in self._font_cache:
            self._font_cache[size] = load_thai_font(size)
        return self._font_cache[size]

    def put_text(
        self,
        frame: np.ndarray,
        text: str,
        position: tuple[int, int],
        font_size: int,
        color_bgr: tuple[int, int, int],
    ) -> np.ndarray:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        draw = ImageDraw.Draw(pil_image)
        font = self._get_font(font_size)
        color_rgb = (color_bgr[2], color_bgr[1], color_bgr[0])
        draw.text(position, text, font=font, fill=color_rgb)
        return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


# ============================================================
# ส่วนที่ 2: สื่อสารกับ ESP32 ผ่าน WiFi/HTTP (non-blocking)
# ============================================================
class Esp32Notifier:
    """ส่งคำสั่งไปหา ESP32 ผ่าน HTTP โดยใช้ worker thread เดียว + persistent connection
    (keep-alive) แทนการเปิด connection ใหม่และสร้าง thread ใหม่ทุกครั้งที่แจ้งเตือน
    ทำให้ส่งสัญญาณได้เร็วขึ้นมาก (ไม่ต้องทำ TCP handshake ใหม่ทุกครั้ง) และเสถียรกว่าเดิม
    เพราะมีแค่ thread เดียวคอยจัดคิวคำสั่ง ไม่มีหลาย thread แย่งกันยิง request พร้อมกัน"""

    def __init__(self, ip: str, timeout: float = 1.0) -> None:
        self.ip = ip.strip()
        self.timeout = timeout
        self.enabled = bool(self.ip)
        self._lock = threading.Lock()
        self._last_error: str | None = None
        self._conn: http.client.HTTPConnection | None = None
        # คิวขนาดเล็ก: ถ้าคำสั่งเก่ายังค้างอยู่ (เช่น ESP32 ไม่ตอบ) ให้ทิ้งคำสั่งเก่า
        # แล้วส่งคำสั่งล่าสุดแทน จะได้ไม่หน่วงเวลาแจ้งเตือนจริง
        self._queue: "queue.Queue[str]" = queue.Queue(maxsize=2)
        if self.enabled:
            threading.Thread(target=self._run_worker, daemon=True).start()

    def _get_connection(self) -> http.client.HTTPConnection:
        if self._conn is None:
            self._conn = http.client.HTTPConnection(self.ip, timeout=self.timeout)
        return self._conn

    def _send(self, path: str) -> None:
        try:
            conn = self._get_connection()
            conn.request("GET", path)
            resp = conn.getresponse()
            resp.read()
            with self._lock:
                self._last_error = None
            print(f"[ESP32] ส่งคำสั่ง {path} สำเร็จ")
        except Exception as exc:  # noqa: BLE001 - ต้องกันทุก error จาก network ไม่ให้โปรแกรมหลัก crash
            with self._lock:
                self._last_error = str(exc)
            print(f"[ESP32] ส่งคำสั่ง {path} ล้มเหลว: {exc}")
            # connection อาจเสียแล้ว ปิดทิ้งแล้วสร้างใหม่ในครั้งถัดไปแทนใช้ตัวเดิมที่พัง
            try:
                if self._conn is not None:
                    self._conn.close()
            except Exception:
                pass
            self._conn = None

    def _run_worker(self) -> None:
        while True:
            path = self._queue.get()
            self._send(path)

    def _enqueue(self, path: str) -> None:
        if not self.enabled:
            return
        try:
            self._queue.put_nowait(path)
        except queue.Full:
            # คิวเต็ม แปลว่ามีคำสั่งเก่าค้างอยู่ ให้ทิ้งอันเก่าแล้วใส่คำสั่งใหม่แทน
            try:
                self._queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(path)
            except queue.Full:
                pass

    def alert(self) -> None:
        self._enqueue("/alert")

    def clear(self) -> None:
        self._enqueue("/clear")

    @property
    def last_error(self) -> str | None:
        with self._lock:
            return self._last_error


# ============================================================
# ส่วนที่ 2.5: ปุ่มลัดแบบ global (ทำงานได้แม้ไม่ได้คลิกหน้าต่างวิดีโอก่อน)
# ใช้ไลบรารี `keyboard` ดักจับปุ่มระดับระบบปฏิบัติการ
# หมายเหตุ: บน Windows อาจต้องรัน Python แบบ Run as Administrator
# ============================================================
class GlobalHotkeys:
    """ดักจับปุ่มคีย์บอร์ดระดับ OS โดยไม่ต้องคลิกโฟกัสหน้าต่างวิดีโอก่อน
    ใช้ threading.Event เป็นตัวส่งสัญญาณเข้าลูปหลัก (thread-safe)"""

    def __init__(self) -> None:
        self.quit_requested = threading.Event()
        self.calibrate_straight_requested = threading.Event()
        self.calibrate_hunched_requested = threading.Event()
        self._registered = False

    def register(self) -> None:
        try:
            # ปุ่ม a = ปิดโปรแกรม (global, ไม่ต้องคลิกหน้าต่างก่อน)
            keyboard.add_hotkey("a", self.quit_requested.set)
            keyboard.add_hotkey("c", self.calibrate_straight_requested.set)
            keyboard.add_hotkey("h", self.calibrate_hunched_requested.set)
            self._registered = True
            print("[ระบบ] ดักจับปุ่มลัดแบบ global สำเร็จ (กด a เพื่อปิดโปรแกรมได้ทันที ไม่ต้องคลิกหน้าต่างก่อน)")
        except Exception as exc:  # noqa: BLE001 - เช่น ไม่มีสิทธิ์ admin บน Windows
            print(
                f"[คำเตือน] ดักจับปุ่มลัดแบบ global ไม่สำเร็จ ({exc}) "
                "จะยังใช้ปุ่มผ่านหน้าต่างวิดีโอได้ตามปกติ (ต้องคลิกหน้าต่างก่อน) "
                "หากต้องการปุ่ม global ลองรัน Python แบบ Run as Administrator"
            )

    def unregister(self) -> None:
        if self._registered:
            try:
                keyboard.unhook_all_hotkeys()
            except Exception:
                pass


# ============================================================
# ส่วนที่ 2.6: สถานะที่ใช้ร่วมกันระหว่างลูปกล้อง (thread หลัก) กับเว็บเซิร์ฟเวอร์ (thread แยก)
# เก็บเฟรมล่าสุด (เข้ารหัส JPEG แล้ว) และสถานะท่าทางล่าสุด ป้องกันด้วย lock
# เพื่อให้ทั้งสอง thread อ่าน/เขียนพร้อมกันได้อย่างปลอดภัย
# ============================================================
class WebStreamState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._latest_jpeg: bytes | None = None
        self._latest_status: str = "ไม่พบร่างกาย"

    def update_frame(self, jpeg_bytes: bytes) -> None:
        with self._lock:
            self._latest_jpeg = jpeg_bytes

    def update_status(self, status_text: str) -> None:
        with self._lock:
            self._latest_status = status_text

    def get_frame(self) -> bytes | None:
        with self._lock:
            return self._latest_jpeg

    def get_status(self) -> str:
        with self._lock:
            return self._latest_status


def build_flask_app(web_state: WebStreamState, hotkeys: GlobalHotkeys) -> "Flask":
    """สร้างเว็บเซิร์ฟเวอร์ที่ ErgoAI Web Dashboard เรียกใช้ในโหมด
    'Python Pose AI Stream (Local)': /video_feed สำหรับสตรีมภาพ, /state สำหรับสถานะ,
    /calibrate สำหรับสั่งคาลิเบรตจากปุ่มบนเว็บ (ใช้ event เดียวกับปุ่มลัดคีย์บอร์ด c/h)"""
    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        # อนุญาตให้หน้าเว็บ (คนละ origin, เช่นเปิดจากไฟล์ในเครื่อง หรือ localhost คนละพอร์ต) เรียก fetch() ได้
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return response

    @app.route("/video_feed")
    def video_feed():
        def generate():
            boundary = b"--frame"
            while True:
                frame_bytes = web_state.get_frame()
                if frame_bytes is None:
                    time.sleep(0.05)
                    continue
                yield (
                    boundary + b"\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
                time.sleep(0.033)  # ~30fps สูงสุด กันสตรีมถี่เกินจำเป็น

        return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

    @app.route("/state")
    def state():
        return jsonify({"status": web_state.get_status()})

    @app.route("/calibrate")
    def calibrate():
        cal_type = request.args.get("type", "")
        if cal_type == "straight":
            hotkeys.calibrate_straight_requested.set()
            return jsonify({"ok": True, "type": "straight"})
        if cal_type == "hunched":
            hotkeys.calibrate_hunched_requested.set()
            return jsonify({"ok": True, "type": "hunched"})
        return jsonify({"ok": False, "error": "invalid type"}), 400

    @app.route("/")
    def index():
        return (
            "<h3>ErgoAI Python Pose AI stream is running.</h3>"
            "<p>Video: <a href='/video_feed'>/video_feed</a> | Status: <a href='/state'>/state</a></p>"
            "<img src='/video_feed' style='max-width:100%;'>"
        )

    return app


def start_web_server(web_state: WebStreamState, hotkeys: GlobalHotkeys, port: int) -> None:
    app = build_flask_app(web_state, hotkeys)
    # threaded=True: ให้รับหลาย request พร้อมกันได้ (สตรีมวิดีโอค้างไว้ยาว ๆ ระหว่างที่ /state ก็ต้องถูก poll ทุกวินาที)
    # use_reloader=False: กันไม่ให้ Flask spawn process ลูกซ้ำ (จะทำให้กล้องถูกเปิดซ้ำ)
    threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True),
        daemon=True,
    ).start()
    print(f"[เว็บ] เปิดสตรีมวิดีโอสำหรับ ErgoAI Web Dashboard ที่ http://localhost:{port}/video_feed")
    print("[เว็บ] ในหน้าเว็บ เลือก Video Source เป็น 'Python Pose AI Stream (Local)' แล้วกด Connect Video")


# ============================================================
# ส่วนที่ 3: อ่านค่าพารามิเตอร์จากบรรทัดคำสั่ง
# ============================================================
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ตรวจจับหลังค้อมจากกล้องด้วย MediaPipe Pose แล้วส่งแจ้งเตือนไป ESP32 ผ่าน WiFi"
    )
    parser.add_argument("--camera", type=int, default=0, help="หมายเลขกล้อง (default 0)")
    parser.add_argument(
        "--relative-threshold",
        type=float,
        default=0.06,
        help="ค่าที่ forward_depth ต้องเพิ่มขึ้นจาก baseline (ตอนนั่งหลังตรง) ถึงจะนับว่าค้อม "
        "(ใช้ 'ส่วนต่างจาก baseline' แทนค่าตายตัว เพื่อไม่ให้ระยะห่าง/มุมกล้องที่ต่างกันทำให้ false alarm)",
    )
    parser.add_argument(
        "--calibration-samples",
        type=int,
        default=30,
        help="จำนวนเฟรมที่ใช้เก็บค่าตอนคาลิเบรต (กด c) ยิ่งมาก = baseline นิ่งกว่าแต่ใช้เวลานานกว่า",
    )
    parser.add_argument(
        "--min-detection-confidence", type=float, default=0.5, help="ความมั่นใจขั้นต่ำสำหรับตรวจจับคน"
    )
    parser.add_argument(
        "--min-tracking-confidence", type=float, default=0.5, help="ความมั่นใจขั้นต่ำสำหรับติดตาม landmark"
    )
    parser.add_argument(
        "--esp32-ip",
        type=str,
        default="",
        help="IP address ของ ESP32 เช่น 192.168.1.41 (ว่างไว้ = รันแค่กล้อง ไม่ส่งสัญญาณ)",
    )
    parser.add_argument(
        "--hold-seconds",
        type=float,
        default=2.0,
        help="ต้องหลังค้อมต่อเนื่องกี่วินาทีก่อนแจ้งเตือนครั้งแรก (กันแจ้งเตือนเด้งเวลาก้มเล็กน้อย)",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=8.0,
        help="หลังแจ้งเตือนไปแล้ว ต้องรอกี่วินาทีก่อนแจ้งเตือนซ้ำได้อีก (ถ้ายังค้อมต่อเนื่อง)",
    )
    parser.add_argument(
        "--web-port",
        type=int,
        default=5000,
        help="พอร์ตของเว็บเซิร์ฟเวอร์สำหรับสตรีมวิดีโอไปที่ ErgoAI Web Dashboard (default 5000)",
    )
    parser.add_argument(
        "--disable-web",
        action="store_true",
        help="ปิดการสตรีมวิดีโอผ่านเว็บ (รันแค่หน้าต่าง OpenCV อย่างเดียวเหมือนเดิม)",
    )
    return parser.parse_args()


# ============================================================
# ส่วนที่ 4: คำนวณค่าท่าทางจาก landmark ของ MediaPipe
# ============================================================
def build_point(landmark) -> np.ndarray:
    return np.array([landmark.x, landmark.y], dtype=np.float32)


CORE_REQUIRED_KEYS = [
    mp_pose.PoseLandmark.LEFT_SHOULDER,
    mp_pose.PoseLandmark.RIGHT_SHOULDER,
    mp_pose.PoseLandmark.NOSE,
]


def compute_posture_metrics(landmarks) -> dict | None:
    """ต้องการแค่ไหล่ 2 ข้าง + จมูก เท่านั้น (ใช้ได้กับกล้องหน้าตรง)
    ใช้ตำแหน่ง 2D (x, y) แทนค่า z เพราะ z ของ MediaPipe จากกล้องตัวเดียว
    ไม่เสถียรและแยกความต่างระหว่างท่าตรง/ท่าค้อมได้ไม่ชัด
    เมตริกใหม่: ระยะจากจมูกถึงเส้นไหล่ (แนวตั้ง) หารด้วยความกว้างไหล่ (scale-invariant)
    เวลาก้ม/หลังค้อม จมูกจะยุบลงมาใกล้เส้นไหล่มากขึ้น ค่านี้จึงลดลงชัดเจน"""
    for key in CORE_REQUIRED_KEYS:
        if landmarks[key].visibility < 0.5:
            return None

    left_shoulder_lm = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder_lm = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    nose_lm = landmarks[mp_pose.PoseLandmark.NOSE]

    shoulder_width = math.hypot(
        right_shoulder_lm.x - left_shoulder_lm.x,
        right_shoulder_lm.y - left_shoulder_lm.y,
    )
    if shoulder_width < 1e-6:
        return None

    mid_shoulder_y = (left_shoulder_lm.y + right_shoulder_lm.y) / 2.0
    # ระยะจากจมูกถึงเส้นไหล่ (แนวตั้ง) หารด้วยความกว้างไหล่
    # ค่ายิ่งน้อย = หัวยุบลงมาใกล้ไหล่ = ยิ่งค้อม/ก้ม
    nose_to_shoulder_ratio = (mid_shoulder_y - nose_lm.y) / shoulder_width

    # forward_depth (z) เก็บไว้โชว์เป็นข้อมูลเสริมบนจอเฉยๆ ไม่ใช้ตัดสินใจหลักแล้ว
    mid_shoulder_z = (left_shoulder_lm.z + right_shoulder_lm.z) / 2.0
    forward_depth = mid_shoulder_z - nose_lm.z

    return {
        "forward_depth": forward_depth,
        "nose_to_shoulder_ratio": nose_to_shoulder_ratio,
    }


# ============================================================
# ส่วนที่ 5: ทำให้ค่าราบเรียบขึ้น (ลด noise ของ MediaPipe)
# ============================================================
class ExponentialSmoother:
    def __init__(self, alpha: float = 0.2) -> None:
        self.alpha = alpha
        self.value: float | None = None

    def update(self, new_value: float | None) -> float | None:
        if new_value is None:
            return None
        if self.value is None:
            self.value = new_value
        else:
            self.value = self.alpha * new_value + (1 - self.alpha) * self.value
        return self.value

    def reset(self) -> None:
        self.value = None


class MedianDespike:
    """กรองค่าผิดปกติ (spike) ทิ้งก่อนส่งเข้า exponential smoother
    MediaPipe บางเฟรมประเมิน z ผิดพลาดกระโดดไปไกลมากแบบไม่มีเหตุผล (เช่น สั่นจากแสง/มุมกล้อง)
    ค่าที่กระโดดเดี่ยวๆ แบบนี้ทำให้ตัวเลขบนจอ 'ไม่นิ่ง' และเกณฑ์ทำงานผิดเป็นครั้งคราว
    จึงใช้ median ของ N เฟรมล่าสุดแทนค่าดิบ ก่อนค่อยเอาไป smooth ต่อ"""

    def __init__(self, window_size: int = 5) -> None:
        self.window_size = window_size
        self.history: deque[float] = deque(maxlen=window_size)

    def update(self, new_value: float | None) -> float | None:
        if new_value is None:
            return None
        self.history.append(new_value)
        return float(np.median(self.history))

    def reset(self) -> None:
        self.history.clear()


class PostureMetricsSmoother:
    def __init__(self) -> None:
        # ขั้นที่ 1: กรอง spike ทิ้งด้วย median ของ 5 เฟรมล่าสุด (ตัดค่าที่กระโดดผิดปกติ)
        # ขั้นที่ 2: ค่อย smooth ต่อด้วย exponential moving average ให้เนียนขึ้นอีกชั้น
        self.despike = MedianDespike(window_size=5)
        self.forward_depth = ExponentialSmoother(alpha=0.15)
        # smoother อีกชุดสำหรับ nose_to_shoulder_ratio ซึ่งเป็นเมตริกหลักที่ใช้ตัดสินใจ
        self.despike_ratio = MedianDespike(window_size=5)
        self.nose_to_shoulder_ratio = ExponentialSmoother(alpha=0.2)

    def reset_all(self) -> None:
        self.despike.reset()
        self.forward_depth.reset()
        self.despike_ratio.reset()
        self.nose_to_shoulder_ratio.reset()

    def smooth(self, metrics: dict) -> dict:
        smoothed = dict(metrics)
        despiked_value = self.despike.update(metrics["forward_depth"])
        smoothed["forward_depth"] = self.forward_depth.update(despiked_value)

        despiked_ratio = self.despike_ratio.update(metrics["nose_to_shoulder_ratio"])
        smoothed["nose_to_shoulder_ratio"] = self.nose_to_shoulder_ratio.update(despiked_ratio)
        return smoothed


# ============================================================
# ส่วนที่ 5.5: คาลิเบรต baseline ส่วนตัว
# กด 'c' ตอนนั่งหลังตรง และกด 'h' ตอนนั่งค้อมจริงๆ (ท่าที่มักค้อมบ่อยๆ)
# ============================================================
class Calibrator:
    """เก็บค่าเฉลี่ยของท่าใดท่าหนึ่ง (ตรง หรือ ค้อม) เป็นเส้นฐาน (baseline)
    ใช้ตัวเดียวกันได้ทั้ง 2 ท่า เพียงสร้างคนละ instance"""

    def __init__(self, samples_needed: int = 30) -> None:
        self.samples_needed = samples_needed
        self.samples: list[float] = []
        self.baseline: float | None = None
        self.active = False
        # เวลาที่คาลิเบรตเสร็จล่าสุด ใช้โชว์แบนเนอร์ยืนยันบนจอสักพัก
        # กันผู้ใช้เข้าใจผิดว่าโปรแกรมค้าง เพราะภาพนิ่งตอนนั่งหลังตรง
        self.finished_at: float | None = None
        self.finish_banner_seconds = 2.5

    def start(self) -> None:
        self.samples = []
        self.active = True
        self.baseline = None
        self.finished_at = None

    def feed(self, value: float | None) -> None:
        if not self.active or value is None:
            return
        self.samples.append(value)
        if len(self.samples) >= self.samples_needed:
            self.baseline = float(np.mean(self.samples))
            self.active = False
            self.finished_at = time.time()
            print(f"[ระบบ] คาลิเบรตเสร็จแล้ว baseline = {self.baseline:.3f}")

    @property
    def just_finished(self) -> bool:
        """True ในช่วง finish_banner_seconds วินาทีแรกหลังคาลิเบรตเสร็จ"""
        if self.finished_at is None:
            return False
        return (time.time() - self.finished_at) < self.finish_banner_seconds


# ============================================================
# ส่วนที่ 6: แปลค่าตัวเลขเป็นสถานะท่าทาง
# ============================================================
def compute_threshold_value(
    args: argparse.Namespace,
    straight_baseline: float | None,
    hunched_baseline: float | None,
) -> float | None:
    """หาค่ากึ่งกลางระหว่างท่าตรง กับ ท่าค้อม ของผู้ใช้คนนั้นๆ โดยเฉพาะ
    แม่นกว่าตั้งเกณฑ์ตายตัวมาก เพราะรู้ทั้ง 2 ปลายจริงของแต่ละคน
    ถ้ายังไม่ได้คาลิเบรตท่าค้อม จะ fallback ไปใช้ --relative-threshold แทน"""
    if straight_baseline is None:
        return None
    if hunched_baseline is not None and hunched_baseline < straight_baseline:
        return straight_baseline - (straight_baseline - hunched_baseline) * 0.5
    return straight_baseline - args.relative_threshold


def classify_posture(
    metrics: dict | None,
    args: argparse.Namespace,
    straight_baseline: float | None,
    hunched_baseline: float | None,
) -> tuple[str, tuple[int, int, int]]:
    if metrics is None:
        return "ไม่พบร่างกายในกล้อง", (0, 255, 255)

    if straight_baseline is None:
        return "รอคาลิเบรต (นั่งหลังตรงแล้วกด c)", (0, 255, 255)

    threshold_value = compute_threshold_value(args, straight_baseline, hunched_baseline)

    # ค่ายิ่งน้อยกว่า threshold = จมูกยุบลงมาใกล้ไหล่มากขึ้น = ค้อม
    if metrics["nose_to_shoulder_ratio"] < threshold_value:
        return "หลังค้อม", (0, 0, 255)

    return "ท่าทางปกติ", (0, 255, 0)


# ============================================================
# ส่วนที่ 7: ลูปหลัก - อ่านกล้อง, ประมวลผล, แสดงผล, สั่ง ESP32
# ============================================================
def run_camera(args: argparse.Namespace) -> None:
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise RuntimeError(f"ไม่สามารถเปิดกล้องหมายเลข {args.camera} ได้")

    notifier = Esp32Notifier(args.esp32_ip)
    if notifier.enabled:
        print(f"[ระบบ] เปิดใช้งานการแจ้งเตือนไปยัง ESP32 ที่ {notifier.ip}")
    else:
        print("[ระบบ] ไม่ได้ระบุ --esp32-ip จะรันแค่กล้องอย่างเดียว ไม่ส่งสัญญาณ")

    hotkeys = GlobalHotkeys()
    hotkeys.register()

    web_state = WebStreamState()
    if args.disable_web:
        print("[เว็บ] ปิดการสตรีมวิดีโอผ่านเว็บไว้ (--disable-web) จะรันแค่หน้าต่าง OpenCV เท่านั้น")
    elif not FLASK_AVAILABLE:
        print("[คำเตือน] ไม่พบไลบรารี flask จึงไม่สามารถสตรีมวิดีโอไปที่เว็บได้ "
              "ติดตั้งด้วยคำสั่ง: pip install flask")
    else:
        start_web_server(web_state, hotkeys, args.web_port)

    text_renderer = ThaiTextRenderer()
    metrics_smoother = PostureMetricsSmoother()
    straight_calibrator = Calibrator(samples_needed=args.calibration_samples)
    hunched_calibrator = Calibrator(samples_needed=args.calibration_samples)
    window_name = "AI Posture Monitor (Hunchback Detection)"

    bad_posture_start_time: float | None = None
    last_alert_time: float = 0.0
    alert_active: bool = False
    consecutive_read_failures: int = 0
    max_consecutive_read_failures: int = 20  # ทนเฟรมหลุดติดกันได้ก่อนค่อยยอมปิดโปรแกรมจริงๆ

    print("[ระบบ] เริ่มโปรแกรมแล้ว: นั่งหลังตรงแล้วกด 'c' / นั่งค้อมจริงแล้วกด 'h' เพื่อคาลิเบรตก่อนใช้งาน")
    print("[ระบบ] กด 'a' เพื่อปิดโปรแกรมได้ทันที (ทำงานแบบ global ไม่ต้องคลิกหน้าต่างวิดีโอก่อน)")

    try:
        with mp_pose.Pose(
            min_detection_confidence=args.min_detection_confidence,
            min_tracking_confidence=args.min_tracking_confidence,
            model_complexity=1,
        ) as pose:
            while True:
                try:
                    if hotkeys.quit_requested.is_set():
                        print("[ระบบ] ได้รับคำสั่งปิดโปรแกรมจากปุ่มลัด 'a'")
                        break
                    if hotkeys.calibrate_straight_requested.is_set():
                        hotkeys.calibrate_straight_requested.clear()
                        straight_calibrator.start()
                        print("[ระบบ] เริ่มคาลิเบรตท่าตรง กรุณานั่งหลังตรงค้างไว้สักครู่...")
                    if hotkeys.calibrate_hunched_requested.is_set():
                        hotkeys.calibrate_hunched_requested.clear()
                        hunched_calibrator.start()
                        print("[ระบบ] เริ่มคาลิเบรตท่าค้อม กรุณานั่งค้อมจริงๆ (ท่าที่มักค้อมบ่อยๆ) ค้างไว้สักครู่...")

                    success, frame = cap.read()
                    if not success:
                        consecutive_read_failures += 1
                        print(
                            f"[คำเตือน] อ่านภาพจากกล้องไม่ได้ ({consecutive_read_failures}/{max_consecutive_read_failures}) "
                            "กำลังลองใหม่..."
                        )
                        if consecutive_read_failures >= max_consecutive_read_failures:
                            print("[ระบบ] อ่านภาพจากกล้องไม่ได้ติดต่อกันนานเกินไป กำลังปิดโปรแกรม")
                            break
                        time.sleep(0.05)
                        continue
                    consecutive_read_failures = 0

                    frame = cv2.flip(frame, 1)
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    rgb_frame.flags.writeable = False
                    results = pose.process(rgb_frame)
                    rgb_frame.flags.writeable = True

                    metrics = None
                    if results.pose_landmarks:
                        mp_drawing.draw_landmarks(
                            frame,
                            results.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            landmark_drawing_spec=mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2, circle_radius=2),
                            connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                        )
                        metrics = compute_posture_metrics(results.pose_landmarks.landmark)
                        if metrics is not None:
                            metrics = metrics_smoother.smooth(metrics)
                        else:
                            metrics_smoother.reset_all()
                    else:
                        metrics_smoother.reset_all()

                    if metrics is not None:
                        straight_calibrator.feed(metrics["nose_to_shoulder_ratio"])
                        hunched_calibrator.feed(metrics["nose_to_shoulder_ratio"])

                    status_text, status_color = classify_posture(
                        metrics, args, straight_calibrator.baseline, hunched_calibrator.baseline
                    )
                    is_bad_posture = (
                        metrics is not None
                        and straight_calibrator.baseline is not None
                        and status_text == "หลังค้อม"
                    )

                    now = time.time()

                    # --- Logic แจ้งเตือน: ยืนยันค้อมต่อเนื่อง แล้วยิงซ้ำได้ทุก cooldown วินาที ---
                    if is_bad_posture:
                        if bad_posture_start_time is None:
                            bad_posture_start_time = now

                        bad_duration = now - bad_posture_start_time
                        time_since_last_alert = now - last_alert_time

                        should_fire = bad_duration >= args.hold_seconds and time_since_last_alert >= args.cooldown_seconds
                        if should_fire:
                            notifier.alert()
                            last_alert_time = now
                            alert_active = True
                    else:
                        bad_posture_start_time = None
                        if alert_active:
                            notifier.clear()
                            alert_active = False

                    # --- วาดผลลัพธ์บนหน้าจอ ---
                    frame = text_renderer.put_text(frame, status_text, (20, 15), 26, status_color)
                    y = 55
                    if metrics is not None:
                        straight_text = (
                            f"{straight_calibrator.baseline:.3f}" if straight_calibrator.baseline is not None else "ยังไม่คาลิเบรต"
                        )
                        hunched_text = (
                            f"{hunched_calibrator.baseline:.3f}" if hunched_calibrator.baseline is not None else "ยังไม่คาลิเบรต"
                        )
                        frame = text_renderer.put_text(
                            frame,
                            f"ค่าปัจจุบัน: {metrics['nose_to_shoulder_ratio']:.3f}  |  ตรง: {straight_text}  |  ค้อม: {hunched_text}",
                            (20, y), 18, (255, 255, 255),
                        )
                        y += 25

                    active_calibrator = None
                    active_label = ""
                    if straight_calibrator.active:
                        active_calibrator = straight_calibrator
                        active_label = "ท่าหลังตรง"
                    elif hunched_calibrator.active:
                        active_calibrator = hunched_calibrator
                        active_label = "ท่าค้อม"

                    just_finished_calibrator = None
                    just_finished_label = ""
                    if straight_calibrator.just_finished:
                        just_finished_calibrator = straight_calibrator
                        just_finished_label = "ท่าหลังตรง"
                    elif hunched_calibrator.just_finished:
                        just_finished_calibrator = hunched_calibrator
                        just_finished_label = "ท่าค้อม"

                    if active_calibrator is not None:
                        progress_ratio = len(active_calibrator.samples) / active_calibrator.samples_needed
                        frame = text_renderer.put_text(
                            frame,
                            f"กำลังคาลิเบรต{active_label}... "
                            f"({len(active_calibrator.samples)}/{active_calibrator.samples_needed}) ค้างท่าไว้ ห้ามขยับ",
                            (20, y), 18, (0, 255, 255),
                        )
                        y += 25
                        # แถบความคืบหน้า วาดด้วย cv2 ตรง ๆ (ไม่ใช่ข้อความ) เพื่อให้เห็นชัดว่าโปรแกรม
                        # กำลังทำงานอยู่ ไม่ได้ค้าง แม้ภาพจากกล้องจะดูนิ่งเพราะกำลังนั่งค้างท่า
                        bar_x, bar_y, bar_w, bar_h = 20, y, 300, 18
                        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 80, 80), -1)
                        fill_w = int(bar_w * min(progress_ratio, 1.0))
                        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), (0, 255, 255), -1)
                        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (255, 255, 255), 1)
                        y += bar_h + 12
                    elif just_finished_calibrator is not None:
                        # แบนเนอร์สีเขียวขนาดใหญ่ยืนยันว่าบันทึกท่าสำเร็จแล้ว
                        # แสดงชัดเจนสักพักหนึ่ง กันผู้ใช้เข้าใจผิดว่าโปรแกรมค้าง
                        banner_h = 50
                        overlay = frame.copy()
                        cv2.rectangle(overlay, (0, y - 5), (frame.shape[1], y - 5 + banner_h), (0, 150, 0), -1)
                        frame = cv2.addWeighted(overlay, 0.75, frame, 0.25, 0)
                        frame = text_renderer.put_text(
                            frame,
                            f"บันทึก{just_finished_label}สำเร็จแล้ว! (baseline = {just_finished_calibrator.baseline:.3f})",
                            (20, y + 8), 22, (255, 255, 255),
                        )
                        y += banner_h + 12

                    esp_status = f"ESP32: {notifier.ip if notifier.enabled else 'ไม่ได้เชื่อมต่อ'}"
                    frame = text_renderer.put_text(frame, esp_status, (20, y), 18, (0, 220, 220))
                    y += 25
                    if notifier.enabled and notifier.last_error:
                        frame = text_renderer.put_text(
                            frame, f"เชื่อมต่อ ESP32 ไม่สำเร็จล่าสุด: {notifier.last_error}", (20, y), 16, (0, 140, 255)
                        )
                        y += 22

                    frame = text_renderer.put_text(
                        frame, "กด c = คาลิเบรตท่าตรง   กด h = คาลิเบรตท่าค้อม   กด a = ปิดโปรแกรม",
                        (20, frame.shape[0] - 55), 18, (200, 200, 200),
                    )
                    frame = text_renderer.put_text(
                        frame, "(ปุ่ม a ทำงานได้ทันทีไม่ต้องคลิกหน้าต่างนี้ก่อน)",
                        (20, frame.shape[0] - 30), 16, (140, 140, 140),
                    )

                    # --- ส่งเฟรมที่วาดเสร็จแล้ว (พร้อม overlay ทั้งหมด) ไปให้เว็บเซิร์ฟเวอร์สตรีมต่อ ---
                    encode_ok, jpeg_buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                    if encode_ok:
                        web_state.update_frame(jpeg_buffer.tobytes())
                    web_state.update_status(status_text)

                    cv2.imshow(window_name, frame)
                    key = cv2.waitKey(5) & 0xFF
                    # ยังคงรองรับปุ่มผ่านหน้าต่างวิดีโอแบบเดิมไว้ด้วย (เผื่อ global hotkey ใช้ไม่ได้)
                    if key == ord("a") or key == ord("q"):
                        break
                    if key == ord("c"):
                        straight_calibrator.start()
                        print("[ระบบ] เริ่มคาลิเบรตท่าตรง กรุณานั่งหลังตรงค้างไว้สักครู่...")
                    if key == ord("h"):
                        hunched_calibrator.start()
                        print("[ระบบ] เริ่มคาลิเบรตท่าค้อม กรุณานั่งค้อมจริงๆ (ท่าที่มักค้อมบ่อยๆ) ค้างไว้สักครู่...")

                except Exception:
                    print("[ผิดพลาด] เกิดข้อผิดพลาดระหว่างประมวลผลเฟรม รายละเอียด:")
                    traceback.print_exc()
                    break
    finally:
        hotkeys.unregister()

    if alert_active:
        notifier.clear()

    cap.release()
    cv2.destroyAllWindows()


def main() -> None:
    args = parse_args()
    try:
        run_camera(args)
    except RuntimeError as exc:
        print(f"[ผิดพลาด] {exc}")
    except KeyboardInterrupt:
        print("\n[ระบบ] ผู้ใช้หยุดโปรแกรม")


if __name__ == "__main__":
    main()
