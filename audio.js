// Web Audio API Procedural Sound Synthesizer
// Clean, self-contained, no external mp3 files required!

const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }
};

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false; // Sound is enabled by default
    safeStorage.setItem('flappy_muted', 'false');

    // 7 Background Dialogue/Voice Clips
    this.voiceClips = [
      'Audio/clip_01.mp3',
      'Audio/clip_02.mp3',
      'Audio/clip_03.mp3',
      'Audio/clip_04.mp3',
      'Audio/clip_05.mp3',
      'Audio/clip_06.mp3',
      'Audio/clip_07.mp3'
    ];
    this.shuffledPlaylist = [...this.voiceClips];
    this.currentClipIndex = 0;
    this.voiceAudio = null;
    this.isVoicePlaying = false;
  }

  shufflePlaylist() {
    this.shuffledPlaylist = [...this.voiceClips];
    for (let i = this.shuffledPlaylist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledPlaylist[i], this.shuffledPlaylist[j]] = [this.shuffledPlaylist[j], this.shuffledPlaylist[i]];
    }
    this.currentClipIndex = 0;
  }

  startVoiceClips() {
    this.shufflePlaylist(); // Shuffled in random order for every new start or retry!
    if (this.muted) return;
    this.isVoicePlaying = true;
    this.playCurrentVoiceClip();
  }

  playCurrentVoiceClip() {
    if (!this.isVoicePlaying || this.muted) return;

    if (!this.voiceAudio) {
      this.voiceAudio = new Audio();
      this.voiceAudio.addEventListener('ended', () => {
        if (this.isVoicePlaying) {
          // Play next clip serially in shuffled order; cycle back to start when all played
          this.currentClipIndex = (this.currentClipIndex + 1) % this.shuffledPlaylist.length;
          this.playCurrentVoiceClip();
        }
      });
      this.voiceAudio.addEventListener('error', (e) => {
        console.warn('Voice clip load error:', e);
        // Advance to next clip if one fails to play
        setTimeout(() => {
          if (this.isVoicePlaying) {
            this.currentClipIndex = (this.currentClipIndex + 1) % this.shuffledPlaylist.length;
            this.playCurrentVoiceClip();
          }
        }, 300);
      });
    }

    const clipSrc = this.shuffledPlaylist[this.currentClipIndex];
    if (this.voiceAudio.src !== clipSrc && !this.voiceAudio.src.endsWith(clipSrc)) {
      this.voiceAudio.src = clipSrc;
    }
    this.voiceAudio.volume = 0.95;
    const p = this.voiceAudio.play();
    if (p !== undefined) {
      p.catch(err => {
        console.warn('Voice play blocked or interrupted', err);
      });
    }
  }

  pauseVoiceClips() {
    if (this.voiceAudio) {
      this.voiceAudio.pause();
    }
  }

  resumeVoiceClips() {
    if (this.isVoicePlaying && !this.muted && this.voiceAudio) {
      const p = this.voiceAudio.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    }
  }

  stopVoiceClips() {
    this.isVoicePlaying = false;
    if (this.voiceAudio) {
      this.voiceAudio.pause();
      this.voiceAudio.currentTime = 0;
    }
  }

  ensureContext() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      } catch (e) {
        console.warn('AudioContext creation blocked or unsupported', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {}
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    safeStorage.setItem('flappy_muted', this.muted);
    if (this.muted) {
      this.pauseVoiceClips();
    } else {
      if (this.isVoicePlaying) {
        this.resumeVoiceClips();
      }
    }
    return this.muted;
  }

  // Jump / Wing Flap Sound
  playFlap() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  // Score Point Chime
  playScore() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.51, now + 0.08);
      gain2.gain.setValueAtTime(0.22, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (e) {}
  }

  // Hit Pipe / Collision
  playHit() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  // Fall / Die sound
  playDie() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.35);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  // UI click sound
  playClick() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}

window.soundController = new SoundController();
