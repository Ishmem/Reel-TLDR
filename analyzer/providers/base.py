from abc import ABC, abstractmethod
from analyzer.schemas import ReelAnalysis

class BaseAnalyzer(ABC):
    """Abstract interface for Reel analyzers."""

    @abstractmethod
    def analyze_video(self, video_path: str) -> ReelAnalysis:
        """
        Takes a local video file path and returns structured ReelAnalysis.
        """
        pass
