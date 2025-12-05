declare module "*.css" {
  const content: { [className: string]: string }
  export default content
}

declare module "*.scss" {
  const content: { [className: string]: string }
  export default content
}

// YouTube IFrame API types
declare namespace YT {
  interface Player {
    playVideo(): void
    pauseVideo(): void
    stopVideo(): void
    seekTo(seconds: number, allowSeekAhead?: boolean): void
    setVolume(volume: number): void
    getVolume(): number
    mute(): void
    unMute(): void
    isMuted(): boolean
    setPlaybackRate(suggestedRate: number): void
    getPlaybackRate(): number
    getAvailablePlaybackRates(): number[]
    getCurrentTime(): number
    getDuration(): number
    getPlayerState(): PlayerState
    destroy(): void
  }

  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5
  }

  interface PlayerEvent {
    target: Player
    data: number
  }

  interface PlayerOptions {
    height?: string | number
    width?: string | number
    videoId?: string
    playerVars?: {
      autoplay?: 0 | 1
      controls?: 0 | 1
      enablejsapi?: 0 | 1
      modestbranding?: 0 | 1
      rel?: 0 | 1
      playsinline?: 0 | 1
      origin?: string
    }
    events?: {
      onReady?: (event: PlayerEvent) => void
      onStateChange?: (event: PlayerEvent) => void
      onError?: (event: PlayerEvent) => void
    }
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions)
  }
}

interface Window {
  YT?: typeof YT
  onYouTubeIframeAPIReady?: () => void
}