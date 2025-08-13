"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Send,
  Search,
  Settings,
  User,
  Menu,
  X,
  Store,
  TrendingUp,
  Users,
  Bot,
  Mic,
  MicOff,
  LogOut,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { AuthModal } from "@/components/AuthModal";
import Scenarios from "@/utils/Scenarios.json";
import { PushToTalkBar } from "@/components/PushToTalkBar";
import { GradientOrb } from "./Gradientorb"; 
import FeedbackBtn from "@/components/FeedbackBtn";


// Define allowed Message roles for type safety
type MessageRole = "system" | "user" | "assistant" | "data";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
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

// Utility message creator
function createMessage(role: "user" | "assistant", content: string): ChatMessage {
  return { id: Date.now().toString() + Math.random().toString(16), role, content };
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function SalesTrainingChatInterface() {
  const { user, signOut, loading: authLoading } = useAuth();

  const {
    conversations,
    loading: conversationsLoading,
    createConversation,
    getMessages,
    saveMessage,
    deleteConversation,
    refetch: refetchConversations,
  } = useConversations();

  // State
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioDetails, setScenarioDetails] = useState<Scenario | null>(null);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const [lastProcessedMessage, setLastProcessedMessage] = useState<string>("");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentMode, setCurrentMode] = useState<"sales" | "game">("sales");
  const [isRecording, setIsRecording] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined" || recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      setSpeechStatus("Listening...");
      recordingTimeout.current = setTimeout(() => {
        recognition.stop();
        setSpeechStatus("Recording stopped (timeout)");
      }, 10000);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) setSpeechStatus(`Hearing: "${interimTranscript}"`);

      if (finalTranscript) {
        setSpeechStatus("Processing...");
        sendMessageToAPI(finalTranscript.trim());
        recognition.stop();
      }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setSpeechStatus("");

      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);

      switch (event.error) {
        case "not-allowed":
          alert("Microphone access denied. Please allow access.");
          break;
        case "no-speech":
          setSpeechStatus("No speech detected");
          break;
        case "audio-capture":
          alert("Audio capture failed. Check your microphone.");
          break;
        case "network":
          alert("Network error. Check connection.");
          break;
        default:
          alert("Speech recognition error. Please try again.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setSpeechStatus("");
      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    };

    recognitionRef.current = recognition;
  }, []);

  // Load conversation messages on conversation change
  useEffect(() => {
    if (!currentConversationId) {
      setChatMessages([]);
      return;
    }

    async function loadMessages() {
      setIsLoadingConversation(true);
      try {
        if (!currentConversationId || typeof currentConversationId !== 'string') {
          return;
        }
        const msgs = await getMessages(currentConversationId);
        const loadedMsgs: ChatMessage[] = msgs.map((msg: any) => ({
          id: msg.id,
          role: msg.role === "user" || msg.role === "assistant" ? msg.role : "assistant",
          content: msg.content,
        }));
        setChatMessages(loadedMsgs);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to load messages"));
      } finally {
        setIsLoadingConversation(false);
      }
    }

    loadMessages();
  }, [currentConversationId, getMessages]);

  // Add message helper
  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setChatMessages((prev) => [...prev, createMessage(role, content)]);
    },
    []
  );

  // Send message handler with TTS audio playback
  const sendMessageToAPI = useCallback(
    async (text: string, overrideScenario?: Scenario | null) => {
      if (isLoading || lastProcessedMessage === text) return;

      setInput("");
      setIsLoading(true);
      setIsThinking(true);
      setError(null);
      setLastProcessedMessage(text);

      addMessage("user", text);

      try {
        // Add slight delay to improve UX
        await new Promise((resolve) => setTimeout(resolve, 700));

        const messagesForAPI = [
          ...chatMessages,
          { role: "user", content: text },
        ].map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/voicechat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesForAPI, scenario: overrideScenario ?? scenarioDetails }),
        });

        if (!res.ok) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {}

          throw new Error(errorData.error ?? `API returned status ${res.status}`);
        }

        const data = await res.json();

        if (!data.text || !data.audio) throw new Error("Incomplete response from server");

        addMessage("assistant", data.text);

        // Play audio
        const base64Audio = data.audio.split(",")[1] || data.audio;
        const audioBlob = new Blob([Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          setIsPlayingAudio(true);

          audioRef.current.onended = () => {
            setIsPlayingAudio(false);
            URL.revokeObjectURL(audioUrl);
            setSpeechStatus("Ready for your response...");
            setTimeout(() => setSpeechStatus(""), 3000);
          };

          audioRef.current.onerror = (error) => {
            console.error("Audio playback error:", error);
            setIsPlayingAudio(false);
            URL.revokeObjectURL(audioUrl);
            setSpeechStatus("Audio playback failed, but conversation continues...");
            setTimeout(() => setSpeechStatus(""), 3000);
            // Don't throw error, just log it and continue
          };

          try {
            await audioRef.current.play();
          } catch (playError) {
            console.error("Audio play failed:", playError);
            setIsPlayingAudio(false);
            URL.revokeObjectURL(audioUrl);
            setSpeechStatus("Audio unavailable, but conversation continues...");
            setTimeout(() => setSpeechStatus(""), 3000);
            // Don't throw error, just log it and continue
          }
        }

        if (currentConversationId) {
          await saveMessage(currentConversationId, "user", text);
          await saveMessage(currentConversationId, "assistant", data.text);
          refetchConversations();
        } else {
          console.log("No conversation ID, skipping message persistence");
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Unknown error"));
        addMessage("assistant", "Sorry, an error occurred. Please try again.");
      } finally {
        setIsLoading(false);
        setIsThinking(false);
      }
    },
    [chatMessages, isLoading, lastProcessedMessage, currentConversationId, saveMessage, refetchConversations, scenarioDetails, addMessage]
  );

  // Form submit handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading || !user) return;

      let convId = currentConversationId;
      if (!convId) {
        const newConv = await createConversation(input.length > 50 ? input.substr(0, 50) + "..." : input);
        if (!newConv) {
          console.error("Failed to create conversation");
          return;
        }
        convId = newConv.id;
        setCurrentConversationId(convId);
      }

      try {
        await saveMessage(convId, "user", input);
        refetchConversations();
      } catch (e) {
        console.error("Failed to save user message:", e);
      }

      await sendMessageToAPI(input);
    },
    [input, isLoading, user, currentConversationId, createConversation, saveMessage, refetchConversations, sendMessageToAPI]
  );

  // Start speech recognition
  const handleStartRecording = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Speech Recognition not supported");
      return;
    }
    if (listening) return; // Already listening

    recognitionRef.current.start();
  }, [listening]);

  // Stop speech recognition
  const handleStopRecording = useCallback(() => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }, [listening]);

  // Toggle speech recognition handler
  const toggleSpeechRecognition = useCallback(() => {
  const recognition = recognitionRef.current;
  if (!recognition) return;

  if (listening) {
    recognition.stop();
    setListening(false);
    setSpeechStatus("Stopped listening.");
  } else {
    try {
      recognition.start();
      setListening(true);
      setSpeechStatus("Listening...");
    } catch (e) {
      // Handle error if recognition already started on rapid toggling
      console.warn("SpeechRecognition start failed:", e);
    }
  }
}, [listening]);

  // Scenario click handler
  const handleScenarioClick = useCallback(
    async (scenarioId: string) => {
      console.log("Clicked scenario ID:", scenarioId);
      
      // Check if user is authenticated
      if (!user) {
        console.error("User not authenticated when trying to create scenario");
        setError(new Error("Please sign in to start a conversation"));
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlayingAudio(false);
      }

      setActiveScenarioId(scenarioId);
      const scenario = Scenarios.find((s) => s.id === scenarioId) ?? null;
      setScenarioDetails(scenario);

      const title = scenario ? `${scenario.name} - ${scenario.persona}` : "Sales Training";
      
      console.log("Creating conversation with title:", title);
      const newConv = await createConversation(title);
      
      if (newConv) {
        console.log("Successfully created conversation:", newConv.id);
        setCurrentConversationId(newConv.id);
      } else {
        console.warn("Failed to create conversation in database, continuing without persistence");
        // Continue without database persistence - this allows the scenario to work even if DB fails
        setCurrentConversationId(null);
        setError(new Error("Note: Conversation won't be saved due to database issue"));
      }

      // Clear any previous messages and start immediately with a kickoff prompt
      setChatMessages([]);
      setInput("");
      setLastProcessedMessage("");
      // Don't clear error here as we want to show the database warning

      // Kickoff message to start the roleplay right away
      const kickoff = scenario
        ? `Hi, I'm calling about ${scenario.name.toLowerCase()}. I'd like to discuss how our solution can help you.`
        : "Hello, I'd like to introduce you to our sales training solution.";

      await sendMessageToAPI(kickoff, scenario);
    },
    [createConversation, sendMessageToAPI, user]
  );

  // Delete conversation handler
  const handleDeleteConversation = useCallback(
    async (convId: string) => {
      if (confirm("Are you sure you want to delete this conversation?")) {
        await deleteConversation(convId);
        if (convId === currentConversationId) {
          setCurrentConversationId(null);
          setChatMessages([]);
          setScenarioDetails(null);
          setActiveScenarioId(null);
        }
        refetchConversations();
      }
    },
    [currentConversationId, deleteConversation, refetchConversations]
  );

  // Select conversation from list handler
  const handleSelectConversation = useCallback(
    async (conv: Conversation) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlayingAudio(false);
      }
      if (listening && recognitionRef.current) {
        recognitionRef.current.stop();
        setListening(false);
      }

      setCurrentConversationId(conv.id);

      try {
        const msgs = await getMessages(conv.id);
        const mappedMessages: ChatMessage[] = msgs.map((msg) => ({
          id: msg.id,
          role: msg.role === "user" || msg.role === "assistant" ? msg.role : "assistant",
          content: msg.content,
        }));
        setChatMessages(mappedMessages);
        setError(null);

        // Extract scenario from conversation title
        const parts = conv.title.split(" - ");
        if (parts.length >= 2) {
          const scenario = Scenarios.find((s) => s.name === parts[0]) ?? null;
          setScenarioDetails(scenario);
          setActiveScenarioId(scenario?.id ?? null);
        } else {
          setScenarioDetails(null);
          setActiveScenarioId(null);
        }
      } catch (e) {
        console.error("Error loading conversation:", e);
        setError(e instanceof Error ? e : new Error("Unable to load conversation messages"));
        addMessage("assistant", "Unable to load conversation messages. Please try again.");
      }
    },
    [getMessages, listening, addMessage]
  );

  // Start new chat
  const handleNewChat = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
    }
    setCurrentConversationId(null);
    setChatMessages([]);
    setScenarioDetails(null);
    setActiveScenarioId(null);
    setInput("");
    setError(null);
    setLastProcessedMessage("");
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      setListening(false);
    }
  }, [listening]);

  // Textarea auto resize
  const handleTextareaResize = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  // Input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // Enter key to send message
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isLoading) handleSubmit(e as any);
      }
    },
    [input, isLoading, handleSubmit]
  );

  // Suggestion cards for quick message input
  const suggestionCards = [
    {
      title: "Cold calling",
      subtitle: "Practice",
      description: "Practice a sales conversation scenario.",
      icon: Users,
    },
    {
      title: "Demo Pitch ",
      subtitle: "Pitch",
      description: "Get feedback on your sales pitch.",
      icon: TrendingUp,
    },
    {
      title: "Upsell",
      subtitle: "Upsell",
      description: "Test your sales knowledge.",
      icon: Bot, // or HelpCircle if preferred
    },
  ];

  // Add mapping from suggestion card titles to scenario IDs
  const suggestionToScenarioId: Record<string, string> = {
    "Cold calling": "cold-call-prospecting",
    "Demo Pitch ": "product-demo-presentation", // Note the trailing space
    "Upsell": "upselling-existing-customers"
  };

  // Update handleSuggestionClick to trigger scenario selection
  const handleSuggestionClick = (suggestion: string) => {
    if (authLoading) {
      console.log("Authentication still loading, ignoring suggestion click");
      return;
    }
    
    console.log("Suggestion clicked:", suggestion);
    const scenarioId = suggestionToScenarioId[suggestion];
    console.log("Mapped scenario ID:", scenarioId);
    if (scenarioId) {
      console.log("Calling handleScenarioClick with:", scenarioId);
      handleScenarioClick(scenarioId);
    } else {
      console.log("No scenario mapping found, setting input as fallback");
      setInput(suggestion); // fallback
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex bg-stone-50 text-gray-800 overflow-hidden h-screen">
      {/* Hidden audio player */}
      <audio ref={audioRef} style={{ display: "none" }} />

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-40 lg:hidden" onClick={toggleMobileMenu} />
      )}

      {/* Sidebar */}
      <div className="fixed lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-50 w-72 sm:w-80 bg-white border-r border-gray-200 flex flex-col full-height shadow-md">
        {/* Mobile close */}
        <div className="lg:hidden flex justify-end p-3 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            title="Close Sidebar"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-orange-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-base text-gray-800">Sales Training Bot</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-500 hover:text-gray-800 hover:bg-white/60 p-2 rounded-full"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          <div className="mb-4 text-sm text-gray-600 truncate">{user?.email}</div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search..."
              aria-label="Search conversations"
              className="pl-8 bg-gray-50 border border-gray-200 rounded-md w-full h-10 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
              onChange={() => {}} // Implement search functionality if desired
            />
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1 p-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-lg">Recent Conversations</h3>
          {conversationsLoading && <p className="text-xs text-gray-500">Loading conversations...</p>}
          {conversations.length === 0 && !conversationsLoading ? (
            <p className="text-xs text-gray-400">No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <Card
                key={conv.id}
                className={clsx(
                  "p-3 cursor-pointer border transition hover:shadow-md",
                  conv.id === currentConversationId
                    ? "bg-purple-100 border-purple-400 shadow"
                    : "border-gray-200"
                )}
                onClick={() => handleSelectConversation(conv)}
              >
                <div className="flex justify-between items-center">
                  <div className="truncate max-w-[60%]">
                    <p className="font-medium text-sm text-gray-900 truncate">{conv.title}</p>
                    <p className="text-xs text-gray-500">{new Date(conv.updated_at).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-600 p-1 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}

          <div className="mt-4">
            <Button
              className="w-full bg-purple-700 hover:bg-purple-800 text-white"
              onClick={handleNewChat}
              title="Start New Chat"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 full-height bg-stone-50 relative">
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="lg:hidden text-gray-500 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <FeedbackBtn messages={chatMessages} scenario={scenarioDetails} />
        </div>

        {/* Loading indicator */}
        {isLoadingConversation && (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 flex-shrink-0 text-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              Loading conversation...
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-800 text-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 text-red-500">⚠️</div>
              <strong>Error:</strong> {error.message}
            </div>
          </div>
        )}

        {/* Chat messages container */}
        <div className="flex-1 min-h-0 flex flex-col relative">
          {/* Animated orb indicating speaking/loading */}
          <GradientOrb isSpeaking={isPlayingAudio} isLoading={isLoading} />

          {/* Speech status */}
          {speechStatus && (
            <div className="px-4 mb-2 animate-in slide-in-from-top-2 duration-300">
              <div className="max-w-4xl mx-auto">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">{speechStatus}</span>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 px-4 space-y-4 overflow-y-auto">
            {chatMessages.length === 0 && !isLoadingConversation ? (
              <div className="flex flex-col items-center justify-center min-h-full max-w-4xl mx-auto text-center text-gray-600">
                <h2 className="mt-2 text-lg font-semibold">Welcome to Sales Training Bot</h2>
                <p className="mt-1 text-sm max-w-md">
                  Choose a scenario to start practicing your sales skills.
                </p>

                {/* Loading state */}
                {authLoading ? (
                  <div className="mt-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading...</p>
                  </div>
                ) : (
                  /* Suggestion cards */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full mt-6">
                    {suggestionCards.map(({ icon: IconComponent, title, subtitle, description }, idx) => (
                      <Card
                        key={idx}
                        className="p-4 cursor-pointer shadow hover:shadow-lg transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 animate-in slide-in-from-bottom-4 duration-500"
                        style={{ animationDelay: `${idx * 150}ms` }}
                        onClick={() => handleSuggestionClick(title)}
                      >
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-purple-700 rounded-lg flex items-center justify-center mr-3 transition-all duration-300 group-hover:bg-purple-600">
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{title}</h3>
                            <p className="text-purple-700 text-xs">{subtitle}</p>
                          </div>
                        </div>
                        <p className="text-gray-600 text-xs">{description}</p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Show scenario cards in a compact format when conversation is active */}
                {chatMessages.length > 0 && !authLoading && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Try Different Scenarios:</h3>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {suggestionCards.map(({ icon: IconComponent, title, subtitle }, idx) => {
                        const scenarioId = suggestionToScenarioId[title];
                        const isActive = scenarioId === activeScenarioId;
                        return (
                          <Card
                            key={idx}
                            className={clsx(
                              "flex-shrink-0 p-3 cursor-pointer border transition-all duration-300 min-w-[140px] transform hover:scale-105 hover:-translate-y-1 animate-in slide-in-from-right-4 duration-300",
                              isActive 
                                ? "border-purple-500 bg-purple-50 shadow-md" 
                                : "border-gray-200 hover:border-purple-300 hover:shadow-md"
                            )}
                            style={{ animationDelay: `${idx * 100}ms` }}
                            onClick={() => handleSuggestionClick(title)}
                          >
                            <div className="flex items-center gap-2">
                              <div className={clsx(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300",
                                isActive ? "bg-purple-600" : "bg-purple-700"
                              )}>
                                <IconComponent className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <h4 className={clsx(
                                  "text-xs font-medium transition-colors duration-300",
                                  isActive ? "text-purple-700" : "text-gray-800"
                                )}>
                                  {title}
                                  {isActive && <span className="ml-1 text-purple-600 animate-pulse">●</span>}
                                </h4>
                                <p className="text-xs text-gray-500">{subtitle}</p>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Chat messages */}
                {chatMessages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={clsx(
                      "flex gap-3 animate-in slide-in-from-bottom-2 duration-300",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {msg.role === "assistant" && (
                      <div className="bg-purple-700 rounded-full w-8 h-8 flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}

                    <div
                      className={clsx(
                        "max-w-[70%] px-4 py-2 rounded-lg shadow-sm animate-in slide-in-from-bottom-2 duration-300",
                        msg.role === "user"
                          ? "bg-purple-700 text-white"
                          : "bg-white text-gray-800 border border-gray-200"
                      )}
                    >
                      <div
                        className={clsx(
                          "prose-sm max-w-none",
                          msg.role === "user" ? "text-white" : "text-gray-800",
                          "prose" // keep it here so it doesn't override color
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="bg-gray-400 rounded-full w-8 h-8 flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-3 justify-start animate-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-purple-700 rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </ScrollArea>

          {/* Input form */}
          {/* <form
            onSubmit={handleSubmit}
            className="sticky bottom-0 z-10 bg-white border-t border-gray-200 p-3 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300"
          >
            <textarea
              rows={1}
              placeholder="Ask about sales strategy, pitching, or practice..."
              className="flex-grow resize-none border border-gray-300 rounded-lg p-2 text-gray-800 text-sm focus:outline-purple-600 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              value={input}
              onChange={handleInputChange}
              onInput={handleTextareaResize}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Chat input"
            />

            {recognitionRef.current && (
              <Button
                type="button"
                size="sm"
                onClick={toggleSpeechRecognition}
                className={clsx(
                  "rounded-full w-10 h-10 flex justify-center items-center transition-all duration-300 transform hover:scale-110",
                  listening ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-purple-700 hover:bg-purple-800"
                )}
                title={listening ? "Stop listening" : "Start listening"}
              >
                {listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </Button>
            )}

            <Button
              type="submit"
              size="sm"
              className="bg-purple-700 hover:bg-purple-800 text-white rounded-full w-10 h-10 flex justify-center items-center shadow-sm transition-all duration-300 transform hover:scale-110 disabled:transform-none"
              disabled={isLoading || !input.trim()}
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form> */}
        </div>
      </div>



{/* Push To Talk Bar */}
      <div className="fixed bottom-8 left-[60%] -translate-x-1/2">
        <PushToTalkBar
          isRecording={listening} // ✅ Now linked to actual recording state
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onNewChat={handleNewChat}
          onShowHistory={() => setActiveTab("chat-history")}
          onRefreshChat={() => {
            if (currentConversationId) handleDeleteConversation(currentConversationId);
            handleNewChat();
          }}
          currentMode={currentMode}
          onToggleMode={() => setCurrentMode(currentMode === "sales" ? "game" : "sales")}
          showModeIndicator={true}
        />
      </div>



      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
