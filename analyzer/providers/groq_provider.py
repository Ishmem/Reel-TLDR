import os
import json
import subprocess
import tempfile
from typing import Optional
from analyzer.providers.base import BaseAnalyzer
from analyzer.schemas import ReelAnalysis

try:
    from groq import Groq
except ImportError:
    Groq = None


class GroqAnalyzer(BaseAnalyzer):
    """
    Groq AI Engine:
    1. Extracts audio from video with ffmpeg
    2. Transcribes spoken narration using Groq Whisper (whisper-large-v3-turbo)
    3. Synthesizes structured JSON using Groq LLM (qwen/qwen3.8-27b or openai/gpt-oss-120b)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required for Groq provider.")
        if Groq is None:
            raise ImportError("groq python library not installed. Install with 'pip install groq'.")
        self.client = Groq(api_key=self.api_key)

    def extract_audio(self, video_path: str) -> str:
        temp_audio = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        temp_audio.close()
        cmd = [
            "ffmpeg", "-i", video_path,
            "-vn", "-ar", "16000", "-ac", "1",
            "-c:a", "mp3", temp_audio.name, "-y"
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return temp_audio.name

    def transcribe_audio(self, audio_path: str) -> str:
        with open(audio_path, "rb") as f:
            try:
                res = self.client.audio.transcriptions.create(
                    file=f,
                    model="whisper-large-v3-turbo",
                    response_format="json"
                )
                return getattr(res, "text", "") or ""
            except Exception:
                res = self.client.audio.transcriptions.create(
                    file=f,
                    model="whisper-large-v3",
                    response_format="json"
                )
                return getattr(res, "text", "") or ""

    def analyze_video(self, video_path: str, caption_or_notes: str = "") -> ReelAnalysis:
        transcript = ""
        audio_path = None
        try:
            audio_path = self.extract_audio(video_path)
            transcript = self.transcribe_audio(audio_path)
        except Exception as e:
            print(f"[GroqAnalyzer] Note on audio extraction: {e}")
        finally:
            if audio_path and os.path.exists(audio_path):
                try:
                    os.unlink(audio_path)
                except Exception:
                    pass

        prompt = f"""You are an expert social media analyst for Instagram Reels.
Here is the transcribed audio and context for this video:

AUDIO TRANSCRIPT:
\"\"\"{transcript or '[Ambient audio / Music only]'}\"\"\"

ADDITIONAL CONTEXT:
\"\"\"{caption_or_notes or 'None provided'}\"\"\"

Extract and return strictly valid JSON matching this schema:
{{
  "summary": "2-4 concise sentences on what the reel is about.",
  "is_list_content": true or false,
  "list_title": "List title if listicle, else null",
  "list_items": ["Item 1", "Item 2"],
  "key_points": ["Key takeaway 1", "Key takeaway 2"],
  "has_speech": true or false,
  "spoken_content_summary": "Summary of spoken dialogue/narration",
  "on_screen_text": ["Any identifiable captions/titles"],
  "visual_description": "Visual presentation description",
  "dominant_mood": "Mood/Tone",
  "content_type": "Category",
  "hashtag_suggestions": ["tag1", "tag2", "tag3"]
}}
"""
        models = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "groq/compound"]
        last_err = None

        for model in models:
            try:
                resp = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You analyze Instagram Reels and output ONLY valid JSON without markdown fences."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2
                )
                raw_text = resp.choices[0].message.content or "{}"
                # Clean fences and think tags
                cleaned = raw_text.replace("```json", "").replace("```", "").strip()
                if "<think>" in cleaned:
                    cleaned = cleaned.split("</think>")[-1].strip()
                data = json.loads(cleaned)
                return ReelAnalysis(**data)
            except Exception as err:
                last_err = err

        raise last_err or RuntimeError("Groq LLM failed to analyze reel.")
