"use client";

import React, { useState } from "react";

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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="max-w-lg mx-auto border rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">
        Special Requests & Preferences
      </h2>

      {/* Tabs */}
      <div className="flex mb-4 border-b">
        <button
          className={`flex-1 py-2 ${
            activeTab === "quick" ? "border-b-2 border-blue-500 font-medium" : ""
          }`}
          onClick={() => setActiveTab("quick")}
        >
          Quick Select
        </button>
        <button
          className={`flex-1 py-2 ${
            activeTab === "text" ? "border-b-2 border-blue-500 font-medium" : ""
          }`}
          onClick={() => setActiveTab("text")}
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
              className={`px-3 py-1 rounded-full border text-sm ${
                selectedTags.includes(tag)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Text Input */}
      {activeTab === "text" && (
        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          rows={4}
          placeholder="Type any special requests here..."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
        />
      )}

      {/* Debug / Saved State */}
      <div className="mt-4 text-sm text-gray-600">
        <strong>Selected tags:</strong> {selectedTags.join(", ") || "None"}
        <br />
        <strong>Text input:</strong> {textInput || "None"}
      </div>
    </div>
  );
}