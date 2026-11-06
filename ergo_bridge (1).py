import time
import queue
import requests
import threading
import tkinter as tk

# ================== ตั้งค่า ==================
ESP32_IP = "10.114.15.153"        # IP จริงของบอร์ด ESP32 (บอร์ด B)
ESP32_ALERT_URL = f"http://{ESP32_IP}/alert"
ESP32_CLEAR_URL = f"http://{ESP32_IP}/clear"
SEND_TO_ESP32 = True               # ตั้ง False ถ้ายังไม่ต่อบอร์ด ต้องการเทสต์ popup อย่างเดียวก่อน
# =============================================

alert_queue = queue.Queue()
latest_status = {
    "posture": "UNKNOWN",
    "connected": True,          # ไม่มี Serial แล้ว ใช้กล้องตรงๆ ถือว่า connected เสมอ
    "last_update": None,
}

# กันเด้ง popup ซ้ำรัวๆ ระหว่างที่ยังค่อมอยู่ (เด้งครั้งเดียวต่อรอบที่เริ่มค่อม)
_alert_fired = False


# ---------- ส่ง HTTP ไปสั่งบอร์ด ESP32 แทนการต่อ Serial ----------
def _send_alert_to_esp32():
    if not SEND_TO_ESP32:
        return
    try:
        requests.get(ESP32_ALERT_URL, timeout=2)
        print("[ESP32] ส่ง /alert สำเร็จ")
    except Exception as e:
        print(f"[ESP32] ส่ง /alert ไม่สำเร็จ: {e}")


def _send_clear_to_esp32():
    if not SEND_TO_ESP32:
        return
    try:
        requests.get(ESP32_CLEAR_URL, timeout=2)
        print("[ESP32] ส่ง /clear สำเร็จ")
    except Exception as e:
        print(f"[ESP32] ส่ง /clear ไม่สำเร็จ: {e}")


# ---------- เรียกฟังก์ชันนี้จาก loop ของ MediaPipe ทุกเฟรม ----------
# raw ที่ส่งเข้ามาคือผลลัพธ์จาก MediaPipe เช่น "SLOUCHING" หรือ "OK"
# เวอร์ชันนี้: เด้งแจ้งเตือนทันทีที่พบว่าค่อม ไม่ต้องรอนับเวลา
def update_posture(raw: str):
    global _alert_fired

    if not raw:
        return

    latest_status["posture"] = raw
    latest_status["last_update"] = time.time()
    latest_status["connected"] = True

    if "SLOUCHING" in raw:
        if not _alert_fired:
            alert_queue.put(raw)          # -> popup เด้งทันที
            _send_alert_to_esp32()        # -> สั่งบอร์ด ESP32 สั่น+เสียง ทันที
            _alert_fired = True           # กันเด้งซ้ำรัวๆ จนกว่าจะกลับมาตรง

    else:
        # ท่านั่งกลับมาปกติ -> รีเซ็ตสถานะ พร้อมเด้งใหม่ได้ทันทีถ้าค่อมอีกครั้ง
        if _alert_fired:
            print("นั่งหลังตรงแล้ว รีเซ็ตสถานะ")
            _send_clear_to_esp32()        # -> สั่งบอร์ด ESP32 หยุดสั่น/เสียง
        _alert_fired = False


# ================== ส่วน POPUP (Tkinter) ==================
def _show_popup(root):
    popup = tk.Toplevel(root)
    popup.title("แจ้งเตือนท่านั่ง")
    popup.geometry("320x150+100+100")
    popup.attributes("-topmost", True)

    label = tk.Label(
        popup,
        text="⚠️ คุณนั่งหลังค่อม!\nกรุณาปรับท่านั่งให้ถูกต้อง",
        font=("Tahoma", 12),
        fg="red",
        wraplength=280,
    )
    label.pack(pady=20)

    btn = tk.Button(popup, text="รับทราบ", command=popup.destroy)
    btn.pack()

    popup.after(10000, popup.destroy)  # ปิดเองถ้าไม่กดภายใน 10 วิ


def popup_watcher():
    """
    เรียกฟังก์ชันนี้บน main thread เท่านั้น (ข้อกำหนดของ Tkinter)
    มันจะคอยเช็ค alert_queue ทุก 300ms ถ้ามีของเข้ามา -> เด้ง popup
    """
    root = tk.Tk()
    root.withdraw()  # ซ่อนหน้าต่างหลัก ใช้แค่เป็น root ของ popup

    def check_queue():
        try:
            while True:
                alert_queue.get_nowait()
                _show_popup(root)
        except queue.Empty:
            pass
        root.after(300, check_queue)

    root.after(300, check_queue)
    root.mainloop()


def start_popup_in_background():
    """
    ทางเลือก: ถ้าอยากรัน popup แบบ non-blocking (ไม่บล็อก thread หลัก)
    เผื่อ MediaPipe loop ของคุณต้องรันบน main thread แทน
    หมายเหตุ: Tkinter ปกติต้องรันบน main thread แต่ในบาง OS (Windows) รันแบบนี้ได้
    ถ้าเจอปัญหา ให้สลับไปใช้ popup_watcher() บน main thread แทน
    """
    t = threading.Thread(target=popup_watcher, daemon=True)
    t.start()
    return t


# ================== วิธีใช้งานร่วมกับ MediaPipe ==================
# ในไฟล์ MediaPipe หลักของคุณ ให้เพิ่ม:
#
#   from ergo_bridge import update_posture, popup_watcher
#   import threading
#
#   if __name__ == "__main__":
#       # รัน loop ตรวจจับกล้องของคุณในเธรดแยก
#       threading.Thread(target=your_mediapipe_camera_loop, daemon=True).start()
#
#       # popup ต้องรันบน main thread เสมอ
#       popup_watcher()
#
# แล้วในลูปตรวจจับกล้อง ตรงจุดที่รู้ผล is_slouching (True/False) ให้เรียก:
#
#   update_posture("SLOUCHING" if is_slouching else "OK")


if __name__ == "__main__":
    # ทดสอบ popup อย่างเดียว โดยไม่ต้องมีกล้อง/MediaPipe
    # จะจำลองว่าค่อมทุก 5 วิ เพื่อดูว่า popup เด้งทันทีถูกต้องไหม
    def _fake_camera_loop():
        while True:
            time.sleep(0.5)
            update_posture("SLOUCHING")
            time.sleep(5)
            update_posture("OK")

    threading.Thread(target=_fake_camera_loop, daemon=True).start()
    popup_watcher()
