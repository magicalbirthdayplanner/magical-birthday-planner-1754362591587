"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowRight, ArrowLeft, PartyPopper } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const themes = [
  { 
    id: "superhero", 
    name: "Superhero", 
    color: "bg-gradient-to-r from-red-500 to-blue-600", 
    emoji: "🦸‍♂️",
    description: "Action-packed adventure with capes and powers!"
  },
  { 
    id: "princess", 
    name: "Princess", 
    color: "bg-gradient-to-r from-pink-400 to-purple-600", 
    emoji: "👸",
    description: "Royal elegance with crowns and magical moments"
  },
  { 
    id: "dinosaur", 
    name: "Dinosaur", 
    color: "bg-gradient-to-r from-green-500 to-emerald-600", 
    emoji: "🦕",
    description: "Prehistoric adventure with roaring fun!"
  },
  { 
    id: "space", 
    name: "Space", 
    color: "bg-gradient-to-r from-purple-600 to-indigo-800", 
    emoji: "🚀",
    description: "Blast off to the stars for cosmic celebration"
  },
  { 
    id: "safari", 
    name: "Safari", 
    color: "bg-gradient-to-r from-yellow-500 to-orange-600", 
    emoji: "🦁",
    description: "Wild adventure with jungle animals"
  },
  { 
    id: "ocean", 
    name: "Ocean", 
    color: "bg-gradient-to-r from-blue-400 to-cyan-600", 
    emoji: "🐙",
    description: "Underwater exploration with sea creatures"
  },
  { 
    id: "pirate", 
    name: "Pirate", 
    color: "bg-gradient-to-r from-amber-600 to-red-700", 
    emoji: "🏴‍☠️",
    description: "Treasure hunting adventure on the high seas"
  },
  { 
    id: "unicorn", 
    name: "Unicorn", 
    color: "bg-gradient-to-r from-pink-500 to-violet-600", 
    emoji: "🦄",
    description: "Magical rainbows and sparkly dreams"
  }
];

interface PartyData {
  childName: string;
  childAge: string;
  partyDate: Date | undefined;
  selectedTheme: string;
}

export default function CreatePartyPage() {
  const [step, setStep] = useState(1);
  const [partyData, setPartyData] = useState<PartyData>({
    childName: "",
    childAge: "",
    partyDate: undefined,
    selectedTheme: ""
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // Save to localStorage for now
    localStorage.setItem('partyData', JSON.stringify(partyData));
    // Navigate to party plan page
    window.location.href = '/party-plan';
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return partyData.childName.trim() !== "" && partyData.childAge !== "";
      case 2:
        return partyData.partyDate !== undefined;
      case 3:
        return partyData.selectedTheme !== "";
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-full">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent mb-2">
            Create Your Party
          </h1>
          <p className="text-gray-600">Let's plan the perfect birthday celebration for your child!</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    step >= stepNumber
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  )}
                >
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div
                    className={cn(
                      "w-16 h-1 mx-2 transition-colors",
                      step > stepNumber ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 1 && "Tell us about your child"}
              {step === 2 && "When's the party?"}
              {step === 3 && "Choose a theme"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "We'll personalize everything based on your child's age and preferences"}
              {step === 2 && "Pick the perfect date for your celebration"}
              {step === 3 && "Select a theme that your child will absolutely love"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Child Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="childName" className="text-sm font-medium">
                    Child's Name
                  </Label>
                  <Input
                    id="childName"
                    placeholder="Enter your child's name"
                    value={partyData.childName}
                    onChange={(e) => setPartyData({ ...partyData, childName: e.target.value })}
                    className="text-lg py-6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="childAge" className="text-sm font-medium">
                    Child's Age
                  </Label>
                  <Select value={partyData.childAge} onValueChange={(value) => setPartyData({ ...partyData, childAge: value })}>
                    <SelectTrigger className="text-lg py-6">
                      <SelectValue placeholder="Select age" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i === 0 ? "Under 1 year" : `${i} year${i > 1 ? 's' : ''} old`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Party Date */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Party Date</Label>
                  <Popover>
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
                        onSelect={(date) => setPartyData({ ...partyData, partyDate: date })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Step 3: Theme Selection */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {themes.map((theme) => (
                    <Card
                      key={theme.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:scale-105",
                        partyData.selectedTheme === theme.id
                          ? "ring-2 ring-purple-500 shadow-lg"
                          : "hover:shadow-lg"
                      )}
                      onClick={() => setPartyData({ ...partyData, selectedTheme: theme.id })}
                    >
                      <CardContent className="p-0">
                        <div className={`${theme.color} h-20 rounded-t-lg flex items-center justify-center text-3xl`}>
                          {theme.emoji}
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{theme.name}</h3>
                            {partyData.selectedTheme === theme.id && (
                              <Badge className="bg-purple-100 text-purple-700">Selected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{theme.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="px-8"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8"
                >
                  Create My Party Plan
                  <PartyPopper className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}