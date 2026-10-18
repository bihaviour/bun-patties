import * as React from "react";

const CountContext = React.createContext<{
	n: number;
	inc: () => void;
} | null>(null);

// Composed parts sharing context + function props: the shape island JSON props
// can't express, and the reason whole-tree hydration exists.
export function CounterRoot({
	start,
	children,
}: {
	start: number;
	children: React.ReactNode;
}) {
	const [n, setN] = React.useState(start);
	const value = React.useMemo(
		() => ({ n, inc: () => setN((v) => v + 1) }),
		[n],
	);
	return (
		<CountContext.Provider value={value}>{children}</CountContext.Provider>
	);
}

export function CounterButton({ onPress }: { onPress?: (n: number) => void }) {
	const ctx = React.useContext(CountContext);
	if (!ctx) throw new Error("CounterButton outside CounterRoot");
	return (
		<button
			type="button"
			onClick={() => {
				ctx.inc();
				onPress?.(ctx.n + 1);
			}}
		>
			count: {ctx.n}
		</button>
	);
}
