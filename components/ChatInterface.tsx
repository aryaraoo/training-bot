"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Bot, User, Search, Store, LogOut, Menu, X, Mic, MicOff, Settings, Send, TrendingUp, Users } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { AuthModal } from "@/components/AuthModal";
import Scenarios from "@/utils/Scenarios.json";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
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

export default function ChatInterface() {
  const { user, signOut } = useAuth();
  const {
    conversations,
    loading: conversationsLoading,
    createConversation,
    getMessages,
    saveMessage,
    deleteConversation,
    refetch: refetchConversations
  } = useConversations();

  // UI & logic state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");

  // Refs
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeout = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // suggestion cards
  const suggestionCards = [
    { title: "Sales Roleplay", subtitle: "Practice", description: "Practice a sales conversation scenario.", icon: Users },
    { title: "Pitch Feedback", subtitle: "Pitch", description: "Get feedback on your sales pitch.", icon: TrendingUp },
    { title: "Quiz", subtitle: "Quiz", description: "Test your sales knowledge.", icon: Bot },
  ];

  // Chat (ai-sdk)
  const {
    messages,
    input: chatInput,
    handleInputChange: chatHandleInputChange,
    handleSubmit: chatHandleSubmit,
    isLoading: chatIsLoading,
    error: chatError,
    setMessages,
  } = useChat({
    onError(error) {
      setError(error);
      // Optionally toast
    },
    onFinish: async (message) => {
      if (!currentConversationId) return;
      if (message.role === "assistant") {
        try {
          await saveMessage(currentConversationId, "assistant", message.content);
          refetchConversations();
        } catch (e) {
          // Silent
        }
      }
    }
  });

  useEffect(() => setInput(chatInput), [chatInput]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, chatIsLoading]);
  useEffect(() => setChatMessages(messages), [messages]);

  // Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined" || recognitionRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => {
      setListening(true);
      setSpeechStatus("Listening...");
      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
      recordingTimeout.current = setTimeout(() => {
        recognition.stop();
        setSpeechStatus("Recording stopped (timeout)");
      }, 9500);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      chatHandleInputChange({ target: { value: transcript } } as any);
    };
    recognition.onerror = (event: any) => {
      setListening(false);
      setSpeechStatus("");
      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
      if (event.error === "not-allowed") alert("Microphone permission denied.");
      else if (event.error === "no-speech") setSpeechStatus("No speech detected.");
      else if (event.error === "audio-capture") alert("Audio capture error.");
      else if (event.error === "network") alert("Network error.");
    };
    recognition.onend = () => {
      setListening(false);
      setSpeechStatus("");
      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    };
    recognitionRef.current = recognition;
  }, [chatHandleInputChange]);

  // Load messages on conversation change
  useEffect(() => {
    async function loadMessages() {
      if (!currentConversationId) {
        setChatMessages([]); setLoadedConversationId(null); return;
      }
      if (loadedConversationId === currentConversationId) return;
      setLoadedConversationId(currentConversationId);
      setError(null); setIsLoading(true);
      try {
        const dbMessages = await getMessages(currentConversationId);
        const mappedMessages = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role === "user" || msg.role === "assistant" ? msg.role : "assistant",
          content: msg.content,
          createdAt: new Date(msg.created_at),
        }));
        setChatMessages(mappedMessages);
        setMessages(mappedMessages);
      } catch (e) { setError(e instanceof Error ? e : new Error("Loading messages failed")); }
      finally { setIsLoading(false); }
    }
    loadMessages();
  }, [currentConversationId, getMessages, setMessages, loadedConversationId]);

  // Setters
  const handleTextareaResize = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!chatIsLoading && input.trim().length > 0) {
          onSubmit(e as any);
        }
      }
    },
    [input, chatIsLoading]
  );
  const toggleSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  }, [listening]);
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || chatIsLoading || !user) return;
      let convId = currentConversationId;
      if (!convId) {
        const newConv = await createConversation(input.length > 50 ? input.substring(0, 50) + "..." : input);
        if (!newConv) { alert("Failed to create new conversation"); return; }
        convId = newConv.id;
        setCurrentConversationId(convId);
      }
      try { await saveMessage(convId, "user", input); refetchConversations(); }
      catch (e) { /* Could log error */ }
      await chatHandleSubmit(e);
    },
    [input, chatIsLoading, user, currentConversationId, createConversation, saveMessage, refetchConversations, chatHandleSubmit]
  );
  const selectConversation = useCallback((conv: Conversation) => {
    if (conv.id !== currentConversationId) {
      setCurrentConversationId(conv.id);
      setLoadedConversationId(null);
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    }
  }, [currentConversationId, isMobileMenuOpen]);
  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      await deleteConversation(id);
      if (id === currentConversationId) {
        setCurrentConversationId(null); setLoadedConversationId(null); setChatMessages([]);
      }
      refetchConversations();
    }
  }, [currentConversationId, deleteConversation, refetchConversations]);
  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    setLoadedConversationId(null);
    setChatMessages([]); setInput("");
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  }, [isMobileMenuOpen]);
  const handleSignOut = useCallback(async () => {
    await signOut();
    setCurrentConversationId(null); setChatMessages([]); setLoadedConversationId(null);
  }, [signOut]);
  const handleSuggestionClick = useCallback((text: string) => setInput(text), []);

  // Responsive sidebar menu
  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((v) => !v), []);

  return (
    <div className="flex min-h-screen h-screen bg-gradient-to-br from-purple-50 via-orange-50 to-white">
      <audio ref={audioRef} style={{ display: "none" }} />
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setIsMobileMenuOpen(false)} tabIndex={-1} aria-label="Close menu overlay" />
      )}
      {/* Sidebar */}
      <aside className={clsx(
        "fixed z-40 lg:z-10 h-full w-72 flex-col bg-gradient-to-b from-purple-50 to-white border-r border-gray-200 shadow-xl transition-transform duration-300",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-purple-100 shadow-sm">
          <div className="flex items-center gap-3">
            <Store className="text-purple-700" size={28} />
            <span className="text-lg font-bold tracking-tight text-purple-700">SalesBot</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu} className="lg:hidden ml-2" aria-label="Close menu"><X className="text-gray-500" /></Button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 bg-white text-xs text-gray-500">{user?.email}</div>
        <div className="border-b border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <Input placeholder="Search" className="pl-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="uppercase text-xs font-bold text-purple-500 tracking-wide mb-2">Scenarios</h3>
          <div className="space-y-2">
            {Scenarios.map((scenario: Scenario) => (
              <Card
                key={scenario.id}
                className={clsx(
                  "p-4 rounded-xl transition hover:shadow-md cursor-pointer border-2",
                  scenario.id === currentConversationId ? "border-purple-500 bg-purple-50" : "border-gray-200"
                )}
                onClick={() => {/* handle scenario selection if needed */}}
              >
                <span className="text-sm font-semibold text-purple-900">{scenario.name}</span>
                <span className="text-xs text-gray-600">{scenario.persona}</span>
                <span className={clsx("inline-block self-start mt-0.5 rounded-full px-2 py-0.5 text-xs",
                  {
                    "bg-green-100 text-green-700": scenario.difficulty === "easy",
                    "bg-yellow-100 text-yellow-800": scenario.difficulty === "medium",
                    "bg-red-100 text-red-700": scenario.difficulty === "hard"
                  })}>
                  {scenario.difficulty}
                </span>
              </Card>
            ))}
          </div>
          <h3 className="mt-6 uppercase text-xs font-bold text-purple-500 tracking-wide mb-2">Conversations</h3>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Card key={conv.id}
                className={clsx(
                  "p-3 flex items-center justify-between rounded-xl hover:shadow transition border-2 cursor-pointer",
                  conv.id === currentConversationId ? "border-purple-500 bg-purple-100" : "border-gray-200"
                )}
                onClick={() => selectConversation(conv)}
              >
                <div className="truncate max-w-[75%]">
                  <span className="block text-xs font-medium">{conv.title}</span>
                  <span className="block text-xs text-gray-400">{new Date(conv.updated_at).toLocaleDateString()}</span>
                </div>
                <Button size="icon" variant="ghost" className="text-gray-400 hover:text-red-500" onClick={(e) => handleDeleteConversation(conv.id, e)} aria-label="Delete conversation">
                  <Trash2 size={16} />
                </Button>
              </Card>
            ))}
          </div>
          <Button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-orange-400 hover:from-purple-700 hover:to-orange-500 text-white rounded-full py-2 shadow-lg font-bold text-base"
            onClick={startNewChat}>
            + New Chat
          </Button>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="flex-1 flex flex-col bg-gradient-to-br from-white via-purple-50 to-orange-50">
        {/* Header */}
        <header className="h-16 bg-white/95 border-b shadow flex items-center px-8 justify-between">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleMobileMenu}><Menu /></Button>
          <span className="font-medium text-purple-800">{user ? `Logged in as ${user.email}` : "Not signed in"}</span>
          <Button variant="ghost" size="icon" onClick={() => setShowAuthModal(true)} aria-label="User profile"><User /></Button>
        </header>

        {/* Error or Info */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 p-4 text-red-600">
            <strong>Error: </strong> {error.message}
          </div>
        )}
        {isLoading && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 text-blue-600">
            Processing your request...
          </div>
        )}

        {/* Chat window */}
        <ScrollArea className="flex-1 px-0 py-4 bg-transparent">
          <div className="max-w-3xl mx-auto px-2">
            {chatMessages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-24 text-gray-400 text-center">
                <Bot size={56} className="mb-4 text-purple-300" />
                <span className="text-2xl font-semibold mb-2 text-gray-600">Ready to practice your sales skills?</span>
                <span className="mb-6">Pick a scenario or start a message below!</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 w-full">
                  {suggestionCards.map(({ title, subtitle, description, icon: Icon }, i) => (
                    <Card
                      key={i}
                      className="cursor-pointer transition hover:shadow-xl bg-white/90 border border-purple-200 p-4 rounded-xl"
                      onClick={() => handleSuggestionClick(`Help me with ${title.toLowerCase()}`)}
                    >
                      <div className="flex items-center mb-2">
                        <Icon size={24} className="text-purple-700 mr-2" />
                        <span className="font-semibold">{title}</span>
                      </div>
                      <span className="block text-xs text-purple-700 font-semibold mb-1">{subtitle}</span>
                      <span className="block text-xs text-gray-600">{description}</span>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={msg.id} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 mr-2 flex items-end">
                        <Bot size={32} className="text-purple-600" />
                      </div>
                    )}
                    <div className={clsx(
                      "rounded-xl shadow px-4 py-3 max-w-[70%] text-sm whitespace-pre-line break-words",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-purple-600 to-orange-400 text-white ml-10"
                        : "bg-white border border-purple-100 text-gray-800 mr-10"
                    )}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex-shrink-0 ml-2 flex items-end">
                        <User size={28} className="text-purple-400" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="sticky bottom-0 left-0 bg-white/95 border-t border-gray-200 py-3 px-8 w-full">
          <form onSubmit={onSubmit} className="flex items-center gap-3 max-w-3xl mx-auto">
            <textarea
              rows={1}
              className="flex-grow resize-none border-none rounded-full bg-gray-100 px-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-purple-400 shadow"
              placeholder="Type your message or use the mic..."
              value={input}
              onChange={chatHandleInputChange}
              onInput={handleTextareaResize}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Chat input"
              style={{ minHeight: 44, maxHeight: 120 }}
            />
            <Button
              type="button"
              size="icon"
              onClick={toggleSpeechRecognition}
              className={clsx(
                "rounded-full h-12 w-12 text-white text-xl shadow bg-purple-700 hover:bg-purple-800",
                listening && "animate-pulse bg-red-600"
              )}
              aria-label={listening ? "Stop Listening" : "Start Listening"}
            >
              {listening ? <MicOff /> : <Mic />}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || input.trim().length === 0}
              className="bg-gradient-to-br from-purple-700 to-orange-500 text-white rounded-full h-12 w-12 shadow hover:from-purple-800 hover:to-orange-600"
              aria-label="Send"
            >
              <Send />
            </Button>
          </form>
        </div>
      </main>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
