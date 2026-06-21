/*
 * ErgoAI ESP32 Posture Firmware
 * Reads MPU6050 Accelerometer/Gyroscope (Spine Tilt) and Analog Flex Sensor (Neck Flexion/Seat Pressure)
 * Transmits data to the ErgoAI Web Dashboard via Web Bluetooth (BLE), USB Serial, or WebSockets (Wi-Fi).
 * 
 * Hardware Wiring:
 *   MPU6050: VCC->3.3V, GND->GND, SCL->GPIO 22, SDA->GPIO 21
 *   Flex/FSR Sensor: 3.3V -> Sensor -> Pin 34 (with 10k resistor pull-down to GND)
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// --- Configurations ---
#define USE_BLUETOOTH_BLE true  // Advertises device over Bluetooth BLE
#define SERIAL_BAUD_RATE  115200
#define ANALOG_PIN        34    // Flex sensor or Seat FSR resistor analog input

Adafruit_MPU6050 mpu;

#if USE_BLUETOOTH_BLE
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;

// Custom UUIDs corresponding to the web client
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      pServer->getAdvertising()->start(); // Restart advertising when client leaves
    }
};
#endif

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  while (!Serial) delay(10);

  Serial.println("Initializing MPU6050 Accelerometer...");
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip! Check connection SCL/SDA pins.");
  } else {
    Serial.println("MPU6050 Found!");
    mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
    mpu.setGyroRange(MPU6050_RANGE_250_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  pinMode(ANALOG_PIN, INPUT);

#if USE_BLUETOOTH_BLE
  // Initialize BLE Stack
  BLEDevice::init("ErgoAI-ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
                    
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("BLE Advertising as 'ErgoAI-ESP32'...");
#endif
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Calculate tilt angle in degrees (Roll/Pitch)
  // Roll (x-plane) represents spine posture leaning forward or back
  float roll = atan2(a.acceleration.y, a.acceleration.z) * 180.0 / PI;
  // Pitch (y-plane) represents sideways leaning tilt
  float pitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y*a.acceleration.y + a.acceleration.z*a.acceleration.z)) * 180.0 / PI;

  // Read analog value from flex/occupancy sensor
  int rawAnalog = analogRead(ANALOG_PIN);
  float flexPct = (rawAnalog / 4095.0) * 100.0; // scale to percentage (ESP32 ADC is 12-bit)

  // Determine seat pressure
  // If weight is above threshold, seat is occupied (100%), otherwise empty (0%)
  float pressurePct = (rawAnalog > 500) ? 100.0 : 0.0;
  
  // Format JSON payload
  // JSON payload schema: {"spine": spineAngle, "neck": neckFlexPct, "pressure": seatOccupiedPct, "side": sidewaysTilt}
  String jsonPayload = "{\"spine\":" + String(roll, 1) + 
                       ",\"neck\":" + String(flexPct, 1) + 
                       ",\"pressure\":" + String(pressurePct, 1) + 
                       ",\"side\":" + String(pitch, 1) + "}";

  // 1. Output to Serial (USB connection mode)
  Serial.println(jsonPayload);

#if USE_BLUETOOTH_BLE
  // 2. Output over Bluetooth BLE Notify
  if (deviceConnected) {
    pCharacteristic->setValue(jsonPayload.c_str());
    pCharacteristic->notify();
    delay(10); // avoid congestion
  }
#endif

  delay(200); // 5Hz sampling rate
}
