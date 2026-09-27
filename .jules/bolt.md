## 2024-06-11 - [Destructure Custom Hook Returns for useMemo Dependencies]
**Learning:** Returning a new object literal from custom hooks (like `useGatewayProfiles`) and passing that entire object as a dependency to `useMemo` in context providers defeats memoization, causing widespread, unnecessary re-renders when the custom hook's internal state updates.
**Action:** When a custom hook returns a new object on every render, strictly destructure its returned properties to explicitly pass individual dependencies to the `useMemo` dependency array rather than the entire object itself.
