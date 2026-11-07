export type ButtonId = 'jump' | 'sprint' | 'accelerate' | 'brake' | 'handbrake';
export type ActionId = 'interact' | 'vehicleAction' | 'camera' | 'jump' | 'pause' | 'map' | 'phone' | 'inventory' | 'walk' | 'horn' | 'lights' | 'signalLeft' | 'signalRight' | 'engine';

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  zoom: number;
  sprint: boolean;
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  pressed: Set<ActionId>;
  /** true when the last input came from a gamepad / touch (for camera auto-centre) */
  analogLook: boolean;
}

const KEY_ACTIONS: Record<string, ActionId> = {
  KeyE: 'interact',
  KeyF: 'vehicleAction',
  KeyV: 'camera',
  KeyG: 'horn',
  KeyH: 'lights',
  KeyQ: 'signalLeft',
  KeyR: 'signalRight',
  KeyX: 'engine',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'map',
  Tab: 'phone',
  KeyI: 'inventory',
  KeyC: 'walk',
};

const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class InputManager {
  private keys = new Set<string>();
  private buttons = new Set<ButtonId>();
  private joy = { x: 0, y: 0 };
  private look = { x: 0, y: 0 };
  private zoomAcc = 0;
  private pressed = new Set<ActionId>();
  private padPrev: boolean[] = [];
  private dragging = false;
  private el: HTMLElement | null = null;
  /** gameplay keys are ignored while a menu is open */
  gameplayEnabled = true;
  mouseSensitivity = 1;
  invertY = false;
  lastAnalog = false;

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.el) {
      this.el.removeEventListener('mousedown', this.onMouseDown);
      this.el.removeEventListener('wheel', this.onWheel);
    }
  }

  get pointerLocked() {
    return !!this.el && document.pointerLockElement === this.el;
  }

  requestPointerLock() {
    if (!this.el || this.pointerLocked) return;
    try {
      const r = this.el.requestPointerLock() as unknown;
      if (r instanceof Promise) r.catch(() => undefined);
    } catch {
      /* not supported: drag-to-look fallback */
    }
  }

  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  // ----- UI / touch entry points -----
  press(a: ActionId) {
    this.pressed.add(a);
  }
  setButton(id: ButtonId, down: boolean) {
    if (down) this.buttons.add(id);
    else this.buttons.delete(id);
    this.lastAnalog = true;
  }
  setJoystick(x: number, y: number) {
    this.joy.x = x;
    this.joy.y = y;
    this.lastAnalog = true;
  }
  addLook(dx: number, dy: number) {
    this.look.x += dx;
    this.look.y += dy;
  }
  addZoom(d: number) {
    this.zoomAcc += d;
  }
  releaseAll() {
    this.keys.clear();
    this.buttons.clear();
    this.joy.x = this.joy.y = 0;
  }

  // ----- DOM handlers -----
  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      const a = KEY_ACTIONS[e.code];
      if (a) this.pressed.add(a);
      if (e.code === 'Space') this.pressed.add('jump');
    }
    this.keys.add(e.code);
    this.lastAnalog = false;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => this.releaseAll();
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) this.dragging = true;
  };
  private onMouseUp = () => {
    this.dragging = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (this.pointerLocked || this.dragging) {
      this.look.x += e.movementX;
      this.look.y += e.movementY;
      this.lastAnalog = false;
    }
  };
  private onWheel = (e: WheelEvent) => {
    this.zoomAcc += Math.sign(e.deltaY);
  };

  private k(...codes: string[]) {
    if (!this.gameplayEnabled) return false;
    return codes.some((c) => this.keys.has(c));
  }

  poll(): InputFrame {
    let moveX = (this.k('KeyD', 'ArrowRight') ? 1 : 0) - (this.k('KeyA', 'ArrowLeft') ? 1 : 0);
    let moveY = (this.k('KeyW', 'ArrowUp') ? 1 : 0) - (this.k('KeyS', 'ArrowDown') ? 1 : 0);
    let throttle = this.k('KeyW', 'ArrowUp') ? 1 : 0;
    let brake = this.k('KeyS', 'ArrowDown') ? 1 : 0;
    let handbrake = this.k('Space');
    let sprint = this.k('ShiftLeft', 'ShiftRight');
    let lookX = this.look.x * this.mouseSensitivity;
    let lookY = this.look.y * this.mouseSensitivity;
    let analog = this.lastAnalog;

    // touch
    if (Math.abs(this.joy.x) > 0.01 || Math.abs(this.joy.y) > 0.01) {
      moveX = this.joy.x;
      moveY = this.joy.y;
    }
    if (this.buttons.has('accelerate')) throttle = 1;
    if (this.buttons.has('brake')) brake = 1;
    if (this.buttons.has('handbrake')) handbrake = true;
    if (this.buttons.has('sprint')) sprint = true;

    // gamepad
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = Array.from(pads ?? []).find((p): p is Gamepad => !!p && p.connected);
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
      const ax = dz(pad.axes[0] ?? 0);
      const ay = dz(pad.axes[1] ?? 0);
      const rx = dz(pad.axes[2] ?? 0);
      const ry = dz(pad.axes[3] ?? 0);
      if (ax || ay) {
        moveX = ax;
        moveY = -ay;
        analog = true;
      }
      if (rx || ry) {
        lookX += rx * 14;
        lookY += ry * 10;
        analog = true;
      }
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const val = (i: number) => pad.buttons[i]?.value ?? 0;
      if (val(7) > 0.05) throttle = Math.max(throttle, val(7));
      if (val(6) > 0.05) brake = Math.max(brake, val(6));
      if (b(0)) handbrake = true;
      if (b(10)) sprint = true;
      const edge = (i: number, a: ActionId) => {
        if (b(i) && !this.padPrev[i]) this.pressed.add(a);
      };
      edge(0, 'jump');
      edge(2, 'interact');
      edge(3, 'interact');
      edge(1, 'vehicleAction');
      edge(5, 'camera');
      edge(9, 'pause');
      edge(8, 'map');
      edge(4, 'phone');
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }

    const steer = Math.max(-1, Math.min(1, moveX));
    const frame: InputFrame = {
      moveX,
      moveY,
      lookX,
      lookY: this.invertY ? -lookY : lookY,
      zoom: this.zoomAcc,
      sprint,
      throttle,
      brake,
      steer,
      handbrake,
      pressed: this.pressed,
      analogLook: analog,
    };
    this.pressed = new Set();
    this.look.x = this.look.y = 0;
    this.zoomAcc = 0;
    return frame;
  }
}
