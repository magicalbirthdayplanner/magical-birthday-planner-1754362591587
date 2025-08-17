"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, ArrowRight, ArrowLeft, PartyPopper, X, Sparkles, Loader2, Heart, User, UserCheck, Users, Baby, AlertTriangle, DollarSign, MapPin, Globe, CreditCard, CheckCircle, Home, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { checkProfanity, getProfanityWarning, shouldBlockAISuggestions } from "@/lib/profanity-filter";
import Fireworks from "react-canvas-confetti/dist/presets/fireworks";
import { useAuth } from "@/contexts/AuthContext";
import { createParty, updateParty } from "@/lib/party-actions";
import AuthModal from "@/components/AuthModal";

const currencyOptions = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "$", name: "Hong Kong Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal" },
  { code: "ZAR", symbol: "R", name: "South African Rand" }
];

const countryOptions = [
  { code: "US", name: "United States", flag: "🇺🇸", postalFormat: "Zip Code", example: "12345 or 12345-6789" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", postalFormat: "Postcode", example: "SW1A 1AA" },
  { code: "CA", name: "Canada", flag: "🇨🇦", postalFormat: "Postal Code", example: "K1A 0A6" },
  { code: "AU", name: "Australia", flag: "🇦🇺", postalFormat: "Postcode", example: "2000" },
  { code: "DE", name: "Germany", flag: "🇩🇪", postalFormat: "Postleitzahl", example: "10115" },
  { code: "FR", name: "France", flag: "🇫🇷", postalFormat: "Code Postal", example: "75001" },
  { code: "JP", name: "Japan", flag: "🇯🇵", postalFormat: "Postal Code", example: "100-0001" },
  { code: "IN", name: "India", flag: "🇮🇳", postalFormat: "PIN Code", example: "110001" },
  { code: "CN", name: "China", flag: "🇨🇳", postalFormat: "Postal Code", example: "100000" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", postalFormat: "Postal Code", example: "03001" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", postalFormat: "Postal Code", example: "018956" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", postalFormat: "Postcode", example: "1012 JS" },
  { code: "IT", name: "Italy", flag: "🇮🇹", postalFormat: "CAP", example: "00118" },
  { code: "ES", name: "Spain", flag: "🇪🇸", postalFormat: "Código Postal", example: "28001" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", postalFormat: "Postnummer", example: "11122" },
  { code: "NO", name: "Norway", flag: "🇳🇴", postalFormat: "Postnummer", example: "0010" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", postalFormat: "Postnummer", example: "1050" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", postalFormat: "Código Postal", example: "01000" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", postalFormat: "CEP", example: "01310-100" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", postalFormat: "Postal Code", example: "8001" }
];

interface PartyData {
  childName: string;
  childAge: number;
  childGender: string;
  childInterests: string[];
  favoriteColors: string[];
  childDetails?: string;
  partyDate: Date | undefined;
  selectedTheme: string; // Default to "unicorn"
  budget?: number;
  currency?: string;
  country?: string;
  zipCode?: string;
  guestCount?: number;
  zipCodeError?: string;
  partyId?: string;
  venue?: 'indoor' | 'outdoor' | 'mixed';
  duration?: string;
  themeActivities?: string;
}

export default function CreatePartyPage() {
  const { user } = useAuth();

  // Clear demo data when user signs in
  useEffect(() => {
    if (user && localStorage.getItem('demoPartyData')) {
      // User has signed in, clear demo data
      localStorage.removeItem('demoPartyData');
    }
  }, [user]);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [partyData, setPartyData] = useState<PartyData>({
    childName: "",
    childAge: 0,
    childGender: "",
    childInterests: [],
    favoriteColors: [],
    partyDate: undefined,
    selectedTheme: "", // No default theme
    budget: undefined,
    currency: "USD", // Initialize with default USD currency
    zipCode: "",
    country: "",
    zipCodeError: undefined,
    venue: 'mixed', // Default venue type
    duration: '2-3 hours', // Default party duration
    guestCount: undefined
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Restore from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('partyData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Ensure required fields are initialized if missing from saved data
        const restoredData = {
          ...parsedData,
          selectedTheme: "", // No default theme
          currency: parsedData.currency || "USD",
          country: parsedData.country || "",
          zipCodeError: parsedData.zipCodeError || undefined,
          // Convert partyDate back to Date object if it exists
          partyDate: parsedData.partyDate ? new Date(parsedData.partyDate) : undefined
        };
        setPartyData(restoredData);
      } catch (error) {
        console.error('Error parsing saved party data:', error);
        // If parsing fails, start fresh
        localStorage.removeItem('partyData');
      }
    }
  }, []);

  // Auto-save functionality - only save to localStorage during wizard
  useEffect(() => {
    // Only save to localStorage during the wizard process
    localStorage.setItem('partyData', JSON.stringify(partyData));
  }, [partyData]);

  // Auto-detect country from zip code format
  const detectCountryFromZipCode = (zipCode: string) => {
    const cleanZip = zipCode.replace(/[\s\-]/g, '');
    
    // Test original zipCode for patterns that require spaces/hyphens first (UK, CA, NL)
    if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(zipCode)) return 'GB';
    if (/^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i.test(zipCode)) return 'CA';
    if (/^\d{4}\s*[A-Z]{2}$/i.test(zipCode)) return 'NL';
    
    // For 5-digit zip codes, use intelligent detection based on actual ranges
    if (/^\d{5}$/.test(cleanZip)) {
      const zipNum = parseInt(cleanZip, 10);
      
      // US ZIP code ranges (00501-99950) - prioritize US first as most common
      if (zipNum >= 501 && zipNum <= 99950) {
        // Additional US validation - exclude known non-US ranges
        // Germany uses 01000-99999, but US has wider coverage and priority
        return 'US';
      }
      
      // If not in US range, check other countries with 5-digit codes
      // German postal codes: 01000-99999
      if (zipNum >= 1000 && zipNum <= 99999) return 'DE';
      
      // Default to US for any 5-digit code (US has broadest coverage)
      return 'US';
    }
    
    // Extended ZIP+4 codes (US only)
    if (/^\d{5}-?\d{4}$/.test(cleanZip)) return 'US';
    
    // Other specific patterns
    if (/^\d{3}-?\d{4}$/.test(cleanZip)) return 'JP';
    if (/^\d{5}-?\d{3}$/.test(cleanZip)) return 'BR';
    
    // 6-digit codes
    if (/^\d{6}$/.test(cleanZip)) {
      // India: 100000-999999
      if (cleanZip.length === 6 && parseInt(cleanZip.substring(0, 1)) >= 1) return 'IN';
      // China: 100000-999999  
      return 'CN';
    }
    
    // 4-digit codes
    if (/^\d{4}$/.test(cleanZip)) {
      const zipNum = parseInt(cleanZip, 10);
      // Australia: 0200-9999
      if (zipNum >= 200) return 'AU';
      // Norway: 0010-9999
      if (zipNum >= 10) return 'NO';
      // Default to Denmark for other 4-digit codes
      return 'DK';
    }
    
    return null;
  };

  // Enhanced zip code validation with auto-detection
  const validateZipCodeWithDetection = (zipCode: string) => {
    if (!zipCode || zipCode.trim() === '') {
      return { error: 'Zip code is required', detectedCountry: null };
    }
    
    const detectedCountry = detectCountryFromZipCode(zipCode);
    const cleanZip = zipCode.replace(/[\s\-]/g, '');
    
    if (!detectedCountry) {
      return { error: 'Invalid zip code format - please check your entry', detectedCountry: null };
    }
    
    // Country-specific validation patterns
    const patterns: { [key: string]: { pattern: RegExp; format: string } } = {
      US: { pattern: /^\d{5}(\d{4})?$/, format: '12345 or 12345-6789' },
      GB: { pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, format: 'SW1A 1AA' },
      CA: { pattern: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, format: 'K1A 0A6' },
      AU: { pattern: /^\d{4}$/, format: '2000' },
      DE: { pattern: /^\d{5}$/, format: '10115' },
      FR: { pattern: /^\d{5}$/, format: '75001' },
      JP: { pattern: /^\d{3}-?\d{4}$/, format: '100-0001' },
      IN: { pattern: /^\d{6}$/, format: '110001' },
      CN: { pattern: /^\d{6}$/, format: '100000' },
      KR: { pattern: /^\d{5}$/, format: '03001' },
      SG: { pattern: /^\d{6}$/, format: '018956' },
      NL: { pattern: /^\d{4}\s*[A-Z]{2}$/i, format: '1012 JS' },
      IT: { pattern: /^\d{5}$/, format: '00118' },
      ES: { pattern: /^\d{5}$/, format: '28001' },
      SE: { pattern: /^\d{5}$/, format: '11122' },
      NO: { pattern: /^\d{4}$/, format: '0010' },
      DK: { pattern: /^\d{4}$/, format: '1050' },
      MX: { pattern: /^\d{5}$/, format: '01000' },
      BR: { pattern: /^\d{5}-?\d{3}$/, format: '01310-100' },
      ZA: { pattern: /^\d{4}$/, format: '8001' }
    };
    
    const countryPattern = patterns[detectedCountry];
    if (!countryPattern) {
      return { error: 'Unsupported country format', detectedCountry };
    }
    
    // For UK and Canada, use original zipCode (with spaces) for validation
    const testValue = (detectedCountry === 'GB' || detectedCountry === 'CA' || detectedCountry === 'NL') ? zipCode : cleanZip;
    
    if (!countryPattern.pattern.test(testValue)) {
      const countryName = countryOptions.find(c => c.code === detectedCountry)?.name || detectedCountry;
      return { error: `Please enter a valid ${countryName} zip code (e.g., ${countryPattern.format})`, detectedCountry };
    }
    
    return { error: null, detectedCountry };
  };

  // Handle zip code input with auto-detection and validation
  const handleZipCodeChange = (value: string) => {
    const result = validateZipCodeWithDetection(value);
    setPartyData({ 
      ...partyData, 
      zipCode: value,
      country: result.detectedCountry || partyData.country,
      zipCodeError: result.error || undefined 
    });
  };

  // Handle currency change from dropdown
  const handleCurrencyChange = (currencyCode: string) => {
    setPartyData({ 
      ...partyData, 
      currency: currencyCode
    });
  };

  const handleNext = async () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    console.log('Starting party creation with user:', { id: user.id, email: user.email })
    console.log('Party data:', partyData)

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmissionStep('Validating party details...');
    
    // Client-side timeout to prevent infinite loading (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timed out. This might be due to network issues. Please try again.'));
      }, 30000);
    });
    
    try {
      // Validate required fields
      if (!partyData.childName || !partyData.partyDate) {
        throw new Error('Missing required fields: child name or party date');
      }

      let partyId = partyData.partyId;

      // If we don't have a party ID from auto-save, create the party
      if (!partyId) {
        setSubmissionStep('Preparing party data...');
        
        const createPayload = {
          childName: partyData.childName,
          childAge: partyData.childAge,
          childGender: partyData.childGender,
          partyDate: partyData.partyDate!,
          theme: "", // No default theme - user can select in themes tab
          interests: partyData.childInterests,
          favoriteColors: partyData.favoriteColors,
          guestCount: partyData.guestCount,
          budget: partyData.budget || undefined,
          location: partyData.zipCode,
          venue: partyData.venue,
          duration: partyData.duration,
          status: 'PLANNING' as const,
        };

        console.log('Creating party with payload:', createPayload)
        setSubmissionStep('Creating your magical party plan...');

        // Create party in database using server action with timeout protection
        const result = await Promise.race([
          createParty(createPayload),
          timeoutPromise
        ]);

        console.log('Party creation result:', result)

        if (!result.success) {
          throw new Error(result.error || 'Failed to create party');
        }

        if (!result.party?.id) {
          throw new Error('Party created but no ID returned');
        }

        partyId = result.party.id;
      }

      setSubmissionStep('Finalizing your party plan...');
      
      // Clear the form data from localStorage after successful creation
      localStorage.removeItem('partyData');
      
      // Navigate to the party dashboard
      console.log('Redirecting to party:', partyId);
      router.push(`/party-plan?id=${partyId}`);

    } catch (error) {
      console.error('Party creation error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      // Show user-friendly error messages
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        setSubmitError('The request is taking longer than expected. Please check your internet connection and try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setSubmitError('Network error occurred. Please check your internet connection and try again.');
      } else if (errorMessage.includes('validation') || errorMessage.includes('required')) {
        setSubmitError('Please fill in all required fields and try again.');
      } else {
        setSubmitError(`Failed to create party: ${errorMessage}`);
      }
      
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl border-2 border-purple-200 dark:border-purple-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg p-6 sm:p-8">
            <div className="flex items-center justify-center space-x-3">
              <PartyPopper className="h-8 w-8 sm:h-10 sm:w-10 animate-bounce" />
              <CardTitle className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                Create Your Party
              </CardTitle>
              <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 animate-pulse" />
            </div>
            <CardDescription className="text-purple-100 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              {step === 1 && "Tell us about your child"}
              {step === 2 && "Party details"}
              {step === 3 && "Create your party plan"}
            </CardDescription>
            <p className="text-purple-200 text-sm sm:text-base">
              {step === 1 && "Basic information about your child and when the party will be"}
              {step === 2 && "Budget, location, and guest count information"}
              {step === 3 && "Ready to create your magical party plan?"}
            </p>
            
            {/* Step Progress Indicator */}
            <div className="flex justify-center space-x-4 mt-6">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    step >= stepNumber 
                      ? "bg-white text-purple-600 shadow-lg" 
                      : "bg-purple-400 text-white"
                  )}>
                    {stepNumber}
                  </div>
                  {stepNumber < 3 && (
                    <div className={cn(
                      "w-8 h-1 mx-2 rounded transition-all duration-300",
                      step > stepNumber ? "bg-white" : "bg-purple-400"
                    )} />
                  )}
                </div>
              ))}
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4">
              <Button
                onClick={handleBack}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
                disabled={step === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Back</span>
              </Button>
              
              {step < 3 && (
                <Button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-3 h-12 text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  disabled={(!partyData.childName || partyData.childAge === 0 || !partyData.childGender || !partyData.partyDate) && step === 1}
                >
                  <span className="hidden sm:inline">Next Step</span>
                  <span className="sm:hidden">Next</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {step === 3 && !submitError && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold px-8 py-3 h-12 text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 min-w-[200px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">{submissionStep || 'Creating...'}</span>
                      <span className="sm:hidden">Creating...</span>
                    </>
                  ) : (
                    <>
                      <PartyPopper className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Create My Party Plan</span>
                      <span className="sm:hidden">Create Plan</span>
                      <Sparkles className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Error Message Display */}
            {submitError && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => {
                      setSubmitError(null);
                      setStep(1);
                      // Reset form data
                      setPartyData({
                        childName: "",
                        childAge: 0,
                        childGender: "",
                        childInterests: [],
                        favoriteColors: [],
                        partyDate: undefined,
                        selectedTheme: "",
                        budget: undefined,
                        currency: "",
                        zipCode: "",
                        country: "",
                        zipCodeError: undefined,
                        guestCount: undefined
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    Start Over
                  </Button>
                  <Button 
                    onClick={() => setSubmitError(null)}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            {/* Step 1: Child Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="childName" className="text-sm font-medium dark:text-gray-200">
                    Child's Name
                  </Label>
                  <Input
                    id="childName"
                    placeholder="Enter your child's name"
                    value={partyData.childName}
                    onChange={(e) => setPartyData({ ...partyData, childName: e.target.value })}
                    className="text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium dark:text-gray-200">
                    Gender
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                    <Button
                      type="button"
                      variant={partyData.childGender === "boy" ? "default" : "outline"}
                      onClick={() => setPartyData({ ...partyData, childGender: "boy" })}
                      className={cn(
                        "h-12 flex items-center justify-center space-x-2 text-sm relative overflow-hidden group transition-all duration-300 transform hover:scale-105",
                        partyData.childGender === "boy"
                          ? "bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 hover:from-blue-600 hover:via-blue-700 hover:to-cyan-700 text-white shadow-lg border-2 border-blue-400"
                          : "hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:border-blue-300 hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transition-transform duration-700",
                        partyData.childGender === "boy" 
                          ? "translate-x-full group-hover:translate-x-[-200%]" 
                          : "translate-x-[-200%]"
                      )} />
                      <User className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        partyData.childGender === "boy" ? "scale-110" : "group-hover:scale-110"
                      )} />
                      <span className="font-medium">Boy</span>
                      {partyData.childGender === "boy" && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={partyData.childGender === "girl" ? "default" : "outline"}
                      onClick={() => setPartyData({ ...partyData, childGender: "girl" })}
                      className={cn(
                        "h-12 flex items-center justify-center space-x-2 text-sm relative overflow-hidden group transition-all duration-300 transform hover:scale-105",
                        partyData.childGender === "girl"
                          ? "bg-gradient-to-br from-pink-500 via-pink-600 to-rose-600 hover:from-pink-600 hover:via-pink-700 hover:to-rose-700 text-white shadow-lg border-2 border-pink-400"
                          : "hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 hover:border-pink-300 hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transition-transform duration-700",
                        partyData.childGender === "girl" 
                          ? "translate-x-full group-hover:translate-x-[-200%]" 
                          : "translate-x-[-200%]"
                      )} />
                      <Users className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        partyData.childGender === "girl" ? "scale-110" : "group-hover:scale-110"
                      )} />
                      <span className="font-medium">Girl</span>
                      {partyData.childGender === "girl" && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium dark:text-gray-200">When is the party?</Label>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-lg py-6",
                          !partyData.partyDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {partyData.partyDate ? format(partyData.partyDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={partyData.partyDate}
                        onSelect={(date) => {
                          setPartyData({ ...partyData, partyDate: date });
                          setIsDatePickerOpen(false);
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-4">
                  <Label htmlFor="childAge" className="text-sm font-medium dark:text-gray-200">
                    Child's Age: {`${partyData.childAge} year${partyData.childAge > 1 ? 's' : ''} old`}
                  </Label>
                  <div className="px-3">
                    <Slider
                      value={[partyData.childAge]}
                      onValueChange={(value) => setPartyData({ ...partyData, childAge: value[0] })}
                      max={12}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                      <span>8</span>
                      <span>9</span>
                      <span>10</span>
                      <span>11</span>
                      <span>12</span>
                    </div>
                  </div>
                  
                  {/* Individual Age Cards */}
                  <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {[
                        { age: 1, label: "Little One", emoji: "🍼" },
                        { age: 2, label: "Toddler", emoji: "🧸" },
                        { age: 3, label: "Preschooler", emoji: "🎈" },
                        { age: 4, label: "Big Kid", emoji: "🎒" },
                        { age: 5, label: "Kindergarten", emoji: "🎒" },
                        { age: 6, label: "School Star", emoji: "📚" },
                        { age: 7, label: "Explorer", emoji: "🔍" },
                        { age: 8, label: "Adventurer", emoji: "🚀" },
                        { age: 9, label: "Tween", emoji: "⭐" },
                        { age: 10, label: "Double Digits", emoji: "🎉" },
                        { age: 11, label: "Pre-teen", emoji: "🎯" },
                        { age: 12, label: "Almost Teen", emoji: "🎮" }
                      ].map((ageCard) => {
                        const isActive = partyData.childAge === ageCard.age;

                        return (
                          <div
                            key={ageCard.age}
                            onClick={() => setPartyData({ ...partyData, childAge: ageCard.age })}
                            className={cn(
                              "p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-105 text-center",
                              isActive 
                                ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 shadow-md" 
                                : "border-gray-200 dark:border-slate-600 hover:border-purple-300 hover:bg-purple-25 dark:hover:bg-purple-900/20"
                            )}
                          >
                            <div className="text-2xl mb-1">{ageCard.emoji}</div>
                            <div className={cn(
                              "text-lg font-bold",
                              isActive ? "text-purple-700 dark:text-purple-400" : "text-gray-600 dark:text-gray-300"
                            )}>
                              {ageCard.age}
                            </div>
                            <div className={cn(
                              "text-xs font-medium mt-1",
                              isActive ? "text-purple-600 dark:text-purple-400" : "text-gray-500 dark:text-gray-400"
                            )}>
                              {ageCard.label}
                            </div>
                            {isActive && (
                              <div className="text-xs text-purple-500 mt-1 italic">
                                ✨ Selected
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Current Selection Display */}
                    <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-lg">
                          {partyData.childAge === 1 ? "🍼" :
                           partyData.childAge === 2 ? "🧸" :
                           partyData.childAge === 3 ? "🎈" :
                           partyData.childAge === 4 ? "🎒" :
                           partyData.childAge === 5 ? "🎒" :
                           partyData.childAge === 6 ? "📚" :
                           partyData.childAge === 7 ? "🔍" :
                           partyData.childAge === 8 ? "🚀" :
                           partyData.childAge === 9 ? "⭐" :
                           partyData.childAge === 10 ? "🎉" :
                           partyData.childAge === 11 ? "🎯" :
                           partyData.childAge === 12 ? "🎮" : "🎈"}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          Perfect for a{" "}
                          <span className="font-bold text-orange-600">
                            {partyData.childAge === 1 ? "Little One" :
                             partyData.childAge === 2 ? "Toddler" :
                             partyData.childAge === 3 ? "Preschooler" :
                             partyData.childAge === 4 ? "Big Kid" :
                             partyData.childAge === 5 ? "Kindergarten" :
                             partyData.childAge === 6 ? "School Star" :
                             partyData.childAge === 7 ? "Explorer" :
                             partyData.childAge === 8 ? "Adventurer" :
                             partyData.childAge === 9 ? "Tween" :
                             partyData.childAge === 10 ? "Double Digits" :
                             partyData.childAge === 11 ? "Pre-teen" :
                             partyData.childAge === 12 ? "Almost Teen" : "Young Child"}
                          </span>{" "}
                          celebration! 🎉
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Party Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Budget Input with Embedded Currency Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Party Budget
                    </Label>
                    <div className="flex gap-2">
                      {/* Currency Selector Button */}
                      <Select value={partyData.currency || 'USD'} onValueChange={handleCurrencyChange}>
                        <SelectTrigger className="w-20 h-12 text-lg font-semibold dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                          <SelectValue>
                            {partyData.currency ? currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$' : '$'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {currencyOptions.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">{currency.symbol}</span>
                                <span className="text-sm">{currency.code}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Budget Input */}
                      <Input
                        type="number"
                        placeholder="Enter budget amount"
                        value={partyData.budget || ''}
                        onChange={(e) => setPartyData({ ...partyData, budget: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                        min="0"
                        step="10"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Click {partyData.currency ? currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$' : '$'} to change currency • Budget helps us recommend the right options
                    </p>
                  </div>

                  {/* Zip Code Input with Auto Country Detection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      Zip Code
                    </Label>
                    <div className="relative">
                      {/* Country Flag Display (Auto-detected) */}
                      {partyData.country && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-lg">
                          {countryOptions.find(c => c.code === partyData.country)?.flag}
                        </div>
                      )}
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Enter zip code (any country)"
                        value={partyData.zipCode || ''}
                        onChange={(e) => handleZipCodeChange(e.target.value)}
                        className={cn(
                          "pl-10 pr-12 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200",
                          partyData.zipCodeError && "border-red-500 focus:border-red-500 focus:ring-red-500",
                          partyData.country && !partyData.zipCodeError && "border-green-500 focus:border-green-500"
                        )}
                        maxLength={15}
                      />
                    </div>
                    {partyData.zipCodeError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {partyData.zipCodeError}
                      </p>
                    )}
                    {partyData.country && !partyData.zipCodeError && partyData.zipCode && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Valid {countryOptions.find(c => c.code === partyData.country)?.name} zip code detected
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Country auto-detected from format • Helps us suggest local vendors
                    </p>
                  </div>

                  {/* Guest Count Input */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <Users className="h-4 w-4 text-purple-600" />
                      Number of Guests
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="Expected guests"
                        value={partyData.guestCount || ''}
                        onChange={(e) => setPartyData({ ...partyData, guestCount: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="pl-10 text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200"
                        min="1"
                        max="100"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Including adults and children</p>
                  </div>
                </div>

                {/* Second row of inputs - Venue and Duration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Venue Type Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <Home className="h-4 w-4 text-indigo-600" />
                      Venue Type
                    </Label>
                    <Select value={partyData.venue || 'mixed'} onValueChange={(value: 'indoor' | 'outdoor' | 'mixed') => setPartyData({ ...partyData, venue: value })}>
                      <SelectTrigger className="text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                        <SelectValue placeholder="Select venue type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-indigo-600" />
                            <span>Indoor (House, Hall, etc.)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="outdoor">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" />
                            <span>Outdoor (Park, Garden, etc.)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="mixed">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-purple-600" />
                            <span>Mixed (Indoor + Outdoor)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Helps us suggest appropriate activities</p>
                  </div>

                  {/* Duration Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2 dark:text-gray-200">
                      <Clock className="h-4 w-4 text-orange-600" />
                      Party Duration
                    </Label>
                    <Select value={partyData.duration || '2-3 hours'} onValueChange={(value: string) => setPartyData({ ...partyData, duration: value })}>
                      <SelectTrigger className="text-lg h-12 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200">
                        <SelectValue placeholder="Select party duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-2 hours">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span>1-2 hours (Short & Sweet)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="2-3 hours">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span>2-3 hours (Standard)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="3-4 hours">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span>3-4 hours (Extended Fun)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="4+ hours">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span>4+ hours (All Day Event)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Determines activity planning and timing</p>
                  </div>
                </div>

                {/* Streamlined Visual Summary Preview */}
                <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-yellow-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-yellow-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700">
                  <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-4 text-lg text-center">Party Planning Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-2xl mb-2">💰</div>
                      <div className="font-semibold text-green-600">Budget</div>
                      <div className="text-lg">
                        {partyData.budget && partyData.currency ? 
                          `${currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$'}${partyData.budget}` : 
                          'Not set'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {partyData.currency ? currencyOptions.find(c => c.code === partyData.currency)?.name : 'Select currency'}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-2xl mb-2">📍</div>
                      <div className="font-semibold text-blue-600">Location</div>
                      <div className="text-lg flex items-center justify-center gap-2">
                        {partyData.country && partyData.zipCode ? 
                          <>
                            <span>{countryOptions.find(c => c.code === partyData.country)?.flag}</span>
                            <span className="text-sm">{partyData.zipCode}</span>
                          </> : 
                          'Not set'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {partyData.country ? countryOptions.find(c => c.code === partyData.country)?.name : 'Auto-detected'}
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <div className="text-2xl mb-2">👥</div>
                      <div className="font-semibold text-purple-600">Guests</div>
                      <div className="text-lg">{partyData.guestCount || 'Not set'}</div>
                      <div className="text-xs text-gray-500 mt-1">Expected attendees</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Create Party Plan */}
            {step === 3 && !submitError && (
              <div className="space-y-8">
                {/* Updated Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Card 1: Birthday Star */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/30 p-6 rounded-xl border border-yellow-200 dark:border-yellow-700 shadow-lg transform hover:scale-105 transition-all duration-300 text-center">
                    <div className="text-5xl mb-4">⭐</div>
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 text-lg">Birthday Star</h3>
                    <div className="text-yellow-700 dark:text-yellow-300 font-semibold text-lg">{partyData.childName || 'Not set'}</div>
                    <div className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">
                      <span className="bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded-full">
                        {partyData.childAge || 0} years old 🎂
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Location */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/30 p-6 rounded-xl border border-blue-200 dark:border-blue-700 shadow-lg transform hover:scale-105 transition-all duration-300 text-center">
                    <div className="text-5xl mb-4">{partyData.country ? countryOptions.find(c => c.code === partyData.country)?.flag || '🏴' : '🏴'}</div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 text-lg">Location</h3>
                    <div className="text-blue-700 dark:text-blue-300 font-semibold text-lg">
                      {partyData.zipCode || 'Not set'}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 text-sm mt-2">
                      <span className="bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">Zip code 📍</span>
                    </div>
                  </div>

                  {/* Card 3: Guest Count */}
                  <div className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/30 p-6 rounded-xl border border-purple-200 dark:border-purple-700 shadow-lg transform hover:scale-105 transition-all duration-300 text-center">
                    <div className="text-5xl mb-4">👥</div>
                    <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-2 text-lg">Guests</h3>
                    <div className="text-purple-700 dark:text-purple-300 font-semibold text-lg">
                      {partyData.guestCount ? `${partyData.guestCount} people` : 'Not set'}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400 text-sm mt-2">
                      <span className="bg-purple-200 dark:bg-purple-800 px-2 py-1 rounded-full">Party crowd 🎉</span>
                    </div>
                  </div>

                  {/* Card 4: Party Date */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 p-6 rounded-xl border border-blue-200 dark:border-blue-700 shadow-lg transform hover:scale-105 transition-all duration-300 text-center">
                    <div className="text-5xl mb-4">
                      {partyData.partyDate ? (
                        <div className="relative inline-block">
                          <span className="text-4xl">📅</span>
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-800 bg-white rounded px-1">
                            {partyData.partyDate.getDate()}
                          </div>
                        </div>
                      ) : '📅'}
                    </div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2 text-lg">Party Date</h3>
                    <div className="text-blue-700 dark:text-blue-300 font-semibold text-lg">
                      {partyData.partyDate?.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 text-sm mt-2">
                      <span className="bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded-full">Save the date! 📝</span>
                    </div>
                  </div>

                  {/* Card 5: Budget */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/30 p-6 rounded-xl border border-green-200 dark:border-green-700 shadow-lg transform hover:scale-105 transition-all duration-300 text-center">
                    <div className="text-5xl mb-4">💰</div>
                    <h3 className="font-bold text-green-800 dark:text-green-200 mb-2 text-lg">Budget</h3>
                    <div className="text-green-700 dark:text-green-300 font-semibold text-lg">
                      {partyData.budget ? `${currencyOptions.find(c => c.code === partyData.currency)?.symbol || '$'}${partyData.budget}` : 'Not set'}
                    </div>
                    <div className="text-green-600 dark:text-green-400 text-sm mt-2">
                      <span className="bg-green-200 dark:bg-green-800 px-2 py-1 rounded-full">Party fund 💵</span>
                    </div>
                  </div>

                </div>

                {/* What's Included Preview */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-900/30 p-8 rounded-xl border border-amber-200 dark:border-amber-700 shadow-lg mb-8 max-w-5xl mx-auto">
                  <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-6 text-xl text-center">🎁 What's Included in Your Party Plan</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-amber-700 dark:text-amber-300">
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">📋</span>
                      <span className="text-sm font-medium text-center">Smart Checklists</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">🎨</span>
                      <span className="text-sm font-medium text-center">Decorations Guide</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">🎮</span>
                      <span className="text-sm font-medium text-center">Fun Activities</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">👥</span>
                      <span className="text-sm font-medium text-center">Guest Management</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">📧</span>
                      <span className="text-sm font-medium text-center">Invitations</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">⏰</span>
                      <span className="text-sm font-medium text-center">Timeline Tracker</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">🍰</span>
                      <span className="text-sm font-medium text-center">Food Ideas</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
                      <span className="text-2xl">✨</span>
                      <span className="text-sm font-medium text-center">Much More!</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-6 rounded-xl border border-purple-300 dark:border-purple-600 max-w-3xl mx-auto">
                  <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                    🎉 Everything is perfectly planned for <span className="font-bold text-purple-600 dark:text-purple-400 text-xl">{partyData.childName}'s</span> magical birthday celebration! 
                    <br />
                    <span className="text-purple-700 dark:text-purple-300 font-medium">Let's create your comprehensive party plan and make this birthday unforgettable! You can choose a theme later in the Themes tab! 🌟</span>
                  </p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Save Your Party Plan"
        description="Sign in to save your party plan, access AI-powered recommendations, and keep your celebrations safe and organized."
      />
    </div>
  );
}