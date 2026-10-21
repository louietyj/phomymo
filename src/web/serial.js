/**
 * Web Serial transport for Phomymo
 *
 * For printers that print over Bluetooth Classic (SPP) rather than BLE, such as the M110C.
 * The page sees a serial port, not a Bluetooth device: the printer has to be paired in the
 * OS Bluetooth settings first, and the port carries the same byte stream as BLE.
 */

const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

// Singleton instance
let sharedInstance = null;

export class SerialTransport {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.connected = false;
    this.onDisconnect = null;
    this.onReconnect = null;
    this._readLoopDone = Promise.resolve();
    this._exclusiveTail = Promise.resolve();
  }

  static getShared() {
    if (!sharedInstance) {
      sharedInstance = new SerialTransport();
    }
    return sharedInstance;
  }

  static isAvailable() {
    return 'serial' in navigator;
  }

  /**
   * Open the printer's port, reusing a port this site was granted before so a reconnect
   * needs no picker
   */
  async connect() {
    if (!SerialTransport.isAvailable()) {
      throw new Error('Web Serial is not supported in this browser');
    }
    if (this.isConnected()) return true;

    if (!this.port) {
      const granted = await navigator.serial.getPorts();
      this.port = granted.find(p => p.getInfo().bluetoothServiceClassId === SPP_UUID) || null;
    }
    if (!this.port) {
      this.port = await navigator.serial.requestPort({
        filters: [{ bluetoothServiceClassId: SPP_UUID }],
        allowedBluetoothServiceClassIds: [SPP_UUID],
      });
    }

    try {
      await this.openPort();
    } catch (e) {
      // Pick again next time: the remembered printer may be off or paired to another device
      this.port = null;
      throw new Error(`Could not open the printer's serial port (is it on and paired with this device?): ${e.message}`);
    }
    return true;
  }

  async openPort() {
    await this.port.open({ baudRate: 115200 });
    this.writer = this.port.writable.getWriter();
    this.connected = true;
    console.log('Serial port open:', JSON.stringify(this.port.getInfo()));
    this._readLoopDone = this.readLoop();
  }

  // The printer answers each job with a status, so keep draining the port. The read
  // failing is also how a dropped link shows up.
  async readLoop() {
    const reader = this.port.readable.getReader();
    this.reader = reader;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        console.log('[Serial <<<]', Array.from(value, b => b.toString(16).padStart(2, '0')).join(' '));
      }
    } catch (e) {
      console.log('Serial read ended:', e.message);
    } finally {
      reader.releaseLock();
    }
    if (this.reader !== reader) return; // disconnect() closed it on purpose
    this.reader = null;
    await this.closePort();
    console.log('Serial link lost');
    if (this.onDisconnect) this.onDisconnect();
  }

  async closePort() {
    this.connected = false;
    try {
      this.writer?.releaseLock();
    } catch (e) {
      // Ignore: the stream may already be errored
    }
    this.writer = null;
    try {
      await this.port?.close();
    } catch (e) {
      // Ignore: the port may already be closed
    }
  }

  async disconnect() {
    const reader = this.reader;
    this.reader = null;
    try {
      await reader?.cancel();
    } catch (e) {
      // Ignore errors during cleanup
    }
    // The port only closes once the read loop has released its lock
    await this._readLoopDone;
    await this.closePort();
    this.port = null;
  }

  // Reopen a link that dropped since the last job. The port is already granted, so this
  // needs no user gesture.
  async ensureFreshLink() {
    if (this.isConnected()) return;
    if (!this.port) throw new Error('Not connected');
    console.log('Reopening serial port for this job');
    await this.openPort();
    if (this.onReconnect) this.onReconnect();
  }

  // Runs fn after earlier exclusive tasks finish, so two jobs never interleave bytes
  exclusive(fn) {
    const run = this._exclusiveTail.then(fn);
    this._exclusiveTail = run.catch(() => {});
    return run;
  }

  async send(data) {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }
    await this.writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConnected() {
    return this.connected && this.writer !== null;
  }

  // Serial ports expose no device name, so every serial printer shares this one
  getDeviceName() {
    return 'Bluetooth serial';
  }
}
