import json
import os
from typing import List, Dict, Any
from analyzer.schemas import ReelAnalysis

def format_text_summary(analysis: ReelAnalysis, reel_identifier: str = "Instagram Reel") -> str:
    """
    Produces a structured, human-readable plain text summary file.
    """
    lines = [
        "=" * 60,
        f" INSTAGRAM REEL CONTENT ANALYSIS: {reel_identifier}",
        "=" * 60,
        "",
        f"📌 CONTENT TYPE:   {analysis.content_type}",
        f"🎭 DOMINANT MOOD:  {analysis.dominant_mood}",
        f"🗣️ SPOKEN SPEECH:  {'Yes' if analysis.has_speech else 'No / Ambient Audio Only'}",
        "",
        "-" * 60,
        "📝 EXECUTIVE SUMMARY",
        "-" * 60,
        analysis.summary,
        ""
    ]

    if analysis.is_list_content:
        lines.extend([
            "-" * 60,
            f"📋 LIST FORMAT DETECTED: {analysis.list_title or 'Ranked List'}",
            "-" * 60
        ])
        for idx, item in enumerate(analysis.list_items, 1):
            lines.append(f"  {idx}. {item}")
        lines.append("")

    if analysis.key_points:
        lines.extend([
            "-" * 60,
            "💡 KEY TAKEAWAYS & HIGHLIGHTS",
            "-" * 60
        ])
        for pt in analysis.key_points:
            lines.append(f"  • {pt}")
        lines.append("")

    if analysis.has_speech and analysis.spoken_content_summary:
        lines.extend([
            "-" * 60,
            "🎙️ SPOKEN NARRATION & DIALOGUE SUMMARY",
            "-" * 60,
            analysis.spoken_content_summary,
            ""
        ])

    if analysis.on_screen_text:
        lines.extend([
            "-" * 60,
            "🔍 ON-SCREEN TEXT & GRAPHIC OCR",
            "-" * 60
        ])
        for text in analysis.on_screen_text:
            lines.append(f"  [Text] {text}")
        lines.append("")

    if analysis.visual_description:
        lines.extend([
            "-" * 60,
            "🎬 VISUAL SCENE & AESTHETIC BREAKDOWN",
            "-" * 60,
            analysis.visual_description,
            ""
        ])

    if analysis.hashtag_suggestions:
        lines.extend([
            "-" * 60,
            "🏷️ RECOMMENDED HASHTAGS",
            "-" * 60,
            " ".join(f"#{tag.lstrip('#')}" for tag in analysis.hashtag_suggestions),
            ""
        ])

    lines.append("=" * 60)
    return "\n".join(lines)

def save_analysis_files(analysis: ReelAnalysis, output_dir: str, base_name: str) -> Dict[str, str]:
    """
    Saves JSON and TXT summary files. Returns dictionary of written file paths.
    """
    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, f"{base_name}_analysis.json")
    txt_path = os.path.join(output_dir, f"{base_name}_summary.txt")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(analysis.to_dict(), f, indent=2, ensure_ascii=False)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(format_text_summary(analysis, base_name))

    return {
        "json": json_path,
        "txt": txt_path
    }

def format_combined_batch_summary(results: List[Dict[str, Any]]) -> str:
    """
    Generates a combined batch summary for multiple analyzed reels.
    """
    lines = [
        "#" * 70,
        f" COMBINED BATCH REEL ANALYSIS REPORT ({len(results)} Reels Processed)",
        "#" * 70,
        ""
    ]

    for idx, item in enumerate(results, 1):
        url = item.get("url", f"Reel #{idx}")
        status = item.get("status", "SUCCESS")
        lines.append(f"[{idx}/{len(results)}] {url} — Status: {status}")
        
        if status == "SUCCESS" and "analysis" in item:
            ana = item["analysis"]
            summary = ana.get("summary", "")
            content_type = ana.get("content_type", "")
            mood = ana.get("dominant_mood", "")
            is_list = ana.get("is_list_content", False)
            list_title = ana.get("list_title", "")
            list_items = ana.get("list_items", [])

            lines.append(f"    Type: {content_type} | Mood: {mood}")
            lines.append(f"    Summary: {summary}")
            if is_list and list_items:
                lines.append(f"    List ({list_title}): {', '.join(list_items)}")
        elif "error" in item:
            lines.append(f"    Error: {item['error']}")
        lines.append("-" * 70)

    return "\n".join(lines)
