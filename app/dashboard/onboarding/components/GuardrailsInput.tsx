"use client";

import { useState } from "react";

interface GuardrailsInputProps {
  guardrails: string[];
  onGuardrailsChange: (guardrails: string[]) => void;
}

export function GuardrailsInput({ guardrails, onGuardrailsChange }: GuardrailsInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddGuardrail = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;
    
    // Avoid duplicates
    if (guardrails.includes(trimmedValue)) {
      setInputValue("");
      return;
    }
    
    onGuardrailsChange([...guardrails, trimmedValue]);
    setInputValue("");
  };

  const handleRemoveGuardrail = (guardrailToRemove: string) => {
    onGuardrailsChange(guardrails.filter(g => g !== guardrailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddGuardrail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Guardrails
        </h3>
        <span className="text-xs text-slate-500">
          {guardrails.length} rule{guardrails.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-md p-3">
        <p className="mb-1">
          <strong>Guardrails</strong> help ensure your AI assistant stays on-brand and follows your business rules.
        </p>
        <p className="text-slate-500">
          Examples: &quot;Never discuss competitor pricing&quot;, &quot;Always mention our 30-day guarantee&quot;, &quot;Redirect technical questions to support&quot;
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Add a business rule or guideline..."
          maxLength={200}
        />
        <button
          onClick={handleAddGuardrail}
          disabled={!inputValue.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {guardrails.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {guardrails.map((guardrail, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-300 max-w-xs truncate" title={guardrail}>
                  {guardrail}
                </span>
                <button
                  onClick={() => handleRemoveGuardrail(guardrail)}
                  className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label={`Remove guardrail: ${guardrail}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {guardrails.length === 0 && (
        <div className="text-center py-4 text-slate-500 text-sm">
          No guardrails added yet. Add some rules to guide your AI assistant&apos;s behavior.
        </div>
      )}
    </div>
  );
}
