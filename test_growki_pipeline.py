#!/usr/bin/env python3
"""
Test Suite for GrowKI Instagram Pipeline:
Tests:
  1. Existing Reel / Video path (extract_video_transcript -> structure -> content_items with source_type="video")
  2. New Carousel / Sidecar path (extract_carousel_insights -> structure -> content_items with source_type="carousel")

Validates independent execution, post type detection, identical output schemas, and persistence.
"""

import sys
import json
import base64
from growki_pipeline import (
    process_instagram_post,
    detect_post_type,
    extract_video_transcript,
    extract_carousel_insights,
    structure_content_with_ai,
    CONTENT_ITEMS,
    ACTION_ITEMS
)

def create_sample_image_data_uri(label: str) -> str:
    """Creates a valid 1x1 base64 png data URI for testing vision downloads."""
    # 1x1 green pixel png
    raw_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    return f"data:image/png;base64,{raw_b64}"


def run_tests():
    print("=" * 70)
    print(" GROWKI INSTAGRAM PIPELINE DUAL-PATH VERIFICATION TEST")
    print("=" * 70)

    # -------------------------------------------------------------
    # TEST 1: REEL / VIDEO EXTRACTION (EXISTING PATH)
    # -------------------------------------------------------------
    print("\n>>> [TEST 1] Testing Existing Video / Reel Path...")

    reel_url = "https://www.instagram.com/reel/C8xyz123_senior_dev_habits/"
    reel_payload = {
        "media_type": 2,  # RapidAPI video/reel
        "type": "Video",  # Apify video
        "productType": "clips",
        "url": reel_url,
        "video_url": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        "caption": "Top 3 habits of high-performing senior engineers. Which one do you practice? #softwareengineering #coding"
    }

    # Verify detection
    detected_type_1 = detect_post_type(reel_payload)
    print(f"  * Post Type Detected: '{detected_type_1}' (expected: 'video')")
    assert detected_type_1 == "video", f"Expected 'video', got '{detected_type_1}'"

    # Execute pipeline
    video_result = process_instagram_post(reel_payload)

    print(f"  * Pipeline Status: {video_result['status']}")
    print(f"  * Source Type Saved: {video_result['source_type']}")
    print(f"  * Title: {video_result['structured']['title']}")
    print(f"  * Key Points Count: {len(video_result['structured']['key_points'])}")
    print(f"  * Actionable Tasks: {video_result['structured']['actionable_tasks']}")
    print(f"  * Categories: {video_result['structured']['categories']}")

    assert video_result["source_type"] == "video", "source_type must be 'video'"
    assert "title" in video_result["structured"]
    assert "summary" in video_result["structured"]
    assert "key_points" in video_result["structured"]
    assert "actionable_tasks" in video_result["structured"]
    assert "categories" in video_result["structured"]

    # -------------------------------------------------------------
    # TEST 2: CAROUSEL / MULTI-IMAGE EXTRACTION (NEW PATH)
    # -------------------------------------------------------------
    print("\n>>> [TEST 2] Testing New Carousel / Sidecar Path...")

    carousel_url = "https://www.instagram.com/p/C9abc456_clean_architecture_slides/"
    carousel_payload = {
        "media_type": 8,  # RapidAPI carousel
        "type": "Sidecar",  # Apify sidecar/album
        "productType": "carousel_container",
        "url": carousel_url,
        "images": [
            create_sample_image_data_uri("Slide 1: Code Screenshot - Clean Controller Architecture"),
            create_sample_image_data_uri("Slide 2: Tips Graphic - Repository & Domain Service Separation")
        ],
        "caption": "Swipe through for the 3 golden rules of clean backend architecture with TypeScript. Save this post for later!"
    }

    # Verify detection
    detected_type_2 = detect_post_type(carousel_payload)
    print(f"  * Post Type Detected: '{detected_type_2}' (expected: 'carousel')")
    assert detected_type_2 == "carousel", f"Expected 'carousel', got '{detected_type_2}'"

    # Execute pipeline
    carousel_result = process_instagram_post(carousel_payload)

    print(f"  * Pipeline Status: {carousel_result['status']}")
    print(f"  * Source Type Saved: {carousel_result['source_type']}")
    print(f"  * Title: {carousel_result['structured']['title']}")
    print(f"  * Key Points Count: {len(carousel_result['structured']['key_points'])}")
    print(f"  * Actionable Tasks: {carousel_result['structured']['actionable_tasks']}")
    print(f"  * Categories: {carousel_result['structured']['categories']}")

    assert carousel_result["source_type"] == "carousel", "source_type must be 'carousel'"
    assert "title" in carousel_result["structured"]
    assert "summary" in carousel_result["structured"]
    assert "key_points" in carousel_result["structured"]
    assert "actionable_tasks" in carousel_result["structured"]
    assert "categories" in carousel_result["structured"]

    # -------------------------------------------------------------
    # TEST 3: STORAGE & ISOLATION VERIFICATION
    # -------------------------------------------------------------
    print("\n>>> [TEST 3] Verifying content_items & action_items Persistence...")
    print(f"  * Total content_items saved: {len(CONTENT_ITEMS)}")
    print(f"  * Total action_items saved: {len(ACTION_ITEMS)}")

    source_types_in_db = [item["source_type"] for item in CONTENT_ITEMS]
    print(f"  * Source Types in Database: {source_types_in_db}")

    assert "video" in source_types_in_db, "Database should contain 'video' items"
    assert "carousel" in source_types_in_db, "Database should contain 'carousel' items"

    print("\n" + "=" * 70)
    print(" ALL TESTS PASSED! Video and Carousel paths operate independently")
    print(" and converge into identical structured output schemas.")
    print("=" * 70)

    # Print pretty JSON representations for inspection
    print("\n--- SAMPLE SAVED CONTENT ITEM (VIDEO) ---")
    print(json.dumps(CONTENT_ITEMS[0], indent=2))

    print("\n--- SAMPLE SAVED CONTENT ITEM (CAROUSEL) ---")
    print(json.dumps(CONTENT_ITEMS[1], indent=2))

if __name__ == "__main__":
    run_tests()
