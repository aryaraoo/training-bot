// utils/scenarioEnhancer.ts
import Scenarios from './Scenarios.json';

export interface EnhancedScenario {
  id: string;
  name: string;
  description: string;
  persona: string;
  difficulty: string;
  dynamicContent?: {
    companyName?: string;
    productName?: string;
    industry?: string;
    budget?: string;
    timeline?: string;
    objections?: string[];
    painPoints?: string[];
  };
}

// Dynamic company names for variety
const companyNames = [
  "TechCorp Solutions", "Global Dynamics", "InnovateTech", "Future Systems",
  "Digital Ventures", "Smart Solutions", "NextGen Technologies", "Elite Corp",
  "Peak Performance", "Strategic Partners", "Visionary Labs", "Prime Solutions"
];

// Dynamic product names
const productNames = [
  "SalesPro Platform", "LeadGen Suite", "CRM Master", "Pipeline Pro",
  "Conversion Engine", "Revenue Optimizer", "Sales Accelerator", "Deal Closer"
];

// Dynamic industries
const industries = [
  "Technology", "Healthcare", "Finance", "Manufacturing", "Retail",
  "Education", "Real Estate", "Consulting", "Marketing", "Legal"
];

// Dynamic budgets
const budgets = [
  "$10K - $25K", "$25K - $50K", "$50K - $100K", "$100K+",
  "TBD", "Flexible", "Enterprise", "Startup Budget"
];

// Dynamic timelines
const timelines = [
  "Immediate", "30 days", "60 days", "90 days", "Q1", "Q2", "Q3", "Q4"
];

// Dynamic objections
const commonObjections = [
  "It's too expensive", "We don't need it", "We're happy with current solution",
  "Need to think about it", "Not the right time", "Need to check with team",
  "Budget constraints", "Technical concerns", "Integration worries"
];

// Dynamic pain points
const painPoints = [
  "Low conversion rates", "Long sales cycles", "Poor lead quality",
  "Manual processes", "Lack of visibility", "Team coordination issues",
  "Customer retention", "Revenue forecasting", "Competitive pressure"
];

export function getEnhancedScenario(scenarioId: string): EnhancedScenario | null {
  const baseScenario = Scenarios.find(s => s.id === scenarioId);
  if (!baseScenario) return null;

  // Add dynamic content based on scenario type
  const dynamicContent = {
    companyName: companyNames[Math.floor(Math.random() * companyNames.length)],
    productName: productNames[Math.floor(Math.random() * productNames.length)],
    industry: industries[Math.floor(Math.random() * industries.length)],
    budget: budgets[Math.floor(Math.random() * budgets.length)],
    timeline: timelines[Math.floor(Math.random() * timelines.length)],
    objections: commonObjections.slice(0, 3 + Math.floor(Math.random() * 3)), // 3-5 objections
    painPoints: painPoints.slice(0, 2 + Math.floor(Math.random() * 2)), // 2-3 pain points
  };

  return {
    ...baseScenario,
    dynamicContent
  };
}

export function getRandomEnhancedScenario(): EnhancedScenario {
  const randomIndex = Math.floor(Math.random() * Scenarios.length);
  const baseScenario = Scenarios[randomIndex];
  
  const dynamicContent = {
    companyName: companyNames[Math.floor(Math.random() * companyNames.length)],
    productName: productNames[Math.floor(Math.random() * productNames.length)],
    industry: industries[Math.floor(Math.random() * industries.length)],
    budget: budgets[Math.floor(Math.random() * budgets.length)],
    timeline: timelines[Math.floor(Math.random() * timelines.length)],
    objections: commonObjections.slice(0, 3 + Math.floor(Math.random() * 3)),
    painPoints: painPoints.slice(0, 2 + Math.floor(Math.random() * 2)),
  };

  return {
    ...baseScenario,
    dynamicContent
  };
}

export function enhanceScenarioDescription(scenario: EnhancedScenario): string {
  if (!scenario.dynamicContent) return scenario.description;

  const { companyName, productName, industry, budget, timeline, painPoints } = scenario.dynamicContent;
  
  let enhancedDescription = scenario.description;
  
  // Add dynamic context based on scenario type
  switch (scenario.id) {
    case 'cold-call-prospecting':
      enhancedDescription += ` You're calling ${companyName}, a ${industry} company with a ${budget} budget.`;
      break;
    case 'product-demo-presentation':
      enhancedDescription += ` Presenting ${productName} to ${companyName} who is struggling with ${painPoints.join(', ')}.`;
      break;
    case 'price-negotiation':
      enhancedDescription += ` Negotiating with ${companyName} who has a ${budget} budget and needs implementation within ${timeline}.`;
      break;
    case 'objection-handling':
      enhancedDescription += ` ${companyName} has raised concerns about: ${scenario.dynamicContent.objections?.join(', ')}.`;
      break;
    case 'closing-techniques':
      enhancedDescription += ` ${companyName} is interested but hesitant. They have a ${budget} budget and need to decide by ${timeline}.`;
      break;
    case 'competitive-positioning':
      enhancedDescription += ` ${companyName} is comparing ${productName} with competitors. They're in the ${industry} sector.`;
      break;
    case 'enterprise-sale':
      enhancedDescription += ` Complex sale to ${companyName} with multiple stakeholders, ${budget} budget, and ${timeline} timeline.`;
      break;
    case 'startup-pitch':
      enhancedDescription += ` Pitching ${productName} to investors from ${companyName}. Focus on ${painPoints.join(', ')}.`;
      break;
    default:
      enhancedDescription += ` Working with ${companyName} in the ${industry} sector.`;
  }

  return enhancedDescription;
} 