---
spec: ui/31-input-otp
title: Input OTP
status: completed
island: true
peer_deps: ["input-otp"]
last_reviewed: 2026-05-23
---

# Input OTP

## Purpose

One-time-passcode segmented input. Mirrors shadcn `InputOTP`. Built on `input-otp`.

## Island model

`island: true`. Caret tracking, paste handling, and per-slot focus management require client JS.

## Peer dependencies

- `input-otp@^1.4`

## Public API

```ts
export function InputOTP(props: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }): JSX.Element
export function InputOTPGroup(props: React.ComponentProps<"div">): JSX.Element
export function InputOTPSlot(props: { index: number; className?: string } & React.ComponentProps<"div">): JSX.Element
export function InputOTPSeparator(props: React.ComponentProps<"div">): JSX.Element

export const island = true
```

## Patties adjustments

- Removes `forwardRef`.
- A hidden `<input>` (provided by `input-otp`) carries the value into native form submission.

## Acceptance criteria

- Typing fills slots left-to-right.
- Pasting a code distributes characters across slots.
- Backspace moves focus to the previous slot.
- Form submit includes the assembled OTP string.
