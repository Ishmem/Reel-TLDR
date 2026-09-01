import os
import json
import time
import sys
from typing import Optional

# Try importing google genai SDK if installed
try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    genai = None
    types = None

from analyzer.providers.base import BaseAnalyzer
from analyzer.schemas import ReelAnalysis

ANALYSIS_SYSTEM_PROMPT = """You are an expert social media and video content analyst specializing in short-form Instagram Reels.
Analyze this video thoroughly across both visuals and audio.
Extract and provide structured information adhering strictly to these requirements:

1. Detect whether there is spoken narration or dialogue, and summarize the spoken content.
2. Read and extract ANY on-screen text (burned-in subtitles, overlay captions, titles, thumbnail labels, book titles, screenshot text, UI text).
3. Check if the reel is in a numbered or list format (e.g., "5 AI tools to try", "Top 3 habits for focus").
   - If yes: set `is_list_content` to true, provide the exact `list_title`, and list each specific item by its actual name/title (e.g., ["Notion AI", "Perplexity", "Midjourney"], NOT generic descriptions like ["first tool", "second tool"]).
   - If not a list: set `is_list_content` to false, `list_title` to null, and `list_items` to empty list.
4. Extract 3-6 clear `key_points`.
5. Provide a comprehensive overall `summary` (2-4 concise sentences) explaining what the reel is actually about.
6. Describe the `visual_description` (what is visually happening, aesthetics, setting, camera angles, demonstrations).
7. Identify the `dominant_mood` (e.g., "High Energy / Motivational", "Humorous / Satirical", "Educational / Informative", "Calm / Aesthetic", "Urgent / Direct").
8. Categorize the `content_type` (e.g., "Educational / Tutorial", "Listicle / Resource Roundup", "Comedy / Sketch", "Tech / Product Demo", "Fitness / Health", "Lifestyle / Vlog", "Finance / Wealth").
9. Suggest 5-10 relevant and trending `hashtag_suggestions` without the '#' symbol.

Return ONLY a valid JSON object matching this exact schema:
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

class GeminiAnalyzer(BaseAnalyzer):
    """
    Primary analyzer provider using Google GenAI SDK.
    Natively processes both video frames and audio tracks together in one multimodal call.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-3.7-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable or argument is required for GeminiAnalyzer.")
        
        if not HAS_GENAI:
            raise ImportError("The 'google-genai' package is not installed in the Python environment. Run 'pip install google-genai' or use the full-stack server integration.")

        self.model_name = model_name
        self.fallback_models = ["gemini-3.7-flash", "gemini-3.1-pro-preview"]
        self.client = genai.Client(
            api_key=self.api_key,
            http_options={'headers': {'User-Agent': 'aistudio-build'}}
        )

    def analyze_video(self, video_path: str) -> ReelAnalysis:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        file_size = os.path.getsize(video_path)
        print(f"[GeminiAnalyzer] Uploading video ({file_size / (1024*1024):.2f} MB) via Files API...", file=sys.stderr)

        uploaded_file = None
        try:
            # Upload video file to Gemini Files API
            uploaded_file = self.client.files.upload(
                file=video_path,
                config=types.UploadFileConfig(
                    mime_type="video/mp4",
                    display_name=os.path.basename(video_path)
                )
            )

            # Wait for file processing if needed
            print(f"[GeminiAnalyzer] File uploaded (name: {uploaded_file.name}). Checking processing state...", file=sys.stderr)
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(2)
                uploaded_file = self.client.files.get(name=uploaded_file.name)

            if uploaded_file.state.name == "FAILED":
                raise RuntimeError(f"Gemini video processing failed: {uploaded_file.error}")

            prompt = "Analyze this Instagram Reel video and extract complete audio, visual, on-screen text, list items, and summary into the requested JSON schema."

            models_to_try = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
            last_err = None

            for m in models_to_try:
                for attempt in range(2):
                    try:
                        print(f"[GeminiAnalyzer] Requesting multimodal analysis with {m} (attempt {attempt + 1})...", file=sys.stderr)
                        response = self.client.models.generate_content(
                            model=m,
                            contents=[
                                uploaded_file,
                                prompt
                            ],
                            config=types.GenerateContentConfig(
                                system_instruction=ANALYSIS_SYSTEM_PROMPT,
                                response_mime_type="application/json",
                                temperature=0.2,
                            )
                        )

                        response_text = response.text or ""
                        parsed = json.loads(response_text)

                        return ReelAnalysis(
                            summary=parsed.get("summary", ""),
                            is_list_content=bool(parsed.get("is_list_content", False)),
                            list_title=parsed.get("list_title") if parsed.get("is_list_content") else None,
                            list_items=parsed.get("list_items", []) or [],
                            key_points=parsed.get("key_points", []) or [],
                            has_speech=bool(parsed.get("has_speech", True)),
                            spoken_content_summary=parsed.get("spoken_content_summary", ""),
                            on_screen_text=parsed.get("on_screen_text", []) or [],
                            visual_description=parsed.get("visual_description", ""),
                            dominant_mood=parsed.get("dominant_mood", "Informative"),
                            content_type=parsed.get("content_type", "Video"),
                            hashtag_suggestions=parsed.get("hashtag_suggestions", []) or []
                        )
                    except Exception as e:
                        last_err = e
                        print(f"[GeminiAnalyzer] Attempt with {m} failed: {e}. Retrying in 2s...", file=sys.stderr)
                        time.sleep(2)

            raise last_err or RuntimeError("Gemini generation failed on all models.")

        finally:
            # Delete file from Gemini Files API storage
            if uploaded_file:
                try:
                    self.client.files.delete(name=uploaded_file.name)
                    print(f"[GeminiAnalyzer] Deleted remote file {uploaded_file.name} from Gemini storage.", file=sys.stderr)
                except Exception as del_err:
                    print(f"[GeminiAnalyzer] Warning: could not delete remote file: {del_err}", file=sys.stderr)
