'use strict';

(function (root) {
  function createAudio() {
    let ctx = null;
    let muted = false;
    let unlocked = false;

    function ac() {
      if (ctx) return ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    }

    function unlock() {
      const c = ac();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      unlocked = true;
    }

    function beep(freq, dur, type, gain) {
      if (muted) return;
      const c = ac();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain == null ? 0.035 : gain, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    }

    return {
      unlock,
      setMuted(v) {
        muted = !!v;
      },
      isMuted() {
        return muted;
      },
      tick() {
        beep(880, 0.04, 'square', 0.012);
      },
      buy() {
        beep(520, 0.07, 'square', 0.04);
        setTimeout(() => beep(760, 0.08, 'square', 0.03), 60);
      },
      sell() {
        beep(420, 0.08, 'triangle', 0.04);
        setTimeout(() => beep(280, 0.1, 'triangle', 0.03), 70);
      },
      news() {
        beep(990, 0.12, 'sawtooth', 0.03);
      },
      rank() {
        [440, 554, 659, 880].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'square', 0.04), i * 90));
      },
      win() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'square', 0.045), i * 110));
      },
      lose() {
        [392, 311, 247].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sawtooth', 0.04), i * 140));
      },
      warn() {
        beep(180, 0.12, 'square', 0.04);
      },
      unlocked: () => unlocked
    };
  }

  root.TerminalAudio = { createAudio };
})(typeof globalThis !== 'undefined' ? globalThis : this);
