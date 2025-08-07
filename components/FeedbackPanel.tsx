// FeedbackPanel.tsx
import React from 'react';

interface FeedbackPanelProps {
  feedback: {
    score: number;
    tone: string;
    fillerWords: number;
    suggestions: string[];
  };
  onClose: () => void;
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ feedback, onClose }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mt-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">📝 Conversation Feedback</h2>
        <button
          onClick={onClose}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Close
        </button>
      </div>

      <p><strong>Score:</strong> {feedback.score}/10</p>
      <p><strong>Tone Detected:</strong> {feedback.tone}</p>
      <p><strong>Filler Words:</strong> {feedback.fillerWords}</p>

      <div className="mt-4">
        <h3 className="font-semibold">Suggestions:</h3>
        <ul className="list-disc list-inside text-sm mt-2">
          {feedback.suggestions.map((suggestion, index) => (
            <li key={index}>👉 {suggestion}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FeedbackPanel;
