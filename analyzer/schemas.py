from typing import List, Optional
from dataclasses import dataclass, asdict

@dataclass
class ReelAnalysis:
    summary: str
    is_list_content: bool
    list_title: Optional[str]
    list_items: List[str]
    key_points: List[str]
    has_speech: bool
    spoken_content_summary: str
    on_screen_text: List[str]
    visual_description: str
    dominant_mood: str
    content_type: str
    hashtag_suggestions: List[str]

    def to_dict(self):
        return asdict(self)
