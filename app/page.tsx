"use client";

import { AuthGuard } from "@/components/AuthGuard";
// import QueryChat from "@/components/ChatInterface";
import TrainingChat from "@/components/TrainingChat";
// import OnboardingChat from "@/components/OnboardingChat";
// import { ModelProvider, useModel } from "@/contexts/ModelContext";

export default function Home() {
  return (
    <AuthGuard>
      <TrainingChat />
    </AuthGuard>
  );
}
