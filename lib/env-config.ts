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