import os
import sys
import shutil
import tempfile
from typing import Optional, Dict, Any, List
from analyzer.downloader import VideoDownloader
from analyzer.providers import get_analyzer
from analyzer.formatter import save_analysis_files, format_text_summary, format_combined_batch_summary
from analyzer.schemas import ReelAnalysis

class ReelAnalysisPipeline:
    """
    Complete Reel Analysis Pipeline:
    Download -> Multimodal AI Analysis -> Structured JSON & Text Output -> Cleanup
    """

    def __init__(self, provider_name: str = "gemini", output_dir: str = "./outputs", keep_temp: bool = False, **provider_kwargs):
        self.provider_name = provider_name
        self.output_dir = output_dir
        self.keep_temp = keep_temp
        self.provider_kwargs = provider_kwargs
        self.analyzer = get_analyzer(provider_name, **provider_kwargs)
        os.makedirs(self.output_dir, exist_ok=True)

    def process_url(self, url: str, custom_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes pipeline for a single Instagram Reel URL with guaranteed cleanup.
        """
        temp_dir = tempfile.mkdtemp(prefix="reel_temp_")
        downloaded_video = None
        shortcode = custom_name or VideoDownloader.extract_shortcode(url) or "reel_result"

        try:
            print(f"[Pipeline] 1/3 Downloading Instagram Reel from: {url}", file=sys.stderr)
            downloaded_video, detected_code = VideoDownloader.download(url, temp_dir=temp_dir)
            if not custom_name and detected_code:
                shortcode = detected_code

            print(f"[Pipeline] 2/3 Analyzing Reel with provider: {self.provider_name}", file=sys.stderr)
            analysis: ReelAnalysis = self.analyzer.analyze_video(downloaded_video)

            print(f"[Pipeline] 3/3 Saving structured outputs to: {self.output_dir}", file=sys.stderr)
            saved_paths = save_analysis_files(analysis, self.output_dir, shortcode)

            return {
                "status": "SUCCESS",
                "url": url,
                "shortcode": shortcode,
                "provider": self.provider_name,
                "analysis": analysis.to_dict(),
                "text_summary": format_text_summary(analysis, shortcode),
                "output_files": saved_paths
            }

        except Exception as e:
            err_msg = str(e)
            print(f"[Pipeline] Error processing reel {url}: {err_msg}", file=sys.stderr)
            return {
                "status": "FAILED",
                "url": url,
                "shortcode": shortcode,
                "provider": self.provider_name,
                "error": err_msg
            }

        finally:
            # Cleanup downloaded video and temporary files whether it succeeded or failed
            if not self.keep_temp and temp_dir and os.path.exists(temp_dir):
                print(f"[Pipeline] Cleanup: Removing temporary working directory {temp_dir}", file=sys.stderr)
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception as clean_err:
                    print(f"[Pipeline] Warning during temp cleanup: {clean_err}", file=sys.stderr)

    def process_video_file(self, video_path: str, custom_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes analysis directly on an existing video file path.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        base_name = custom_name or os.path.splitext(os.path.basename(video_path))[0]
        print(f"[Pipeline] Analyzing local video file with provider: {self.provider_name}", file=sys.stderr)
        analysis = self.analyzer.analyze_video(video_path)
        saved_paths = save_analysis_files(analysis, self.output_dir, base_name)

        return {
            "status": "SUCCESS",
            "video_path": video_path,
            "shortcode": base_name,
            "provider": self.provider_name,
            "analysis": analysis.to_dict(),
            "text_summary": format_text_summary(analysis, base_name),
            "output_files": saved_paths
        }

    def process_batch(self, urls: List[str]) -> Dict[str, Any]:
        """
        Batch-processes a list of reel URLs one at a time, saving per-reel results and combined reports.
        """
        cleaned_urls = [u.strip() for u in urls if u.strip() and not u.strip().startswith("#")]
        total = len(cleaned_urls)
        print(f"[Pipeline] Starting batch processing for {total} reels...", file=sys.stderr)

        results = []
        for idx, url in enumerate(cleaned_urls, 1):
            print(f"\n[Pipeline] === Processing batch item {idx}/{total}: {url} ===", file=sys.stderr)
            res = self.process_url(url)
            results.append(res)

        # Save combined batch outputs
        import json
        combined_json_path = os.path.join(self.output_dir, "batch_combined_summary.json")
        combined_txt_path = os.path.join(self.output_dir, "batch_summary.txt")

        with open(combined_json_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        batch_txt = format_combined_batch_summary(results)
        with open(combined_txt_path, "w", encoding="utf-8") as f:
            f.write(batch_txt)

        return {
            "status": "COMPLETED",
            "total": total,
            "successful": sum(1 for r in results if r.get("status") == "SUCCESS"),
            "failed": sum(1 for r in results if r.get("status") == "FAILED"),
            "results": results,
            "combined_files": {
                "json": combined_json_path,
                "txt": combined_txt_path
            }
        }
