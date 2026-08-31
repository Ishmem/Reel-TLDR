from analyzer.providers.base import BaseAnalyzer
from analyzer.providers.gemini_provider import GeminiAnalyzer
from analyzer.providers.groq_provider import GroqAnalyzer

def get_analyzer(provider_name: str = "gemini", **kwargs) -> BaseAnalyzer:
    provider = provider_name.lower().strip()
    if provider in ("gemini", "google"):
        return GeminiAnalyzer(**kwargs)
    elif provider in ("groq", "whisper_vision"):
        return GroqAnalyzer(**kwargs)
    else:
        raise ValueError(f"Unknown provider '{provider_name}'. Supported providers: 'gemini', 'groq'")
