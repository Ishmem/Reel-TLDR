import os
import re
import sys
import glob
import shutil
import tempfile
import urllib.parse
from typing import Optional, Tuple

class VideoDownloader:
    """
    Downloads Instagram Reels with fallback strategies:
    1. Instaloader (Primary)
    2. yt-dlp (Fallback)
    """

    @staticmethod
    def extract_shortcode(url: str) -> Optional[str]:
        """Extract shortcode from Instagram URL."""
        clean_url = url.strip()
        # Match instagram.com/reel/SHORTCODE, /reels/SHORTCODE, /p/SHORTCODE
        pattern = r'(?:instagram\.com/(?:reel|reels|p)/([A-Za-z0-9_-]+))'
        match = re.search(pattern, clean_url)
        if match:
            return match.group(1)
        
        # If it's already just a shortcode
        if re.match(r'^[A-Za-z0-9_-]{10,13}$', clean_url):
            return clean_url
        return None

    @classmethod
    def download(cls, url: str, temp_dir: Optional[str] = None) -> Tuple[str, str]:
        """
        Downloads a reel from URL to a temporary or specified directory.
        Returns: (video_file_path, shortcode_or_id)
        Raises: Exception if all download methods fail
        """
        if not temp_dir:
            temp_dir = tempfile.mkdtemp(prefix="reel_download_")
        os.makedirs(temp_dir, exist_ok=True)

        shortcode = cls.extract_shortcode(url) or "reel_" + str(abs(hash(url)) % 10000000)
        errors = []

        # Strategy 1: Instaloader
        try:
            print(f"[Downloader] Attempting download with Instaloader for: {url}", file=sys.stderr)
            video_path = cls._download_with_instaloader(url, shortcode, temp_dir)
            if video_path and os.path.exists(video_path) and os.path.getsize(video_path) > 1024:
                print(f"[Downloader] Successfully downloaded using Instaloader: {video_path}", file=sys.stderr)
                return video_path, shortcode
        except Exception as e:
            err_msg = f"Instaloader failed: {str(e)}"
            print(f"[Downloader] {err_msg}", file=sys.stderr)
            errors.append(err_msg)

        # Strategy 2: yt-dlp
        try:
            print(f"[Downloader] Falling back to yt-dlp for: {url}", file=sys.stderr)
            video_path = cls._download_with_ytdlp(url, shortcode, temp_dir)
            if video_path and os.path.exists(video_path) and os.path.getsize(video_path) > 1024:
                print(f"[Downloader] Successfully downloaded using yt-dlp: {video_path}", file=sys.stderr)
                return video_path, shortcode
        except Exception as e:
            err_msg = f"yt-dlp failed: {str(e)}"
            print(f"[Downloader] {err_msg}", file=sys.stderr)
            errors.append(err_msg)

        raise RuntimeError(f"Could not download Reel from {url}. Strategies tried:\n" + "\n".join(errors))

    @classmethod
    def _download_with_instaloader(cls, url: str, shortcode: str, target_dir: str) -> Optional[str]:
        import instaloader
        import logging

        # Ensure instaloader logger outputs to stderr, not stdout
        instaloader_logger = logging.getLogger("instaloader")
        instaloader_logger.setLevel(logging.WARNING)

        loader = instaloader.Instaloader(
            download_pictures=False,
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_history=False,
            post_metadata_txt_pattern="",
            dirname_pattern=target_dir,
            filename_pattern=f"{shortcode}",
            quiet=True
        )

        try:
            post = instaloader.Post.from_shortcode(loader.context, shortcode)
            if not post.is_video:
                raise ValueError("Target Instagram post is not a video/reel.")
            
            loader.download_post(post, target=target_dir)

            # Search for downloaded .mp4 file in target_dir
            candidates = glob.glob(os.path.join(target_dir, f"*{shortcode}*.mp4")) + glob.glob(os.path.join(target_dir, "*.mp4"))
            if candidates:
                return candidates[0]
        except Exception as e:
            raise e
        return None

    @classmethod
    def _download_with_ytdlp(cls, url: str, shortcode: str, target_dir: str) -> Optional[str]:
        import yt_dlp

        class SilentLogger:
            def debug(self, msg):
                pass
            def info(self, msg):
                pass
            def warning(self, msg):
                print(f"[yt-dlp warning] {msg}", file=sys.stderr)
            def error(self, msg):
                print(f"[yt-dlp error] {msg}", file=sys.stderr)

        out_template = os.path.join(target_dir, f"{shortcode}.%(ext)s")
        ydl_opts = {
            'outtmpl': out_template,
            'format': 'bestvideo+bestaudio/best',
            'merge_output_format': 'mp4',
            'quiet': True,
            'no_warnings': True,
            'noprogress': True,
            'noplaylist': True,
            'logger': SilentLogger(),
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        candidates = glob.glob(os.path.join(target_dir, f"{shortcode}*.mp4")) + glob.glob(os.path.join(target_dir, "*.mp4"))
        if candidates:
            return candidates[0]
        return None
