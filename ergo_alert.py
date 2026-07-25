import serial
import serial.tools.list_ports
import tkinter as tk
from tkinter import messagebox
import time

# ================== ตั้งค่า ==================
PORT = 'COM3'       # เปลี่ยนเป็นพอร์ตของ ESP32 ที่ใช้จริง
BAUDRATE = 9600
RECONNECT_DELAY = 3  # วินาที ระหว่างการลองเชื่อมต่อใหม่
SLOUCH_ALERT_COOLDOWN = 10  # วินาที กันไม่ให้ popup เด้งรัวๆ ซ้ำ

# ตัวแปรสถานะ
last_slouch_alert_time = 0
was_connected = False  # เก็บสถานะการเชื่อมต่อครั้งก่อน เพื่อรู้ว่า "เพิ่งหลุด"

# ================== เตรียม GUI ==================
root = tk.Tk()
root.withdraw()  # ซ่อนหน้าต่างหลักไว้ ใช้แค่เป็นตัวยิง popup


def show_popup(title, message, alert_type="warning"):
    """เด้ง popup ขึ้นมาตรงกลางจอ และตั้งให้อยู่บนสุดชั่วคราว"""
    root.deiconify()
    root.attributes("-topmost", True)
    root.focus_force()
    root.withdraw()

    if alert_type == "error":
        messagebox.showerror(title, message)
    else:
        messagebox.showwarning(title, message)


def connect_serial():
    """พยายามเชื่อมต่อกับ ESP32 คืนค่า serial object ถ้าสำเร็จ หรือ None ถ้าไม่สำเร็จ"""
    try:
        s = serial.Serial(PORT, BAUDRATE, timeout=1)
        print(f"✅ เชื่อมต่อกับ ESP32 สำเร็จบนพอร์ต {PORT}")
        return s
    except Exception as e:
        print(f"❌ ไม่สามารถเชื่อมต่อ Serial ได้: {e}")
        return None


# ================== เริ่มต้นเชื่อมต่อ ==================
ser = connect_serial()

if ser is not None:
    was_connected = True

# ================== ลูปหลัก ==================
while True:
    try:
        # ---------- กรณียังไม่ได้เชื่อมต่อ / หลุดไปแล้ว ----------
        if ser is None:
            was_connected = False
            # ไม่เด้ง popup ใดๆ แค่ log ไว้ในคอนโซล แล้วลองเชื่อมต่อใหม่เงียบๆ
            print("🔄 กำลังพยายามเชื่อมต่อ ESP32 ใหม่...")
            time.sleep(RECONNECT_DELAY)
            ser = connect_serial()
            if ser is not None:
                was_connected = True
            continue

        # ---------- อ่านข้อมูลจาก ESP32 ----------
        if ser.in_waiting:
            data = ser.readline().decode('utf-8', errors='ignore').strip()
            if data:
                print(f"ข้อมูลจาก ESP32: {data}")

            if data == "SLOUCHING":
                now = time.time()
                # กันไม่ให้ popup เด้งซ้ำถี่เกินไป
                if now - last_slouch_alert_time > SLOUCH_ALERT_COOLDOWN:
                    last_slouch_alert_time = now
                    show_popup("ErgoAI Alert",
                               "⚠️ ตรวจพบการนั่งหลังค่อม! กรุณานั่งหลังตรง")

    except serial.SerialException as e:
        # ---------- หลุดการเชื่อมต่อระหว่างใช้งาน (ถอดสาย, ปิดเครื่อง ฯลฯ) ----------
        print(f"⚠️ การเชื่อมต่อ Serial ขาดหาย: {e}")
        try:
            ser.close()
        except Exception:
            pass
        ser = None  # ให้ลูปด้านบนจัดการแจ้งเตือน + reconnect ต่อ

    except KeyboardInterrupt:
        print("ปิดโปรแกรมโดยผู้ใช้")
        if ser:
            ser.close()
        break

    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการรับข้อมูล: {e}")
        time.sleep(1)
