import { useState } from "react";
import { Loader2, MessageSquare, CheckCircle, AlertTriangle, Lightbulb, X } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  persona: string;
  difficulty: string;
  prompts?: string | string[];
  scenarioType?: string;
}

interface FeedbackButtonProps {
  messages: ChatMessage[];
  scenario?: Scenario | null;
}

interface FeedbackData {
  scores: {
    professionalism: number;
    tone: number;
    clarity: number;
    empathy: number;
    overall: number;
  };
  good: string;
  improvement: string;
  suggestion: string;
}

export default function FeedbackButton({ messages, scenario }: FeedbackButtonProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  console.log("Messages for feedback:", messages);

  const handleGetFeedback = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, scenario }),
      });

      if (!res.ok) throw new Error("Failed to fetch feedback");

      const data = await res.json();
      setFeedback(data.feedback);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFeedback(null);
    setError(null);
  };

  const renderBar = (label: string, value: number, color = "bg-green-600") => (
    <div className="mb-3">
      <div className="flex justify-between text-sm font-medium mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-800 font-semibold">{value}/10</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full">
        <div 
          className={`${color} h-3 rounded-full transition-all duration-500 ease-out`} 
          style={{ width: `${(value / 10) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <>
      {/* Header Button */}
      <button
        onClick={handleGetFeedback}
        disabled={loading || !messages.length}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-orange-400 text-white rounded-full hover:from-purple-700 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
        title="Get conversation feedback"
      >
        {loading ? (
          <Loader2 className="animate-spin w-4 h-4" />
        ) : (
          <MessageSquare className="w-4 h-4" />
        )}
        {loading ? "Analyzing..." : "Get Feedback"}
      </button>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Blurred Background */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeModal}
          ></div>
          
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-orange-50 rounded-t-2xl">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                  Conversation Feedback
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-200"
                  aria-label="Close feedback modal"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {error ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-red-700 mb-2">Error Getting Feedback</h4>
                    <p className="text-red-600">{error}</p>
                    <button
                      onClick={handleGetFeedback}
                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : feedback ? (
                  <div className="space-y-6">
                    {/* Scores Section */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-800">
                        📊 Performance Scores
                      </h4>
                      <div className="space-y-3">
                        {renderBar("Professionalism", feedback.scores.professionalism, "bg-purple-600")}
                        {renderBar("Tone", feedback.scores.tone, "bg-blue-600")}
                        {renderBar("Clarity", feedback.scores.clarity, "bg-green-600")}
                        {renderBar("Empathy", feedback.scores.empathy, "bg-orange-600")}
                        {renderBar("Overall Score", feedback.scores.overall, "bg-gradient-to-r from-purple-600 to-orange-600")}
                      </div>
                    </div>

                    {/* Feedback Sections */}
                    <div className="space-y-4">
                      {/* What you did well */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                          <CheckCircle className="w-5 h-5" />
                          What You Did Well
                        </h4>
                        <p className="text-sm text-gray-800 leading-relaxed">{feedback.good}</p>
                      </div>

                      {/* What you can improve */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-yellow-700 font-semibold mb-2">
                          <AlertTriangle className="w-5 h-5" />
                          Areas for Improvement
                        </h4>
                        <p className="text-sm text-gray-800 leading-relaxed">{feedback.improvement}</p>
                      </div>

                      {/* Suggestion */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                          <Lightbulb className="w-5 h-5" />
                          Suggestion for Next Time
                        </h4>
                        <p className="text-sm text-gray-800 leading-relaxed">{feedback.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-pulse">
                      <Loader2 className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-spin" />
                      <p className="text-gray-600">Analyzing your conversation...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}