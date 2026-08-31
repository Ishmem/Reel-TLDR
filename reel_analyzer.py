#!/usr/bin/env python3
"""
Instagram Reel Content Analyzer CLI
Takes Instagram Reel URLs or video files and outputs structured multimodal AI summaries.
"""

import sys
import os
import argparse
import json
from analyzer.pipeline import ReelAnalysisPipeline

def main():
    parser = argparse.ArgumentParser(
        description="Instagram Reel Content Analyzer — Multimodal Vision, Audio & OCR Analysis without human watching."
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("url", nargs="?", help="Instagram Reel URL to analyze (e.g. https://www.instagram.com/reel/Cxxxx/)")
    group.add_argument("-b", "--batch", help="Path to text file containing list of Instagram Reel URLs (one per line)")
    group.add_argument("-v", "--video", help="Path to a local video file (.mp4, .mov) to analyze directly")

    parser.add_argument(
        "-p", "--provider",
        choices=["gemini", "groq"],
        default="gemini",
        help="AI Backend provider: 'gemini' (multimodal single-pass) or 'groq' (Whisper + Vision + LLM)"
    )
    parser.add_argument(
        "-o", "--output-dir",
        default="./outputs",
        help="Directory where structured JSON and human-readable TXT summaries will be saved (default: ./outputs)"
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep downloaded temporary video and frame files instead of deleting them (default: False)"
    )
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="Print raw JSON output to stdout instead of formatted text"
    )

    args = parser.parse_args()

    # Verify API key for chosen provider
    if args.provider == "gemini" and not os.environ.get("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please export GEMINI_API_KEY='your_api_key' or configure it in your environment.", file=sys.stderr)
        sys.exit(1)
    elif args.provider == "groq" and not os.environ.get("GROQ_API_KEY"):
        print("Error: GROQ_API_KEY environment variable is not set for Groq provider.", file=sys.stderr)
        print("Please export GROQ_API_KEY='your_api_key' or configure it in your environment.", file=sys.stderr)
        sys.exit(1)

    pipeline = ReelAnalysisPipeline(
        provider_name=args.provider,
        output_dir=args.output_dir,
        keep_temp=args.keep_temp
    )

    if args.batch:
        if not os.path.exists(args.batch):
            print(f"Error: Batch file '{args.batch}' does not exist.", file=sys.stderr)
            sys.exit(1)
        with open(args.batch, "r", encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        
        batch_result = pipeline.process_batch(urls)
        if args.json_only:
            sys.stdout.write(json.dumps(batch_result, indent=2) + "\n")
            sys.stdout.flush()
        else:
            print(f"\nBatch processing complete! ({batch_result['successful']}/{batch_result['total']} succeeded)")
            print(f"Combined report saved to: {batch_result['combined_files']['txt']}")
            print(f"Combined JSON saved to: {batch_result['combined_files']['json']}")

    elif args.video:
        if not os.path.exists(args.video):
            print(f"Error: Video file '{args.video}' does not exist.", file=sys.stderr)
            sys.exit(1)
        result = pipeline.process_video_file(args.video)
        if args.json_only:
            sys.stdout.write(json.dumps(result, indent=2) + "\n")
            sys.stdout.flush()
        else:
            if result["status"] == "SUCCESS":
                print("\n" + result["text_summary"])
                print(f"\nFiles saved:\n- JSON: {result['output_files']['json']}\n- Summary TXT: {result['output_files']['txt']}")
            else:
                print(f"Error: {result.get('error')}", file=sys.stderr)
                sys.exit(1)

    elif args.url:
        result = pipeline.process_url(args.url)
        if args.json_only:
            sys.stdout.write(json.dumps(result, indent=2) + "\n")
            sys.stdout.flush()
        else:
            if result["status"] == "SUCCESS":
                print("\n" + result["text_summary"])
                print(f"\nFiles saved:\n- JSON: {result['output_files']['json']}\n- Summary TXT: {result['output_files']['txt']}")
            else:
                print(f"\nAnalysis Failed: {result.get('error')}", file=sys.stderr)
                sys.exit(1)

if __name__ == "__main__":
    main()
