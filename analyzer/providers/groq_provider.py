import os
import sys
import json
import base64
import subprocess
import tempfile
import glob
from typing import Optional, List
from analyzer.providers.base import BaseAnalyzer
from analyzer.schemas import ReelAnalysis

GROQ_SYNTHESIS_PROMPT = """You are an expert social media and video content analyst.
Synthesize the provided audio transcript and visual frame descriptions of an Instagram Reel into a structured JSON analysis.

Strict Requirements:
1. Detect if spoken dialogue/narration is present and summarize it.
2. Combine all extracted on-screen text (captions, subtitles, book titles, screenshot text, stickers).
3. Detect if the reel is in a numbered/list format (e.g. "5 YouTube channels for finance", "Top 3 tips").
   - If yes: set `is_list_content` to true, provide the exact `list_title`, and extract each specific item by its actual name (e.g. ["Tool A", "Tool B"], NOT generic labels).
   - If not: set `is_list_content` to false, `list_title` to null, `list_items` to empty list.
4. Extract 3-6 clear `key_points`.
5. Provide a 2-4 sentence comprehensive `summary`.
6. Summarize the `visual_description` from the frame observations.
7. Identify `dominant_mood` (e.g., "Motivational", "Humorous", "Educational", "Calm").
8. Categorize `content_type` (e.g., "Educational / Tutorial", "Listicle / Resource Roundup", "Product Review", "Lifestyle").
9. Suggest 5-10 trending `hashtag_suggestions` (without '#').

Return ONLY a valid JSON object matching this schema:
{
  "summary": "string",
  "is_list_content": true/false,
  "list_title": "string or null",
  "list_items": ["string"],
  "key_points": ["string"],
  "has_speech": true/false,
  "spoken_content_summary": "string",
  "on_screen_text": ["string"],
  "visual_description": "string",
  "dominant_mood": "string",
  "content_type": "string",
  "hashtag_suggestions": ["string"]
}
"""

class GroqAnalyzer(BaseAnalyzer):
    """
    Fallback/Free alternative analyzer using Groq API:
    1. Whisper API (audio extraction & transcription)
    2. Vision Model API (frame sampling & visual OCR/description)
    3. Text LLM API (synthesis into final structured schema)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable or argument is required for GroqAnalyzer.")
        
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
        except ImportError:
            raise ImportError("Please install groq package: pip install groq")

    def analyze_video(self, video_path: str) -> ReelAnalysis:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        temp_dir = tempfile.mkdtemp(prefix="groq_reel_proc_")
        try:
            # Step 1: Audio extraction & Whisper transcription
            audio_transcript, has_speech = self._extract_and_transcribe_audio(video_path, temp_dir)

            # Step 2: Frame sampling & Vision OCR / visual analysis
            frame_descriptions = self._extract_and_analyze_frames(video_path, temp_dir)

            # Step 3: Synthesis via Groq Text LLM
            analysis = self._synthesize_results(audio_transcript, has_speech, frame_descriptions)
            return analysis

        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    def _extract_and_transcribe_audio(self, video_path: str, temp_dir: str) -> tuple[str, bool]:
        audio_path = os.path.join(temp_dir, "audio.mp3")
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "64k",
            audio_path
        ]
        
        try:
            print("[GroqAnalyzer] Extracting audio with ffmpeg...", file=sys.stderr)
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        except Exception as e:
            print(f"[GroqAnalyzer] Audio extraction warning: {e}", file=sys.stderr)
            return "No audio track available or audio extraction failed.", False

        if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 100:
            return "No audio detected in video.", False

        print("[GroqAnalyzer] Transcribing audio with Groq Whisper...", file=sys.stderr)
        try:
            with open(audio_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3",
                    response_format="text"
                )
                transcript_text = str(transcription).strip()
                has_speech = len(transcript_text) > 5 and "thank you for watching" not in transcript_text.lower()
                return transcript_text if transcript_text else "No spoken speech detected.", has_speech
        except Exception as e:
            print(f"[GroqAnalyzer] Whisper error: {e}", file=sys.stderr)
            return f"Audio transcription error: {str(e)}", False

    def _extract_and_analyze_frames(self, video_path: str, temp_dir: str) -> List[str]:
        # Extract 4-6 evenly spaced frames from video
        frames_pattern = os.path.join(temp_dir, "frame_%03d.jpg")
        # Extract 1 frame every 4 seconds or at least 4 frames
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-vf", "fps=1/3,scale=720:-1",
            "-q:v", "3",
            frames_pattern
        ]
        try:
            print("[GroqAnalyzer] Extracting sample video frames with ffmpeg...", file=sys.stderr)
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        except Exception as e:
            print(f"[GroqAnalyzer] Frame extraction error: {e}", file=sys.stderr)

        frame_files = sorted(glob.glob(os.path.join(temp_dir, "frame_*.jpg")))
        if not frame_files:
            # Try single frame fallback
            fallback_frame = os.path.join(temp_dir, "frame_001.jpg")
            subprocess.run(["ffmpeg", "-y", "-i", video_path, "-vframes", "1", fallback_frame],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            frame_files = glob.glob(os.path.join(temp_dir, "frame_*.jpg"))

        if not frame_files:
            return ["No visual frames could be extracted."]

        # Select max 5 frames for vision model
        selected_frames = frame_files[:5]
        frame_descriptions = []

        print(f"[GroqAnalyzer] Analyzing {len(selected_frames)} frames with Groq Vision...", file=sys.stderr)
        for i, fpath in enumerate(selected_frames, 1):
            try:
                with open(fpath, "rb") as img_f:
                    b64_img = base64.b64encode(img_f.read()).decode("utf-8")
                
                vis_resp = self.client.chat.completions.create(
                    model="llama-3.2-11b-vision-preview",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Frame {i}: Read and transcribe all on-screen text, subtitles, headings, and labels. Describe what is visually shown, people, actions, and graphic overlays."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64_img}"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=350,
                    temperature=0.2
                )
                desc = vis_resp.choices[0].message.content or ""
                frame_descriptions.append(f"Frame {i} Observation:\n{desc.strip()}")
            except Exception as e:
                print(f"[GroqAnalyzer] Vision frame {i} warning: {e}", file=sys.stderr)
                frame_descriptions.append(f"Frame {i}: Visual observation unavailable ({str(e)})")

        return frame_descriptions

    def _synthesize_results(self, audio_transcript: str, has_speech: bool, frame_descriptions: List[str]) -> ReelAnalysis:
        combined_context = f"""=== AUDIO TRANSCRIPT ===
Spoken Speech Detected: {'Yes' if has_speech else 'No'}
Transcript:
{audio_transcript}

=== VISUAL FRAME OBSERVATIONS & ON-SCREEN TEXT ===
{chr(10).join(frame_descriptions)}
"""
        print("[GroqAnalyzer] Synthesizing final structured analysis with Groq LLM (llama-3.3-70b-versatile)...", file=sys.stderr)
        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": GROQ_SYNTHESIS_PROMPT},
                    {"role": "user", "content": combined_context}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            raw_text = resp.choices[0].message.content or "{}"
            parsed = json.loads(raw_text)

            return ReelAnalysis(
                summary=parsed.get("summary", ""),
                is_list_content=bool(parsed.get("is_list_content", False)),
                list_title=parsed.get("list_title") if parsed.get("is_list_content") else None,
                list_items=parsed.get("list_items", []) or [],
                key_points=parsed.get("key_points", []) or [],
                has_speech=bool(parsed.get("has_speech", has_speech)),
                spoken_content_summary=parsed.get("spoken_content_summary", ""),
                on_screen_text=parsed.get("on_screen_text", []) or [],
                visual_description=parsed.get("visual_description", ""),
                dominant_mood=parsed.get("dominant_mood", "Informative"),
                content_type=parsed.get("content_type", "Video"),
                hashtag_suggestions=parsed.get("hashtag_suggestions", []) or []
            )
        except Exception as e:
            print(f"[GroqAnalyzer] Synthesis error: {e}", file=sys.stderr)
            # Fallback structure
            return ReelAnalysis(
                summary="Analysis generated from audio transcript and visual frames.",
                is_list_content=False,
                list_title=None,
                list_items=[],
                key_points=[f"Transcript excerpt: {audio_transcript[:120]}..."],
                has_speech=has_speech,
                spoken_content_summary=audio_transcript[:300],
                on_screen_text=["Extracted from frame analysis"],
                visual_description="\n".join(frame_descriptions)[:400],
                dominant_mood="Informative",
                content_type="Social Media Reel",
                hashtag_suggestions=["instagramreels", "contentanalysis", "ai"]
            )
