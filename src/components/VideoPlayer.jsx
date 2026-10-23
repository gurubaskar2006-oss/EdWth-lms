import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  Sparkles,
  CheckCircle2,
  Tv
} from 'lucide-react';

export const VideoPlayer = ({ lesson, onComplete, isCompleted, courseTitle }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // When lesson changes, reset player
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [lesson?.id]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 120);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const skipTime = (delta) => {
    if (videoRef.current) {
      const nextTime = Math.min(Math.max(0, videoRef.current.currentTime + delta), duration);
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        backgroundColor: '#050706',
        borderRadius: theaterMode ? '0' : 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border-default)',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Video Stream / Canvas Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%', // 16:9 Aspect Ratio
          backgroundColor: '#050807'
        }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={lesson?.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
          poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            if (!isCompleted && onComplete) onComplete();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          playsInline
        />

        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-blue)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
                transform: 'scale(1)',
                transition: 'transform var(--transition-fast)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Play size={26} fill="currentColor" style={{ marginLeft: '3px' }} />
            </div>
          </div>
        )}

        {/* Dynamic Subtitles Overlay */}
        {showSubtitles && isPlaying && (
          <div
            style={{
              position: 'absolute',
              bottom: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(8, 12, 10, 0.85)',
              border: '1px solid var(--border-default)',
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              color: '#ffffff',
              textAlign: 'center',
              pointerEvents: 'none',
              maxWidth: '85%'
            }}
          >
            {lesson?.title}: Implementing tensor backpropagation in CUDA and Python
          </div>
        )}
      </div>

      {/* Sleek Slate Video Control Bar */}
      <div
        style={{
          background: '#0F172A',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timeline Scrubber */}
        <div style={{ position: 'relative', width: '100%', height: '8px', display: 'flex', alignItems: 'center' }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%',
              height: '5px',
              appearance: 'none',
              WebkitAppearance: 'none',
              background: `linear-gradient(to right, var(--accent-blue) ${progressPercent}%, #334155 ${progressPercent}%)`,
              borderRadius: '9999px',
              cursor: 'pointer',
              outline: 'none'
            }}
          />
        </div>

        {/* Buttons and Meta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Left: Play, Skips, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={togglePlay}
              className="btn-icon"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--accent-blue)',
                color: '#FFFFFF',
                borderColor: 'transparent'
              }}
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
            </button>

            <button onClick={() => skipTime(-10)} className="btn-icon" style={{ width: '32px', height: '32px', color: '#94A3B8' }} title="Rewind 10s">
              <RotateCcw size={15} />
            </button>
            <button onClick={() => skipTime(10)} className="btn-icon" style={{ width: '32px', height: '32px', color: '#94A3B8' }} title="Forward 10s">
              <RotateCw size={15} />
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.25rem' }}>
              <button onClick={toggleMute} className="btn-icon" style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', color: '#94A3B8' }}>
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                onInput={handleVolumeChange}
                style={{
                  width: '65px',
                  height: '4px',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: `linear-gradient(to right, var(--accent-blue) ${(isMuted ? 0 : volume) * 100}%, #334155 ${(isMuted ? 0 : volume) * 100}%)`,
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              />
            </div>

            {/* Timecode */}
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginLeft: '0.5rem' }}>
              <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{formatTime(currentTime)}</span> / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Subtitles, Speed, Theater, Complete Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* Mark Complete Button */}
            <button
              onClick={onComplete}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isCompleted ? '#ECFDF5' : 'var(--bg-surface)',
                border: `1px solid ${isCompleted ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                color: isCompleted ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700
              }}
            >
              <CheckCircle2 size={15} color={isCompleted ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              <span>{isCompleted ? 'Completed' : 'Mark as Done'}</span>
            </button>

            {/* Subtitles */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                color: showSubtitles ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}
              title="Toggle Subtitles"
            >
              <Subtitles size={16} />
            </button>

            {/* Playback Speed Popover */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    right: 0,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100
                  }}
                >
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => changeSpeed(spd)}
                      style={{
                        padding: '0.3rem 0.8rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        backgroundColor: playbackSpeed === spd ? '#ECFDF5' : 'transparent',
                        color: playbackSpeed === spd ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {spd}x {spd === 1.0 && '(Normal)'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theater Mode */}
            <button
              onClick={() => setTheaterMode(!theaterMode)}
              className="btn-icon"
              style={{ width: '32px', height: '32px', color: theaterMode ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
              title="Theater Mode"
            >
              <Tv size={16} />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="btn-icon"
              style={{ width: '32px', height: '32px' }}
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
