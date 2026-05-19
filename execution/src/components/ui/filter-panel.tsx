"use client"

import { useState } from "react"
import { Filter, Plus, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldType = "text" | "enum" | "numeric"

export type Operator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in"

export type MatchMode = "all" | "any"

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
}

export interface FilterCondition {
  id: string
  field: string
  operator: Operator
  value: string | string[]
}

// ── Operator definitions ──────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<Operator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  gt: "greater than",
  gte: "≥",
  lt: "less than",
  lte: "≤",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "is any of",
  not_in: "is none of",
}

const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ["is", "is_not", "contains", "not_contains", "is_empty", "is_not_empty"],
  enum: ["is", "is_not", "in", "not_in", "is_empty", "is_not_empty"],
  numeric: ["is", "is_not", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
}

// Operators that use multi-select value (string[])
const MULTI_VALUE_OPERATORS: Operator[] = ["in", "not_in"]

// ── Pure helper ───────────────────────────────────────────────────────────────

export function applyConditions<T extends Record<string, unknown>>(
  record: T,
  conditions: FilterCondition[],
  matchMode: MatchMode,
  getValue?: (record: T, fieldKey: string) => unknown
): boolean {
  if (conditions.length === 0) return true

  const defaultGetter = (r: T, key: string): unknown => r[key]
  const get = getValue ?? defaultGetter

  function evalCondition(cond: FilterCondition): boolean {
    const fieldVal = get(record, cond.field)
    const { operator, value } = cond

    const noValueOps: Operator[] = ["is_empty", "is_not_empty"]

    // Incomplete condition — no value entered yet, don't filter
    if (!noValueOps.includes(operator)) {
      if (Array.isArray(value)) {
        if (value.length === 0) return true
      } else {
        if (value.trim() === "") return true
      }
    }

    if (operator === "is_empty") {
      return fieldVal === null || fieldVal === undefined || fieldVal === ""
    }

    if (operator === "is_not_empty") {
      return fieldVal !== null && fieldVal !== undefined && fieldVal !== ""
    }

    if (operator === "in") {
      if (!Array.isArray(value) || value.length === 0) return true
      return value.includes(String(fieldVal ?? ""))
    }

    if (operator === "not_in") {
      if (!Array.isArray(value) || value.length === 0) return true
      return !value.includes(String(fieldVal ?? ""))
    }

    // From here value is string
    const strValue = Array.isArray(value) ? value[0] ?? "" : value

    if (operator === "contains") {
      return String(fieldVal ?? "")
        .toLowerCase()
        .includes(strValue.toLowerCase())
    }

    if (operator === "not_contains") {
      return !String(fieldVal ?? "")
        .toLowerCase()
        .includes(strValue.toLowerCase())
    }

    if (operator === "is") {
      const fieldNum = Number(fieldVal)
      const condNum = parseFloat(strValue)
      if (!isNaN(fieldNum) && !isNaN(condNum) && typeof fieldVal === "number") {
        return fieldNum === condNum
      }
      return String(fieldVal ?? "").toLowerCase() === strValue.toLowerCase()
    }

    if (operator === "is_not") {
      const fieldNum = Number(fieldVal)
      const condNum = parseFloat(strValue)
      if (!isNaN(fieldNum) && !isNaN(condNum) && typeof fieldVal === "number") {
        return fieldNum !== condNum
      }
      return String(fieldVal ?? "").toLowerCase() !== strValue.toLowerCase()
    }

    // Numeric comparisons
    const numVal = Number(fieldVal)
    const numCond = parseFloat(strValue)
    if (isNaN(numVal) || isNaN(numCond)) return false

    if (operator === "gt") return numVal > numCond
    if (operator === "gte") return numVal >= numCond
    if (operator === "lt") return numVal < numCond
    if (operator === "lte") return numVal <= numCond

    return false
  }

  if (matchMode === "all") {
    return conditions.every(evalCondition)
  }
  return conditions.some(evalCondition)
}

// ── FilterRow ─────────────────────────────────────────────────────────────────

interface FilterRowProps {
  condition: FilterCondition
  fields: FieldConfig[]
  onChange: (updated: FilterCondition) => void
  onRemove: () => void
}

function FilterRow({ condition, fields, onChange, onRemove }: FilterRowProps) {
  const currentField = fields.find((f) => f.key === condition.field) ?? fields[0]
  const availableOperators = OPERATORS_BY_TYPE[currentField.type]
  const noValueNeeded =
    condition.operator === "is_empty" || condition.operator === "is_not_empty"
  const isMultiValue = MULTI_VALUE_OPERATORS.includes(condition.operator)

  function handleFieldChange(fieldKey: string) {
    const newField = fields.find((f) => f.key === fieldKey) ?? fields[0]
    const firstOp = OPERATORS_BY_TYPE[newField.type][0]
    onChange({ ...condition, field: fieldKey, operator: firstOp, value: "" })
  }

  function handleOperatorChange(op: string) {
    const newOp = op as Operator
    // Reset value to appropriate empty type
    const resetValue = MULTI_VALUE_OPERATORS.includes(newOp) ? [] : ""
    onChange({ ...condition, operator: newOp, value: resetValue })
  }

  function handleValueChange(value: string) {
    onChange({ ...condition, value })
  }

  function handleMultiValueToggle(optionValue: string) {
    const current = Array.isArray(condition.value) ? condition.value : []
    const next = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue]
    onChange({ ...condition, value: next })
  }

  // Derived: single string value for non-multi operators
  const strValue = Array.isArray(condition.value)
    ? ""
    : condition.value

  // Derived: array value for multi operators
  const arrValue = Array.isArray(condition.value) ? condition.value : []

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {/* Field select */}
      <Select value={condition.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-8 w-[160px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator select */}
      <Select value={condition.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-8 w-[160px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableOperators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      <div className="flex-1">
        {noValueNeeded ? (
          <span className="text-xs text-neutral-400 italic">
            no value needed
          </span>
        ) : isMultiValue && currentField.options ? (
          // Multi-select: checkbox list inside a popover-style container
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-8 w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm transition-colors hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-accent-500",
                  arrValue.length === 0 && "text-neutral-400"
                )}
              >
                {arrValue.length === 0
                  ? "Select values..."
                  : arrValue.length === 1
                    ? (currentField.options.find((o) => o.value === arrValue[0])?.label ?? arrValue[0])
                    : `${arrValue.length} selected`}
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0 ml-1" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1.5">
              {currentField.options.map((opt) => {
                const checked = arrValue.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleMultiValueToggle(opt.value)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-100 transition-colors text-left"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-accent-600 bg-accent-600 text-white"
                          : "border-neutral-300 bg-white"
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                          className="block"
                        >
                          <path
                            d="M1 4l2.5 2.5L9 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        ) : currentField.type === "enum" &&
          (condition.operator === "is" || condition.operator === "is_not") &&
          currentField.options ? (
          <Select value={strValue} onValueChange={handleValueChange}>
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue placeholder="Select value..." />
            </SelectTrigger>
            <SelectContent>
              {currentField.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : currentField.type === "numeric" ? (
          <Input
            type="number"
            className="h-8 text-sm"
            value={strValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter number..."
          />
        ) : (
          <Input
            type="text"
            className="h-8 text-sm"
            value={strValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter value..."
          />
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-neutral-400 hover:text-neutral-600 shrink-0"
        onClick={onRemove}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Remove condition</span>
      </Button>
    </div>
  )
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

interface FilterPanelProps {
  fields: FieldConfig[]
  conditions: FilterCondition[]
  matchMode: MatchMode
  onChange: (conditions: FilterCondition[], matchMode: MatchMode) => void
  className?: string
}

export function FilterPanel({
  fields,
  conditions,
  matchMode,
  onChange,
  className,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false)

  function addCondition() {
    const firstField = fields[0]
    if (!firstField) return
    const firstOp = OPERATORS_BY_TYPE[firstField.type][0]
    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: firstField.key,
      operator: firstOp,
      value: "",
    }
    onChange([...conditions, newCondition], matchMode)
  }

  function updateCondition(id: string, updated: FilterCondition) {
    onChange(
      conditions.map((c) => (c.id === id ? updated : c)),
      matchMode
    )
  }

  function removeCondition(id: string) {
    onChange(
      conditions.filter((c) => c.id !== id),
      matchMode
    )
  }

  function clearAll() {
    onChange([], matchMode)
  }

  function handleMatchModeChange(value: string) {
    onChange(conditions, value as MatchMode)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", className)}
          type="button"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {conditions.length > 0 && (
            <Badge className="bg-neutral-900 text-white text-xs h-4 px-1 rounded-sm border-0 min-w-4 inline-flex items-center justify-center ml-0.5">
              {conditions.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[560px] p-0 shadow-lg"
        align="start"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
          <span className="text-xs text-neutral-500">Filter records</span>
          <span className="text-xs text-neutral-500">meeting</span>
          <Select value={matchMode} onValueChange={handleMatchModeChange}>
            <SelectTrigger className="h-6 w-16 text-xs px-2 py-0 border-neutral-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="any">any</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-neutral-500">of the conditions</span>
        </div>

        {/* Condition rows */}
        {conditions.length > 0 ? (
          <div className="max-h-[280px] overflow-y-auto py-1">
            {conditions.map((cond) => (
              <FilterRow
                key={cond.id}
                condition={cond}
                fields={fields}
                onChange={(updated) => updateCondition(cond.id, updated)}
                onRemove={() => removeCondition(cond.id)}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-neutral-400">No conditions added yet.</p>
            <p className="text-xs text-neutral-400 mt-1">
              Click &ldquo;+ Add Condition&rdquo; to filter records.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
          <button
            type="button"
            className="text-sm text-neutral-600 hover:text-neutral-800 flex items-center gap-1.5 px-1 py-1 transition-colors"
            onClick={addCondition}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Condition
          </button>

          {conditions.length > 0 && (
            <button
              type="button"
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
              onClick={clearAll}
            >
              Clear all
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
