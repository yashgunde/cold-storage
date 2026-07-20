/**
 * Loops a single YouTube track as background music through the official
 * IFrame Player API. The audio is STREAMED from YouTube — nothing is
 * downloaded or bundled — so no copyrighted file lives in the repo.
 *
 * Browser autoplay policy: playback must be kicked off from a user
 * gesture, so call start() from a click handler (the game does this from
 * the "begin shift" / "resume" clicks). The player is created at page
 * load so it is ready by the time the first gesture arrives.
 */
const YT_VIDEO_ID = 'tKTgdMHV8Ks';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(v: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: string | HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export class MusicPlayer {
  private player: YTPlayer | null = null;
  private ready = false;
  private wantPlay = false;
  private volume = 0.5; // 0..1

  constructor() {
    // Build the iframe ourselves so it carries allow="autoplay" AT LOAD —
    // Chrome blocks gesture-initiated playback of a cross-origin embed if
    // that permission is missing, and the YT API's own iframe omits it.
    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;width:1px;height:1px;left:-100px;top:-100px;opacity:0;pointer-events:none;';
    const iframe = document.createElement('iframe');
    iframe.id = 'yt-music-frame';
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.style.cssText = 'width:1px;height:1px;border:0;';
    const params = new URLSearchParams({
      enablejsapi: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      loop: '1',
      playlist: YT_VIDEO_ID, // playlist=self is what enables native loop
      modestbranding: '1',
      playsinline: '1',
      rel: '0',
      origin: location.origin
    });
    iframe.src = `https://www.youtube.com/embed/${YT_VIDEO_ID}?${params.toString()}`;
    host.appendChild(iframe);
    document.body.appendChild(host);
    this.loadApi();
  }

  private loadApi(): void {
    if (window.YT?.Player) {
      this.attach();
      return;
    }
    // Chain onto any existing ready hook rather than clobbering it.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      this.attach();
    };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }

  /** Attach the JS API to our pre-built (allow=autoplay) iframe. */
  private attach(): void {
    if (!window.YT) return;
    this.player = new window.YT.Player('yt-music-frame', {
      events: {
        onReady: () => {
          this.ready = true;
          this.player?.setVolume(Math.round(this.volume * 100));
          if (this.wantPlay) this.player?.playVideo();
        },
        onStateChange: (e: { data: number }) => {
          // Belt-and-suspenders loop: some clients ignore loop=1.
          if (window.YT && e.data === window.YT.PlayerState.ENDED) {
            this.player?.seekTo(0, true);
            this.player?.playVideo();
          }
        }
      }
    });
  }

  /** Begin (or resume) playback. Call from a user gesture; safe to repeat. */
  start(): void {
    this.wantPlay = true;
    if (this.ready) this.player?.playVideo();
  }

  /** 0..1 background-music volume; applies live. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ready) this.player?.setVolume(Math.round(this.volume * 100));
  }
}
