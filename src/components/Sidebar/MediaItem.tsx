import React, { useState, useEffect, useRef } from 'react';
import { Video, Music, Image, Trash2, MoreVertical, Play } from 'lucide-react';
import type { MediaAsset } from '../../types/media';
import { useMediaStore } from '../../store/mediaStore';
import { useUIStore } from '../../store/uiStore';
import { pathToFileURL } from '../../utils/fileHandling';

interface MediaItemProps {
  media: MediaAsset;
}

export default function MediaItem({ media }: MediaItemProps) {
  const { removeMedia } = useMediaStore();
  const { setSelectedMedia, selectedMediaId } = useUIStore();

  const isSelected = selectedMediaId === media.id;
  const [isHovering, setIsHovering] = useState(false);
  const [audioTimeout, setAudioTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [previewDataURL, setPreviewDataURL] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);
  
  const getIcon = () => {
    switch (media.type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeMedia(media.id);
    setShowMenu(false);
  };
  
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(true);
  };
  
  const handleClick = () => {
    setSelectedMedia(media.id);
  };
  
  const handleDoubleClick = () => {
    // TODO: Add to timeline
    console.log('Double-click to add to timeline:', media.name);
  };

  // Load file as data URL when hovering (audio only)
  const loadPreviewData = async () => {
    // Audio preview loads file as data URL
    if (!previewDataURL && media.type === 'audio') {
      console.log('🔄 Loading audio preview for:', media.name);
      try {
        const dataURL = await window.electronAPI.readFileAsDataURL(media.path);
        if (dataURL) {
          console.log('✅ Audio preview loaded, length:', dataURL.length);
          setPreviewDataURL(dataURL);
        } else {
          console.error('❌ No data URL returned');
        }
      } catch (error) {
        console.error('❌ Error loading audio preview:', error);
      }
    }
  };

  // Handle video playback on hover with 0.5s delay
  useEffect(() => {
    if (media.type !== 'video' || !videoRef.current) return;

    const video = videoRef.current;
    
    if (isHovering) {
      // Delay video playback by 0.5 seconds
      const timeout = setTimeout(() => {
        const playVideo = async () => {
          try {
            video.currentTime = 0;
            await video.play();
            setIsVideoPlaying(true);
          } catch (err) {
            // Ignore AbortError - video was removed during play
            if (err instanceof Error && err.name !== 'AbortError') {
              console.error('Video play error:', err);
            }
          }
        };
        playVideo();
      }, 500);

      return () => clearTimeout(timeout);
    } else {
      // Stop and reset video when not hovering
      try {
        video.pause();
        video.currentTime = 0;
      } catch (err) {
        // Ignore errors when stopping
      }
      setIsVideoPlaying(false);
    }
  }, [isHovering, media.type]);
  
  return (
    <div 
      className={`group relative rounded-lg overflow-hidden cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-purple-600/20 ring-2 ring-purple-400' 
          : 'bg-transparent hover:bg-gray-600/20'
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => {
        setIsHovering(true);

        // Load preview data for video/audio
        loadPreviewData();

        // Delay audio preview by 0.5 seconds
        if (media.type === 'audio') {
          const timeout = setTimeout(() => {
            // Audio will start playing after timeout
            setAudioTimeout(null);
          }, 500);
          setAudioTimeout(timeout);
        }
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        if (audioTimeout) {
          clearTimeout(audioTimeout);
          setAudioTimeout(null);
        }
        
        // Stop audio playback when mouse leaves
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsAudioPlaying(false);
      }}
      style={{ aspectRatio: '4/3' }}
    >
      {/* Thumbnail */}
      <div className="w-full h-3/4 bg-black flex items-center justify-center overflow-hidden rounded-t-lg relative">
        {(() => {
          // Show video preview when hovering
          if (media.type === 'video' && isHovering) {
            const videoUrl = pathToFileURL(media.path);
            return (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain bg-black"
                  loop
                  playsInline
                />
                
                {/* Playing indicator - only show when actually playing */}
                {isVideoPlaying && (
                  <div className="absolute bottom-1 right-1 bg-purple-600/90 rounded p-1.5">
                    <Play className="w-3 h-3 text-white" fill="white" />
                  </div>
                )}
              </>
            );
          }

          // Show static thumbnail
          if (media.thumbnail) {
            return (
              <>
                <img 
                  src={media.thumbnail} 
                  alt={media.name} 
                  className="w-full h-full object-contain bg-black"
                  onError={(e) => {
                    console.error('Failed to load thumbnail for:', media.name, 'URL:', media.thumbnail);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  onLoad={() => console.log('Thumbnail loaded for:', media.name)}
                />
                
                {/* Duration overlay at bottom-left - hide when hovering */}
                {(media.type === 'video' || media.type === 'audio') && media.duration > 0 && !isHovering && (
                  <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded">
                    <p className="text-[10px] text-white font-medium">
                      {formatDuration(media.duration)}
                    </p>
                  </div>
                )}
              </>
            );
          }
          
          // Show icon as fallback
          return (
            <div className="text-gray-500 text-4xl bg-black w-full h-full flex items-center justify-center">
              {getIcon()}
            </div>
          );
        })()}
        
        {/* Audio preview on hover with 1 second delay */}
        {media.type === 'audio' && isHovering && audioTimeout === null && previewDataURL && (
          <audio
            ref={audioRef}
            src={previewDataURL}
            autoPlay
            className="hidden"
            onPlay={() => {
              console.log('🔊 Audio started playing');
              setIsAudioPlaying(true);
            }}
            onPause={() => {
              console.log('⏸️ Audio paused');
              setIsAudioPlaying(false);
            }}
            onError={(e) => console.error('❌ Audio error:', e.target)}
          />
        )}
        
        {/* Playing indicator for audio when actually playing */}
        {media.type === 'audio' && isHovering && isAudioPlaying && (
          <div className="absolute bottom-1 right-1 bg-purple-600/90 rounded p-1.5">
            <Play className="w-3 h-3 text-white" fill="white" />
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="px-2 pb-2 pt-1 bg-transparent">
        <p className="text-xs text-gray-300 truncate" title={media.name}>
          {media.name}
        </p>
      </div>
      
      {/* Three-dot menu - Shows menu options when clicked */}
      <div className="absolute top-1 right-1 z-20" ref={menuRef}>
        {showMenu ? (
          // Menu dropdown
          <div className="bg-gray-800 border border-gray-600 rounded shadow-lg">
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-red-400 hover:bg-gray-700 flex items-center gap-2 text-sm transition-colors rounded-t"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-gray-300 hover:bg-gray-700 flex items-center gap-2 text-sm transition-colors rounded-b"
            >
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleMenuClick}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Options"
          >
            <MoreVertical className="w-3 h-3 text-gray-300" />
          </button>
        )}
      </div>
    </div>
  );
}

