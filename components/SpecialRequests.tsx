"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

const TAGS = [
  "Outdoor games",
  "Photo booth", 
  "Face painting",
  "Live music",
  "Magician",
  "DIY crafts",
  "Bouncy castle",
  "Cupcake station"
];

export default function SpecialRequests() {
  const [activeTab, setActiveTab] = useState("quick");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [textInput, setTextInput] = useState("");
  
  // Refs for direct DOM access and typing protection
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ultra-stable event handlers with zero dependencies
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    isTypingRef.current = true;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Update state immediately 
    setTextInput(value);
    
    // Set typing protection timeout
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 2000);
  }, []);

  const handleTextFocus = useCallback(() => {
    isTypingRef.current = true;
  }, []);

  const handleTextBlur = useCallback(() => {
    // Delay clearing typing state to prevent immediate re-renders
    setTimeout(() => {
      isTypingRef.current = false;
    }, 100);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    // Don't update if user is typing
    if (isTypingRef.current) return;
    
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleTabSwitch = useCallback((tab: string) => {
    // Don't switch tabs if user is actively typing
    if (isTypingRef.current) return;
    
    setActiveTab(tab);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto border rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">
        Special Requests & Preferences
      </h2>

      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button
          className={`flex-1 py-2 transition-colors ${
            activeTab === "quick" ? "border-b-2 border-blue-500 font-medium text-blue-600" : "text-gray-600 hover:text-gray-800"
          }`}
          onClick={() => handleTabSwitch("quick")}
          type="button"
        >
          Quick Select
        </button>
        <button
          className={`flex-1 py-2 transition-colors ${
            activeTab === "text" ? "border-b-2 border-blue-500 font-medium text-blue-600" : "text-gray-600 hover:text-gray-800"
          }`}
          onClick={() => handleTabSwitch("text")}
          type="button"
        >
          Text Input
        </button>
      </div>

      {/* Quick Select */}
      {activeTab === "quick" && (
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              type="button"
              className={`px-3 py-1 rounded-full border text-sm transition-all duration-200 ${
                selectedTags.includes(tag)
                  ? "bg-blue-500 text-white border-blue-500 shadow-md"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Text Input */}
      {activeTab === "text" && (
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            placeholder="Type any special requests here..."
            value={textInput}
            onChange={handleTextChange}
            onFocus={handleTextFocus}
            onBlur={handleTextBlur}
            autoComplete="off"
            spellCheck="true"
            data-testid="special-requests-textarea"
            style={{ minHeight: '100px' }}
          />
        </div>
      )}

      {/* Saved State Display */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
        <div className="mb-2">
          <span className="font-medium text-gray-700">Selected tags:</span>{" "}
          <span className="text-gray-600">
            {selectedTags.length > 0 ? selectedTags.join(", ") : "None"}
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-700">Text input:</span>{" "}
          <span className="text-gray-600">
            {textInput.trim() ? `"${textInput}"` : "None"}
          </span>
        </div>
      </div>
    </div>
  );
}