"""
ErgoAI Bridge
- อ่านข้อมูลจาก ESP32 ผ่าน Serial (USB)
- เปิด popup เตือนเมื่อพบ "SLOUCHING"
- เปิด HTTP server (Flask) ที่ http://localhost:5000/status
  ให้หน้าเว็บ (index.html) ดึงข้อมูลไปแสดงแบบ real-time ได้
  (ใช้แทน/เสริมช่องทาง BLE ที่หน้าเว็บมีอยู่)
"""

import serial
import threading
import time
import queue
import tkinter as tk
from tkinter import messagebox
from flask import Flask, jsonify
from flask_cors import CORS

# ================== ตั้งค่า ==================
SERIAL_PORT = 'COM3'      # แก้เป็นพอร์ตจริงของ ESP32
BAUD_RATE = 115200
HTTP_PORT = 5000
# =============================================

alert_queue = queue.Queue()
latest_status = {
    "posture": "UNKNOWN",
    "connected": False,
    "last_update": None,
}

# ---------- ส่วนเว็บเซิร์ฟเวอร์ (ให้หน้า index.html เรียกใช้) ----------
app = Flask(__name__)
CORS(app)  # อนุญาตให้ index.html (เปิดจาก file:// หรือ localhost) เรียกข้ามโดเมนได้

@app.route('/status')
def status():
    return jsonify(latest_status)


def run_flask():
    app.run(host='0.0.0.0', port=HTTP_PORT, debug=False, use_reloader=False)


# ---------- ส่วนอ่าน Serial จาก ESP32 ----------
def serial_reader():
    global latest_status
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"เชื่อมต่อกับ ESP32 สำเร็จบนพอร์ต {SERIAL_PORT}")
        latest_status["connected"] = True
    except Exception as e:
        print(f"ไม่สามารถเชื่อมต่อ Serial ได้: {e}")
        latest_status["connected"] = False
        return

    while True:
        try:
            if ser.in_waiting:
                raw = ser.readline().decode('utf-8', errors='ignore').strip()
                if not raw:
                    continue

                print(f"ข้อมูลจาก ESP32: {raw}")
                latest_status["posture"] = raw
                latest_status["last_update"] = time.time()
                latest_status["connected"] = True

                if "SLOUCHING" in raw:
                    alert_queue.put(raw)

        except Exception as e:
            print(f"เกิดข้อผิดพลาดในการรับข้อมูล: {e}")
            latest_status["connected"] = False
            break


# ---------- ส่วน popup เตือน (ทำงานบน main thread เท่านั้น) ----------
def check_queue():
    try:
        while True:
            alert_queue.get_nowait()
            root.attributes("-topmost", True)
            messagebox.showwarning(
                "ErgoAI Alert",
                "⚠️ ตรวจพบการนั่งหลังค่อม! กรุณานั่งหลังตรง",
                parent=root,
            )
    except queue.Empty:
        pass
    root.after(500, check_queue)  # เช็คคิวใหม่ทุก 0.5 วินาที ไม่บล็อกโปรแกรม


if __name__ == "__main__":
    # รัน Serial reader และ Flask server เป็น background thread
    threading.Thread(target=serial_reader, daemon=True).start()
    threading.Thread(target=run_flask, daemon=True).start()

    print(f"เปิด HTTP server ที่ http://localhost:{HTTP_PORT}/status")

    root = tk.Tk()
    root.withdraw()  # ซ่อนหน้าต่างหลัก ให้เหลือแค่ popup ตอนแจ้งเตือน
    check_queue()
    root.mainloop()
