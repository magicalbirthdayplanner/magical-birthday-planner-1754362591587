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
    description: "Azure OpenAI API key for AI-powered theme recommendations using GPT-4.1",
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
    description: "Azure OpenAI deployment name for GPT-4.1 model",
    required: false,
    instructions: "The deployment name you created in Azure OpenAI Studio (e.g., 'gpt-4.1')"
  },
  {
    name: "AZURE_OPENAI_API_VERSION",
    description: "Azure OpenAI API version",
    required: false,
    instructions: "Use '2025-01-01-preview' or latest available API version from Azure OpenAI documentation"
  },
  {
    name: "DODO_PAYMENTS_API_KEY",
    description: "DoDo Payments API key for subscription handling and payment processing",
    required: false,
    instructions: "Go to [DoDo Payments Dashboard](https://app.dodopayments.com) → Settings → API Keys → Copy your Live or Test API key"
  },
  {
    name: "DODO_PAYMENTS_WEBHOOK_SECRET",
    description: "DoDo Payments webhook secret for secure webhook verification",
    required: false,
    instructions: "Go to [DoDo Payments Dashboard](https://app.dodopayments.com) → Webhooks → Copy the webhook secret"
  },
  {
    name: "RESEND_API_KEY",
    description: "Resend API key for transactional email sending (invitations, notifications, etc.)",
    required: true,
    instructions: "Go to [Resend Dashboard](https://resend.com/api-keys) → Create new API key → Copy the generated API key (starts with 're_')"
  },
  {
    name: "GOOGLE_PLACES_API_KEY",
    description: "Google Places API key for real venue recommendations and search functionality",
    required: false,
    instructions: "Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create API key → Enable Places API (New) → Copy the API key"
  },
  {
    name: "APIFY_API_TOKEN",
    description: "Apify API token for venue scraping using Google Maps Scraper Actor",
    required: false,
    instructions: "Go to [Apify Console](https://console.apify.com) → Settings → Integrations → API tokens → Create new token → Copy the API token (starts with 'apify_api_')"
  },
  {
    name: "APIFY_USER_ID",
    description: "Apify user ID for API authentication",
    required: false,
    instructions: "Go to [Apify Console](https://console.apify.com) → Settings → Account → Copy your User ID"
  },
  {
    name: "GEOAPIFY_API_KEY",
    description: "Geoapify API key for location geocoding (ZIP/City to coordinates)",
    required: false,
    instructions: "Go to [Geoapify](https://www.geoapify.com/) → Create account → MyProjects → Create new project → Copy API key (free tier: 3,000 requests/day)"
  },
  {
    name: "POSITIONSTACK_API_KEY",
    description: "Positionstack API key for backup geocoding service",
    required: false,
    instructions: "Go to [Positionstack](https://positionstack.com/) → Sign up → Dashboard → Copy your API access key (free tier: 25,000 requests/month)"
  },
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