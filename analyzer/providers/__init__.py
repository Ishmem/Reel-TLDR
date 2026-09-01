from analyzer.providers.base import BaseAnalyzer

def get_analyzer(provider_name: str = "groq", **kwargs) -> BaseAnalyzer:
    provider = provider_name.lower().strip()
    if provider in ("groq", "whisper"):
        from analyzer.providers.groq_provider import GroqAnalyzer
        return GroqAnalyzer(**kwargs)
    elif provider in ("gemini", "google"):
        from analyzer.providers.gemini_provider import GeminiAnalyzer
        return GeminiAnalyzer(**kwargs)
    else:
        from analyzer.providers.groq_provider import GroqAnalyzer
        return GroqAnalyzer(**kwargs)

