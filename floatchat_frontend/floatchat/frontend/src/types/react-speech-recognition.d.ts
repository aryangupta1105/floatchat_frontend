declare module "react-speech-recognition" {
  export function useSpeechRecognition(): {
    transcript: string;
    listening: boolean;
    resetTranscript: () => void;
    browserSupportsSpeechRecognition: boolean;
  };

  const SpeechRecognition: {
    startListening: (options?: { continuous?: boolean; language?: string }) => void;
    stopListening: () => void;
  };

  export default SpeechRecognition;
}
