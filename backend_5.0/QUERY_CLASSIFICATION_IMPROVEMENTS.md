# Query Classification Improvements

## Problem Solved
The query classification system was not intelligently distinguishing between:
1. **Data Queries** - Questions asking for specific metrics/measurements from the database
2. **Conceptual Queries** - Questions asking for definitions, explanations, or concepts

This caused data queries like "What is the average salinity at depth 100m in 2023?" to be incorrectly classified as conceptual and sent to the LLM instead of being routed to the SQL pipeline via RAG.

## Solution Implemented

### Enhanced Classification Algorithm

The new `classifyQuestion()` function now uses a **multi-pattern matching system** with priorities:

#### Pattern 1: Measurement Patterns (Highest Priority)
Detects explicit measurement requests:
- `What is the (average|mean|maximum|minimum|...)`
- `How (much|many|deep|warm|salty|...)`
- Measurement units with specific values

Examples:
- ✅ "What is the average salinity at depth 100m in 2023?" → **DATA_QUERY**
- ✅ "What is the maximum temperature between 50m and 150m?" → **DATA_QUERY**

#### Pattern 2: Specificity Patterns
Detects requests for specific data points:
- `at depth XXm`
- `in YYYY` (year like 2023)
- `during [month]`
- `from X to Y`
- `for [float/profile/station]`

Examples:
- ✅ "How many profiles were collected in 2023?" → **DATA_QUERY**
- ✅ "Temperature at depth 100m" → **DATA_QUERY**

#### Pattern 3: Data Keywords
Detects domain-specific data terms:
- `profile`, `depth`, `pressure`, `temperature`, `salinity`
- `doxy`, `chla`, `nitrate`, `ph`
- `year`, `2023`, `2024`
- `trend`, `anomaly`, `correlation`

#### Pattern 4: Conceptual Patterns (if data patterns don't match)
Detects definition/explanation requests:
- `What is/are [definition]`
- `Explain`, `Describe`
- `How does X work?`
- `Why does X happen?`
- `Difference/Comparison`
- `Background/Concept/Theory`

Examples:
- ✅ "What is an argofloat?" → **CONCEPTUAL**
- ✅ "Explain how Argo floats measure ocean parameters" → **CONCEPTUAL**
- ✅ "What are the differences between salinity and conductivity?" → **CONCEPTUAL**

### Routing Logic

```
User Question
    ↓
classifyQuestion() → "data_query" or "conceptual"
    ├─→ data_query
    │   ├─→ callRagService() → Generate SQL
    │   ├─→ sqlService.execute() → Run SQL against PostgreSQL
    │   └─→ Return results with raw_rows
    │
    └─→ conceptual
        ├─→ llmService.callLlm() → Generate answer
        └─→ Return answer directly
```

## Testing Results

### Test Case 1: Data Query
```
Question: "What is the average salinity at depth 100m in 2023?"
Expected: data_query
Result: ✅ PASS (Classified as: data_query)
Reason: Matches measurement pattern + specific depth + specific year
```

### Test Case 2: Conceptual Query
```
Question: "What is an argofloat and how is it different from satellite observations?"
Expected: conceptual
Result: ✅ PASS (Classified as: conceptual)
Reason: Matches definition pattern + comparison pattern
```

### Test Case 3: Data Query with Range
```
Question: "What is the maximum temperature between 50m and 150m depth?"
Expected: data_query
Result: ✅ PASS (Classified as: data_query)
Reason: Matches measurement pattern + range pattern + measurement unit
```

### Test Case 4: Conceptual Query with Explanation
```
Question: "Explain how Argo floats measure ocean parameters"
Expected: conceptual
Result: ✅ PASS (Classified as: conceptual)
Reason: Matches conceptual pattern + method explanation
```

## Key Improvements

1. **Regex-based Pattern Matching** - Uses regular expressions for more flexible matching
2. **Priority-based Classification** - Measurement patterns take precedence
3. **Fallback Logic** - Sophisticated fallback for edge cases
4. **Logging** - Each classification decision is logged for debugging
5. **Context-aware** - Considers the full context, not just individual keywords

## Files Modified

- `services/queryOrchestrator.js` - Enhanced `classifyQuestion()` function

## Future Enhancements

1. **ML-based Classification** - Use a trained classifier for higher accuracy
2. **User Feedback** - Allow users to correct classifications
3. **Dynamic Learning** - Learn from user corrections over time
4. **Multi-turn Context** - Consider conversation history for classification
5. **Confidence Scores** - Return confidence level with classification
