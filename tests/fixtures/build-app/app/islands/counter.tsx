import * as React from "react";

export default function Counter(props: { start?: number }) {
	const [n, setN] = React.useState(props.start ?? 0);
	return <button onClick={() => setN(n + 1)}>count: {n}</button>;
}
