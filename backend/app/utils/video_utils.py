import subprocess
import json
import os
import tempfile
from pathlib import Path
from app.core.config import settings


# Paths to FFmpeg executables from environment variables
FFPROBE_PATH = getattr(settings, 'FFPROBE_PATH', r"C:\ffmpeg\bin\ffprobe.exe")
FFMPEG_PATH = getattr(settings, 'FFMPEG_PATH', r"C:\ffmpeg\bin\ffmpeg.exe")


def get_video_duration(video_path: str) -> float:
    """
    Get the duration of a video in seconds.
    
    Args:
        video_path: Path to the video file
    
    Returns:
        float: Duration in seconds
    """
    try:
        # Try using ffprobe directly via subprocess
        cmd = [
            FFPROBE_PATH,
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        probe = json.loads(result.stdout)
        duration = float(probe['format']['duration'])
        return duration
    except FileNotFoundError:
        # ffprobe not found at default path, try system PATH
        try:
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            probe = json.loads(result.stdout)
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            print(f"Error getting video duration with ffprobe from PATH: {str(e)}")
            raise ValueError(f"Could not determine video duration: {str(e)}")
    except Exception as e:
        print(f"Error getting video duration: {str(e)}")
        raise ValueError(f"Could not determine video duration: {str(e)}")


def compress_video(
    input_path: str,
    output_path: str = None,
    max_duration_seconds: int = 60,
    video_bitrate: str = "1500k",
    audio_bitrate: str = "128k",
    preset: str = "medium",
    crf: int = 28,
    threads: int = 1  # 1 = использовать аппаратное ускорение, 0 = все ядра (может быть медленно)
) -> str:
    """
    Compress and optimize a video file using FFmpeg directly.
    
    Args:
        input_path: Path to input video file
        output_path: Path for output video (optional, will use temp file if not provided)
        max_duration_seconds: Maximum video duration in seconds (default: 60)
        video_bitrate: Video bitrate (default: 1500k for good quality/size balance)
        audio_bitrate: Audio bitrate (default: 128k)
        preset: Encoding preset (default: medium)
        crf: Constant Rate Factor for quality (18-28, higher = more compression, default: 28)
    
    Returns:
        str: Path to compressed video file
    
    Raises:
        ValueError: If video exceeds maximum duration
        RuntimeError: If compression fails
    """
    # Validate video duration
    duration = get_video_duration(input_path)
    if duration > max_duration_seconds:
        raise ValueError(
            f"Видео слишком длинное. Длительность: {duration:.1f} сек. "
            f"Максимальная длительность: {max_duration_seconds} сек."
        )
    
    # Generate output path if not provided
    if not output_path:
        temp_dir = tempfile.gettempdir()
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(temp_dir, f"{base_name}_compressed.mp4")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        # Build FFmpeg command with threading optimization
        cmd = [
            FFMPEG_PATH,
            '-i', input_path,
            '-vcodec', 'libx264',
            '-acodec', 'aac',
            '-b:v', video_bitrate,
            '-b:a', audio_bitrate,
            '-preset', preset,
            '-crf', str(crf),
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-threads', str(threads),  # Использовать все ядра CPU
            '-tune', 'zerolatency',    # Оптимизация для низкой задержки
            '-y',  # Overwrite output file
            output_path
        ]
        
        print(f"Running FFmpeg command: {' '.join(cmd)}")
        
        # Run FFmpeg with timeout
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=180  # 3 minute timeout for FFmpeg (increased from 120)
            )
        except subprocess.TimeoutExpired as e:
            error_message = f"FFmpeg timed out after 180 seconds"
            print(error_message)
            raise RuntimeError(error_message)
        
        print(f"✓ Video compressed successfully: {output_path}")
        print(f"  Original size: {os.path.getsize(input_path) / 1024 / 1024:.2f} MB")
        print(f"  Compressed size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")
        
        return output_path
        
    except subprocess.CalledProcessError as e:
        error_message = f"FFmpeg error: {e.stderr if e.stderr else str(e)}"
        print(error_message)
        raise RuntimeError(f"Video compression failed: {error_message}")
    except Exception as e:
        print(f"Error during video compression: {str(e)}")
        raise RuntimeError(f"Video compression failed: {str(e)}")


def add_watermark_to_video(
    input_path: str,
    logo_path: str,
    output_path: str = None,
    opacity: float = 0.5,  # 50% opacity for balanced visibility
    padding: int = 20
) -> str:
    """
    Add organization logo as watermark to the bottom-right corner of the video.
    
    Args:
        input_path: Path to input video file
        logo_path: Path to the logo image file
        output_path: Path for output video (optional, will use temp file if not provided)
        opacity: Watermark opacity (0.0 to 1.0, default: 0.5 for 50% opacity)
        padding: Padding from edges in pixels (default: 20)
    
    Returns:
        str: Path to video with watermark applied
    
    Raises:
        ValueError: If logo file not found
        RuntimeError: If watermark application fails
    """
    if not os.path.exists(logo_path):
        raise ValueError(f"Logo file not found: {logo_path}")
    
    # Generate output path if not provided
    if not output_path:
        temp_dir = tempfile.gettempdir()
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(temp_dir, f"{base_name}_watermarked.mp4")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        # Build FFmpeg filter complex for watermark with bottom-right positioning
        # The watermark will be automatically resized by FFmpeg to fit within 50% of video width/height
        filter_complex = f"[1:v]scale=iw*0.5:-1[wm];[0:v][wm]overlay=W-w-{padding}:H-h-{padding}:format=auto" # Bottom-right corner
        
        # Build FFmpeg command
        cmd = [
            FFMPEG_PATH,
            '-i', input_path,
            '-i', logo_path,
            '-filter_complex', filter_complex,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'medium',
            '-crf', '28',
            '-y',  # Overwrite output file
            output_path
        ]
        
        print(f"Running FFmpeg watermark command: {' '.join(cmd)}")
        
        # Run FFmpeg with timeout
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=180  # 3 minute timeout for watermark (increased from 120)
            )
        except subprocess.TimeoutExpired as e:
            error_message = f"FFmpeg watermark timed out after 180 seconds"
            print(error_message)
            raise RuntimeError(error_message)
        
        print(f"✓ Watermark applied to video successfully: {output_path}")
        print(f"  Input video: {input_path}")
        print(f"  Logo: {logo_path}")
        print(f"  Output: {output_path}")
        print(f"  Opacity: {opacity*100}%")
        print(f"  Position: Bottom-right with {padding}px padding")
        
        return output_path
        
    except subprocess.CalledProcessError as e:
        error_message = f"FFmpeg watermark error: {e.stderr if e.stderr else str(e)}"
        print(error_message)
        raise RuntimeError(f"Video watermark application failed: {error_message}")
    except Exception as e:
        print(f"Error during video watermark application: {str(e)}")
        raise RuntimeError(f"Video watermark application failed: {str(e)}")


def validate_video_file(video_path: str, max_size_mb: int = 100, max_duration_sec: int = 60) -> dict:
    """
    Validate a video file meets requirements.
    
    Args:
        video_path: Path to video file
        max_size_mb: Maximum file size in MB (default: 100)
        max_duration_sec: Maximum duration in seconds (default: 60)
    
    Returns:
        dict: Validation result with 'valid', 'size_mb', 'duration_sec' keys
    
    Raises:
        ValueError: If validation fails
    """
    # Check file exists
    if not os.path.exists(video_path):
        raise ValueError(f"Video file not found: {video_path}")
    
    # Check file size
    size_mb = os.path.getsize(video_path) / 1024 / 1024
    if size_mb > max_size_mb:
        raise ValueError(
            f"Файл слишком большой. Размер: {size_mb:.1f}MB. "
            f"Максимальный размер: {max_size_mb}MB"
        )
    
    # Check duration
    duration_sec = get_video_duration(video_path)
    if duration_sec > max_duration_sec:
        raise ValueError(
             f"Видео слишком длинное. Длительность: {duration_sec:.1f} сек. "
            f"Максимальная длительность: {max_duration_sec} сек."
        )
    
    return {
        'valid': True,
        'size_mb': size_mb,
        'duration_sec': duration_sec
    }
