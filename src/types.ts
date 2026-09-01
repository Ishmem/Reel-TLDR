export interface ReelAnalysisData {
  summary: string;
  is_list_content: boolean;
  list_title: string | null;
  list_items: string[];
  key_points: string[];
  has_speech: boolean;
  spoken_content_summary: string;
  on_screen_text: string[];
  visual_description: string;
  dominant_mood: string;
  content_type: string;
  hashtag_suggestions: string[];
}

export interface AnalysisResponse {
  status: 'SUCCESS' | 'FAILED';
  url?: string;
  video_path?: string;
  shortcode: string;
  provider?: string;
  analysis?: ReelAnalysisData;
  text_summary?: string;
  output_files?: {
    json: string;
    txt: string;
  };
  error?: string;
  execution_time_ms?: number;
}

export interface BatchAnalysisResponse {
  status: 'COMPLETED' | 'FAILED';
  total: number;
  successful: number;
  failed: number;
  results: AnalysisResponse[];
  combined_files?: {
    json: string;
    txt: string;
  };
  combined_summary_text?: string;
}
