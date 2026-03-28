import { useState, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4891/api';

interface VoiceRecorderProps {
  onTranscription: (data: {
    transcription: {
      text: string;
      language: string;
      confidence: number;
    };
    extracted: {
      category_id: number | null;
      task_data: {
        title?: string;
        description?: string;
        location?: string;
        applicant_name?: string;
        applicant_phone?: string;
        due_date?: string;
      };
      priority: 'high' | 'medium' | 'low';
      summary: string;
      confidence: number;
    };
  }) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Process the audio
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Error starting recording:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setError('Failed to start recording. Please check your microphone.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/tasks/process-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process voice');
      }

      const result = await response.json();
      onTranscription(result.data);

    } catch (err: any) {
      console.error('Error processing audio:', err);
      setError(err.message || 'Failed to process voice input. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Recording Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        {!isRecording && !isProcessing && (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-gray-300 text-white rounded-lg transition-colors touch-manipulation"
          >
            <Mic className="h-5 w-5" />
            <span>Start Voice Input</span>
          </button>
        )}

        {isRecording && (
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={stopRecording}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2 bg-gray-700 hover:bg-gray-800 active:bg-gray-900 text-white rounded-lg transition-colors touch-manipulation"
            >
              <Square className="h-5 w-5" />
              <span>Stop Recording</span>
            </button>
            <div className="flex items-center gap-2 text-red-500">
              <span className="animate-pulse text-2xl">●</span>
              <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="w-full flex items-center justify-center sm:justify-start gap-2 text-blue-600 py-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm sm:text-base">Processing voice...</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && !isProcessing && (
        <p className="text-sm text-gray-500">
          Speak in <strong>Marathi</strong>, <strong>Hindi</strong>, or <strong>English</strong>.
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> </span>
          Include date like "उद्या" (tomorrow) for auto-fill.
        </p>
      )}

      {isRecording && (
        <p className="text-sm text-gray-600 bg-red-50 p-2 rounded-md">
          Recording... Speak clearly about the task. Tap "Stop" when done.
        </p>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
