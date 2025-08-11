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
  console.log("Scenario context:", scenario);

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

  const getScoreColor = (score: number) => {
    if (score >= 9) return "bg-emerald-600"; // Excellent - emerald green
    if (score >= 8) return "bg-green-600";   // Very Good - green
    if (score >= 7) return "bg-blue-600";    // Good - blue
    if (score >= 6) return "bg-yellow-600";  // Fair - yellow
    if (score >= 5) return "bg-orange-600";  // Average - orange
    if (score >= 4) return "bg-purple-600";  // Below Average - purple
    if (score >= 3) return "bg-indigo-600";  // Poor - indigo
    return "bg-gray-600";                    // Very Poor - gray
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return "Excellent";
    if (score >= 8) return "Very Good";
    if (score >= 7) return "Good";
    if (score >= 6) return "Fair";
    if (score >= 5) return "Average";
    if (score >= 4) return "Below Average";
    if (score >= 3) return "Poor";
    return "Very Poor";
  };

  const getScoreLabelColor = (score: number) => {
    if (score >= 9) return "bg-emerald-100 text-emerald-800";
    if (score >= 8) return "bg-green-100 text-green-800";
    if (score >= 7) return "bg-blue-100 text-blue-800";
    if (score >= 6) return "bg-yellow-100 text-yellow-800";
    if (score >= 5) return "bg-orange-100 text-orange-800";
    if (score >= 4) return "bg-purple-100 text-purple-800";
    if (score >= 3) return "bg-indigo-100 text-indigo-800";
    return "bg-gray-100 text-gray-800";
  };

  const renderBar = (label: string, value: number) => {
    const color = getScoreColor(value);
    const labelColor = getScoreLabelColor(value);
    
    return (
      <div className="mb-3">
        <div className="flex justify-between text-sm font-medium mb-1">
          <span className="text-gray-700">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-800 font-semibold">{value}/10</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${labelColor}`}>
              {getScoreLabel(value)}
            </span>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`${color} h-3 rounded-full transition-all duration-500 ease-out shadow-sm`} 
            style={{ width: `${(value / 10) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

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
                    {/* Scenario Context */}
                    {scenario && (
                      <div className="bg-gradient-to-r from-purple-50 to-orange-50 border border-purple-200 rounded-xl p-4">
                        <h4 className="text-lg font-semibold mb-3 flex items-center gap-2 text-purple-800">
                          🎯 Scenario Analysis
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Scenario:</span>
                            <p className="text-gray-800">{scenario.name}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Customer Persona:</span>
                            <p className="text-gray-800">{scenario.persona}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Difficulty:</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              scenario.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                              scenario.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              scenario.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {scenario.difficulty.charAt(0).toUpperCase() + scenario.difficulty.slice(1)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Messages Analyzed:</span>
                            <p className="text-gray-800">{messages.length} messages</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Conversation Insights */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2 text-indigo-800">
                          📈 Conversation Insights
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="text-center bg-white/50 rounded-lg p-2">
                            <div className="text-2xl font-bold text-indigo-600">{messages.filter(m => m.role === 'user').length}</div>
                            <div className="text-xs text-gray-600">Your Messages</div>
                          </div>
                          <div className="text-center bg-white/50 rounded-lg p-2">
                            <div className="text-2xl font-bold text-purple-600">{messages.filter(m => m.role === 'assistant').length}</div>
                            <div className="text-xs text-gray-600">Customer Responses</div>
                          </div>
                          <div className="text-center bg-white/50 rounded-lg p-2">
                            <div className="text-2xl font-bold text-blue-600">{Math.round(messages.filter(m => m.role === 'user').reduce((sum, m) => sum + m.content.split(' ').length, 0) / Math.max(messages.filter(m => m.role === 'user').length, 1))}</div>
                            <div className="text-xs text-gray-600">Avg Words/Message</div>
                          </div>
                          <div className="text-center bg-white/50 rounded-lg p-2">
                            <div className="text-2xl font-bold text-green-600">{Math.round((messages.filter(m => m.role === 'assistant').length / Math.max(messages.filter(m => m.role === 'user').length, 1)) * 100)}%</div>
                            <div className="text-xs text-gray-600">Response Rate</div>
                          </div>
                        </div>
                        
                        {/* Additional insights */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="bg-white/30 rounded-lg p-2">
                            <span className="font-medium text-indigo-700">Total Words:</span> {messages.reduce((sum, m) => sum + m.content.split(' ').length, 0)}
                          </div>
                          <div className="bg-white/30 rounded-lg p-2">
                            <span className="font-medium text-purple-700">Conversation Length:</span> {messages.length < 4 ? 'Brief' : messages.length > 10 ? 'Detailed' : 'Standard'}
                          </div>
                        </div>
                      </div>

                    {/* Overall Performance Summary */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-800">
                        📊 Overall Performance Summary
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${getScoreColor(feedback.scores.overall).replace('bg-', 'text-')}`}>
                            {feedback.scores.overall}/10
                          </div>
                          <div className={`text-sm font-medium ${getScoreLabelColor(feedback.scores.overall)} px-2 py-1 rounded-full mt-1`}>
                            {getScoreLabel(feedback.scores.overall)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-700 mb-2">Performance Level:</div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`${getScoreColor(feedback.scores.overall)} h-3 rounded-full transition-all duration-500 shadow-sm`} 
                              style={{ width: `${(feedback.scores.overall / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Scores Section */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                        📈 Detailed Performance Breakdown
                      </h4>
                      <div className="space-y-3">
                        {renderBar("Professionalism", feedback.scores.professionalism)}
                        {renderBar("Tone", feedback.scores.tone)}
                        {renderBar("Clarity", feedback.scores.clarity)}
                        {renderBar("Empathy", feedback.scores.empathy)}
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
                          Actionable Suggestion
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
                      {scenario && (
                        <p className="text-sm text-gray-500 mt-2">
                          Evaluating performance for: <span className="font-medium">{scenario.name}</span>
                        </p>
                      )}
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