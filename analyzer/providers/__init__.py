from analyzer.providers.base import BaseAnalyzer

def get_analyzer(provider_name: str = "gemini", **kwargs) -> BaseAnalyzer:
    provider = provider_name.lower().strip()
    if provider in ("gemini", "google"):
        from analyzer.providers.gemini_provider import GeminiAnalyzer
        return GeminiAnalyzer(**kwargs)
    elif provider in ("groq", "whisper_vision"):
        from analyzer.providers.groq_provider import GroqAnalyzer
        return GroqAnalyzer(**kwargs)
    else:
        raise ValueError(f"Unknown provider '{provider_name}'. Supported providers: 'gemini', 'groq'")

