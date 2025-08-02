// IMPORTANT: When adding new env variables to the codebase, update this array
export const ENV_VARIABLES: EnvVariable[] = [
  {
    name: "DATABASE_URL",
    description: "Supabase PostgreSQL database connection string for migrations and server-side operations",
    required: true,
    instructions: "Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Settings → Database → Connection string (URI format).\n Copy the full postgresql:// connection string.\n Make sure to replace [YOUR-PASSWORD] with actual password"
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    description: "Supabase project URL for client-side authentication and API calls",
    required: true,
    instructions: "Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Settings → Data API → Copy the 'Project URL -> URL' field (format: https://[project-id].supabase.co)"
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    description: "Supabase anonymous/publishable key for client-side authentication",
    required: true,
    instructions: "Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Settings → API Keys → Copy 'Legacy API keys → anon public' key"
  },
  {
    name: "AZURE_OPENAI_API_KEY",
    description: "Azure OpenAI API key for AI-powered theme recommendations using GPT-4o mini",
    required: false,
    instructions: "Go to Azure Portal → Your OpenAI Resource → Keys and Endpoint → Copy 'Key 1' or 'Key 2'"
  },
  {
    name: "AZURE_OPENAI_ENDPOINT",
    description: "Azure OpenAI service endpoint URL",
    required: false,
    instructions: "Format: https://[resource-name].openai.azure.com/ (from Azure Portal → Your OpenAI Resource → Keys and Endpoint)"
  },
  {
    name: "AZURE_OPENAI_DEPLOYMENT_NAME",
    description: "Azure OpenAI deployment name for GPT-4o mini model",
    required: false,
    instructions: "The deployment name you created in Azure OpenAI Studio (e.g., 'gpt-4o-mini')"
  },
  {
    name: "AZURE_OPENAI_API_VERSION",
    description: "Azure OpenAI API version",
    required: false,
    instructions: "Use '2024-02-01' or latest available API version from Azure OpenAI documentation"
  },
  {
    name: "AMAZON_API_KEY",
    description: "Amazon Product Advertising API key for live product deals",
    required: false,
    instructions: "Sign up for Amazon Product Advertising API at https://webservices.amazon.com/paapi5/documentation/ → Get your API key"
  },
  {
    name: "WALMART_API_KEY",
    description: "Walmart Open API key for product prices and deals",
    required: false,
    instructions: "Register at https://developer.walmart.com/ → Create application → Get API key"
  },
  {
    name: "TEMU_API_KEY",
    description: "Temu API key for product search and pricing (if available)",
    required: false,
    instructions: "Contact Temu developer support for API access (limited availability)"
  },
  {
    name: "YELP_API_KEY",
    description: "Yelp Fusion API key for local restaurant and catering recommendations",
    required: false,
    instructions: "Create account at https://www.yelp.com/developers → Create app → Get API key"
  },
  {
    name: "GOOGLE_MAPS_API_KEY",
    description: "Google Maps API key for location services and nearby business search",
    required: false,
    instructions: "Go to Google Cloud Console → APIs & Services → Credentials → Create API key → Enable Places API and Maps JavaScript API"
  }
];

export interface EnvVariable {
  name: string
  description: string
  instructions: string
  required: boolean
}

export function checkMissingEnvVars(): string[] {
  return ENV_VARIABLES.filter(envVar => envVar.required && !process.env[envVar.name]).map(envVar => envVar.name)
}