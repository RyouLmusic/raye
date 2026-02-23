# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Ask User Tool Detection with Rate Limit Error
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: `ask_user` tool call + 429 error + `finishReason="other"` + `lastMessage.role="tool"`
  - Test that `makeDecision` returns `"continue"` on unfixed code when `ask_user` tool call exists with 429 error (from Fault Condition in design)
  - Test implementation details:
    - Create message history with `ask_user` tool call followed by tool error message
    - Set `finishReason` to `"other"`, `"error"`, or `undefined`
    - Set `lastMessage.role` to `"tool"`
    - Verify `makeDecision` returns `"continue"` (bug behavior)
  - The test assertions should match the Expected Behavior Properties from design: `makeDecision` SHOULD return `"stop"` for any `ask_user` tool call
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Test cases to include:
    1. Ask User + 429 Error: `ask_user` call → 429 error → `finishReason="other"` → verify returns `"continue"` (bug)
    2. Ask User + Other FinishReason: `ask_user` call → `finishReason="other"` but no error → verify behavior
    3. Multiple Ask User Calls: Multiple `ask_user` calls in history → verify detection
    4. Ask User in Middle of History: `ask_user` not in last message → verify detection
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Ask-User Tool Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (no `ask_user` tool calls)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    1. Other Tools Retry Preservation: `read_file` + 429 error → observe retry behavior → test preserves it
    2. Normal FinishReason Preservation: `finishReason="stop"` or `"tool-calls"` → observe decision → test preserves it
    3. Finish Task Preservation: `finish_task` tool call → observe detection → test preserves it
    4. Message Structure Fallback Preservation: P2 fallback logic for non-`ask_user` → observe behavior → test preserves it
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for ask_user tool detection with rate limit errors

  - [x] 3.1 Add hasAskUserToolCall helper function
    - Create helper function in `packges/core/src/session/loop.ts`
    - Function signature: `hasAskUserToolCall(messages: Message[]): boolean`
    - Implementation: Traverse all messages, check for `role="assistant"` with `ask_user` tool calls
    - Return `true` if any `ask_user` tool call found, `false` otherwise
    - _Bug_Condition: isBugCondition(input) where existsAskUserToolCall(input.messages) AND input.finishReason IN ['other', 'error', undefined] AND lastMessage(input.messages).role === 'tool'_
    - _Expected_Behavior: makeDecision SHALL return "stop" for any ask_user tool call regardless of finishReason_
    - _Preservation: Non-ask-user tool behavior must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Add P0.5 priority check in makeDecision
    - Add new priority level P0.5 after P0 (context compression) and before P1 (finishReason)
    - Check: `if (hasAskUserToolCall(context.session.messages)) { return "stop"; }`
    - Add decision logger: `检测到 ask_user 工具调用 → stop (等待用户介入)`
    - Ensure this check runs regardless of `finishReason` value
    - _Bug_Condition: isBugCondition(input) where existsAskUserToolCall(input.messages) AND input.finishReason IN ['other', 'error', undefined]_
    - _Expected_Behavior: makeDecision SHALL return "stop" for any ask_user tool call_
    - _Preservation: P1 and P2 logic for non-ask-user cases must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Remove P1.5 ask_user check logic
    - Remove the original P1.5 phase `ask_user` check that only checked `lastMessage.role === "assistant"`
    - Keep `finish_task` check if it exists in P1.5 (or move to P0.5 alongside `ask_user`)
    - Avoid duplicate logic and confusion
    - _Bug_Condition: Original P1.5 logic failed when finishReason="other" and lastMessage.role="tool"_
    - _Expected_Behavior: P0.5 check replaces P1.5 logic with broader coverage_
    - _Preservation: Other P1.5 checks (if any) must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Ask User Tool Detection
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify `makeDecision` now returns `"stop"` for all `ask_user` tool call scenarios
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Ask-User Tool Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify:
      1. Other tools retry logic unchanged
      2. Normal finishReason handling unchanged
      3. finish_task detection unchanged
      4. P2 fallback logic unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
