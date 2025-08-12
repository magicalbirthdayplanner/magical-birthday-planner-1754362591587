"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Target,
  Mic,
  Settings,
  BookOpen,
  CheckCircle2,
  X,
  Play
} from "lucide-react";

interface AlternativeInputProps {
  onRequestsChange: (requests: string) => void;
  initialValue?: string;
}

export default function AlternativeInput({ onRequestsChange, initialValue = '' }: AlternativeInputProps) {
  const [inputMethod, setInputMethod] = useState<'quickselect' | 'voice' | 'builder' | 'text'>('quickselect');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [preferences, setPreferences] = useState<{[key: string]: string}>({});
  const [customRequests, setCustomRequests] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // Quick select options
  const quickSelectOptions = {
    'Activity Style': ['Outdoor games', 'Indoor activities', 'Arts & crafts', 'Educational activities', 'Physical activities', 'Quiet activities'],
    'Preferences': ['No messy activities', 'Easy cleanup', 'Minimal prep time', 'Budget-friendly', 'High energy', 'Low energy'],
    'Restrictions': ['No food activities', 'Allergy considerations', 'Safe for young kids', 'Wheelchair accessible', 'Sensory-friendly'],
    'Interests': ['Sports', 'Science', 'Art', 'Music', 'Animals', 'Technology', 'Reading', 'Building'],
    'Special Needs': ['ADHD-friendly', 'Autism-friendly', 'Large group activities', 'Small group activities', 'Solo activities']
  };

  // Update custom requests from tags and preferences
  const updateCustomRequests = useCallback((tags: Set<string>, prefs: {[key: string]: string}) => {
    const parts: string[] = [];
    if (tags.size > 0) {
      parts.push(Array.from(tags).join(', '));
    }
    Object.entries(prefs).forEach(([key, value]) => {
      if (value.trim()) {
        parts.push(`${key}: ${value}`);
      }
    });
    const result = parts.join('. ');
    setCustomRequests(result);
    onRequestsChange(result);
  }, [onRequestsChange]);

  // Handle tag selection
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const newTags = new Set(prev);
      if (newTags.has(tag)) {
        newTags.delete(tag);
      } else {
        newTags.add(tag);
      }
      updateCustomRequests(newTags, preferences);
      return newTags;
    });
  }, [preferences, updateCustomRequests]);

  // Handle preference builder
  const updatePreference = useCallback((key: string, value: string) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, [key]: value };
      updateCustomRequests(selectedTags, newPrefs);
      return newPrefs;
    });
  }, [selectedTags, updateCustomRequests]);

  // Voice recording functions
  const startVoiceRecording = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsRecording(true);
        setError(null);
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
          const newValue = (customRequests + ' ' + finalTranscript).trim();
          setCustomRequests(newValue);
          onRequestsChange(newValue);
        }
      };
      
      recognition.onerror = () => {
        setError('Voice recognition error. Please try again.');
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.start();
    } else {
      setError('Voice recognition not supported in this browser');
    }
  }, [customRequests, onRequestsChange]);

  const stopVoiceRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  // Handle text input
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomRequests(value);
    onRequestsChange(value);
  }, [onRequestsChange]);

  return (
    <div className="space-y-4">
      <Label className="text-lg font-semibold">Special Requests & Preferences</Label>
      
      {/* Input Method Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Button
          variant={inputMethod === 'quickselect' ? 'default' : 'outline'}
          onClick={() => setInputMethod('quickselect')}
          className="h-auto p-3 flex flex-col items-center gap-2"
        >
          <Target className="h-5 w-5" />
          <span className="text-xs">Quick Select</span>
        </Button>
        <Button
          variant={inputMethod === 'voice' ? 'default' : 'outline'}
          onClick={() => setInputMethod('voice')}
          className="h-auto p-3 flex flex-col items-center gap-2"
        >
          <Mic className="h-5 w-5" />
          <span className="text-xs">Voice Input</span>
        </Button>
        <Button
          variant={inputMethod === 'builder' ? 'default' : 'outline'}
          onClick={() => setInputMethod('builder')}
          className="h-auto p-3 flex flex-col items-center gap-2"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Builder</span>
        </Button>
        <Button
          variant={inputMethod === 'text' ? 'default' : 'outline'}
          onClick={() => setInputMethod('text')}
          className="h-auto p-3 flex flex-col items-center gap-2"
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-xs">Text Input</span>
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick Select Interface */}
      {inputMethod === 'quickselect' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select tags that describe your preferences for the party activities:
          </p>
          {Object.entries(quickSelectOptions).map(([category, options]) => (
            <div key={category} className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">{category}:</h4>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <Button
                    key={option}
                    variant={selectedTags.has(option) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleTag(option)}
                    className={`text-xs h-8 ${
                      selectedTags.has(option) 
                        ? 'bg-purple-600 text-white hover:bg-purple-700' 
                        : 'hover:bg-purple-50 border-purple-200'
                    }`}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {selectedTags.size > 0 && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <h4 className="font-medium text-sm mb-2">Selected Preferences:</h4>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedTags).map((tag) => (
                  <Badge key={tag} className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-purple-200"
                      onClick={() => toggleTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Input Interface */}
      {inputMethod === 'voice' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Speak your preferences and requirements for the party activities:
          </p>
          <div className="flex flex-col items-center space-y-4 p-6 border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-lg">
            {isRecording ? (
              <>
                <div className="relative">
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 border-4 border-red-300 rounded-full animate-ping"></div>
                </div>
                <p className="text-lg font-medium text-red-600">Recording... Speak now!</p>
                <Button
                  onClick={stopVoiceRecording}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Stop Recording
                </Button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center">
                  <Mic className="h-8 w-8 text-white" />
                </div>
                <p className="text-lg font-medium">Ready to record</p>
                <Button
                  onClick={startVoiceRecording}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  Start Voice Recording
                </Button>
              </>
            )}
          </div>
          {transcript && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-medium text-sm mb-2">Voice Transcript:</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{transcript}</p>
            </div>
          )}
        </div>
      )}

      {/* Preference Builder Interface */}
      {inputMethod === 'builder' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Build your preferences step by step:
          </p>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Activity Energy Level</Label>
              <Select onValueChange={(value) => updatePreference('Energy Level', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select energy level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High Energy (running, jumping, active games)</SelectItem>
                  <SelectItem value="medium">Medium Energy (mixed active and calm activities)</SelectItem>
                  <SelectItem value="low">Low Energy (crafts, quiet games, reading)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mess Level Tolerance</Label>
              <Select onValueChange={(value) => updatePreference('Mess Level', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mess tolerance..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-mess">No Mess (clean activities only)</SelectItem>
                  <SelectItem value="minimal">Minimal Mess (easy cleanup)</SelectItem>
                  <SelectItem value="moderate">Moderate Mess (some cleanup required)</SelectItem>
                  <SelectItem value="messy">Messy Fun (anything goes!)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Setup Time Preference</Label>
              <Select onValueChange={(value) => updatePreference('Setup Time', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select setup time..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant (no setup required)</SelectItem>
                  <SelectItem value="quick">Quick Setup (5-10 minutes)</SelectItem>
                  <SelectItem value="moderate">Moderate Setup (15-30 minutes)</SelectItem>
                  <SelectItem value="elaborate">Elaborate Setup (30+ minutes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Special Requirements</Label>
              <Input
                placeholder="e.g., allergies, accessibility needs, specific interests..."
                onChange={(e) => updatePreference('Special Requirements', e.target.value)}
              />
            </div>
          </div>
          
          {Object.keys(preferences).length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="font-medium text-sm mb-2">Your Preferences:</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(preferences).map(([key, value]) => (
                  value && <p key={key} className="text-gray-700 dark:text-gray-300"><strong>{key}:</strong> {value}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Traditional Text Input */}
      {inputMethod === 'text' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Type your preferences and requirements:
          </p>
          <Textarea
            id="customRequests"
            name="customRequests"
            placeholder="Tell us what you'd like! For example: outdoor games, no messy crafts, educational activities, specific interests, allergies to consider, or any other special requirements..."
            value={customRequests}
            onChange={handleTextChange}
            rows={4}
            className="resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            autoComplete="off"
            spellCheck="true"
          />
        </div>
      )}

      {/* Final Summary */}
      {customRequests && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Your Preferences Summary:
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{customRequests}</p>
        </div>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        The more details you provide, the better our AI can customize activities for your party!
      </p>
    </div>
  );
}