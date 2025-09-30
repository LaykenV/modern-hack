"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
      <div className="text-xs text-muted-foreground bg-surface-muted/50 rounded-lg p-3 border border-border/40">
        <p className="mb-1">
          <strong>Guardrails</strong> help ensure your AI assistant stays on-brand and follows your business rules.
        </p>
        <p className="text-muted-foreground/80">
          Examples: &quot;Never discuss competitor pricing&quot;, &quot;Always mention our 30-day guarantee&quot;, &quot;Redirect technical questions to support&quot;
        </p>
      </div>

      <div>
        <Label className="input-label">Add Guardrail</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="input-field flex-1"
            placeholder="Add a business rule or guideline..."
            maxLength={200}
          />
          <button
            onClick={handleAddGuardrail}
            disabled={!inputValue.trim()}
            className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {guardrails.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {guardrails.map((guardrail, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 bg-surface-muted border border-border rounded-full px-3 py-1.5 text-sm"
              >
                <span className="text-foreground max-w-xs truncate" title={guardrail}>
                  {guardrail}
                </span>
                <button
                  onClick={() => handleRemoveGuardrail(guardrail)}
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 transition-all cursor-pointer"
                  aria-label={`Remove guardrail: ${guardrail}`}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'hsl(var(--destructive))' }}>
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {guardrails.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No guardrails added yet. Add some rules to guide your AI assistant&apos;s behavior.
        </div>
      )}
    </div>
  );
}
