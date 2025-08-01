"use client";

import { useChat } from "@ai-sdk/react";
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
  ArrowLeft,
  RotateCcw,
  MessageSquare,
  BarChart3,
  FileText,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { AuthModal } from "@/components/AuthModal";
// import { useModel } from "@/contexts/ModelContext";
// import ModelSelector from "@/components/ModelSelector";
import { MessageBubble } from "./MessageBubble";
import { GradientOrb } from "./Gradientorb";
import { PushToTalkBar } from "@/components/PushToTalkBar";
import Scenarios from "@/utils/Scenarios.json";
import { getRandomEnhancedScenario, getEnhancedScenario, enhanceScenarioDescription } from "@/utils/scenarioEnhancer";

// Define message type for better type safety
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Add type declarations for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Standalone function to send a message to the sales training bot API
export async function sendSalesTrainingMessage(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  scenarioDetails?: any
) {
  try {
    const response = await fetch("/api/voicechat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, scenario: scenarioDetails }),
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.text || !data.audio) {
      throw new Error("Incomplete response from server");
    }
    
    return data; // { text, audio }
  } catch (error) {
    console.error("Error sending message to sales training bot:", error);
    throw error;
  }
}

export default function TrainingChat() {
  const { user, signOut } = useAuth();
  const {
    conversations,
    loading: conversationsLoading,
    createConversation,
    getMessages,
    saveMessage,
    deleteConversation,
    refetch: refetchConversations,
  } = useConversations();

  // Speech Recognition setup
  const recognitionRef = useRef<any | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        // FIX: Use 'any' for SpeechRecognition to avoid TS error
        const recognition = new (SpeechRecognition as any)();
        recognition.continuous = false; // Changed to false to prevent continuous listening
        recognition.lang = "en-US"; // Changed to en-US for better recognition
        recognition.interimResults = true; // Enable interim results for better UX
        recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
        
        recognitionRef.current = recognition;
      } else {
        console.warn("Speech recognition not supported in this browser");
      }
    }
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [activeTab, setActiveTab] = useState("scenarios");
  const [isRecording, setIsRecording] = useState(false);
  const [currentMode, setCurrentMode] = useState("sales");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<string>("");
  const [recordingTimeout, setRecordingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastProcessedMessage, setLastProcessedMessage] = useState<string>("");
  const [isThinking, setIsThinking] = useState(false);

  const loadedConversationRef = useRef(null);
  const currentConversationRef = useRef(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Commented out model context and selector usage
  // const { selectedModel, setSelectedModel } = useModel();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const setAppHeight = () => {
        document.documentElement.style.setProperty(
          "--app-height",
          `${window.innerHeight}px`
        );
      };

      setAppHeight();
      window.addEventListener("resize", setAppHeight);
      handleScenarioClick("cold-call-prospecting");
      return () => window.removeEventListener("resize", setAppHeight);
    }
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setCurrentConversationId(null);
    setChatMessages([]);
    loadedConversationRef.current = null;
  }, [signOut]);

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarioDetails, setScenarioDetails] = useState<any>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  useEffect(() => {
    currentConversationRef.current = currentConversationId;
  }, [currentConversationId]);

  // Function to get random enhanced scenario for variety
  const getRandomScenario = () => {
    return getRandomEnhancedScenario();
  };

  const handleScenarioClick = async (scenarioId: string) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }

    setActiveScenarioId(scenarioId);
    const enhancedScenario = getEnhancedScenario(scenarioId);
    
    if (enhancedScenario) {
      setScenarioDetails(enhancedScenario);
      
      // Create new conversation for this scenario
      const conversationTitle = `${enhancedScenario.name} - ${enhancedScenario.persona}`;
      const newConversation = await createConversation(conversationTitle);
      
      if (newConversation) {
        setCurrentConversationId(newConversation.id);
        console.log('Created new conversation for scenario:', newConversation.id);
      }
      
      // Add enhanced welcome message
      const enhancedDescription = enhanceScenarioDescription(enhancedScenario);
      addMessage("assistant", `Welcome to ${enhancedScenario.name}! ${enhancedDescription} Ready to begin your training session?`);
    } else {
      setScenarioDetails(null);
      addMessage(
        "assistant",
        "Sorry, I couldn't find the requested training scenario. Please select a different scenario or contact support."
      );
    }
    
    // Clear chat messages for new scenario
    setChatMessages([]);
    setLastProcessedMessage("");
  };

  // Add message to chat
  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        role,
        content,
      };
      setChatMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  // Send text to API and handle audio response
  const sendMessageToAPI = useCallback(
    async (text: string) => {
      // Prevent duplicate calls and duplicate messages
      if (isLoading || lastProcessedMessage === text) {
        console.log("Already processing a message or duplicate message, skipping...");
        return;
      }

      try {
        // Add user message to chat
        addMessage("user", text);
        setLastProcessedMessage(text);

        setIsLoading(true);
        setIsThinking(true);

        // Add a small delay to allow user to complete their thought
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Prepare messages for API (include conversation history)
        const messages = [
          ...chatMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          { role: "user", content: text },
        ];

        // Send to API
        const response = await fetch("/api/voicechat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            scenario: scenarioDetails, // Include current mode
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `API Error: ${response.status} ${response.statusText}`;
          const errorDetails = errorData.details || "Unknown error occurred";
          throw new Error(`${errorMessage}: ${errorDetails}`);
        }

        // Parse JSON { text, audio }
        const data = await response.json();

        if (!data.text || !data.audio) {
          throw new Error("Incomplete response from server - missing text or audio data");
        }

        // Add assistant text to chat
        addMessage("assistant", data.text);

        // Decode base64 audio
        const base64 = data.audio.split(",")[1] || data.audio; // Remove "data:audio/mp3;base64," if present
        const audioBlob = new Blob(
          [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
          {
            type: "audio/mpeg",
          }
        );
        const audioUrl = URL.createObjectURL(audioBlob);

        // Play audio
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          setIsPlayingAudio(true);
          setIsAudioPlaying(true);

          audioRef.current.onended = () => {
            setIsPlayingAudio(false);
            setIsAudioPlaying(false);
            URL.revokeObjectURL(audioUrl);
            
            // Add a pause after AI finishes speaking to give user time to think
            setTimeout(() => {
              setSpeechStatus("Ready for your response...");
              setTimeout(() => {
                setSpeechStatus("");
              }, 3000);
            }, 500);
          };

          audioRef.current.onerror = () => {
            setIsPlayingAudio(false);
            setIsAudioPlaying(false);
            URL.revokeObjectURL(audioUrl);
            console.error("Audio playback failed");
          };

          await audioRef.current.play();
        }

        // Save to conversation if needed
        if (currentConversationId) {
          try {
            await saveMessage(currentConversationId, "user", text);
            await saveMessage(currentConversationId, "assistant", data.text);
            refetchConversations(); // Update sidebar conversations
          } catch (error) {
            console.error("Failed to save messages:", error);
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        addMessage(
          "assistant",
          "Sorry, I encountered an error. Please try again."
        );
      } finally {
        setIsLoading(false);
        setIsThinking(false);
      }
    },
    [
      chatMessages,
      scenarioDetails,
      currentConversationId,
      addMessage,
      saveMessage,
      refetchConversations,
      isLoading,
      lastProcessedMessage,
    ]
  );

  const handleStartRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("Speech Recognition is not supported in this browser.");
      return;
    }

    // Prevent starting if already recording
    if (isRecording) {
      console.log("Already recording, ignoring start request");
      return;
    }

    // Set up event handlers
    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsRecording(true);
      setSpeechStatus("Listening...");
      
      // Set timeout to auto-stop after 10 seconds of no speech
      const timeout = setTimeout(() => {
        if (isRecording) {
          console.log("Auto-stopping recording due to timeout");
          recognition.stop();
          setSpeechStatus("Recording stopped (timeout)");
        }
      }, 10000);
      setRecordingTimeout(timeout);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Log interim results for debugging
      if (interimTranscript) {
        console.log("Interim transcript:", interimTranscript);
        setSpeechStatus(`Hearing: "${interimTranscript}"`);
      }

      // Process final transcript
      if (finalTranscript) {
        console.log("Final transcript:", finalTranscript);
        const cleanTranscript = finalTranscript.trim();
        
        // Only send if we have meaningful content
        if (cleanTranscript.length > 0) {
          setSpeechStatus("Processing...");
          sendMessageToAPI(cleanTranscript);
        }
        
        // Stop recognition after processing
        recognition.stop();
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      setSpeechStatus("");

      // Handle specific errors with better user feedback
      switch (event.error) {
        case "not-allowed":
          alert("Microphone access denied. Please allow microphone access and try again.");
          break;
        case "no-speech":
          console.log("No speech detected, stopping recording");
          setSpeechStatus("No speech detected");
          break;
        case "audio-capture":
          alert("Audio capture failed. Please check your microphone and try again.");
          break;
        case "network":
          alert("Network error. Please check your internet connection and try again.");
          break;
        case "aborted":
          console.log("Speech recognition aborted");
          break;
        default:
          console.error("Speech recognition error:", event.error);
          alert("Speech recognition error. Please try again.");
      }
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsRecording(false);
      setSpeechStatus("");
      
      // Clear timeout
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        setRecordingTimeout(null);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsRecording(false);
      alert("Failed to start speech recognition. Please try again.");
    }
  }, [sendMessageToAPI, isRecording]);

  const handleStopRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition && isRecording) {
      try {
        recognition.stop();
        console.log("Stopping speech recognition");
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
    }
    setIsRecording(false);
  }, [isRecording]);

  const handleNewChat = useCallback(async () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }

    // Get a random scenario for variety
    const randomScenario = getRandomScenario();
    setActiveScenarioId(randomScenario.id);
    setScenarioDetails(randomScenario);
    
    // Create new conversation
    const conversationTitle = `${randomScenario.name} - ${randomScenario.persona}`;
    const newConversation = await createConversation(conversationTitle);
    
    if (newConversation) {
      setCurrentConversationId(newConversation.id);
    }
    
    setChatMessages([]);
    setLastProcessedMessage("");
    setSpeechStatus("");
    
    // Add welcome message for new scenario
    addMessage("assistant", `Welcome to ${randomScenario.name}! You'll be practicing with a ${randomScenario.persona}. Ready to begin?`);
  }, [createConversation, addMessage]);

  const handleShowHistory = useCallback(() => {
    setActiveTab("chat-history");
    refetchConversations(); // Refresh conversations list
  }, [refetchConversations]);

  const handleRefreshChat = useCallback(async () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }

    // Stop any ongoing recording
    if (isRecording) {
      handleStopRecording();
    }

    // Clear current chat but keep the same scenario
    setChatMessages([]);
    setLastProcessedMessage("");
    setSpeechStatus("");

    // Create new conversation for current scenario
    if (scenarioDetails) {
      const conversationTitle = `${scenarioDetails.name} - ${scenarioDetails.persona} (Refreshed)`;
      const newConversation = await createConversation(conversationTitle);
      
      if (newConversation) {
        setCurrentConversationId(newConversation.id);
      }
    }

    // Add welcome message
    if (scenarioDetails) {
      addMessage("assistant", `Chat refreshed! You're still practicing ${scenarioDetails.name} with a ${scenarioDetails.persona}. Ready to continue?`);
    }
  }, [scenarioDetails, isRecording, handleStopRecording, createConversation, addMessage]);

  const handleConversationSelect = useCallback(async (conversation: Conversation) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }

    // Stop any ongoing recording
    if (isRecording) {
      handleStopRecording();
    }

    setCurrentConversationId(conversation.id);
    
    try {
      // Load messages for this conversation
      const messages = await getMessages(conversation.id);
      const chatMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content
      }));
      
      setChatMessages(chatMessages);
      setLastProcessedMessage("");
      setSpeechStatus("");
      
      // Extract scenario info from conversation title
      const titleParts = conversation.title.split(' - ');
      if (titleParts.length >= 2) {
        const scenarioName = titleParts[0];
        const scenario = Scenarios.find(s => s.name === scenarioName);
        if (scenario) {
          setActiveScenarioId(scenario.id);
          setScenarioDetails(scenario);
        }
      }
      
      console.log('Loaded conversation:', conversation.id, 'with', messages.length, 'messages');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      addMessage("assistant", "Sorry, I couldn't load this conversation. Please try again.");
    }
  }, [isRecording, handleStopRecording, getMessages, addMessage]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      try {
        await deleteConversation(conversationId);
        
        // If this was the current conversation, clear the chat
        if (currentConversationId === conversationId) {
          setChatMessages([]);
          setCurrentConversationId(null);
          setActiveScenarioId(null);
          setScenarioDetails(null);
        }
        
        refetchConversations();
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        alert('Failed to delete conversation. Please try again.');
      }
    }
  }, [deleteConversation, currentConversationId, refetchConversations]);

  const handleToggleMode = useCallback(() => {
    setCurrentMode((prev) => (prev === "sales" ? "game" : "sales"));
  }, []);

  // Clear chat messages when mode changes
  useEffect(() => {
    setChatMessages([]);
  }, [currentMode]);

  const sidebarTabs = [
    { id: "scenarios", label: "Scenarios", icon: FileText },
    //{ id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "chat-history", label: "Chat History", icon: MessageSquare },
  ];

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeout) {
        clearTimeout(recordingTimeout);
      }
    };
  }, [recordingTimeout]);

  // Periodic refresh of conversations to keep sidebar synced
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && activeTab === "chat-history") {
        refetchConversations();
      }
    }, 30000); // Refresh every 30 seconds when on chat history tab

    return () => clearInterval(interval);
  }, [user, activeTab, refetchConversations]);

  return (
    <div className="flex bg-stone-50 text-gray-800 h-screen overflow-hidden">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} style={{ display: "none" }} />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar - Full Height */}
      <div
        className={clsx(
          "fixed lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-50",
          "w-72 sm:w-80 bg-white border-r border-gray-200 flex flex-col h-screen shadow-xl lg:shadow-md",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Close Button */}
        <div className="lg:hidden flex justify-end p-3 border-b border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Header */}
        <div className="p-4 lg:p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-orange-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-base text-gray-800">
                Training Assistant
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-800 hover:bg-white/60 p-2 rounded-full"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          <div className="mb-4 text-sm text-gray-600 truncate bg-white/50 rounded-lg px-3 py-2">
            {user?.email}
          </div>

          {/* Navigation Tabs */}
          <div className="space-y-1">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "w-full justify-start gap-3 text-sm py-3 rounded-lg transition-all duration-200",
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:from-purple-600 hover:to-purple-700"
                      : "text-gray-600 hover:text-gray-800 hover:bg-white/60"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <ScrollArea className="flex-1 p-4 lg:p-5">
          {activeTab === "scenarios" && currentMode === "sales" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Sales Training Scenarios
              </h3>
              <div className="space-y-3">
                {Scenarios.map((scenario) => (
                  <Card
                    key={scenario.id}
                    onClick={() => handleScenarioClick(scenario.id)}
                    className={`p-4 cursor-pointer transition-all duration-200 border 
                      ${
                        activeScenarioId === scenario.id
                          ? "bg-gradient-to-r from-gray-100 to-purple-100 border-purple-300 shadow-md"
                          : "border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50 hover:border-purple-200 hover:shadow-md"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-gray-800">
                        {scenario.name}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        scenario.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        scenario.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        scenario.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {scenario.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">
                      {scenario.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      Persona: {scenario.persona}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === "scenarios" && currentMode === "game" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Interactive Sales Challenges
              </h3>
              <div className="space-y-3">
                <Card
                  onClick={() => handleScenarioClick("enterprise-sale")}
                  className={`p-4 cursor-pointer transition-all duration-200 border 
                    ${
                      activeScenarioId === "enterprise-sale"
                        ? "bg-gradient-to-r from-gray-100 to-blue-100 border-blue-300 shadow-md"
                        : "border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:border-blue-200 hover:shadow-md"
                    }
                  `}
                >
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Enterprise Sale Challenge
                  </h4>
                  <p className="text-xs text-gray-600">
                    Navigate a complex enterprise sale with multiple stakeholders and long sales cycles.
                  </p>
                </Card>

                <Card
                  onClick={() => handleScenarioClick("startup-pitch")}
                  className={`p-4 cursor-pointer transition-all duration-200 border 
                    ${
                      activeScenarioId === "startup-pitch"
                        ? "bg-gradient-to-r from-gray-100 to-green-100 border-green-300 shadow-md"
                        : "border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-green-50 hover:border-green-200 hover:shadow-md"
                    }
                  `}
                >
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Startup Pitch Challenge
                  </h4>
                  <p className="text-xs text-gray-600">
                    Assess a distributor’s experience, reach, and setup.
                  </p>
                </Card>

                
                <Card
                  onClick={() => handleScenarioClick("difficult-prospect")}
                  className={`p-4 cursor-pointer transition-all duration-200 border 
                      ${
                        activeScenarioId === "difficult-prospect"
                          ? "bg-gradient-to-r from-gray-100 to-red-100 border-red-300 shadow-md"
                          : "border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-red-50 hover:border-red-200 hover:shadow-md"
                      }
                    `}
                >
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Difficult Prospect Challenge
                  </h4>
                  <p className="text-xs text-gray-600">
                    Respond to an unhappy customer with empathy and quick
                    action.
                  </p>
                </Card>

                <Card
                  onClick={() => handleScenarioClick("competitive-battle")}
                  className={`p-4 cursor-pointer transition-all duration-200 border 
                      ${
                        activeScenarioId === "competitive-battle"
                          ? "bg-gradient-to-r from-gray-100 to-indigo-100 border-indigo-300 shadow-md"
                          : "border-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50 hover:border-indigo-200 hover:shadow-md"
                      }
                    `}
                >
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">
                    Competitive Battle
                  </h4>
                  <p className="text-xs text-gray-600">
                    Negotiate a deal for a large order and unlock bonus sales
                    points.
                  </p>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                Performance Dashboard
              </h3>
              <div className="space-y-4">
                <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Sessions Completed
                    </span>
                    <span className="font-bold text-xl text-blue-600">12</span>
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Average Score
                    </span>
                    <span className="font-bold text-xl text-green-600">
                      8.5/10
                    </span>
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Time Practiced
                    </span>
                    <span className="font-bold text-xl text-purple-600">
                      4.2h
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "chat-history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 mb-4 text-lg">
                  Recent Conversations
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refetchConversations}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {conversationsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="text-xs text-gray-500 mt-2">Loading conversations...</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500">No conversations yet</p>
                    <p className="text-xs text-gray-400 mt-1">Start a scenario to create your first conversation</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <Card
                      key={conversation.id}
                      className={`p-4 cursor-pointer transition-all duration-200 border hover:shadow-md ${
                        currentConversationId === conversation.id
                          ? "bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 shadow-md"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => handleConversationSelect(conversation)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-800 mb-1 truncate">
                            {conversation.title}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {new Date(conversation.updated_at).toLocaleDateString()} • {new Date(conversation.updated_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conversation.id);
                          }}
                          className="text-gray-400 hover:text-red-500 p-1 h-6 w-6"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen bg-stone-50 relative">
        {/* Header */}
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="lg:hidden text-gray-500 hover:text-gray-800 hover:bg-gray-100 p-2 h-10 w-10 flex-shrink-0 rounded-full"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Commented out model selector */}
            {/* <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            /> */}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 h-10 w-10 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full"
            >
              <Settings className="w-5 h-5" />
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 hidden sm:block">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 h-10 w-10 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                  onClick={signOut}
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="p-2 h-10 w-10 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full"
                onClick={() => setShowAuthModal(true)}
              >
                <User className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Loading Conversation */}
        {isLoadingConversation && (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 flex-shrink-0">
            <p className="text-sm">Loading conversation...</p>
          </div>
        )}

        {/* Chat Content */}
        <div className="flex-1 flex flex-col min-h-0 pb-32 overflow-hidden">
          {/* Gradient Orb */}
          <GradientOrb isSpeaking={isPlayingAudio} isLoading={isLoading} />

          {/* Speech Status Indicator */}
          {speechStatus && (
            <div className="px-4 lg:px-6 mb-2">
              <div className="max-w-4xl mx-auto">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  {speechStatus}
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <ScrollArea className="flex-1 px-4 lg:px-6">
            <div className="max-w-4xl max-h-[200px] overflow-y-auto mx-auto scrollbar-hide">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <h2 className="text-xl font-semibold mb-3 text-gray-700">
                    Ready for your{" "}
                    {currentMode === "sales"
                      ? "sales training"
                      : "practice game"}
                    ?
                  </h2>
                  <p className="text-sm  text-gray-600 max-w-md mx-auto">
                    Press and hold the microphone button below to start speaking
                    with your AI training assistant.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {chatMessages.map((message, index) => (
                    <MessageBubble
                      key={message.id || index}
                      message={message}
                      isUser={message.role === "user"}
                    />
                  ))}
                  {(isLoading || isThinking) && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-xs shadow-sm">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {isThinking ? "Processing..." : "Thinking..."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Push-to-Talk Control Bar */}
        <div>
          <div className="fixed inset-x-0 bottom-[30px] flex justify-center lg:justify-start lg:pl-[52%]">
            <PushToTalkBar
              isRecording={isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onNewChat={handleNewChat}
              onShowHistory={handleShowHistory}
              onRefreshChat={handleRefreshChat}
              currentMode={currentMode}
              onToggleMode={handleToggleMode}
              showModeIndicator={true}
            />
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}